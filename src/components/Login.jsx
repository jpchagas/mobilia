import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import Logomark from "./Logomark";
import { useAuth } from "../context/AuthContext";
import "./Login.css";

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      await login(email, password);
      navigate("/chat", { replace: true });
    } catch (err) {
      setError("E-mail ou senha incorretos.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="login-screen">
      <Logomark size={30} />
      <h1>Bem-vindo de volta</h1>
      <p className="login-sub">Entre para continuar seus projetos</p>

      <form onSubmit={handleSubmit}>
        <div className="field">
          <label htmlFor="email">E-mail</label>
          <input
            id="email"
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="voce@email.com"
          />
        </div>
        <div className="field">
          <label htmlFor="password">Senha</label>
          <input
            id="password"
            type="password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </div>

        {error && <div className="login-error" role="alert">{error}</div>}

        <button type="button" className="forgot-link">Esqueceu sua senha?</button>
        <button type="submit" className="btn-primary" disabled={submitting}>
          {submitting ? "Entrando..." : "Entrar"}
        </button>
      </form>

      <div className="login-foot">
        Ainda não tem conta? <b>Cadastre-se</b>
      </div>
    </div>
  );
}
