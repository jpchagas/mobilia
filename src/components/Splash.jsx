import React, { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import Logomark from "./Logomark";
import { useAuth } from "../context/AuthContext";
import "./Splash.css";

export default function Splash() {
  const { user, status } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (status !== "ready") return;
    // Small delay so the splash reads as a moment, not a flicker,
    // even when auth resolves instantly from cache.
    const timer = setTimeout(() => {
      navigate(user ? "/chat" : "/login", { replace: true });
    }, 900);
    return () => clearTimeout(timer);
  }, [status, user, navigate]);

  return (
    <div className="splash">
      <div className="splash-glow" />
      <Logomark size={56} />
      <div className="splash-text">
        <div className="splash-wordmark">
          Mobíl<span>IA</span>
        </div>
        <div className="splash-tagline">desenhe o móvel que você imagina</div>
      </div>
    </div>
  );
}
