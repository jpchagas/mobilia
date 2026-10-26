import React, { useEffect, useRef, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  Menu,
  SquarePen,
  ImagePlus,
  ArrowUp,
  X,
  RotateCcw,
  Tv,
  Shirt,
  Library,
  CookingPot,
  Camera,
} from "lucide-react";
import { doc, addDoc, updateDoc, onSnapshot, collection, serverTimestamp } from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { db, storage } from "../firebase";
import { useAuth } from "../context/AuthContext";
import { sendMessage } from "../services/aiClient";
import ProjectsDrawer from "./ProjectsDrawer";
import DesignCard from "./DesignCard";
import Logomark from "./Logomark";
import "./ChatScreen.css";

// One tap on a suggestion starts the conversation with that prompt.
const SUGGESTIONS = [
  { icon: Tv, label: "Painel de TV", prompt: "Quero criar um painel de TV para a minha sala." },
  { icon: Shirt, label: "Guarda-roupa", prompt: "Preciso de um guarda-roupa sob medida para o quarto." },
  { icon: Library, label: "Estante", prompt: "Quero uma estante para livros e objetos decorativos." },
  { icon: CookingPot, label: "Cozinha", prompt: "Quero planejar os armários da minha cozinha." },
];

// Phone photos are often 4000px+ and several MB; the AI doesn't need that.
// Downscale to a JPEG before upload (falls back to the original file).
async function prepareRoomPhoto(file) {
  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, 1600 / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    canvas.getContext("2d").drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close();
    const blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.85));
    return blob ? { data: blob, name: "foto.jpg" } : { data: file, name: file.name };
  } catch {
    return { data: file, name: file.name };
  }
}

export default function ChatScreen() {
  const { user } = useAuth();
  const { projectId } = useParams();
  const navigate = useNavigate();

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [messages, setMessages] = useState([]);
  const [projectName, setProjectName] = useState("");
  const [loadingProject, setLoadingProject] = useState(false);
  const [input, setInput] = useState("");
  const [pendingPhoto, setPendingPhoto] = useState(null); // { file, previewUrl }
  const [sending, setSending] = useState(false);
  const [failed, setFailed] = useState(null); // { message, retry? } — never persisted
  const bodyRef = useRef(null);
  const fileInputRef = useRef(null);
  const textareaRef = useRef(null);
  // Project we just created from /chat; navigating to it shouldn't blank
  // the screen while the first snapshot arrives.
  const createdIdRef = useRef(null);

  // Load an existing project's messages, or start a fresh in-memory
  // conversation for a brand-new one.
  useEffect(() => {
    setFailed(null);
    if (!projectId) {
      setMessages([]);
      setProjectName("");
      setLoadingProject(false);
      return;
    }
    if (projectId !== createdIdRef.current) {
      setMessages([]);
      setLoadingProject(true);
    }
    const unsubscribe = onSnapshot(
      doc(db, "projects", projectId),
      (snap) => {
        if (snap.exists()) {
          setMessages(snap.data().messages || []);
          setProjectName(snap.data().name || "");
        }
        setLoadingProject(false);
      },
      () => setLoadingProject(false)
    );
    return unsubscribe;
  }, [projectId]);

  useEffect(() => {
    bodyRef.current?.scrollTo({ top: bodyRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, sending, failed]);

  // Grow the composer with its content, up to a few lines.
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 140)}px`;
  }, [input]);

  function handlePickPhoto(e) {
    const file = e.target.files?.[0];
    e.target.value = ""; // allow picking the same file again
    if (!file) return;
    if (pendingPhoto) URL.revokeObjectURL(pendingPhoto.previewUrl);
    setPendingPhoto({ file, previewUrl: URL.createObjectURL(file) });
    textareaRef.current?.focus();
  }

  function removePendingPhoto() {
    URL.revokeObjectURL(pendingPhoto.previewUrl);
    setPendingPhoto(null);
  }

  async function persistProject(nextMessages) {
    if (projectId) {
      await updateDoc(doc(db, "projects", projectId), {
        messages: nextMessages,
        updatedAt: serverTimestamp(),
      });
      return projectId;
    }
    const firstText = nextMessages.find((m) => m.role === "user" && m.text)?.text;
    const docRef = await addDoc(collection(db, "projects"), {
      ownerId: user.uid,
      name: firstText?.slice(0, 40) || "Novo projeto",
      messages: nextMessages,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    createdIdRef.current = docRef.id;
    navigate(`/chat/${docRef.id}`, { replace: true });
    return docRef.id;
  }

  async function requestReply(nextMessages) {
    setSending(true);
    setFailed(null);
    try {
      const { reply, designSpec } = await sendMessage(
        nextMessages.map((m) => ({
          role: m.role,
          content: m.text,
          ...(m.photoUrl && { imageUrl: m.photoUrl }),
          ...(m.designSpec && { designSpec: m.designSpec }),
        }))
      );
      const aiMessage = { role: "assistant", text: reply, designSpec: designSpec || null };
      const withReply = [...nextMessages, aiMessage];
      setMessages(withReply);
      await persistProject(withReply);
    } catch (err) {
      setFailed({
        message: "Não consegui responder agora.",
        retry: () => requestReply(nextMessages),
      });
    } finally {
      setSending(false);
    }
  }

  async function handleSend(textOverride) {
    const text = (typeof textOverride === "string" ? textOverride : input).trim();
    if ((!text && !pendingPhoto) || sending) return;

    const photo = pendingPhoto;
    const base = messages;
    setSending(true);
    setFailed(null);
    setInput("");
    setPendingPhoto(null);
    // Show the message right away, with the local preview while it uploads.
    setMessages([...base, { role: "user", text, photoUrl: photo?.previewUrl || null }]);

    let photoUrl = null;
    if (photo) {
      try {
        const { data, name } = await prepareRoomPhoto(photo.file);
        const storageRef = ref(storage, `rooms/${user.uid}/${Date.now()}-${name}`);
        await uploadBytes(storageRef, data);
        photoUrl = await getDownloadURL(storageRef);
      } catch (err) {
        // Put everything back so sending again is a single tap.
        setMessages(base);
        setInput(text);
        setPendingPhoto(photo);
        setFailed({ message: "Não consegui enviar a foto. Verifique sua conexão." });
        setSending(false);
        return;
      }
    }

    const nextMessages = [...base, { role: "user", text, photoUrl }];
    setMessages(nextMessages);
    if (photo) URL.revokeObjectURL(photo.previewUrl);
    await requestReply(nextMessages);
  }

  function startNewProject() {
    setDrawerOpen(false);
    if (projectId) {
      navigate("/chat");
      return;
    }
    // Already on an unsaved /chat: navigating to the same URL changes
    // nothing, so clear the draft conversation here instead.
    setMessages([]);
    setFailed(null);
    setInput("");
    if (pendingPhoto) removePendingPhoto();
  }

  function handleKeyDown(e) {
    if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      handleSend();
    }
  }

  const isWelcome = !projectId && messages.length === 0;
  const canSend = (input.trim() || pendingPhoto) && !sending;

  return (
    <div className="chat-screen">
      <header className="chat-head">
        <button className="icon-btn" onClick={() => setDrawerOpen(true)} aria-label="Abrir projetos">
          <Menu size={20} />
        </button>
        <span className="chat-title">
          {projectId ? projectName : (
            <>
              Mobíl<em>IA</em>
            </>
          )}
        </span>
        <button className="icon-btn" onClick={startNewProject} aria-label="Novo projeto">
          <SquarePen size={19} />
        </button>
      </header>

      <div className="chat-body" ref={bodyRef}>
        <div className="chat-column">
          {isWelcome && (
            <section className="welcome">
              <div className="welcome-mark">
                <Logomark size={34} />
              </div>
              <h1>Qual móvel vamos criar hoje?</h1>
              <p>
                Conte sua ideia ou envie uma foto do ambiente. A IA desenha o móvel com você
                e prepara tudo para a fabricação.
              </p>

              <button className="welcome-photo" onClick={() => fileInputRef.current?.click()}>
                <span className="welcome-photo-icon">
                  <Camera size={20} />
                </span>
                <span>
                  <strong>Começar com uma foto</strong>
                  <small>Tire ou escolha uma foto do espaço</small>
                </span>
              </button>

              <div className="suggestions">
                {SUGGESTIONS.map(({ icon: Icon, label, prompt }) => (
                  <button key={label} className="suggestion" onClick={() => handleSend(prompt)}>
                    <Icon size={18} />
                    <span>{label}</span>
                  </button>
                ))}
              </div>
            </section>
          )}

          {loadingProject && (
            <div className="row ai">
              <div className="avatar"><Logomark size={15} /></div>
              <div className="typing" aria-label="Carregando"><i /><i /><i /></div>
            </div>
          )}

          {messages.map((m, i) =>
            m.role === "user" ? (
              <div className="row user" key={i}>
                <div className="bubble user">
                  {m.photoUrl && <img className="bubble-photo" src={m.photoUrl} alt="Foto do ambiente" />}
                  {m.text && <div className="bubble-text">{m.text}</div>}
                </div>
              </div>
            ) : (
              <div className="row ai" key={i}>
                <div className="avatar"><Logomark size={15} /></div>
                <div className="ai-content">
                  {m.text && <div className="bubble ai">{m.text}</div>}
                  {m.designSpec && <DesignCard designSpec={m.designSpec} />}
                </div>
              </div>
            )
          )}

          {sending && (
            <div className="row ai">
              <div className="avatar"><Logomark size={15} /></div>
              <div className="typing" aria-label="A IA está digitando"><i /><i /><i /></div>
            </div>
          )}

          {failed && (
            <div className="row ai">
              <div className="avatar"><Logomark size={15} /></div>
              <div className="error-bubble" role="alert">
                <span>{failed.message}</span>
                {failed.retry && (
                  <button onClick={failed.retry}>
                    <RotateCcw size={14} /> Tentar novamente
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="composer-wrap">
        <div className="composer">
          {pendingPhoto && (
            <div className="pending-photo">
              <img src={pendingPhoto.previewUrl} alt="Foto do ambiente" />
              <button onClick={removePendingPhoto} aria-label="Remover foto">
                <X size={13} />
              </button>
            </div>
          )}
          <div className="composer-row">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              hidden
              onChange={handlePickPhoto}
            />
            <button
              className="icon-btn"
              onClick={() => fileInputRef.current?.click()}
              aria-label="Anexar foto do espaço"
            >
              <ImagePlus size={20} />
            </button>
            <textarea
              ref={textareaRef}
              rows={1}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={pendingPhoto ? "Conte o que quer para esse espaço..." : "Descreva o móvel ou o espaço..."}
            />
            <button className="send-btn" onClick={() => handleSend()} disabled={!canSend} aria-label="Enviar">
              <ArrowUp size={18} strokeWidth={2.4} />
            </button>
          </div>
        </div>
      </div>

      <ProjectsDrawer
        open={drawerOpen}
        activeId={projectId}
        onClose={() => setDrawerOpen(false)}
        onSelectProject={(id) => {
          navigate(`/chat/${id}`);
          setDrawerOpen(false);
        }}
        onNewProject={startNewProject}
      />
    </div>
  );
}
