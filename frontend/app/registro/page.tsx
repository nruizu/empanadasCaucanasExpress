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
  const [deliveryLocalAddress, setDeliveryLocalAddress] = useState("");
  const [deliveryCity, setDeliveryCity] = useState("");
  const [deliveryRegion, setDeliveryRegion] = useState("");
  const [password, setPassword] = useState("");
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await register(
        username,
        password,
        email,
        fullName,
        phone,
        address,
        deliveryLocalAddress,
        deliveryCity,
        deliveryRegion,
      );
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
    <main className="min-h-screen bg-[var(--background)] px-4 py-10 md:px-10">
      <div className="mx-auto flex max-w-5xl items-center justify-center">
        <form
          onSubmit={handleSubmit}
          className="w-full max-w-md rounded-2xl bg-white p-7 shadow-[0_8px_30px_rgba(31,92,58,0.08)]"
        >
          <h2 className="text-2xl font-bold text-[var(--primary)]">Crear cuenta</h2>
          <p className="mt-1 text-sm text-[var(--muted-foreground)]">Regístrate para guardar tu pedido y comprar más rápido.</p>

          {error && <div className="mt-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>}

          <div className="mt-5 space-y-4">
            <input
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="Nombre completo"
              className="w-full rounded-lg border border-[color-mix(in_srgb,var(--primary)_18%,white)] bg-white px-3 py-2.5 outline-none focus:border-[var(--primary)]"
            />
            <input
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Usuario"
              className="w-full rounded-lg border border-[color-mix(in_srgb,var(--primary)_18%,white)] bg-white px-3 py-2.5 outline-none focus:border-[var(--primary)]"
            />
            <input
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="Telefono"
              className="w-full rounded-lg border border-[color-mix(in_srgb,var(--primary)_18%,white)] bg-white px-3 py-2.5 outline-none focus:border-[var(--primary)]"
            />
            <input
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Email (opcional)"
              className="w-full rounded-lg border border-[color-mix(in_srgb,var(--primary)_18%,white)] bg-white px-3 py-2.5 outline-none focus:border-[var(--primary)]"
            />
            <input
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="Direccion principal"
              className="w-full rounded-lg border border-[color-mix(in_srgb,var(--primary)_18%,white)] bg-white px-3 py-2.5 outline-none focus:border-[var(--primary)]"
            />
            <input
              value={deliveryLocalAddress}
              onChange={(e) => setDeliveryLocalAddress(e.target.value)}
              placeholder="Direccion de domicilio (opcional)"
              className="w-full rounded-lg border border-[color-mix(in_srgb,var(--primary)_18%,white)] bg-white px-3 py-2.5 outline-none focus:border-[var(--primary)]"
            />
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <input
                value={deliveryCity}
                onChange={(e) => setDeliveryCity(e.target.value)}
                placeholder="Ciudad de domicilio (opcional)"
                className="w-full rounded-lg border border-[color-mix(in_srgb,var(--primary)_18%,white)] bg-white px-3 py-2.5 outline-none focus:border-[var(--primary)]"
              />
              <input
                value={deliveryRegion}
                onChange={(e) => setDeliveryRegion(e.target.value)}
                placeholder="Departamento de domicilio (opcional)"
                className="w-full rounded-lg border border-[color-mix(in_srgb,var(--primary)_18%,white)] bg-white px-3 py-2.5 outline-none focus:border-[var(--primary)]"
              />
            </div>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Contraseña"
              className="w-full rounded-lg border border-[color-mix(in_srgb,var(--primary)_18%,white)] bg-white px-3 py-2.5 outline-none focus:border-[var(--primary)]"
            />
          </div>

          <button className="mt-5 w-full rounded-lg bg-[var(--primary)] py-2.5 font-semibold text-white transition-colors hover:bg-[color-mix(in_srgb,var(--primary)_90%,black)]">
            Crear cuenta
          </button>
        </form>
      </div>
    </main>
  );
}
