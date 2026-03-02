"use client";

import { useCallback, useEffect, useState } from "react";
import * as authApi from "@/lib/auth-api";

const TOKEN_KEY = "cce_token";

export default function useAuth() {
  // start with null; the true value lives in localStorage and will be
  // populated after the component mounts on the client. Initializing from
  // localStorage directly inside useState causes the value to be `null` on
  // first render (because the SSR pass can't read window), and React won't
  // re-run the initializer during hydration, so the token would stay null
  // forever.
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
    const res = await authApi.login({ username, password });
    if (res.token) {
      saveToken(res.token);
      setUser({ id: res.user_id, username: res.username });
    }
    return res;
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
