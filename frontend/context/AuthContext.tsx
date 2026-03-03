"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";
import * as authApi from "@/lib/auth-api";

const TOKEN_KEY = "cce_token";

interface AuthContextType {
  token: string | null;
  user: { id: number; username: string } | null;
  login: (username: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  register: (username: string, password: string, email?: string) => Promise<any>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [token, setToken] = useState<string | null>(null);
  const [user, setUser] = useState<{ id: number; username: string } | null>(null);

  useEffect(() => {
    const stored = localStorage.getItem(TOKEN_KEY);
    if (stored) setToken(stored);
  }, []);

  const saveToken = (t: string | null) => {
    setToken(t);
    if (t) localStorage.setItem(TOKEN_KEY, t);
    else localStorage.removeItem(TOKEN_KEY);
  };

  const login = useCallback(async (username: string, password: string) => {
    const res = await fetch("http://localhost:8080/api/auth/login/", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password }),
    });
    if (!res.ok) throw new Error("Credenciales inválidas");
    const data = await res.json();
    saveToken(data.token);
    setUser({ id: data.user_id, username: data.username });
    window.dispatchEvent(new CustomEvent("auth:changed"));
  }, []);

  const logout = useCallback(async () => {
    if (token) await authApi.logout(token).catch(() => null);
    saveToken(null);
    setUser(null);
    window.dispatchEvent(new CustomEvent("auth:changed"));
  }, [token]);

  const register = useCallback(async (username: string, password: string, email?: string) => {
    const res = await authApi.register({ username, password, email });
    if (res.token) {
      saveToken(res.token);
      setUser({ id: res.user_id, username: res.username });
      window.dispatchEvent(new CustomEvent("auth:changed"));
    }
    return res;
  }, []);

  return (
    <AuthContext.Provider value={{ token, user, login, logout, register }}>
      {children}
    </AuthContext.Provider>
  );
}

export default function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used inside AuthProvider");
  return context;
}