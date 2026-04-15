"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import useAuth from "@/context/AuthContext";

type RegisterErrorPayload = {
  password?: string[];
  username?: string[];
  email?: string[];
  full_name?: string[];
  phone?: string[];
  address?: string[];
  non_field_errors?: string[];
  message?: string;
};

const getRegisterErrorMessage = (err: unknown) => {
  if (err && typeof err === "object") {
    const typed = err as RegisterErrorPayload;
    return (
      typed.password?.[0] ||
      typed.username?.[0] ||
      typed.email?.[0] ||
      typed.full_name?.[0] ||
      typed.phone?.[0] ||
      typed.address?.[0] ||
      typed.non_field_errors?.[0] ||
      typed.message ||
      "Error al registrarse"
    );
  }
  if (err instanceof Error && err.message) {
    return err.message;
  }
  return "Error al registrarse";
};

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
      router.push("/catalogo");
    } catch (err: unknown) {
      setError(getRegisterErrorMessage(err));
    }
  };

  return (
    <main className="min-h-screen flex items-center justify-center bg-[var(--cce-beige)]">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-md bg-white p-6 rounded-lg"
      >
        <h2 className="text-xl font-semibold mb-4">Registro</h2>
        {error && <div className="text-red-600 mb-2">{error}</div>}
        <input
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          placeholder="Usuario"
          className="w-full mb-2 p-2 border rounded"
          required
        />
        <input
          value={fullName}
          onChange={(e) => setFullName(e.target.value)}
          placeholder="Nombre completo"
          className="w-full mb-2 p-2 border rounded"
          required
        />
        <input
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          placeholder="Teléfono"
          className="w-full mb-2 p-2 border rounded"
          required
        />
        <input
          value={address}
          onChange={(e) => setAddress(e.target.value)}
          placeholder="Dirección"
          className="w-full mb-2 p-2 border rounded"
          required
        />
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="Email"
          className="w-full mb-2 p-2 border rounded"
          required
        />
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Contraseña"
          className="w-full mb-2 p-2 border rounded"
          required
        />
        <input
          type="password"
          value={repeatPassword}
          onChange={(e) => setRepeatPassword(e.target.value)}
          placeholder="Repetir contraseña"
          className="w-full mb-4 p-2 border rounded"
          required
        />
        <button className="w-full rounded bg-[var(--cce-green-dark)] text-white py-2">
          Crear cuenta
        </button>
      </form>
    </main>
  );
}
