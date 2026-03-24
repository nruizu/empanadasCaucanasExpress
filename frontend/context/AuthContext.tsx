"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";
import * as authApi from "@/lib/auth-api";

const TOKEN_KEY = "cce_token";

interface AuthContextType {
  token: string | null;
  user: { id: number; username: string; is_staff: boolean } | null;
  login: (username: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  register: (username: string, password: string, email?: string) => Promise<unknown>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [token, setToken] = useState<string | null>(null);
  const [user, setUser] = useState<{ id: number; username: string; is_staff: boolean } | null>(null);

  const saveToken = (t: string | null) => {
    setToken(t);
    if (t) localStorage.setItem(TOKEN_KEY, t);
    else localStorage.removeItem(TOKEN_KEY);
  };

  useEffect(() => {
    const stored = localStorage.getItem(TOKEN_KEY);
    if (stored) setToken(stored);
  }, []);

  useEffect(() => {
    if (!token) {
      setUser(null);
      return;
    }

    let cancelled = false;

    const loadCurrentUser = async () => {
      try {
        const data = await authApi.me(token);
        if (cancelled) return;
        setUser({
          id: data.user_id,
          username: data.username,
          is_staff: Boolean(data.is_staff),
        });
      } catch {
        if (cancelled) return;
        saveToken(null);
        setUser(null);
      }
    };

    void loadCurrentUser();

    return () => {
      cancelled = true;
    };
  }, [token]);

  const login = useCallback(async (username: string, password: string) => {
    const data = await authApi.login({ username, password });
    saveToken(data.token);
    setUser({
      id: data.user_id,
      username: data.username,
      is_staff: Boolean(data.is_staff),
    });
    window.dispatchEvent(new CustomEvent("auth:changed"));
  }, []);

  const logout = useCallback(async () => {
    if (token) await authApi.logout(token).catch(() => null);
    saveToken(null);
    setUser(null);
    window.dispatchEvent(new CustomEvent("auth:changed"));
  }, [token]);

  const register = useCallback(async (username: string, password: string, email?: string) => {
    const data = await authApi.register({ username, password, email }); // si falla, throw llega al catch de RegisterPage
    saveToken(data.token);
    setUser({
      id: data.user_id,
      username: data.username,
      is_staff: Boolean(data.is_staff),
    });
    window.dispatchEvent(new CustomEvent("auth:changed"));
    return data;
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