import React, { useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { Eye, EyeOff } from "lucide-react";
import Logomark from "./Logomark";
import { useAuth } from "../context/AuthContext";
import "./Login.css";

const ERROR_MESSAGES = {
  "auth/invalid-credential": "E-mail ou senha incorretos.",
  "auth/wrong-password": "E-mail ou senha incorretos.",
  "auth/user-not-found": "E-mail ou senha incorretos.",
  "auth/invalid-email": "Esse e-mail não parece válido.",
  "auth/email-already-in-use": "Já existe uma conta com esse e-mail. Tente entrar.",
  "auth/weak-password": "A senha precisa ter pelo menos 6 caracteres.",
  "auth/too-many-requests": "Muitas tentativas. Aguarde um pouco e tente de novo.",
  "auth/network-request-failed": "Sem conexão. Verifique sua internet.",
};

export default function Login() {
  const { user, status, login, register, resetPassword } = useAuth();
  const navigate = useNavigate();
  const [mode, setMode] = useState("login"); // login | register
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // Someone already signed in has nothing to do here.
  if (status === "ready" && user && !submitting) return <Navigate to="/chat" replace />;

  const isRegister = mode === "register";

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setNotice("");
    setSubmitting(true);
    try {
      await (isRegister ? register(email, password) : login(email, password));
      navigate("/chat", { replace: true });
    } catch (err) {
      setError(ERROR_MESSAGES[err.code] || "Algo deu errado. Tente novamente.");
      setSubmitting(false);
    }
  }

  async function handleForgot() {
    setError("");
    setNotice("");
    if (!email) {
      setError("Digite seu e-mail acima para receber o link de redefinição.");
      return;
    }
    try {
      await resetPassword(email);
      setNotice(`Enviamos um link de redefinição para ${email}.`);
    } catch (err) {
      setError(ERROR_MESSAGES[err.code] || "Não foi possível enviar o link agora.");
    }
  }

  function toggleMode() {
    setMode(isRegister ? "login" : "register");
    setError("");
    setNotice("");
  }

  return (
    <div className="login-screen">
      <div className="login-glow" />
      <div className="login-inner">
        <div className="login-brand">
          <Logomark size={30} />
          <span>
            Mobíl<em>IA</em>
          </span>
        </div>

        <h1>{isRegister ? "Crie sua conta" : "Bem-vindo de volta"}</h1>
        <p className="login-sub">
          {isRegister
            ? "Desenhe móveis sob medida conversando com a IA."
            : "Entre para continuar seus projetos."}
        </p>

        <form onSubmit={handleSubmit} className="login-card">
          <div className="field">
            <label htmlFor="email">E-mail</label>
            <input
              id="email"
              type="email"
              autoComplete="email"
              inputMode="email"
              autoFocus
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="voce@email.com"
            />
          </div>
          <div className="field">
            <label htmlFor="password">Senha</label>
            <div className="password-wrap">
              <input
                id="password"
                type={showPassword ? "text" : "password"}
                autoComplete={isRegister ? "new-password" : "current-password"}
                minLength={6}
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={isRegister ? "Mínimo de 6 caracteres" : "••••••••"}
              />
              <button
                type="button"
                className="reveal-btn"
                onClick={() => setShowPassword((v) => !v)}
                aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}
              >
                {showPassword ? <EyeOff size={17} /> : <Eye size={17} />}
              </button>
            </div>
          </div>

          {error && <div className="login-error" role="alert">{error}</div>}
          {notice && <div className="login-notice" role="status">{notice}</div>}

          {!isRegister && (
            <button type="button" className="forgot-link" onClick={handleForgot}>
              Esqueceu sua senha?
            </button>
          )}
          <button type="submit" className="btn-primary" disabled={submitting}>
            {submitting
              ? isRegister ? "Criando conta..." : "Entrando..."
              : isRegister ? "Criar conta" : "Entrar"}
          </button>
        </form>

        <div className="login-foot">
          {isRegister ? "Já tem conta?" : "Ainda não tem conta?"}{" "}
          <button type="button" onClick={toggleMode}>
            {isRegister ? "Entrar" : "Cadastre-se"}
          </button>
        </div>
      </div>
    </div>
  );
}
