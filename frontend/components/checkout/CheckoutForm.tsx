"use client";

import Link from "next/link";
import { useState } from "react";
import { useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import useAuth from "@/context/AuthContext";
import * as authApi from "@/lib/auth-api";
import * as cartApi from "@/lib/cart-api";
import * as deliveryApi from "@/lib/delivery-api";

interface CheckoutFormData {
  customer_name: string;
  customer_phone: string;
  customer_email: string;
  delivery_method: "pickup" | "delivery" | "scheduled";
  pickup_date: string;
  pickup_time: string;
  scheduled_date: string;
  delivery_local_address: string;
  delivery_city: string;
  delivery_region: string;
  delivery_country: string;
  delivery_reference: string;
  notes: string;
}

const getCheckoutErrorMessage = (err: unknown) => {
  if (err instanceof Error && err.message) {
    return err.message;
  }
  return "Error al crear el pedido";
};

const normalizeColombianMobile = (rawPhone: string): string | null => {
  const digits = rawPhone.replace(/\D/g, "");

  // Formato local: 3XXXXXXXXX (10 digitos)
  if (digits.length === 10 && digits.startsWith("3")) {
    return `+57${digits}`;
  }

  // Formato internacional sin +: 573XXXXXXXXX (12 digitos)
  if (digits.length === 12 && digits.startsWith("57") && digits[2] === "3") {
    return `+${digits}`;
  }

  return null;
};

export default function CheckoutForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { token } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [infoMessage, setInfoMessage] = useState<string | null>(null);
  const [deliveryValidationMessage, setDeliveryValidationMessage] = useState<
    string | null
  >(null);
  const [deliveryValidationStatus, setDeliveryValidationStatus] = useState<
    "not_validated" | "valid" | "invalid" | "out_of_coverage" | "service_error"
  >("not_validated");
  const [validatingDelivery, setValidatingDelivery] = useState(false);

  const [formData, setFormData] = useState<CheckoutFormData>({
    customer_name: "",
    customer_phone: "",
    customer_email: "",
    delivery_method: "pickup",
    pickup_date: "",
    pickup_time: "",
    scheduled_date: "",
    delivery_local_address: "",
    delivery_city: "",
    delivery_region: "",
    delivery_country: "Colombia",
    delivery_reference: "",
    notes: "",
  });

  const buildDeliveryAddress = (data: CheckoutFormData) => {
    const parts = [
      data.delivery_local_address.trim(),
      data.delivery_reference.trim(),
      data.delivery_city.trim(),
      data.delivery_region.trim(),
      data.delivery_country.trim(),
    ].filter(Boolean);

    return parts.join(", ");
  };

  useEffect(() => {
    if (searchParams.get("reorder") === "1") {
      setInfoMessage("Carrito cargado con los productos de tu pedido anterior.");
      router.replace("/checkout");
    }
  }, [searchParams, router]);

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
          delivery_local_address:
            me.delivery_local_address || me.address || prev.delivery_local_address,
          delivery_city: me.delivery_city || prev.delivery_city,
          delivery_region: me.delivery_region || prev.delivery_region,
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

    if (name === "delivery_method") {
      setDeliveryValidationStatus("not_validated");
      setDeliveryValidationMessage(null);
    }

    if (name.startsWith("delivery_")) {
      setDeliveryValidationStatus("not_validated");
      setDeliveryValidationMessage(null);
    }
  };

  const handleValidateDeliveryAddress = async () => {
    const deliveryAddress = buildDeliveryAddress(formData);
    if (
      !formData.delivery_local_address.trim() ||
      !formData.delivery_city.trim()
    ) {
      setDeliveryValidationStatus("invalid");
      setDeliveryValidationMessage(
        "Debes ingresar direccion y ciudad/pueblo para validar",
      );
      return;
    }

    setValidatingDelivery(true);
    setDeliveryValidationMessage(null);

    try {
      const result = await deliveryApi.validateDeliveryAddress(deliveryAddress);
      setDeliveryValidationStatus(result.status);
      setDeliveryValidationMessage(result.message);
    } catch (err: unknown) {
      setDeliveryValidationStatus("service_error");
      setDeliveryValidationMessage(getCheckoutErrorMessage(err));
    } finally {
      setValidatingDelivery(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const normalizedPhone = normalizeColombianMobile(formData.customer_phone);
    if (!normalizedPhone) {
      setError(
        "Ingresa un celular colombiano valido (ej: 3001234567 o +573001234567).",
      );
      return;
    }

    setLoading(true);
    setError(null);

    const deliveryAddress = buildDeliveryAddress(formData);

    if (
      formData.delivery_method === "delivery" &&
      deliveryValidationStatus !== "valid"
    ) {
      setLoading(false);
      setError(
        "Debes validar una direccion de domicilio dentro de cobertura antes de confirmar.",
      );
      return;
    }

    try {
      const response = await fetch("http://localhost:8080/api/orders/", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token && { Authorization: `Token ${token}` }),
        },
        body: JSON.stringify({
          customer_name: formData.customer_name,
          customer_phone: normalizedPhone,
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
            delivery_address: deliveryAddress,
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

      const orderData = await response.json();
      const orderId = orderData.id;

      if (token) {
        try {
          const cart = await cartApi.getMyCart();
          if (
            cart?.id &&
            Array.isArray(cart?.products) &&
            cart.products.length > 0
          ) {
            await cartApi.clearCart(cart.id);
          }
          window.dispatchEvent(new CustomEvent("cart:updated"));
        } catch {
          // no-op: the order was created, so we avoid blocking navigation
        }
      }

      // Redirigir a página de confirmación
      router.push(`/confirmacion?orderId=${orderId}`);
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

        {infoMessage && (
          <div className="mb-4 rounded bg-green-100 p-4 text-green-700">
            {infoMessage}
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
              inputMode="numeric"
              placeholder="3001234567 o +573001234567"
              pattern="^(\\+57|57)?3[0-9]{9}$"
              className="w-full border p-2 rounded"
            />
            <p className="mt-1 text-xs text-gray-500">
              Solo celular colombiano. Ejemplos: 3001234567, 573001234567,
              +573001234567.
            </p>
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
              <input
                name="delivery_local_address"
                value={formData.delivery_local_address}
                onChange={handleChange}
                required
                className="w-full border p-2 rounded"
                placeholder="Direccion (ej: Calle 20B #80-15)"
              />
              <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2">
                <input
                  name="delivery_city"
                  value={formData.delivery_city}
                  onChange={handleChange}
                  required
                  className="w-full border p-2 rounded"
                  placeholder="Ciudad o pueblo (ej: Medellin)"
                />
                <input
                  name="delivery_region"
                  value={formData.delivery_region}
                  onChange={handleChange}
                  className="w-full border p-2 rounded"
                  placeholder="Departamento/region (ej: Antioquia)"
                />
                <input
                  name="delivery_country"
                  value={formData.delivery_country}
                  onChange={handleChange}
                  className="w-full border p-2 rounded"
                  placeholder="Pais (ej: Colombia)"
                />
                <input
                  name="delivery_reference"
                  value={formData.delivery_reference}
                  onChange={handleChange}
                  className="w-full border p-2 rounded"
                  placeholder="Referencia (opcional, ej: Barrio Belen)"
                />
              </div>
              <p className="mt-2 text-xs text-gray-600">
                Vista previa:{" "}
                {buildDeliveryAddress(formData) || "Completa la direccion"}
              </p>
              <div className="mt-3 flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => void handleValidateDeliveryAddress()}
                  disabled={validatingDelivery}
                  className="rounded bg-[var(--cce-green-dark)] px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
                >
                  {validatingDelivery ? "Validando..." : "Validar direccion"}
                </button>
                <span className="text-xs text-gray-600">
                  Solo se valida para pedidos a domicilio.
                </span>
              </div>
              {deliveryValidationMessage && (
                <p
                  className={`mt-2 text-sm ${
                    deliveryValidationStatus === "valid"
                      ? "text-green-700"
                      : "text-red-700"
                  }`}
                >
                  {deliveryValidationMessage}
                </p>
              )}
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
