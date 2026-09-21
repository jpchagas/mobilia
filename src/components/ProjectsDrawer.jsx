import React from "react";
import { X, Plus, Clock } from "lucide-react";
import { useProjects } from "../hooks/useProjects";
import "./ProjectsDrawer.css";

function timeAgo(timestamp) {
  if (!timestamp) return "";
  const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
  const diffMs = Date.now() - date.getTime();
  const days = Math.floor(diffMs / 86400000);
  if (days <= 0) return "hoje";
  if (days === 1) return "ontem";
  if (days < 14) return `${days} dias atrás`;
  return `${Math.floor(days / 7)} semanas atrás`;
}

export default function ProjectsDrawer({ open, onClose, onSelectProject, onNewProject }) {
  const { projects, loading } = useProjects();

  return (
    <>
      <div className={`scrim${open ? " open" : ""}`} onClick={onClose} />
      <aside className={`drawer${open ? " open" : ""}`} aria-hidden={!open}>
        <div className="drawer-head">
          <span>Meus projetos</span>
          <button className="icon-btn" onClick={onClose} aria-label="Fechar menu">
            <X size={17} />
          </button>
        </div>

        <button className="new-project" onClick={onNewProject}>
          <Plus size={14} /> Novo projeto
        </button>

        <div className="drawer-label">RECENTES</div>

        {loading && <div className="drawer-empty">Carregando...</div>}
        {!loading && projects.length === 0 && (
          <div className="drawer-empty">Seus projetos aparecerão aqui assim que você começar a conversar com a IA.</div>
        )}

        {projects.map((p) => (
          <button className="project-item" key={p.id} onClick={() => onSelectProject(p.id)}>
            <div className="project-thumb" />
            <div>
              <div className="pname">{p.name || "Projeto sem nome"}</div>
              <div className="pdate">
                <Clock size={10} /> {timeAgo(p.updatedAt)}
              </div>
            </div>
          </button>
        ))}
      </aside>
    </>
  );
}
