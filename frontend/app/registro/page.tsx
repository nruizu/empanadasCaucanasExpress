"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import useAuth from "@/hooks/useAuth";

export default function RegisterPage() {
  const { register } = useAuth();
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await register(username, password, email);
      router.push('/catalogo');
    } catch (err: any) {
      setError(err.message || 'Register failed');
    }
  };

  return (
    <main className="min-h-screen flex items-center justify-center bg-[var(--cce-beige)]">
      <form onSubmit={handleSubmit} className="w-full max-w-md bg-white p-6 rounded-lg">
        <h2 className="text-xl font-semibold mb-4">Registro</h2>
        {error && <div className="text-red-600 mb-2">{error}</div>}
        <input value={username} onChange={(e) => setUsername(e.target.value)} placeholder="Usuario" className="w-full mb-2 p-2 border rounded" />
        <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email (opcional)" className="w-full mb-2 p-2 border rounded" />
        <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Contraseña" className="w-full mb-4 p-2 border rounded" />
        <button className="w-full rounded bg-[var(--cce-green-dark)] text-white py-2">Crear cuenta</button>
      </form>
    </main>
  );
}
