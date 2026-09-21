import React, { useEffect, useRef, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Menu, Plus, Camera, Send, Image as ImageIcon } from "lucide-react";
import { doc, addDoc, updateDoc, onSnapshot, collection, serverTimestamp } from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { db, storage } from "../firebase";
import { useAuth } from "../context/AuthContext";
import { sendMessage } from "../services/aiClient";
import ProjectsDrawer from "./ProjectsDrawer";
import DesignCard from "./DesignCard";
import "./ChatScreen.css";

export default function ChatScreen() {
  const { user } = useAuth();
  const { projectId } = useParams();
  const navigate = useNavigate();

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [pendingPhoto, setPendingPhoto] = useState(null); // { file, previewUrl }
  const [sending, setSending] = useState(false);
  const bodyRef = useRef(null);
  const fileInputRef = useRef(null);

  // Load an existing project's messages, or start a fresh in-memory
  // conversation for a brand-new one.
  useEffect(() => {
    if (!projectId) {
      setMessages([
        { role: "assistant", text: "Oi! Sobre qual espaço da sua casa vamos criar um móvel hoje?" },
      ]);
      return;
    }
    const unsubscribe = onSnapshot(doc(db, "projects", projectId), (snap) => {
      if (snap.exists()) setMessages(snap.data().messages || []);
    });
    return unsubscribe;
  }, [projectId]);

  useEffect(() => {
    bodyRef.current?.scrollTo({ top: bodyRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  function handlePickPhoto(e) {
    const file = e.target.files?.[0];
    if (file) setPendingPhoto({ file, previewUrl: URL.createObjectURL(file) });
  }

  async function persistProject(nextMessages) {
    if (projectId) {
      await updateDoc(doc(db, "projects", projectId), {
        messages: nextMessages,
        updatedAt: serverTimestamp(),
      });
      return projectId;
    }
    const docRef = await addDoc(collection(db, "projects"), {
      ownerId: user.uid,
      name: nextMessages[1]?.text?.slice(0, 40) || "Novo projeto",
      messages: nextMessages,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    navigate(`/chat/${docRef.id}`, { replace: true });
    return docRef.id;
  }

  async function handleSend() {
    if (!input.trim() && !pendingPhoto) return;
    setSending(true);

    let photoUrl = null;
    if (pendingPhoto) {
      const path = `rooms/${user.uid}/${Date.now()}-${pendingPhoto.file.name}`;
      const storageRef = ref(storage, path);
      await uploadBytes(storageRef, pendingPhoto.file);
      photoUrl = await getDownloadURL(storageRef);
    }

    const userMessage = { role: "user", text: input.trim(), photoUrl };
    const nextMessages = [...messages, userMessage];
    setMessages(nextMessages);
    setInput("");
    setPendingPhoto(null);

    try {
      const { reply, designSpec } = await sendMessage(
        nextMessages.map((m) => ({ role: m.role, content: m.text })),
        photoUrl ? { imageUrl: photoUrl } : {}
      );
      const aiMessage = { role: "assistant", text: reply, designSpec: designSpec || null };
      const withReply = [...nextMessages, aiMessage];
      setMessages(withReply);
      await persistProject(withReply);
    } catch (err) {
      const errorMessage = {
        role: "assistant",
        text: "Não consegui responder agora. Tente novamente em instantes.",
      };
      setMessages([...nextMessages, errorMessage]);
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="chat-screen">
      <header className="chat-head">
        <button className="icon-btn" onClick={() => setDrawerOpen(true)} aria-label="Abrir projetos">
          <Menu size={19} />
        </button>
        <span className="chat-title">MobílIA</span>
        <button className="icon-btn" onClick={() => navigate("/chat")} aria-label="Novo projeto">
          <Plus size={19} />
        </button>
      </header>

      <div className="chat-body" ref={bodyRef}>
        {messages.map((m, i) => (
          <div className={`bubble-row ${m.role === "user" ? "user" : ""}`} key={i}>
            {m.designSpec ? (
              <div className="bubble-with-card">
                <div className="bubble ai">{m.text}</div>
                <DesignCard designSpec={m.designSpec} />
              </div>
            ) : (
              <div className={`bubble ${m.role === "user" ? "user" : "ai"}`}>
                {m.text}
                {m.photoUrl && (
                  <div className="photo-chip">
                    <ImageIcon size={13} /> foto anexada
                  </div>
                )}
              </div>
            )}
          </div>
        ))}
        {sending && (
          <div className="bubble-row">
            <div className="bubble ai typing">digitando...</div>
          </div>
        )}
      </div>

      {pendingPhoto && (
        <div className="pending-photo">
          <img src={pendingPhoto.previewUrl} alt="Foto do ambiente" />
          <button onClick={() => setPendingPhoto(null)}>remover</button>
        </div>
      )}

      <div className="chat-input">
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          hidden
          onChange={handlePickPhoto}
        />
        <button
          className="icon-btn photo-btn"
          onClick={() => fileInputRef.current?.click()}
          aria-label="Anexar foto do espaço"
        >
          <Camera size={17} />
        </button>
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleSend()}
          placeholder="Descreva o móvel ou o espaço..."
        />
        <button className="send-btn" onClick={handleSend} disabled={sending} aria-label="Enviar">
          <Send size={15} />
        </button>
      </div>

      <ProjectsDrawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        onSelectProject={(id) => {
          navigate(`/chat/${id}`);
          setDrawerOpen(false);
        }}
        onNewProject={() => {
          navigate("/chat");
          setDrawerOpen(false);
        }}
      />
    </div>
  );
}
