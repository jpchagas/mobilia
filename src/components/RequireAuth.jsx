import React from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export default function RequireAuth({ children }) {
  const { user, status } = useAuth();
  if (status !== "ready") return null; // splash/auth check is still resolving
  if (!user) return <Navigate to="/login" replace />;
  return children;
}
