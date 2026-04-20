"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import useAuth from "@/context/AuthContext";
import * as authApi from "@/lib/auth-api";

type AccountErrorPayload = {
  email?: string[];
  full_name?: string[];
  phone?: string[];
  address?: string[];
  delivery_local_address?: string[];
  delivery_city?: string[];
  delivery_region?: string[];
  message?: string;
};

const getAccountErrorMessage = (err: unknown) => {
  if (err && typeof err === "object") {
    const typed = err as AccountErrorPayload;
    return (
      typed.email?.[0] ||
      typed.full_name?.[0] ||
      typed.phone?.[0] ||
      typed.address?.[0] ||
      typed.delivery_local_address?.[0] ||
      typed.delivery_city?.[0] ||
      typed.delivery_region?.[0] ||
      typed.message ||
      "No se pudo actualizar la cuenta"
    );
  }
  if (err instanceof Error && err.message) {
    return err.message;
  }
  return "No se pudo actualizar la cuenta";
};

interface AccountFormData {
  email: string;
  full_name: string;
  phone: string;
  address: string;
  delivery_local_address: string;
  delivery_city: string;
  delivery_region: string;
}

export default function CuentaPage() {
  const router = useRouter();
  const { token } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [formData, setFormData] = useState<AccountFormData>({
    email: "",
    full_name: "",
    phone: "",
    address: "",
    delivery_local_address: "",
    delivery_city: "",
    delivery_region: "",
  });

  useEffect(() => {
    if (!token) {
      router.push("/login");
      return;
    }

    let cancelled = false;

    const loadAccount = async () => {
      try {
        const data = await authApi.me(token);
        if (cancelled) return;
        setFormData({
          email: data.email || "",
          full_name: data.full_name || "",
          phone: data.phone || "",
          address: data.address || "",
          delivery_local_address: data.delivery_local_address || "",
          delivery_city: data.delivery_city || "",
          delivery_region: data.delivery_region || "",
        });
      } catch {
        if (cancelled) return;
        setError("No se pudo cargar tu información de cuenta");
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    void loadAccount();

    return () => {
      cancelled = true;
    };
  }, [token, router]);

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>,
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return;

    setSaving(true);
    setError(null);
    setSuccess(null);

    try {
      await authApi.updateMe(token, formData);
      setSuccess("Datos actualizados correctamente");
      window.dispatchEvent(new CustomEvent("auth:changed"));
    } catch (err: unknown) {
      setError(getAccountErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <main className="min-h-screen bg-[var(--cce-beige)] px-4 py-10 md:px-10">
        <div className="mx-auto max-w-2xl bg-white p-6 rounded">
          Cargando cuenta...
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[var(--cce-beige)] px-4 py-10 md:px-10">
      <div className="mx-auto max-w-2xl bg-white p-6 rounded">
        <h1 className="text-2xl font-bold mb-6">Mi Cuenta</h1>

        {error && (
          <div className="mb-4 p-4 bg-red-100 text-red-700 rounded">
            {error}
          </div>
        )}
        {success && (
          <div className="mb-4 p-4 bg-green-100 text-green-700 rounded">
            {success}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">Email *</label>
            <input
              type="email"
              name="email"
              value={formData.email}
              onChange={handleChange}
              required
              className="w-full border p-2 rounded"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">
              Nombre completo *
            </label>
            <input
              type="text"
              name="full_name"
              value={formData.full_name}
              onChange={handleChange}
              required
              className="w-full border p-2 rounded"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Teléfono *</label>
            <input
              type="tel"
              name="phone"
              value={formData.phone}
              onChange={handleChange}
              required
              className="w-full border p-2 rounded"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">
              Dirección *
            </label>
            <textarea
              name="address"
              value={formData.address}
              onChange={handleChange}
              rows={3}
              required
              className="w-full border p-2 rounded"
            />
          </div>

          <hr className="my-6" />

          <h2 className="text-lg font-semibold">
            Información para entregas a domicilio
          </h2>

          <div>
            <label className="block text-sm font-medium mb-1">
              Dirección de entrega
            </label>
            <input
              type="text"
              name="delivery_local_address"
              value={formData.delivery_local_address}
              onChange={handleChange}
              className="w-full border p-2 rounded"
              placeholder="Ej: Calle 20B #80-15"
            />
          </div>

          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <div>
              <label className="block text-sm font-medium mb-1">
                Ciudad o pueblo
              </label>
              <input
                type="text"
                name="delivery_city"
                value={formData.delivery_city}
                onChange={handleChange}
                className="w-full border p-2 rounded"
                placeholder="Ej: Medellin"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">
                Departamento/región
              </label>
              <input
                type="text"
                name="delivery_region"
                value={formData.delivery_region}
                onChange={handleChange}
                className="w-full border p-2 rounded"
                placeholder="Ej: Antioquia"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={saving}
            className="w-full rounded bg-[var(--cce-green-dark)] text-white py-2 disabled:opacity-50"
          >
            {saving ? "Guardando..." : "Guardar cambios"}
          </button>
        </form>
      </div>
    </main>
  );
}
