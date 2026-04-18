"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import useAuth from "@/context/AuthContext";

interface CheckoutFormData {
  customer_name: string;
  customer_phone: string;
  delivery_method: "pickup" | "delivery" | "scheduled";
  pickup_date: string;
  pickup_time: string;
  scheduled_date: string;
  delivery_address: string;
  notes: string;
}

export default function CheckoutForm() {
  const router = useRouter();
  const { token } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const [formData, setFormData] = useState<CheckoutFormData>({
    customer_name: "",
    customer_phone: "",
    delivery_method: "pickup",
    pickup_date: "",
    pickup_time: "",
    scheduled_date: "",
    delivery_address: "",
    notes: "",
  });

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target;
    const nextValue =
      name === "customer_phone" ? value.replace(/\D/g, "").slice(0, 15) : value;
    setFormData((prev) => ({ ...prev, [name]: nextValue }));
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
          errorData.non_field_errors?.[0] ||
            errorData.delivery_address?.[0] ||
            errorData.pickup_time?.[0] ||
            "Error al crear el pedido",
        );
      }

      alert("¡Pedido creado exitosamente!");
      router.push("/");
    } catch (err: any) {
      setError(err.message || "Error al crear el pedido");
    } finally {
      setLoading(false);
    }
  };

  const getPickupMinTime = () => {
    if (!formData.pickup_date) {
      return "08:00";
    }

    const pickupDate = new Date(`${formData.pickup_date}T00:00:00`);
    // JS day: Sunday=0 ... Saturday=6
    return pickupDate.getDay() === 0 ? "08:00" : "09:00";
  };

  const pickupScheduleLabel =
    getPickupMinTime() === "08:00"
      ? "Hora de recogida * (domingo: 8:00 AM - 8:00 PM)"
      : "Hora de recogida * (lunes a sábado: 9:00 AM - 8:00 PM)";

  return (
    <main className="min-h-screen bg-[var(--background)] px-4 py-10 md:px-10">
      <div className="mx-auto max-w-3xl rounded-2xl bg-white p-6 shadow-[0_8px_30px_rgba(31,92,58,0.08)] md:p-8">
        <h1 className="mb-1 text-2xl font-bold text-[var(--primary)] md:text-3xl">Confirmar pedido</h1>
        <p className="mb-6 text-sm text-[var(--muted-foreground)]">Completa los datos para finalizar tu orden.</p>

        {error && (
          <div className="mb-4 rounded-xl border border-red-200 bg-red-50 p-4 text-red-700">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="mb-1 block text-sm font-medium text-[var(--primary)]">
              Nombre completo *
              </label>
              <input
                type="text"
                name="customer_name"
                value={formData.customer_name}
                onChange={handleChange}
                required
                className="w-full rounded-lg border border-[color-mix(in_srgb,var(--primary)_18%,white)] bg-white px-3 py-2 outline-none focus:border-[var(--primary)]"
              />
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-[var(--primary)]">
              Teléfono *
              </label>
              <input
                type="tel"
                name="customer_phone"
                value={formData.customer_phone}
                onChange={handleChange}
                required
                inputMode="numeric"
                pattern="[0-9]{7,15}"
                minLength={7}
                maxLength={15}
                className="w-full rounded-lg border border-[color-mix(in_srgb,var(--primary)_18%,white)] bg-white px-3 py-2 outline-none focus:border-[var(--primary)]"
              />
            </div>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-[var(--primary)]">
              Modalidad de entrega *
            </label>
            <select
              name="delivery_method"
              value={formData.delivery_method}
              onChange={handleChange}
              className="w-full rounded-lg border border-[color-mix(in_srgb,var(--primary)_18%,white)] bg-white px-3 py-2 outline-none focus:border-[var(--primary)]"
            >
              <option value="pickup">Recoger en sede</option>
              <option value="delivery">Entrega a domicilio</option>
              <option value="scheduled">Programado</option>
            </select>
          </div>

          {formData.delivery_method === "pickup" && (
            <div className="space-y-4 rounded-xl border border-[color-mix(in_srgb,var(--primary)_12%,white)] bg-[color-mix(in_srgb,var(--secondary)_16%,white)] p-4">
              <h3 className="font-semibold text-[var(--primary)]">Recogida en sede</h3>
              <p className="text-sm text-[var(--muted-foreground)]">
                Horario: lunes a sábado de 9:00 AM a 8:00 PM y domingo de 8:00 AM a 8:00 PM.
              </p>
              <div>
                <label className="mb-1 block text-sm font-medium text-[var(--primary)]">
                  Fecha de recogida *
                </label>
                <input
                  type="date"
                  name="pickup_date"
                  value={formData.pickup_date}
                  onChange={handleChange}
                  required
                  className="w-full rounded-lg border border-[color-mix(in_srgb,var(--primary)_18%,white)] bg-white px-3 py-2 outline-none focus:border-[var(--primary)]"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-[var(--primary)]">
                  {pickupScheduleLabel}
                </label>
                <input
                  type="time"
                  name="pickup_time"
                  value={formData.pickup_time}
                  onChange={handleChange}
                  required
                  min={getPickupMinTime()}
                  max="20:00"
                  className="w-full rounded-lg border border-[color-mix(in_srgb,var(--primary)_18%,white)] bg-white px-3 py-2 outline-none focus:border-[var(--primary)]"
                />
              </div>
            </div>
          )}

          {formData.delivery_method === "scheduled" && (
            <div className="rounded-xl border border-[color-mix(in_srgb,var(--primary)_12%,white)] bg-[color-mix(in_srgb,var(--primary)_7%,white)] p-4">
              <h3 className="mb-2 font-semibold text-[var(--primary)]">Programar para fecha futura</h3>
              <div>
                <label className="mb-1 block text-sm font-medium text-[var(--primary)]">
                  Fecha programada *
                </label>
                <input
                  type="date"
                  name="scheduled_date"
                  value={formData.scheduled_date}
                  onChange={handleChange}
                  required
                  min={new Date().toISOString().split("T")[0]}
                  className="w-full rounded-lg border border-[color-mix(in_srgb,var(--primary)_18%,white)] bg-white px-3 py-2 outline-none focus:border-[var(--primary)]"
                />
              </div>
            </div>
          )}

          {formData.delivery_method === "delivery" && (
            <div className="rounded-xl border border-[color-mix(in_srgb,var(--primary)_12%,white)] bg-[color-mix(in_srgb,var(--secondary)_20%,white)] p-4">
              <h3 className="mb-2 font-semibold text-[var(--primary)]">Dirección de entrega</h3>
              <p className="mb-3 text-sm text-[var(--muted-foreground)]">
                Horario domicilio: lunes a sábado de 9:00 AM a 7:30 PM, domingo de 8:00 AM a 7:30 PM.
              </p>
              <p className="mb-3 text-sm font-semibold text-[var(--primary)]">Tiempo estimado de entrega: 45-60 minutos</p>
              <textarea
                name="delivery_address"
                value={formData.delivery_address}
                onChange={handleChange}
                required
                rows={3}
                className="w-full rounded-lg border border-[color-mix(in_srgb,var(--primary)_18%,white)] bg-white px-3 py-2 outline-none focus:border-[var(--primary)]"
                placeholder="Calle, número, barrio..."
              />
            </div>
          )}

          <div>
            <label className="mb-1 block text-sm font-medium text-[var(--primary)]">
              Notas adicionales
            </label>
            <textarea
              name="notes"
              value={formData.notes}
              onChange={handleChange}
              rows={3}
              className="w-full rounded-lg border border-[color-mix(in_srgb,var(--primary)_18%,white)] bg-white px-3 py-2 outline-none focus:border-[var(--primary)]"
              placeholder="Instrucciones especiales..."
            />
          </div>

          <div className="flex gap-4">
            <button
              type="button"
              onClick={() => router.back()}
              className="flex-1 rounded-lg border border-[color-mix(in_srgb,var(--primary)_18%,white)] bg-white py-2.5 font-medium text-[var(--primary)] transition-colors hover:bg-[var(--background)]"
            >
              Volver
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 rounded-lg bg-[var(--accent)] py-2.5 font-semibold text-[var(--accent-foreground)] shadow-sm transition-colors hover:bg-[color-mix(in_srgb,var(--accent)_88%,black)] disabled:opacity-50"
            >
              {loading ? "Creando..." : "Confirmar Pedido"}
            </button>
          </div>
        </form>
      </div>
    </main>
  );
}