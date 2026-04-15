"use client";

import Link from "next/link";
import { useState } from "react";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import useAuth from "@/context/AuthContext";
import * as authApi from "@/lib/auth-api";

interface CheckoutFormData {
  customer_name: string;
  customer_phone: string;
  customer_email: string;
  delivery_method: "pickup" | "delivery" | "scheduled";
  pickup_date: string;
  pickup_time: string;
  scheduled_date: string;
  delivery_address: string;
  notes: string;
}

const getCheckoutErrorMessage = (err: unknown) => {
  if (err instanceof Error && err.message) {
    return err.message;
  }
  return "Error al crear el pedido";
};

export default function CheckoutForm() {
  const router = useRouter();
  const { token } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [formData, setFormData] = useState<CheckoutFormData>({
    customer_name: "",
    customer_phone: "",
    customer_email: "",
    delivery_method: "pickup",
    pickup_date: "",
    pickup_time: "",
    scheduled_date: "",
    delivery_address: "",
    notes: "",
  });

  useEffect(() => {
    if (!token) return;

    let cancelled = false;

    const loadAccountData = async () => {
      try {
        const me = await authApi.me(token);
        if (cancelled) return;
        setFormData((prev) => ({
          ...prev,
          customer_name: me.full_name || prev.customer_name,
          customer_phone: me.phone || prev.customer_phone,
          customer_email: me.email || prev.customer_email,
          delivery_address: me.address || prev.delivery_address,
        }));
      } catch {
        // no-op: checkout can still be completed manually
      }
    };

    void loadAccountData();

    return () => {
      cancelled = true;
    };
  }, [token]);

  const handleChange = (
    e: React.ChangeEvent<
      HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement
    >,
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const response = await fetch("http://localhost:8080/api/orders/", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token && { Authorization: `Token ${token}` }),
        },
        body: JSON.stringify({
          customer_name: formData.customer_name,
          customer_phone: formData.customer_phone,
          customer_email: formData.customer_email,
          delivery_method: formData.delivery_method,
          status: "pending",
          ...(formData.delivery_method === "pickup" && {
            pickup_date: formData.pickup_date,
            pickup_time: formData.pickup_time,
          }),
          ...(formData.delivery_method === "scheduled" && {
            scheduled_date: formData.scheduled_date,
          }),
          ...(formData.delivery_method === "delivery" && {
            delivery_address: formData.delivery_address,
          }),
          notes: formData.notes,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(
          errorData.non_field_errors?.[0] || "Error al crear el pedido",
        );
      }

      alert("¡Pedido creado exitosamente!");
      router.push("/");
    } catch (err: unknown) {
      setError(getCheckoutErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-[var(--cce-beige)] px-4 py-10 md:px-10">
      <div className="mx-auto max-w-2xl bg-white p-6 rounded">
        <h1 className="text-2xl font-bold mb-6">Confirmar Pedido</h1>

        {error && (
          <div className="mb-4 p-4 bg-red-100 text-red-700 rounded">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">
              Nombre completo *
            </label>
            <div className="mb-1 text-xs text-gray-500">
              ¿Necesitas actualizar tus datos?{" "}
              <Link
                href="/cuenta"
                className="text-[var(--cce-green-dark)] underline"
              >
                Ir a cuenta
              </Link>
            </div>
            <input
              type="text"
              name="customer_name"
              value={formData.customer_name}
              onChange={handleChange}
              required
              className="w-full border p-2 rounded"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Teléfono *</label>
            <input
              type="tel"
              name="customer_phone"
              value={formData.customer_phone}
              onChange={handleChange}
              required
              className="w-full border p-2 rounded"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Email</label>
            <input
              type="email"
              name="customer_email"
              value={formData.customer_email}
              onChange={handleChange}
              className="w-full border p-2 rounded"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">
              Modalidad de entrega *
            </label>
            <select
              name="delivery_method"
              value={formData.delivery_method}
              onChange={handleChange}
              className="w-full border p-2 rounded"
            >
              <option value="pickup">Recoger en sede</option>
              <option value="delivery">Entrega a domicilio</option>
              <option value="scheduled">Programado</option>
            </select>
          </div>

          {formData.delivery_method === "pickup" && (
            <div className="p-4 bg-blue-50 rounded space-y-4">
              <h3 className="font-semibold">Recogida en sede</h3>
              <div>
                <label className="block text-sm font-medium mb-1">
                  Fecha de recogida *
                </label>
                <input
                  type="date"
                  name="pickup_date"
                  value={formData.pickup_date}
                  onChange={handleChange}
                  required
                  className="w-full border p-2 rounded"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">
                  Hora de recogida * (8:00 AM - 8:00 PM)
                </label>
                <input
                  type="time"
                  name="pickup_time"
                  value={formData.pickup_time}
                  onChange={handleChange}
                  required
                  min="08:00"
                  max="20:00"
                  className="w-full border p-2 rounded"
                />
              </div>
            </div>
          )}

          {formData.delivery_method === "scheduled" && (
            <div className="p-4 bg-green-50 rounded">
              <h3 className="font-semibold mb-2">
                Programar para fecha futura
              </h3>
              <div>
                <label className="block text-sm font-medium mb-1">
                  Fecha programada *
                </label>
                <input
                  type="date"
                  name="scheduled_date"
                  value={formData.scheduled_date}
                  onChange={handleChange}
                  required
                  min={new Date().toISOString().split("T")[0]}
                  className="w-full border p-2 rounded"
                />
              </div>
            </div>
          )}

          {formData.delivery_method === "delivery" && (
            <div className="p-4 bg-yellow-50 rounded">
              <h3 className="font-semibold mb-2">Dirección de entrega</h3>
              <textarea
                name="delivery_address"
                value={formData.delivery_address}
                onChange={handleChange}
                required
                rows={3}
                className="w-full border p-2 rounded"
                placeholder="Calle, número, barrio..."
              />
            </div>
          )}

          <div>
            <label className="block text-sm font-medium mb-1">
              Notas adicionales
            </label>
            <textarea
              name="notes"
              value={formData.notes}
              onChange={handleChange}
              rows={3}
              className="w-full border p-2 rounded"
              placeholder="Instrucciones especiales..."
            />
          </div>

          <div className="flex gap-4">
            <button
              type="button"
              onClick={() => router.back()}
              className="flex-1 bg-gray-200 text-gray-700 py-2 rounded hover:bg-gray-300"
            >
              Volver
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 bg-[var(--cce-pink)] text-white py-2 rounded hover:opacity-90 disabled:opacity-50"
            >
              {loading ? "Creando..." : "Confirmar Pedido"}
            </button>
          </div>
        </form>
      </div>
    </main>
  );
}
