"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import useAuth from "@/context/AuthContext";
import {
  getCourierAssignedOrders,
  updateCourierOrderStatus,
} from "@/lib/courier-orders-api";
import { getStoreLocation } from "@/lib/store-api";
import type { OrderHistoryItem } from "@/lib/auth-api";

const DeliveryMap = dynamic(
  () => import("@/components/repartidor/DeliveryMap"),
  {
    ssr: false,
    loading: () => (
      <div className="h-48 w-full animate-pulse rounded-lg bg-gray-100" />
    ),
  },
);

const STATUS_LABELS: Record<string, string> = {
  pending: "Pendiente",
  confirmed: "Confirmado",
  preparing: "En preparacion",
  ready: "Listo",
  in_transit: "En camino",
  completed: "Completado",
  cancelled: "Cancelado",
};

const STATUS_BADGE_STYLES: Record<string, string> = {
  pending: "bg-amber-100 text-amber-800",
  confirmed: "bg-sky-100 text-sky-800",
  preparing: "bg-indigo-100 text-indigo-800",
  ready: "bg-emerald-100 text-emerald-800",
  in_transit: "bg-orange-100 text-orange-800",
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

interface StoreLocation {
  latitude: number;
  longitude: number;
  name: string;
}

export default function CourierOrdersPage() {
  const router = useRouter();
  const { token, authReady, user } = useAuth();
  const [orders, setOrders] = useState<OrderHistoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [storeLocation, setStoreLocation] = useState<StoreLocation | null>(
    null,
  );
  const [mapVisible, setMapVisible] = useState<Record<number, boolean>>({});
  const [updatingOrderId, setUpdatingOrderId] = useState<number | null>(null);
  const [statusError, setStatusError] = useState<string | null>(null);
  const refreshRef = useRef<ReturnType<typeof setInterval> | null>(null);

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
  }, [authReady, canAccess, router, token, user]);

  const loadData = useMemo(
    () => async () => {
      if (!canAccess) return;

      try {
        const [ordersData, storeData] = await Promise.all([
          getCourierAssignedOrders(),
          getStoreLocation().catch(() => null),
        ]);
        setOrders(ordersData.results || []);
        const lat = Number(storeData?.latitude);
        const lng = Number(storeData?.longitude);
        if (!isNaN(lat) && !isNaN(lng)) {
          setStoreLocation({
            latitude: lat,
            longitude: lng,
            name: storeData?.name || "Tienda",
          });
        }
        setError(null);
      } catch (loadError: unknown) {
        setError(
          loadError instanceof Error
            ? loadError.message
            : "No se pudieron cargar los pedidos asignados",
        );
      } finally {
        setLoading(false);
      }
    },
    [canAccess],
  );

  useEffect(() => {
    if (!authReady || !canAccess) return;

    let cancelled = false;

    const initialLoad = async () => {
      setLoading(true);
      await loadData();
    };

    void initialLoad();

    refreshRef.current = setInterval(() => {
      if (!cancelled) {
        void loadData();
      }
    }, 30000);

    return () => {
      cancelled = true;
      if (refreshRef.current) {
        clearInterval(refreshRef.current);
        refreshRef.current = null;
      }
    };
  }, [authReady, canAccess, loadData]);

  const pendingOrders = useMemo(
    () => orders.filter((order) => order.status !== "completed").length,
    [orders],
  );

  const toggleMap = (orderId: number) => {
    setMapVisible((prev) => ({ ...prev, [orderId]: !prev[orderId] }));
  };

  const handleStatusUpdate = async (orderId: number, newStatus: string) => {
    setUpdatingOrderId(orderId);
    setStatusError(null);
    try {
      const updated = await updateCourierOrderStatus(orderId, newStatus);
      setOrders((prev) =>
        prev.map((o) => (o.id === orderId ? { ...o, ...updated } : o)),
      );
    } catch (e: unknown) {
      const msg =
        e instanceof Error ? e.message : "Error al actualizar el estado";
      setStatusError(msg);
    } finally {
      setUpdatingOrderId(null);
    }
  };

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
        {statusError && (
          <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {statusError}
          </div>
        )}

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
                      <strong>Total:</strong> $
                      {Number(order.total_amount).toFixed(0)}
                    </p>
                    <p>
                      <strong>Asignado:</strong> {formatDate(order.assigned_at)}
                    </p>
                  </div>

                  {order.items && order.items.length > 0 && (
                    <div className="mt-3 border-t border-gray-100 pt-3">
                      <p className="mb-1 text-sm font-semibold text-gray-700">
                        Productos:
                      </p>
                      <ul className="space-y-0.5">
                        {order.items.map((item) => (
                          <li
                            key={item.id}
                            className="flex items-center justify-between text-sm text-gray-600"
                          >
                            <span>
                              {item.quantity}x {item.product.name}
                            </span>
                            <span>
                              ${Number(item.subtotal).toFixed(0)}
                            </span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {order.delivery_method === "delivery" && (
                    <>
                      <div className="mt-3 rounded-lg border border-emerald-200 bg-emerald-50 p-3">
                        <div className="flex items-start gap-2">
                          <svg
                            className="mt-0.5 h-5 w-5 flex-shrink-0 text-emerald-600"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                            strokeWidth={2}
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"
                            />
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"
                            />
                          </svg>
                          <div className="flex-1">
                            <p className="text-sm font-semibold text-emerald-800">
                              Direccion de entrega
                            </p>
                            <p className="mt-0.5 text-sm text-emerald-700">
                              {order.delivery_address || "Sin direccion"}
                            </p>
                            {order.delivery_distance_km && (
                              <p className="mt-0.5 text-xs text-emerald-600">
                                Distancia: {order.delivery_distance_km} km
                              </p>
                            )}
                          </div>
                        </div>

                        <div className="mt-2 flex flex-wrap gap-2">
                          {getDeliveryMapsUrl(order) && (
                            <a
                              href={getDeliveryMapsUrl(order)}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex items-center gap-1 rounded bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-700"
                            >
                              <svg
                                className="h-4 w-4"
                                fill="none"
                                viewBox="0 0 24 24"
                                stroke="currentColor"
                                strokeWidth={2}
                              >
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7"
                                />
                              </svg>
                              Google Maps
                            </a>
                          )}

                          {storeLocation &&
                            order.delivery_latitude &&
                            order.delivery_longitude && (
                              <button
                                type="button"
                                onClick={() => toggleMap(order.id)}
                                className="inline-flex items-center gap-1 rounded border border-emerald-600 bg-white px-3 py-1.5 text-xs font-semibold text-emerald-700 hover:bg-emerald-50"
                              >
                                <svg
                                  className="h-4 w-4"
                                  fill="none"
                                  viewBox="0 0 24 24"
                                  stroke="currentColor"
                                  strokeWidth={2}
                                >
                                  <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z"
                                  />
                                </svg>
                                {mapVisible[order.id]
                                  ? "Ocultar mapa"
                                  : "Ver mapa"}
                              </button>
                            )}
                        </div>
                      </div>

                      {mapVisible[order.id] &&
                        storeLocation &&
                        order.delivery_latitude &&
                        order.delivery_longitude && (
                          <div className="mt-3">
                            <DeliveryMap
                              storeLat={storeLocation.latitude}
                              storeLng={storeLocation.longitude}
                              storeName={storeLocation.name}
                              destLat={Number(order.delivery_latitude)}
                              destLng={Number(order.delivery_longitude)}
                              destAddress={
                                order.delivery_address || "Destino"
                              }
                            />
                          </div>
                        )}
                    </>
                  )}

                  {(order.status === "ready" ||
                    order.status === "in_transit") && (
                    <div className="mt-4 flex flex-wrap items-center gap-3">
                      {order.status === "ready" && (
                        <button
                          type="button"
                          onClick={() =>
                            handleStatusUpdate(order.id, "in_transit")
                          }
                          disabled={updatingOrderId === order.id}
                          className="inline-flex items-center gap-1.5 rounded bg-orange-500 px-4 py-2 text-sm font-semibold text-white hover:bg-orange-600 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          {updatingOrderId === order.id ? (
                            <>
                              <svg
                                className="h-4 w-4 animate-spin"
                                fill="none"
                                viewBox="0 0 24 24"
                              >
                                <circle
                                  className="opacity-25"
                                  cx="12"
                                  cy="12"
                                  r="10"
                                  stroke="currentColor"
                                  strokeWidth="4"
                                />
                                <path
                                  className="opacity-75"
                                  fill="currentColor"
                                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                                />
                              </svg>
                              Actualizando...
                            </>
                          ) : (
                            <>
                              <svg
                                className="h-4 w-4"
                                fill="none"
                                viewBox="0 0 24 24"
                                stroke="currentColor"
                                strokeWidth={2}
                              >
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  d="M13 7l5 5m0 0l-5 5m5-5H6"
                                />
                              </svg>
                              En camino
                            </>
                          )}
                        </button>
                      )}

                      {order.status === "in_transit" && (
                        <button
                          type="button"
                          onClick={() =>
                            handleStatusUpdate(order.id, "completed")
                          }
                          disabled={updatingOrderId === order.id}
                          className="inline-flex items-center gap-1.5 rounded bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          {updatingOrderId === order.id ? (
                            <>
                              <svg
                                className="h-4 w-4 animate-spin"
                                fill="none"
                                viewBox="0 0 24 24"
                              >
                                <circle
                                  className="opacity-25"
                                  cx="12"
                                  cy="12"
                                  r="10"
                                  stroke="currentColor"
                                  strokeWidth="4"
                                />
                                <path
                                  className="opacity-75"
                                  fill="currentColor"
                                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                                />
                              </svg>
                              Actualizando...
                            </>
                          ) : (
                            <>
                              <svg
                                className="h-4 w-4"
                                fill="none"
                                viewBox="0 0 24 24"
                                stroke="currentColor"
                                strokeWidth={2}
                              >
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  d="M5 13l4 4L19 7"
                                />
                              </svg>
                              Entregado
                            </>
                          )}
                        </button>
                      )}
                    </div>
                  )}

                  {order.status === "completed" && order.delivered_at && (
                    <div className="mt-4 rounded-lg border border-gray-200 bg-gray-50 px-4 py-3">
                      <p className="text-sm text-gray-700">
                        <strong>Entregado:</strong>{" "}
                        {formatDate(order.delivered_at)}
                      </p>
                    </div>
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
