"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import useAuth from "@/context/AuthContext";
import { getCourierAssignedOrders } from "@/lib/courier-orders-api";
import type { OrderHistoryItem } from "@/lib/auth-api";

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
  pickup: "Recoger en tienda",
  delivery: "Domicilio",
  scheduled: "Programado",
};

function formatDate(dateValue: string | null | undefined) {
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

function getDeliveryMapsUrl(order: OrderHistoryItem) {
  if (order.delivery_maps_url) {
    return order.delivery_maps_url;
  }

  if (!order.delivery_address) {
    return "";
  }

  return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(order.delivery_address)}`;
}

export default function CourierOrdersPage() {
  const router = useRouter();
  const { token, authReady, user } = useAuth();
  const [orders, setOrders] = useState<OrderHistoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const canAccess = Boolean(token && user?.role === "courier");

  useEffect(() => {
    if (!authReady) return;

    if (!token) {
      router.replace("/login");
      return;
    }

    if (user && user.role !== "courier") {
      router.replace("/catalogo");
      return;
    }

    let cancelled = false;

    const loadOrders = async () => {
      if (!canAccess) return;

      setLoading(true);
      setError(null);

      try {
        const data = await getCourierAssignedOrders();
        if (cancelled) return;
        setOrders(data.results || []);
      } catch (loadError: unknown) {
        if (cancelled) return;
        setError(
          loadError instanceof Error
            ? loadError.message
            : "No se pudieron cargar los pedidos asignados",
        );
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    void loadOrders();

    return () => {
      cancelled = true;
    };
  }, [authReady, canAccess, router, token, user]);

  const pendingOrders = useMemo(
    () => orders.filter((order) => order.status !== "completed").length,
    [orders],
  );

  if (!authReady || !token || !canAccess) {
    return (
      <main className="min-h-screen bg-[var(--cce-beige)] px-4 py-8 md:px-8">
        <div className="mx-auto max-w-4xl rounded-xl bg-white p-6 text-center text-[var(--cce-text-muted)] shadow-[0_8px_30px_rgba(31,77,58,0.09)]">
          Verificando permisos...
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[var(--cce-beige)] px-4 py-8 md:px-8">
      <div className="mx-auto max-w-5xl space-y-6">
        <section className="rounded-xl bg-white p-6 shadow-[0_8px_30px_rgba(31,77,58,0.09)]">
          <h1 className="text-2xl font-bold text-[var(--cce-green-dark)]">
            Pedidos asignados
          </h1>
          <p className="mt-1 text-sm text-[var(--cce-text-muted)]">
            Consulta los pedidos que te fueron asignados y revisa el detalle de
            cada entrega.
          </p>

          <div className="mt-5 grid grid-cols-1 gap-3 md:grid-cols-2">
            <div className="rounded-lg border border-[color-mix(in_srgb,var(--cce-green-dark)_15%,white)] p-4">
              <p className="text-sm text-[var(--cce-text-muted)]">
                Total asignados
              </p>
              <p className="text-2xl font-bold text-[var(--cce-green-dark)]">
                {orders.length}
              </p>
            </div>
            <div className="rounded-lg border border-[color-mix(in_srgb,var(--cce-green-dark)_15%,white)] p-4">
              <p className="text-sm text-[var(--cce-text-muted)]">Pendientes</p>
              <p className="text-2xl font-bold text-[var(--cce-green-dark)]">
                {pendingOrders}
              </p>
            </div>
          </div>
        </section>

        <section className="rounded-xl bg-white p-6 shadow-[0_8px_30px_rgba(31,77,58,0.09)]">
          <h2 className="text-xl font-bold text-[var(--cce-green-dark)]">
            Lista de pedidos
          </h2>

          {loading ? (
            <p className="mt-4 text-sm text-[var(--cce-text-muted)]">
              Cargando pedidos asignados...
            </p>
          ) : error ? (
            <div className="mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {error}
            </div>
          ) : orders.length === 0 ? (
            <p className="mt-4 text-sm text-[var(--cce-text-muted)]">
              No tienes pedidos asignados por ahora.
            </p>
          ) : (
            <div className="mt-4 space-y-4">
              {orders.map((order) => (
                <article
                  key={order.id}
                  className="rounded-lg border border-[color-mix(in_srgb,var(--cce-green-dark)_15%,white)] p-4"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <h3 className="text-lg font-semibold text-[var(--cce-green-dark)]">
                      Pedido {order.id}
                    </h3>
                    <span
                      className={`rounded px-2 py-1 text-sm ${STATUS_BADGE_STYLES[order.status] || "bg-gray-100 text-gray-700"}`}
                    >
                      {STATUS_LABELS[order.status] || order.status}
                    </span>
                  </div>

                  <div className="mt-2 grid grid-cols-1 gap-1 text-sm text-gray-700 md:grid-cols-2">
                    <p>
                      <strong>Cliente:</strong> {order.customer_name}
                    </p>
                    <p>
                      <strong>Telefono:</strong> {order.customer_phone}
                    </p>
                    <p>
                      <strong>Tipo:</strong>{" "}
                      {DELIVERY_LABELS[order.delivery_method] ||
                        order.delivery_method}
                    </p>
                    <p>
                      <strong>Fecha:</strong> {formatDate(order.created_at)}
                    </p>
                    <p>
                      <strong>Total:</strong> ${Number(order.total_amount).toFixed(0)}
                    </p>
                    <p>
                      <strong>Asignado:</strong> {formatDate(order.assigned_at)}
                    </p>
                  </div>

                  {order.delivery_method === "delivery" &&
                    getDeliveryMapsUrl(order) && (
                      <div className="mt-3">
                        <a
                          href={getDeliveryMapsUrl(order)}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex rounded bg-blue-600 px-3 py-1 text-sm font-semibold text-white hover:bg-blue-700"
                        >
                          Abrir en Google Maps
                        </a>
                      </div>
                    )}

                  {order.delivery_method === "delivery" &&
                    order.delivery_address && (
                      <p className="mt-2 text-sm text-gray-600">
                        <strong>Direccion:</strong> {order.delivery_address}
                      </p>
                    )}

                  {order.assigned_courier_display_name && (
                    <p className="mt-2 text-sm text-gray-600">
                      <strong>Repartidor:</strong>{" "}
                      {order.assigned_courier_display_name}
                    </p>
                  )}
                </article>
              ))}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
