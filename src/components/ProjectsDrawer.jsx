import React, { useEffect } from "react";
import { X, Plus, LogOut } from "lucide-react";
import Logomark from "./Logomark";
import { useProjects } from "../hooks/useProjects";
import { useAuth } from "../context/AuthContext";
import "./ProjectsDrawer.css";

function timeAgo(timestamp) {
  if (!timestamp) return "agora";
  const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
  const diffMs = Date.now() - date.getTime();
  const days = Math.floor(diffMs / 86400000);
  if (days <= 0) return "hoje";
  if (days === 1) return "ontem";
  if (days < 14) return `${days} dias atrás`;
  return `${Math.floor(days / 7)} semanas atrás`;
}

function firstPhoto(project) {
  return project.messages?.find((m) => m.photoUrl)?.photoUrl;
}

export default function ProjectsDrawer({ open, activeId, onClose, onSelectProject, onNewProject }) {
  const { projects, loading } = useProjects();
  const { user, logout } = useAuth();

  useEffect(() => {
    if (!open) return;
    const onKey = (e) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  return (
    <>
      <div className={`scrim${open ? " open" : ""}`} onClick={onClose} />
      <aside className={`drawer${open ? " open" : ""}`} aria-hidden={!open} inert={open ? undefined : ""}>
        <div className="drawer-head">
          <span className="drawer-brand">
            <Logomark size={22} />
            <span>
              Mobíl<em>IA</em>
            </span>
          </span>
          <button className="icon-btn" onClick={onClose} aria-label="Fechar menu">
            <X size={19} />
          </button>
        </div>

        <button className="new-project" onClick={onNewProject}>
          <Plus size={17} /> Novo projeto
        </button>

        <div className="drawer-label">Meus projetos</div>

        <div className="drawer-list">
          {loading && <div className="drawer-empty">Carregando...</div>}
          {!loading && projects.length === 0 && (
            <div className="drawer-empty">
              Seus projetos aparecerão aqui assim que você começar a conversar com a IA.
            </div>
          )}

          {projects.map((p) => {
            const photo = firstPhoto(p);
            return (
              <button
                className={`project-item${p.id === activeId ? " active" : ""}`}
                key={p.id}
                onClick={() => onSelectProject(p.id)}
              >
                <div
                  className="project-thumb"
                  style={photo ? { backgroundImage: `url("${photo}")` } : undefined}
                />
                <div className="project-meta">
                  <div className="pname">{p.name || "Projeto sem nome"}</div>
                  <div className="pdate">
                    {p.designSpec || p.messages?.some((m) => m.designSpec) ? "Design pronto · " : ""}
                    {timeAgo(p.updatedAt)}
                  </div>
                </div>
              </button>
            );
          })}
        </div>

        <div className="drawer-foot">
          <div className="account">
            <div className="account-avatar">{user?.email?.[0]?.toUpperCase() || "?"}</div>
            <span className="account-email">{user?.email}</span>
          </div>
          <button className="icon-btn" onClick={logout} aria-label="Sair">
            <LogOut size={18} />
          </button>
        </div>
      </aside>
    </>
  );
}
