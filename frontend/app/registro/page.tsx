"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import useAuth from "@/context/AuthContext";

export default function RegisterPage() {
  const { register } = useAuth();
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [password, setPassword] = useState("");
  const [repeatPassword, setRepeatPassword] = useState("");
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (password !== repeatPassword) {
      setError("Las contraseñas no coinciden");
      return;
    }

    try {
      await register(username, password, email, fullName, phone, address);
      router.push('/catalogo');
    } catch (err: any) {
      const msg =
        err?.password?.[0] ||
        err?.username?.[0] ||
        err?.email?.[0] ||
        err?.full_name?.[0] ||
        err?.phone?.[0] ||
        err?.address?.[0] ||
        err?.non_field_errors?.[0] ||
        err?.message ||
        "Error al registrarse";
      setError(msg);
    }
  };

  return (
    <main className="min-h-screen flex items-center justify-center bg-[var(--cce-beige)]">
      <form onSubmit={handleSubmit} className="w-full max-w-md bg-white p-6 rounded-lg">
        <h2 className="text-xl font-semibold mb-4">Registro</h2>
        {error && <div className="text-red-600 mb-2">{error}</div>}
        <input value={username} onChange={(e) => setUsername(e.target.value)} placeholder="Usuario" className="w-full mb-2 p-2 border rounded" required />
        <input value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Nombre completo" className="w-full mb-2 p-2 border rounded" required />
        <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="Teléfono" className="w-full mb-2 p-2 border rounded" required />
        <input value={address} onChange={(e) => setAddress(e.target.value)} placeholder="Dirección" className="w-full mb-2 p-2 border rounded" required />
        <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email" className="w-full mb-2 p-2 border rounded" required />
        <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Contraseña" className="w-full mb-2 p-2 border rounded" required />
        <input type="password" value={repeatPassword} onChange={(e) => setRepeatPassword(e.target.value)} placeholder="Repetir contraseña" className="w-full mb-4 p-2 border rounded" required />
        <button className="w-full rounded bg-[var(--cce-green-dark)] text-white py-2">Crear cuenta</button>
      </form>
    </main>
  );
}
