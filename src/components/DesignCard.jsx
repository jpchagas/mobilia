import React, { useState } from "react";
import { Package, ChevronRight, Check } from "lucide-react";
import { createFabricationOrder } from "../services/cortecloud";
import "./DesignCard.css";

export default function DesignCard({ designSpec }) {
  const [status, setStatus] = useState("idle"); // idle | sending | sent | error

  async function handleSend() {
    setStatus("sending");
    try {
      await createFabricationOrder(designSpec);
      setStatus("sent");
    } catch (err) {
      setStatus("error");
    }
  }

  return (
    <div className="design-card">
      <div className="render">
        <Package size={26} color="var(--clay)" />
      </div>
      <h4>{designSpec.name}</h4>
      <p>{designSpec.summary}</p>

      {status === "sent" ? (
        <div className="sent-confirmation">
          <Check size={14} /> Enviado para a Cortecloud
        </div>
      ) : (
        <button className="cortecloud-btn" onClick={handleSend} disabled={status === "sending"}>
          {status === "sending" ? "Enviando..." : "Enviar para fabricação"}
          {status !== "sending" && <ChevronRight size={14} />}
        </button>
      )}
      {status === "error" && (
        <div className="send-error">Não foi possível enviar agora. Tente novamente.</div>
      )}
    </div>
  );
}
