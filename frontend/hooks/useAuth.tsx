"use client";

import { useCallback, useEffect, useState } from "react";
import * as authApi from "@/lib/auth-api";

const TOKEN_KEY = "cce_token";

export default function useAuth() {
  const [token, setToken] = useState<string | null>(null);
  const [user, setUser] = useState<{ id: number; username: string } | null>(null);

  useEffect(() => {
    // read localStorage after mount so the value is available on client
    const stored = localStorage.getItem(TOKEN_KEY);
    if (stored) {
      setToken(stored);
      // user info was already saved in login/register; leave user as-is
    }
  }, []);

  useEffect(() => {
    if (token) {
      // we don't fetch user details now; store token and basic info in login response
    }
  }, [token]);

  const saveToken = useCallback((t: string | null) => {
    setToken(t);
    if (typeof window !== "undefined") {
      if (t) localStorage.setItem(TOKEN_KEY, t);
      else localStorage.removeItem(TOKEN_KEY);
    }
  }, []);

const login = useCallback(async (username: string, password: string) => {
  const res = await fetch("http://localhost:8080/api/auth/login/", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ username, password }),
  });

  if (!res.ok) {
    throw new Error("Credenciales inválidas");
  }

  const data = await res.json();

  // ✅ usar la MISMA key definida arriba
  saveToken(data.token);

  // ✅ guardar usuario correctamente
  setUser({
    id: data.user_id,
    username: data.username,
  });
}, [saveToken]);

  const register = useCallback(async (username: string, password: string, email?: string) => {
    const res = await authApi.register({ username, password, email });
    if (res.token) {
      saveToken(res.token);
      setUser({ id: res.user_id, username: res.username });
    }
    return res;
  }, [saveToken]);

  const logout = useCallback(async () => {
    if (token) await authApi.logout(token).catch(() => null);
    saveToken(null);
    setUser(null);
  }, [token, saveToken]);

  return { token, user, login, logout, register };
}
