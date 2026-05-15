"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import useAuth from "@/context/AuthContext";
import * as authApi from "@/lib/auth-api";
import * as cartApi from "@/lib/cart-api";
import { getOrderAvailability, type PublicOrderAvailability } from "@/lib/catalog-api";
import { getManualPaymentSettings, type ManualPaymentSettings } from "@/lib/payment-settings-api";
import {
  validateDeliveryAddress,
  type DeliveryValidationResponse,
} from "@/lib/delivery-api";
import { getBogotaISODate, getWeekdayFromISODate } from "@/lib/colombia-time";

interface CartSnapshot {
  id: number;
  total_price: number | string;
  products: Array<{
    id: number;
    quantity: number;
    product: {
      id: number;
      name: string;
      image?: string | null;
      price?: number | string;
    };
  }>;
}

interface CheckoutFormData {
  customer_name: string;
  customer_phone: string;
  customer_email: string;
  delivery_method: "pickup" | "delivery" | "scheduled";
  payment_method: "cash_on_delivery" | "transfer";
  pickup_date: string;
  pickup_time: string;
  scheduled_date: string;
  delivery_address: string;
  notes: string;
}

const toTimeInput = (value: string) => value.slice(0, 5);

const formatTime12h = (value: string) => {
  const [hourRaw, minuteRaw] = value.slice(0, 5).split(":");
  const hour = Number(hourRaw);
  const minute = Number(minuteRaw);
  const period = hour >= 12 ? "PM" : "AM";
  const normalizedHour = hour % 12 || 12;
  const normalizedMinute = String(minute).padStart(2, "0");
  return `${normalizedHour}:${normalizedMinute} ${period}`;
};

const getApiErrorMessage = (errorData: unknown, fallback: string) => {
  if (!errorData) {
    return fallback;
  }

  if (typeof errorData === "string") {
    return errorData.trim() || fallback;
  }

  if (Array.isArray(errorData)) {
    const firstMessage = errorData.find((item) => typeof item === "string");
    return typeof firstMessage === "string" && firstMessage.trim()
      ? firstMessage
      : fallback;
  }

  if (typeof errorData !== "object") {
    return fallback;
  }

  const errorObject = errorData as Record<string, unknown>;
  const messageFields = [
    errorObject.non_field_errors,
    errorObject.detail,
    errorObject.message,
    errorObject.error,
    errorObject.delivery_address,
    errorObject.pickup_time,
    errorObject.order_items,
  ];

  for (const fieldValue of messageFields) {
    if (Array.isArray(fieldValue)) {
      const firstMessage = fieldValue.find((item) => typeof item === "string");
      if (typeof firstMessage === "string" && firstMessage.trim()) {
        return firstMessage;
      }
    }

    if (typeof fieldValue === "string" && fieldValue.trim()) {
      return fieldValue;
    }
  }

  return fallback;
};

export default function CheckoutForm() {
  const router = useRouter();
  const { token } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [availability, setAvailability] = useState<PublicOrderAvailability | null>(null);
  const [paymentSettings, setPaymentSettings] = useState<ManualPaymentSettings | null>(null);
  const [deliveryValidation, setDeliveryValidation] =
    useState<DeliveryValidationResponse | null>(null);
  const [receiptFile, setReceiptFile] = useState<File | null>(null);
  const [receiptError, setReceiptError] = useState<string | null>(null);
  
  const [formData, setFormData] = useState<CheckoutFormData>({
    customer_name: "",
    customer_phone: "",
    customer_email: "",
    delivery_method: "pickup",
    payment_method: "cash_on_delivery",
    pickup_date: "",
    pickup_time: "",
    scheduled_date: "",
    delivery_address: "",
    notes: "",
  });

  const globalRestrictionToday = availability?.restricted_dates?.find(
    (item) =>
      item.is_active && item.applies_to === "all" && item.date === getBogotaISODate(),
  );
  const ordersDisabledGlobally = availability ? !availability.is_accepting_orders : false;
  const receiptMaxBytes = paymentSettings?.receipt_max_bytes ?? 5 * 1024 * 1024;
  const receiptMaxMb = Math.round(receiptMaxBytes / (1024 * 1024));

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target;
    const nextValue =
      name === "customer_phone" ? value.replace(/\D/g, "").slice(0, 15) : value;
    setFormData((prev) => ({ ...prev, [name]: nextValue }));
    if (name === "delivery_address") {
      setDeliveryValidation(null);
    }
    if (name === "payment_method") {
      setReceiptFile(null);
      setReceiptError(null);
    }
  };

  const handleReceiptChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] ?? null;
    setReceiptFile(file);
    setReceiptError(null);

    if (!file) {
      return;
    }

    const maxBytes = paymentSettings?.receipt_max_bytes ?? 5 * 1024 * 1024;
    if (file.size > maxBytes) {
      const maxMb = Math.round(maxBytes / (1024 * 1024));
      setReceiptError(`El archivo supera el limite de ${maxMb} MB.`);
    }
  };

  const handleValidateDeliveryAddress = async () => {
    if (
      formData.delivery_method !== "delivery" &&
      formData.delivery_method !== "scheduled"
    ) {
      return;
    }

    const address = formData.delivery_address.trim();
    if (!address) {
      setDeliveryValidation(null);
      return;
    }

    try {
      const validation = await validateDeliveryAddress(address);
      setDeliveryValidation(validation);
      if (validation.status === "valid") {
        setError(null);
      }
    } catch (validationError) {
      setDeliveryValidation({
        status: "service_error",
        message:
          validationError instanceof Error
            ? validationError.message
            : "No se pudo validar la direccion",
      });
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    if (globalRestrictionToday) {
      const reason = globalRestrictionToday.reason
        ? ` Motivo: ${globalRestrictionToday.reason}`
        : "";
      setError(`No hay servicio de pedidos para hoy.${reason}`);
      setLoading(false);
      return;
    }

    if (ordersDisabledGlobally) {
      setError("Los pedidos están temporalmente deshabilitados por administración.");
      setLoading(false);
      return;
    }

    const blockedDate = (() => {
      if (!availability?.restricted_dates?.length) return null;

      const method = formData.delivery_method;
      const today = getBogotaISODate();
      const targetDate =
        method === "delivery"
          ? today
          : method === "pickup"
            ? formData.pickup_date
            : formData.scheduled_date;

      if (!targetDate) return null;

      return (
        availability.restricted_dates.find(
          (item) =>
            item.is_active &&
            item.date === targetDate &&
            (item.applies_to === "all" || item.applies_to === method),
        ) || null
      );
    })();

    if (blockedDate) {
      const reason = blockedDate.reason ? ` Motivo: ${blockedDate.reason}` : "";
      setError(`No hay disponibilidad para la fecha seleccionada.${reason}`);
      setLoading(false);
      return;
    }

    if (formData.delivery_method === "delivery") {
      let validation: DeliveryValidationResponse | null = deliveryValidation;

      if (!validation || validation.status === "not_validated") {
        try {
          validation = await validateDeliveryAddress(formData.delivery_address.trim());
          setDeliveryValidation(validation);
        } catch (validationError) {
          validation = {
            status: "service_error",
            message:
              validationError instanceof Error
                ? validationError.message
                : "No se pudo validar la direccion",
          };
          setDeliveryValidation(validation);
        }
      }

      if (validation.status !== "valid") {
        setError(validation.message || "La dirección de entrega no es válida.");
        setLoading(false);
        return;
      }
    }

    if (formData.payment_method === "transfer") {
      if (paymentSettings && !paymentSettings.is_active) {
        setError("El pago por transferencia no esta disponible en este momento.");
        setLoading(false);
        return;
      }

      if (!receiptFile) {
        setError("Debes subir el comprobante para confirmar el pago online.");
        setLoading(false);
        return;
      }

      if (receiptError) {
        setError(receiptError);
        setLoading(false);
        return;
      }

      if (!token) {
        setError("Debes iniciar sesion para subir el comprobante.");
        setLoading(false);
        return;
      }
    }

    try {
      // 🔥 OBTENER EL CARRITO ANTES DE CREAR LA ORDEN
      let cartSnapshot: CartSnapshot | null = null;
      if (token) {
        try {
          cartSnapshot = (await cartApi.getMyCart()) as CartSnapshot;
          
          // Validar que el carrito tenga items
          if (!cartSnapshot?.products?.length) {
            setError("Tu carrito está vacío. Agrega productos antes de confirmar el pedido.");
            setLoading(false);
            return;
          }
        } catch (cartError) {
          console.error("Error obteniendo carrito:", cartError);
          setError("No se pudo obtener tu carrito. Por favor intenta nuevamente.");
          setLoading(false);
          return;
        }
      }

      // 🔥 CONSTRUIR EL PAYLOAD CON LOS ITEMS
      const orderPayload = {
        customer_name: formData.customer_name,
        customer_phone: formData.customer_phone,
        ...(formData.customer_email.trim() && {
          customer_email: formData.customer_email.trim(),
        }),
        delivery_method: formData.delivery_method,
        payment_method: formData.payment_method,
        status: "pending",
        ...(formData.delivery_method === "pickup" && {
          pickup_date: formData.pickup_date,
          pickup_time: formData.pickup_time,
        }),
        ...(formData.delivery_method === "scheduled" && {
          scheduled_date: formData.scheduled_date,
        }),
        ...((formData.delivery_method === "delivery" ||
          formData.delivery_method === "scheduled") && {
          delivery_address: formData.delivery_address,
        }),
        notes: formData.notes,
        // 🔥 AGREGAR LOS ITEMS DEL CARRITO
        order_items: cartSnapshot?.products.map((item) => ({
          product_id: item.product.id,
          quantity: item.quantity,
        })) || [],
      };

      console.log("📦 Enviando orden:", orderPayload); // Para debugging

      const response = await fetch("http://localhost:8080/api/orders/", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token && { Authorization: `Token ${token}` }),
        },
        body: JSON.stringify(orderPayload),
      });

      if (!response.ok) {
        let errorMessage = "Error al crear el pedido";
        try {
          const contentType = response.headers.get("content-type") ?? "";

          if (contentType.includes("application/json")) {
            const errorData = await response.json();
            console.error("❌ Error del servidor:", errorData);
            errorMessage = getApiErrorMessage(errorData, errorMessage);
          } else {
            const textBody = await response.text();
            if (textBody.trim()) {
              console.error("❌ Error del servidor:", textBody);
              errorMessage = textBody;
            }
          }
        } catch {
          try {
            const textBody = await response.text();
            console.error("❌ Respuesta no JSON:", textBody);
            errorMessage = textBody.trim() || errorMessage;
          } catch {
            errorMessage = `Error del servidor (${response.status})`;
          }
        }

        if (errorMessage === "Error al crear el pedido") {
          errorMessage = `Error del servidor (${response.status})`;
        }

        throw new Error(errorMessage);
      }

      const createdOrder = await response.json();
      console.log("✅ Orden creada:", createdOrder); // Para debugging

      let paymentStatus: string =
        formData.payment_method === "cash_on_delivery"
          ? "cash_on_delivery"
          : "pending_payment";
      let paymentReceiptRequired = false;

      if (
        formData.payment_method === "transfer" &&
        receiptFile &&
        token &&
        createdOrder?.id
      ) {
        try {
          const updatedOrder = await authApi.uploadMyPaymentReceipt(
            token,
            createdOrder.id,
            receiptFile,
          );
          paymentStatus = updatedOrder.payment_status || "pending_validation";
        } catch (uploadError) {
          console.error("❌ Error subiendo comprobante:", uploadError);
          paymentReceiptRequired = true;
        }
      }

      // Guardar en localStorage para la página de confirmación
      if (typeof window !== "undefined") {
        localStorage.setItem(
          "cce_last_order",
          JSON.stringify({
            id: createdOrder?.id,
            created_at: createdOrder?.created_at ?? new Date().toISOString(),
            customer_name: formData.customer_name,
            customer_phone: formData.customer_phone,
            delivery_method: formData.delivery_method,
            payment_method: formData.payment_method,
            payment_status: paymentStatus,
            payment_receipt_required: paymentReceiptRequired,
            pickup_date: formData.pickup_date,
            pickup_time: formData.pickup_time,
            scheduled_date: formData.scheduled_date,
            delivery_address: formData.delivery_address,
            notes: formData.notes,
            estimated_delivery_time:
              createdOrder?.estimated_delivery_time ||
              (formData.delivery_method !== "pickup" ? "45-60 minutos" : null),
            total_price: createdOrder?.total_amount || cartSnapshot?.total_price || 0,
            items: cartSnapshot?.products || [],
          }),
        );
      }

      // 🔥 LIMPIAR EL CARRITO DESPUÉS DE CREAR LA ORDEN
      if (token && cartSnapshot?.id) {
        try {
          await cartApi.clearCart(cartSnapshot.id);
          window.dispatchEvent(new CustomEvent("cart:updated"));
        } catch (clearError) {
          console.warn("No se pudo vaciar el carrito después del pedido", clearError);
        }
      }

      // Redirigir a la página de confirmación
      router.push("/mi-pedido");
    } catch (err: any) {
      console.error("❌ Error creando pedido:", err);
      setError(err.message || "Error al crear el pedido");
    } finally {
      setLoading(false);
    }
  };

  const getPickupMinTime = () => {
    if (!formData.pickup_date || !availability) return "08:00";

    const pickupWeekday = getWeekdayFromISODate(formData.pickup_date);
    return pickupWeekday === 0
      ? toTimeInput(availability.pickup_sunday_open)
      : toTimeInput(availability.pickup_weekday_open);
  };

  const getPickupMaxTime = () => {
    if (!formData.pickup_date || !availability) return "20:00";

    const pickupWeekday = getWeekdayFromISODate(formData.pickup_date);
    return pickupWeekday === 0
      ? toTimeInput(availability.pickup_sunday_close)
      : toTimeInput(availability.pickup_weekday_close);
  };

  const isPickupSunday =
    Boolean(formData.pickup_date) &&
    getWeekdayFromISODate(formData.pickup_date) === 0;

  const pickupScheduleLabel =
    isPickupSunday
      ? `Hora de recogida * (domingo: ${formatTime12h(availability?.pickup_sunday_open ?? "08:00:00")} - ${formatTime12h(availability?.pickup_sunday_close ?? "20:00:00")})`
      : `Hora de recogida * (lunes a sábado: ${formatTime12h(availability?.pickup_weekday_open ?? "09:00:00")} - ${formatTime12h(availability?.pickup_weekday_close ?? "20:00:00")})`;

  useEffect(() => {
    if (!token) {
      return;
    }

    let cancelled = false;

    const loadAccountDefaults = async () => {
      try {
        const me = await authApi.me(token);
        if (cancelled) return;

        const deliveryParts = [
          me.delivery_local_address?.trim() || "",
          me.delivery_city?.trim() || "",
          me.delivery_region?.trim() || "",
        ].filter(Boolean);

        const preferredDeliveryAddress =
          deliveryParts.length > 0
            ? deliveryParts.join(", ")
            : (me.address || "").trim();

        setFormData((prev) => ({
          ...prev,
          customer_name: prev.customer_name || me.full_name || "",
          customer_phone: prev.customer_phone || me.phone || "",
          customer_email: prev.customer_email || me.email || "",
          delivery_address: prev.delivery_address || preferredDeliveryAddress,
        }));
      } catch {
        // Keep checkout usable even if profile loading fails.
      }
    };

    void loadAccountDefaults();

    return () => {
      cancelled = true;
    };
  }, [token]);

  useEffect(() => {
    const loadAvailability = async () => {
      try {
        const data = await getOrderAvailability();
        setAvailability(data);
      } catch {
        setAvailability(null);
      }
    };

    void loadAvailability();
  }, []);

  useEffect(() => {
    const loadPaymentSettings = async () => {
      try {
        const data = await getManualPaymentSettings();
        setPaymentSettings(data);
      } catch {
        setPaymentSettings(null);
      }
    };

    void loadPaymentSettings();
  }, []);

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

        {availability?.order_notice && (
          <div className="mb-4 rounded-xl border-2 border-red-400 bg-red-100 p-4 text-red-900">
            {availability.order_notice}
          </div>
        )}

        {ordersDisabledGlobally && (
          <div className="mb-4 rounded-xl border-2 border-red-600 bg-red-200 p-4 font-semibold text-red-950">
            Los pedidos están cerrados temporalmente en todas las modalidades.
          </div>
        )}

        {globalRestrictionToday && (
          <div className="mb-4 rounded-xl border-2 border-red-500 bg-red-100 p-4 text-red-900">
            Hay una restricción global activa para hoy y no se permiten pedidos en ninguna modalidad.
            {globalRestrictionToday.reason ? ` Motivo: ${globalRestrictionToday.reason}` : ""}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          {/* ... resto del formulario igual ... */}
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
              disabled={Boolean(globalRestrictionToday) || ordersDisabledGlobally}
              className="w-full rounded-lg border border-[color-mix(in_srgb,var(--primary)_18%,white)] bg-white px-3 py-2 outline-none focus:border-[var(--primary)]"
            >
              <option value="pickup">Recoger en sede</option>
              <option value="delivery">Entrega a domicilio</option>
              <option value="scheduled">Programado</option>
            </select>
            {(globalRestrictionToday || ordersDisabledGlobally) && (
              <p className="mt-1 text-xs font-medium text-red-700">
                El selector está bloqueado por cierre global de pedidos.
              </p>
            )}
          </div>

          <div className="rounded-xl border border-[color-mix(in_srgb,var(--primary)_12%,white)] bg-[color-mix(in_srgb,var(--secondary)_10%,white)] p-4">
            <h3 className="mb-3 font-semibold text-[var(--primary)]">Metodo de pago *</h3>
            <div className="grid gap-3 md:grid-cols-2">
              <label
                className={`flex cursor-pointer items-start gap-3 rounded-lg border px-3 py-3 text-sm transition ${
                  formData.payment_method === "cash_on_delivery"
                    ? "border-[var(--primary)] bg-white"
                    : "border-[color-mix(in_srgb,var(--primary)_14%,white)] bg-white"
                }`}
              >
                <input
                  type="radio"
                  name="payment_method"
                  value="cash_on_delivery"
                  checked={formData.payment_method === "cash_on_delivery"}
                  onChange={handleChange}
                  className="mt-1"
                />
                <span>
                  <span className="block font-semibold text-[var(--primary)]">Pago contra entrega</span>
                  <span className="mt-1 block text-xs text-[var(--muted-foreground)]">
                    Pagas en efectivo al recibir el pedido.
                  </span>
                </span>
              </label>

              <label
                className={`flex cursor-pointer items-start gap-3 rounded-lg border px-3 py-3 text-sm transition ${
                  formData.payment_method === "transfer"
                    ? "border-[var(--primary)] bg-white"
                    : "border-[color-mix(in_srgb,var(--primary)_14%,white)] bg-white"
                }`}
              >
                <input
                  type="radio"
                  name="payment_method"
                  value="transfer"
                  checked={formData.payment_method === "transfer"}
                  onChange={handleChange}
                  className="mt-1"
                />
                <span>
                  <span className="block font-semibold text-[var(--primary)]">Pago online (transferencia)</span>
                  <span className="mt-1 block text-xs text-[var(--muted-foreground)]">
                    Subes el comprobante y validamos manualmente.
                  </span>
                </span>
              </label>
            </div>

            {formData.payment_method === "transfer" && (
              <div className="mt-4 rounded-lg border border-[color-mix(in_srgb,var(--primary)_14%,white)] bg-white p-4">
                <div className="grid gap-4 md:grid-cols-[160px_1fr]">
                  <div className="flex items-center justify-center rounded-lg border border-dashed border-[color-mix(in_srgb,var(--primary)_20%,white)] bg-[var(--background)] p-3">
                    {paymentSettings?.qr_image ? (
                      <img
                        src={paymentSettings.qr_image}
                        alt="QR pago"
                        className="h-28 w-28 object-contain"
                      />
                    ) : (
                      <p className="text-xs text-[var(--muted-foreground)]">
                        QR no disponible
                      </p>
                    )}
                  </div>
                  <div className="text-sm text-[var(--foreground)]">
                    <p className="font-semibold text-[var(--primary)]">
                      Datos para transferencia
                    </p>
                    <div className="mt-2 space-y-1">
                      <p><strong>Banco:</strong> {paymentSettings?.bank_name || "Por definir"}</p>
                      <p><strong>Cuenta:</strong> {paymentSettings?.account_number || "Por definir"}</p>
                      <p><strong>Tipo:</strong> {paymentSettings?.account_type || "Por definir"}</p>
                      <p><strong>Titular:</strong> {paymentSettings?.account_holder || "Por definir"}</p>
                      {paymentSettings?.transfer_key && (
                        <p><strong>Llave:</strong> {paymentSettings.transfer_key}</p>
                      )}
                    </div>
                    {paymentSettings?.instructions && (
                      <p className="mt-3 text-xs text-[var(--muted-foreground)]">
                        {paymentSettings.instructions}
                      </p>
                    )}
                  </div>
                </div>

                <div className="mt-4">
                  <label className="mb-1 block text-sm font-medium text-[var(--primary)]">
                    Subir comprobante (JPG, PNG o PDF) *
                  </label>
                  <input
                    type="file"
                    accept=".jpg,.jpeg,.png,.pdf"
                    onChange={handleReceiptChange}
                    className="w-full rounded-lg border border-[color-mix(in_srgb,var(--primary)_18%,white)] bg-white px-3 py-2 text-sm"
                  />
                  <p className="mt-1 text-xs text-[var(--muted-foreground)]">
                    Tamano maximo: {receiptMaxMb} MB.
                  </p>
                  {receiptError && (
                    <p className="mt-2 text-xs font-semibold text-red-700">{receiptError}</p>
                  )}
                </div>
              </div>
            )}
          </div>

          {formData.delivery_method === "pickup" && (
            <div className="space-y-4 rounded-xl border border-[color-mix(in_srgb,var(--primary)_12%,white)] bg-[color-mix(in_srgb,var(--secondary)_16%,white)] p-4">
              <h3 className="font-semibold text-[var(--primary)]">Recogida en sede</h3>
              <p className="text-sm text-[var(--muted-foreground)]">
                Horario: lunes a sábado de {formatTime12h(availability?.pickup_weekday_open ?? "09:00:00")} a {formatTime12h(availability?.pickup_weekday_close ?? "20:00:00")} y domingo de {formatTime12h(availability?.pickup_sunday_open ?? "08:00:00")} a {formatTime12h(availability?.pickup_sunday_close ?? "20:00:00")}.
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
                  max={getPickupMaxTime()}
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

          {(formData.delivery_method === "delivery" || formData.delivery_method === "scheduled") && (
            <div className="rounded-xl border border-[color-mix(in_srgb,var(--primary)_12%,white)] bg-[color-mix(in_srgb,var(--secondary)_20%,white)] p-4">
              <h3 className="mb-2 font-semibold text-[var(--primary)]">Dirección de entrega</h3>
              <p className="mb-3 text-sm text-[var(--muted-foreground)]">
                Horario domicilio: lunes a sábado de {formatTime12h(availability?.delivery_weekday_open ?? "09:00:00")} a {formatTime12h(availability?.delivery_weekday_close ?? "19:30:00")}, domingo de {formatTime12h(availability?.delivery_sunday_open ?? "08:00:00")} a {formatTime12h(availability?.delivery_sunday_close ?? "19:30:00")}.
              </p>
              <p className="mb-3 text-sm font-semibold text-[var(--primary)]">
                {formData.delivery_method === "scheduled"
                  ? "Programas este domicilio para una fecha futura."
                  : "Tiempo estimado de entrega: 45-60 minutos"}
              </p>
              <textarea
                name="delivery_address"
                value={formData.delivery_address}
                onChange={handleChange}
                onBlur={() => {
                  void handleValidateDeliveryAddress();
                }}
                required
                rows={3}
                className="w-full rounded-lg border border-[color-mix(in_srgb,var(--primary)_18%,white)] bg-white px-3 py-2 outline-none focus:border-[var(--primary)]"
                placeholder="Calle, número, barrio..."
              />
              {deliveryValidation && (
                <div
                  className={`mt-3 rounded-lg border px-3 py-2 text-sm ${
                    deliveryValidation.status === "valid"
                      ? "border-green-200 bg-green-50 text-green-800"
                      : "border-amber-200 bg-amber-50 text-amber-800"
                  }`}
                >
                  <p>{deliveryValidation.message}</p>
                  {deliveryValidation.distance_km && (
                    <p className="mt-1 text-xs">
                      Distancia estimada: {deliveryValidation.distance_km} km
                    </p>
                  )}
                  {deliveryValidation.delivery_maps_url && (
                    <a
                      href={deliveryValidation.delivery_maps_url}
                      target="_blank"
                      rel="noreferrer"
                      className="mt-2 inline-block text-xs font-semibold underline"
                    >
                      Ver ubicación en mapa
                    </a>
                  )}
                </div>
              )}
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
              disabled={loading || Boolean(globalRestrictionToday) || ordersDisabledGlobally}
              className="flex-1 rounded-lg bg-[var(--accent)] py-2.5 font-semibold text-[var(--accent-foreground)] shadow-sm transition-colors hover:bg-[color-mix(in_srgb,var(--accent)_88%,black)] disabled:opacity-50"
            >
              {globalRestrictionToday || ordersDisabledGlobally ? "Pedidos deshabilitados" : loading ? "Creando..." : "Confirmar Pedido"}
            </button>
          </div>
        </form>
      </div>
    </main>
  );
}