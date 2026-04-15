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

export default function OrderHistoryPage() {
  const router = useRouter();
  const { token } = useAuth();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [orders, setOrders] = useState<authApi.OrderHistoryItem[]>([]);
  const [expandedOrders, setExpandedOrders] = useState<Record<number, boolean>>({});

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
      } catch (err: any) {
        if (cancelled) return;
        setError(err?.message || "No se pudo cargar el historial de pedidos");
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    void loadOrders();

    return () => {
      cancelled = true;
    };
  }, [token, router]);

  if (loading) {
    return (
      <main className="min-h-screen bg-[var(--cce-beige)] px-4 py-10 md:px-10">
        <div className="mx-auto max-w-4xl bg-white p-6 rounded">Cargando historial...</div>
      </main>
    );
  }

  if (error) {
    return (
      <main className="min-h-screen bg-[var(--cce-beige)] px-4 py-10 md:px-10">
        <div className="mx-auto max-w-4xl bg-white p-6 rounded text-red-700">{error}</div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[var(--cce-beige)] px-4 py-10 md:px-10">
      <div className="mx-auto max-w-4xl bg-white p-6 rounded">
        <h1 className="text-2xl font-bold mb-6">Historial de pedidos</h1>

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
                        STATUS_BADGE_STYLES[order.status] || "bg-gray-100 text-gray-700"
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
                      {expandedOrders[order.id] ? "Ocultar detalle" : "Ver detalle"}
                    </button>
                  </div>
                </div>

                <p className="text-sm text-gray-700">
                  <strong>Fecha:</strong> {formatDate(order.created_at)}
                </p>
                <p className="text-sm text-gray-700">
                  <strong>Modalidad:</strong> {DELIVERY_LABELS[order.delivery_method] || order.delivery_method}
                </p>
                <p className="text-sm text-gray-700">
                  <strong>Total:</strong> ${Number(order.total_amount).toFixed(0)}
                </p>

                {order.delivery_method === "delivery" && order.delivery_address && (
                  <p className="text-sm text-gray-700">
                    <strong>Direccion:</strong> {order.delivery_address}
                  </p>
                )}

                {order.delivery_method === "pickup" && (
                  <p className="text-sm text-gray-700">
                    <strong>Recogida:</strong> {order.pickup_date || "-"} {order.pickup_time || ""}
                  </p>
                )}

                {order.delivery_method === "scheduled" && (
                  <p className="text-sm text-gray-700">
                    <strong>Programado para:</strong> {order.scheduled_date || "-"}
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
                      <p className="text-sm text-gray-600">Este pedido no tiene productos asociados.</p>
                    ) : (
                      <div className="space-y-3">
                        {order.items.map((item: authApi.OrderHistoryItem["items"][number]) => (
                          <div key={item.id} className="flex items-start justify-between gap-4 rounded bg-gray-50 p-3">
                            <div>
                              <p className="font-medium">{item.product.name}</p>
                              <p className="text-sm text-gray-600">Cantidad: {item.quantity}</p>
                              <p className="text-sm text-gray-600">Precio unitario: ${Number(item.unit_price).toFixed(0)}</p>
                            </div>
                            <p className="text-sm font-semibold">Subtotal: ${Number(item.subtotal).toFixed(0)}</p>
                          </div>
                        ))}
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
