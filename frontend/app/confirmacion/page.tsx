"use client";

import { useEffect, useMemo } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";

interface OrderConfirmationData {
  order_id: number;
  customer_name: string;
  delivery_method: string;
  total_amount: number;
  pickup_date?: string;
  pickup_time?: string;
  scheduled_date?: string;
  status: string;
}

export default function OrderConfirmationPage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const orderData = useMemo<OrderConfirmationData | null>(() => {
    const orderId = searchParams.get("orderId");
    if (!orderId) {
      return null;
    }

    const parsedOrderId = Number.parseInt(orderId, 10);
    if (Number.isNaN(parsedOrderId)) {
      return null;
    }

    // Simular carga de datos del pedido
    // En producción, esto vendría del backend
    return {
      order_id: parsedOrderId,
      customer_name: "Nombre del Cliente",
      delivery_method: "pickup",
      total_amount: 50000,
      pickup_date: new Date().toISOString().split("T")[0],
      pickup_time: "15:00",
      status: "pending",
    };
  }, [searchParams]);

  useEffect(() => {
    if (!orderData) {
      router.replace("/");
    }
  }, [orderData, router]);

  if (!orderData) {
    return (
      <main className="min-h-screen bg-[var(--cce-beige)] px-4 py-10 md:px-10">
        <div className="mx-auto max-w-2xl bg-white p-6 rounded text-center">
          <p className="text-red-600">
            No se encontró la información del pedido
          </p>
          <Link
            href="/"
            className="mt-4 inline-block rounded bg-[var(--cce-green-dark)] text-white px-6 py-2"
          >
            Volver al inicio
          </Link>
        </div>
      </main>
    );
  }

  const getDeliveryMethodLabel = (method: string) => {
    const labels: Record<string, string> = {
      pickup: "Recoger en tienda",
      delivery: "Entrega a domicilio",
      scheduled: "Programado",
    };
    return labels[method] || method;
  };

  const getStatusLabel = (status: string) => {
    const labels: Record<string, string> = {
      pending: "Pendiente",
      confirmed: "Confirmado",
      preparing: "En preparación",
      ready: "Listo",
      completed: "Completado",
      cancelled: "Cancelado",
    };
    return labels[status] || status;
  };

  return (
    <main className="min-h-screen bg-[var(--cce-beige)] px-4 py-10 md:px-10">
      <div className="mx-auto max-w-2xl">
        {/* Success Icon */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-green-100 mb-4">
            <svg
              className="w-8 h-8 text-green-600"
              fill="currentColor"
              viewBox="0 0 20 20"
            >
              <path
                fillRule="evenodd"
                d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                clipRule="evenodd"
              />
            </svg>
          </div>
          <h1 className="text-3xl font-bold text-[var(--cce-green-dark)] mb-2">
            ¡Pedido Confirmado!
          </h1>
          <p className="text-gray-600 mb-4">
            Tu pedido ha sido registrado exitosamente
          </p>
        </div>

        {/* Confirmation Card */}
        <div className="bg-white rounded-lg p-8 shadow-lg mb-8">
          {/* Order ID */}
          <div className="border-b pb-6 mb-6">
            <p className="text-sm text-gray-600 mb-1">Número de pedido</p>
            <p className="text-4xl font-bold text-[var(--cce-green-dark)]">
              #{orderData.order_id}
            </p>
          </div>

          {/* Order Details Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
            {/* Monto Total */}
            <div className="border rounded-lg p-4 bg-blue-50">
              <p className="text-sm text-gray-600 font-semibold">
                Total del pedido
              </p>
              <p className="text-2xl font-bold text-[var(--cce-green-dark)] mt-2">
                ${orderData.total_amount.toLocaleString()}
              </p>
            </div>

            {/* Estado */}
            <div className="border rounded-lg p-4 bg-amber-50">
              <p className="text-sm text-gray-600 font-semibold">
                Estado actual
              </p>
              <p className="text-2xl font-bold text-amber-700 mt-2">
                {getStatusLabel(orderData.status)}
              </p>
            </div>

            {/* Tipo de Entrega */}
            <div className="border rounded-lg p-4 bg-purple-50">
              <p className="text-sm text-gray-600 font-semibold">Modalidad</p>
              <p className="text-2xl font-bold text-purple-700 mt-2">
                {getDeliveryMethodLabel(orderData.delivery_method)}
              </p>
            </div>

            {/* Detalles de Entrega */}
            <div className="border rounded-lg p-4 bg-green-50">
              <p className="text-sm text-gray-600 font-semibold">Detalles</p>
              {orderData.delivery_method === "pickup" && (
                <div className="mt-2">
                  <p className="text-sm">
                    <strong>Fecha:</strong> {orderData.pickup_date}
                  </p>
                  <p className="text-sm">
                    <strong>Hora:</strong> {orderData.pickup_time}
                  </p>
                </div>
              )}
              {orderData.delivery_method === "scheduled" && (
                <p className="text-sm mt-2">
                  <strong>Fecha:</strong> {orderData.scheduled_date}
                </p>
              )}
              {orderData.delivery_method === "delivery" && (
                <p className="text-sm mt-2 text-green-700">
                  Nos contactaremos pronto para confirmar los detalles
                </p>
              )}
            </div>
          </div>

          {/* Important Note */}
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-6">
            <div className="flex">
              <svg
                className="w-5 h-5 text-yellow-600 mr-2 flex-shrink-0 mt-0.5"
                fill="currentColor"
                viewBox="0 0 20 20"
              >
                <path
                  fillRule="evenodd"
                  d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
                  clipRule="evenodd"
                />
              </svg>
              <div>
                <p className="font-semibold text-yellow-800 mb-1">Importante</p>
                <p className="text-sm text-yellow-700">
                  Hemos enviado los detalles de tu pedido a tu número de
                  WhatsApp. Guarda este número de pedido para futuras
                  referencias.
                </p>
              </div>
            </div>
          </div>

          {/* What's Next Section */}
          <div className="bg-gray-50 rounded-lg p-4">
            <h3 className="font-semibold text-gray-800 mb-3">¿Qué sigue?</h3>
            <ol className="space-y-2 text-sm text-gray-700">
              <li className="flex items-start">
                <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-[var(--cce-green-dark)] text-white text-xs mr-3 flex-shrink-0">
                  1
                </span>
                <span>Recibirás actualizaciones por WhatsApp</span>
              </li>
              <li className="flex items-start">
                <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-[var(--cce-green-dark)] text-white text-xs mr-3 flex-shrink-0">
                  2
                </span>
                <span>
                  {orderData.delivery_method === "delivery"
                    ? "Nos contactaremos para confirmar dirección y horario"
                    : "Tu pedido será preparado"}
                </span>
              </li>
              <li className="flex items-start">
                <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-[var(--cce-green-dark)] text-white text-xs mr-3 flex-shrink-0">
                  3
                </span>
                <span>
                  {orderData.delivery_method === "pickup"
                    ? `Recógelo el ${orderData.pickup_date} a las ${orderData.pickup_time}`
                    : "Recibirás por WhatsApp cuando esté listo"}
                </span>
              </li>
            </ol>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-col gap-3">
          <Link
            href="/ordenes"
            className="text-center rounded bg-[var(--cce-green-dark)] text-white py-3 font-semibold hover:opacity-90 transition"
          >
            Ver mis pedidos
          </Link>
          <Link
            href="/"
            className="text-center rounded border-2 border-[var(--cce-green-dark)] text-[var(--cce-green-dark)] py-3 font-semibold hover:bg-[var(--cce-beige)] transition"
          >
            Continuar comprando
          </Link>
        </div>
      </div>
    </main>
  );
}
