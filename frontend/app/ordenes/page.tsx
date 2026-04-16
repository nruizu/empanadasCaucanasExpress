"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import useAuth from "@/context/AuthContext";
import * as authApi from "@/lib/auth-api";

const STATUS_LABELS: Record<string, string> = {
  pending: "Pendiente",
  confirmed: "Confirmado",
  preparing: "En preparacion",
  ready: "Listo",
  completed: "Completado",
  cancelled: "Cancelado",
};

const STATUS_BADGE_STYLES: Record<string, string> = {
  pending: "bg-amber-100 text-amber-800",
  confirmed: "bg-sky-100 text-sky-800",
  preparing: "bg-indigo-100 text-indigo-800",
  ready: "bg-emerald-100 text-emerald-800",
  completed: "bg-gray-100 text-gray-700",
  cancelled: "bg-rose-100 text-rose-800",
};

const DELIVERY_LABELS: Record<string, string> = {
  pickup: "Recoger en sede",
  delivery: "Entrega a domicilio",
  scheduled: "Programado",
};

function formatDate(dateValue: string | null) {
  if (!dateValue) return "-";
  const date = new Date(dateValue);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleString("es-CO", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function getDeliveryMapsUrl(order: authApi.OrderHistoryItem) {
  if (order.delivery_maps_url) {
    return order.delivery_maps_url;
  }

  if (!order.delivery_address) {
    return "";
  }

  return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(order.delivery_address)}`;
}

function getErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}

export default function OrderHistoryPage() {
  const router = useRouter();
  const { token } = useAuth();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [orders, setOrders] = useState<authApi.OrderHistoryItem[]>([]);
  const [expandedOrders, setExpandedOrders] = useState<Record<number, boolean>>(
    {},
  );
  const [nowMs, setNowMs] = useState(Date.now());
  const [cancellingOrderId, setCancellingOrderId] = useState<number | null>(
    null,
  );

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      setNowMs(Date.now());
    }, 1000);

    return () => {
      window.clearInterval(intervalId);
    };
  }, []);

  const getCancelDeadlineMs = (createdAt: string) => {
    return new Date(createdAt).getTime() + 5 * 60 * 1000;
  };

  const getRemainingCancelMs = (order: authApi.OrderHistoryItem) => {
    return getCancelDeadlineMs(order.created_at) - nowMs;
  };

  const canCancelOrder = (order: authApi.OrderHistoryItem) => {
    if (order.status === "cancelled" || order.status === "completed") {
      return false;
    }

    return getRemainingCancelMs(order) > 0;
  };

  const formatCountdown = (remainingMs: number) => {
    const totalSeconds = Math.max(0, Math.floor(remainingMs / 1000));
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
  };

  useEffect(() => {
    if (token === null) return;
    if (!token) {
      router.push("/login");
      return;
    }

    let cancelled = false;

    const loadOrders = async () => {
      try {
        const data = await authApi.myOrderHistory(token);
        if (cancelled) return;
        setOrders(data.results || []);
      } catch (error: unknown) {
        if (cancelled) return;
        setError(
          getErrorMessage(error, "No se pudo cargar el historial de pedidos"),
        );
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    void loadOrders();

    return () => {
      cancelled = true;
    };
  }, [token, router]);

  const handleCancelOrder = async (orderId: number) => {
    if (!token) return;

    setError(null);
    setSuccess(null);
    setCancellingOrderId(orderId);

    try {
      const updatedOrder = await authApi.cancelMyOrder(token, orderId);
      setOrders((current) =>
        current.map((order) => (order.id === orderId ? updatedOrder : order)),
      );
      setSuccess(`Pedido ${orderId} cancelado correctamente.`);
    } catch (err: unknown) {
      setError(
        err instanceof Error ? err.message : "No se pudo cancelar el pedido.",
      );
    } finally {
      setCancellingOrderId(null);
    }
  };

  if (loading) {
    return (
      <main className="min-h-screen bg-[var(--cce-beige)] px-4 py-10 md:px-10">
        <div className="mx-auto max-w-4xl bg-white p-6 rounded">
          Cargando historial...
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[var(--cce-beige)] px-4 py-10 md:px-10">
      <div className="mx-auto max-w-4xl bg-white p-6 rounded">
        <h1 className="text-2xl font-bold mb-6">Historial de pedidos</h1>

        {success && (
          <div className="mb-4 rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">
            {success}
          </div>
        )}

        {error && (
          <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        {orders.length === 0 ? (
          <p className="text-gray-600">Aun no tienes pedidos registrados.</p>
        ) : (
          <div className="space-y-4">
            {orders.map((order: authApi.OrderHistoryItem) => (
              <article key={order.id} className="border rounded p-4">
                <div className="flex items-center justify-between mb-2">
                  <h2 className="text-lg font-semibold">Pedido {order.id}</h2>
                  <div className="flex items-center gap-2">
                    <span
                      className={`text-sm px-2 py-1 rounded ${
                        STATUS_BADGE_STYLES[order.status] ||
                        "bg-gray-100 text-gray-700"
                      }`}
                    >
                      {STATUS_LABELS[order.status] || order.status}
                    </span>
                    <button
                      type="button"
                      onClick={() =>
                        setExpandedOrders((prev: Record<number, boolean>) => ({
                          ...prev,
                          [order.id]: !prev[order.id],
                        }))
                      }
                      className="text-sm px-3 py-1 rounded border border-[var(--cce-green-dark)] text-[var(--cce-green-dark)] hover:bg-[var(--cce-green-dark)] hover:text-white"
                    >
                      {expandedOrders[order.id]
                        ? "Ocultar detalle"
                        : "Ver detalle"}
                    </button>
                  </div>
                </div>

                <p className="text-sm text-gray-700">
                  <strong>Fecha:</strong> {formatDate(order.created_at)}
                </p>
                <p className="text-sm text-gray-700">
                  <strong>Modalidad:</strong>{" "}
                  {DELIVERY_LABELS[order.delivery_method] ||
                    order.delivery_method}
                </p>
                <p className="text-sm text-gray-700">
                  <strong>Total:</strong> $
                  {Number(order.total_amount).toFixed(0)}
                </p>

                {canCancelOrder(order) && (
                  <div className="mt-2 rounded border border-amber-200 bg-amber-50 p-2 text-sm text-amber-800">
                    <p>
                      Tiempo restante para cancelar:{" "}
                      {formatCountdown(getRemainingCancelMs(order))}
                    </p>
                    <button
                      type="button"
                      onClick={() => void handleCancelOrder(order.id)}
                      disabled={cancellingOrderId === order.id}
                      className="mt-2 inline-flex rounded bg-red-600 px-3 py-1 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-60"
                    >
                      {cancellingOrderId === order.id
                        ? "Cancelando..."
                        : "Cancelar pedido"}
                    </button>
                  </div>
                )}

                {!canCancelOrder(order) &&
                  order.status !== "cancelled" &&
                  order.status !== "completed" && (
                    <p className="mt-2 text-sm text-gray-500">
                      El tiempo para cancelar este pedido ya expiro.
                    </p>
                  )}

                {order.delivery_method === "delivery" &&
                  order.delivery_address && (
                    <>
                      <p className="text-sm text-gray-700">
                        <strong>Direccion:</strong> {order.delivery_address}
                      </p>
                      {getDeliveryMapsUrl(order) && (
                        <div className="mt-1 text-sm text-gray-700">
                          <p>
                            <strong>URL Maps:</strong>{" "}
                            <a
                              href={getDeliveryMapsUrl(order)}
                              target="_blank"
                              rel="noreferrer"
                              className="text-blue-700 underline break-all"
                            >
                              {getDeliveryMapsUrl(order)}
                            </a>
                          </p>
                          <a
                            href={getDeliveryMapsUrl(order)}
                            target="_blank"
                            rel="noreferrer"
                            className="mt-2 inline-flex rounded bg-blue-600 px-3 py-1 text-sm font-semibold text-white hover:bg-blue-700"
                          >
                            Abrir en Google Maps
                          </a>
                        </div>
                      )}
                    </>
                  )}

                {order.delivery_method === "pickup" && (
                  <p className="text-sm text-gray-700">
                    <strong>Recogida:</strong> {order.pickup_date || "-"}{" "}
                    {order.pickup_time || ""}
                  </p>
                )}

                {order.delivery_method === "scheduled" && (
                  <p className="text-sm text-gray-700">
                    <strong>Programado para:</strong>{" "}
                    {order.scheduled_date || "-"}
                  </p>
                )}

                {order.notes && (
                  <p className="text-sm text-gray-700 mt-2">
                    <strong>Notas:</strong> {order.notes}
                  </p>
                )}

                {expandedOrders[order.id] && (
                  <div className="mt-4 border-t pt-4">
                    <h3 className="font-semibold mb-3">Productos del pedido</h3>
                    {order.items.length === 0 ? (
                      <p className="text-sm text-gray-600">
                        Este pedido no tiene productos asociados.
                      </p>
                    ) : (
                      <div className="space-y-3">
                        {order.items.map(
                          (item: authApi.OrderHistoryItem["items"][number]) => (
                            <div
                              key={item.id}
                              className="flex items-start justify-between gap-4 rounded bg-gray-50 p-3"
                            >
                              <div>
                                <p className="font-medium">
                                  {item.product.name}
                                </p>
                                <p className="text-sm text-gray-600">
                                  Cantidad: {item.quantity}
                                </p>
                                <p className="text-sm text-gray-600">
                                  Precio unitario: $
                                  {Number(item.unit_price).toFixed(0)}
                                </p>
                              </div>
                              <p className="text-sm font-semibold">
                                Subtotal: ${Number(item.subtotal).toFixed(0)}
                              </p>
                            </div>
                          ),
                        )}
                      </div>
                    )}
                  </div>
                )}
              </article>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
