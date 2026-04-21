"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import useAuth from "@/context/AuthContext";

export default function LoginPage() {
  const { login } = useAuth();
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await login(username, password);
      router.push('/catalogo');
    } catch (err: any) {
      setError(err.message || 'Login failed');
    }
  };

  return (
    <main className="min-h-screen bg-[var(--background)] px-4 py-10 md:px-10">
      <div className="mx-auto flex max-w-5xl items-center justify-center">
        <form
          onSubmit={handleSubmit}
          className="w-full max-w-md rounded-2xl bg-white p-7 shadow-[0_8px_30px_rgba(31,92,58,0.08)]"
        >
          <h2 className="text-2xl font-bold text-[var(--primary)]">Iniciar sesión</h2>
          <p className="mt-1 text-sm text-[var(--muted-foreground)]">Accede para continuar con tu pedido.</p>

          {error && <div className="mt-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>}

          <div className="mt-5 space-y-4">
            <input
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Usuario"
              className="w-full rounded-lg border border-[color-mix(in_srgb,var(--primary)_18%,white)] bg-white px-3 py-2.5 outline-none focus:border-[var(--primary)]"
            />
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Contraseña"
              className="w-full rounded-lg border border-[color-mix(in_srgb,var(--primary)_18%,white)] bg-white px-3 py-2.5 outline-none focus:border-[var(--primary)]"
            />
          </div>

          <button className="mt-5 w-full rounded-lg bg-[var(--primary)] py-2.5 font-semibold text-white transition-colors hover:bg-[color-mix(in_srgb,var(--primary)_90%,black)]">
            Entrar
          </button>
        </form>
      </div>
    </main>
  );
}
