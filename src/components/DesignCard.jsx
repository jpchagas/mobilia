import React, { useState } from "react";
import { Package, Check, Sparkles, ClipboardCopy, Download } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { copyPartsForCortecloud, downloadCortecloudSheet } from "../services/cortecloudExport";
import "./DesignCard.css";

const cm = (mm) => `${Math.round(mm / 10)}`;

export default function DesignCard({ designSpec }) {
  const { user } = useAuth();
  const [copyStatus, setCopyStatus] = useState("idle"); // idle | copied | error
  const [downloading, setDownloading] = useState(false);
  const [downloadError, setDownloadError] = useState(false);
  const hasParts = designSpec.parts?.length > 0;

  async function handleCopy() {
    try {
      await copyPartsForCortecloud(designSpec);
      setCopyStatus("copied");
    } catch (err) {
      setCopyStatus("error");
    }
  }

  async function handleDownload() {
    setDownloading(true);
    setDownloadError(false);
    try {
      await downloadCortecloudSheet(designSpec, user?.displayName || user?.email);
    } catch (err) {
      setDownloadError(true);
    } finally {
      setDownloading(false);
    }
  }

  return (
    <div className="design-card">
      <div className="render">
        <span className="render-badge">
          <Sparkles size={12} /> Design pronto
        </span>
        <Package size={34} strokeWidth={1.4} />
      </div>
      <div className="design-info">
        <h4>{designSpec.name}</h4>
        {designSpec.summary && <p>{designSpec.summary}</p>}

        <div className="spec-chips">
          {designSpec.widthMm && designSpec.heightMm && designSpec.depthMm && (
            <span>
              {cm(designSpec.widthMm)} × {cm(designSpec.heightMm)} × {cm(designSpec.depthMm)} cm
            </span>
          )}
          {designSpec.material && (
            <span>
              {designSpec.material}
              {designSpec.thicknessMm ? ` ${designSpec.thicknessMm} mm` : ""}
            </span>
          )}
          {hasParts && <span>{designSpec.parts.length} peças</span>}
          {designSpec.components?.length > 0 && (
            <span>{designSpec.components.length} ferragens</span>
          )}
        </div>

        {hasParts ? (
          <>
            {copyStatus === "copied" ? (
              <div className="sent-confirmation">
                <Check size={16} /> Peças copiadas
              </div>
            ) : (
              <button className="cortecloud-btn" onClick={handleCopy}>
                <ClipboardCopy size={16} /> Copiar para o Cortecloud
              </button>
            )}
            <button className="secondary-btn" onClick={handleDownload} disabled={downloading}>
              <Download size={16} /> {downloading ? "Gerando planilha..." : "Baixar planilha (.xlsx)"}
            </button>

            {copyStatus === "copied" && (
              <ol className="import-steps">
                <li>No Cortecloud, crie ou abra um serviço completo.</li>
                <li>Toque em <b>Importar peças</b> → <b>Colar dados da planilha ou Excel</b>.</li>
                <li>Cole as peças e vincule cada chapa e fita aos materiais.</li>
              </ol>
            )}
            {copyStatus === "error" && (
              <div className="send-error">Não foi possível copiar. Use a planilha.</div>
            )}
            {downloadError && (
              <div className="send-error">Não foi possível gerar a planilha. Tente novamente.</div>
            )}
          </>
        ) : (
          <div className="send-error">
            Este projeto ainda não tem a lista de peças. Peça à IA para detalhar as peças de corte.
          </div>
        )}
      </div>
    </div>
  );
}
