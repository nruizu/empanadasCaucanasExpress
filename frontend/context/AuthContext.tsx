"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";
import * as authApi from "@/lib/auth-api";

const TOKEN_KEY = "cce_token";

interface AuthContextType {
  token: string | null;
  user: { id: number; username: string; is_staff: boolean } | null;
  login: (username: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  register: (
    username: string,
    password: string,
    email: string,
    full_name: string,
    phone: string,
    address: string,
  ) => Promise<unknown>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [token, setToken] = useState<string | null>(() => {
    if (typeof window === "undefined") {
      return null;
    }
    return localStorage.getItem(TOKEN_KEY);
  });
  const [user, setUser] = useState<{
    id: number;
    username: string;
    is_staff: boolean;
  } | null>(null);

  const saveToken = useCallback((t: string | null) => {
    setToken(t);
    if (t) {
      localStorage.setItem(TOKEN_KEY, t);
      return;
    }
    localStorage.removeItem(TOKEN_KEY);
    setUser(null);
  }, []);

  useEffect(() => {
    if (!token) {
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
  }, [token, saveToken]);

  const login = useCallback(
    async (username: string, password: string) => {
      const data = await authApi.login({ username, password });
      saveToken(data.token);
      setUser({
        id: data.user_id,
        username: data.username,
        is_staff: Boolean(data.is_staff),
      });
      window.dispatchEvent(new CustomEvent("auth:changed"));
    },
    [saveToken],
  );

  const logout = useCallback(async () => {
    if (token) await authApi.logout(token).catch(() => null);
    saveToken(null);
    setUser(null);
    window.dispatchEvent(new CustomEvent("auth:changed"));
  }, [token, saveToken]);

  const register = useCallback(
    async (
      username: string,
      password: string,
      email: string,
      full_name: string,
      phone: string,
      address: string,
    ) => {
      const data = await authApi.register({
        username,
        password,
        email,
        full_name,
        phone,
        address,
      }); // si falla, throw llega al catch de RegisterPage
      saveToken(data.token);
      setUser({
        id: data.user_id,
        username: data.username,
        is_staff: Boolean(data.is_staff),
      });
      window.dispatchEvent(new CustomEvent("auth:changed"));
      return data;
    },
    [saveToken],
  );

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
