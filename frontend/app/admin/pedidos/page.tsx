"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import useAuth from "@/context/AuthContext";
import {
  deleteAdminOrder,
  getAdminOrders,
  updateAdminOrderStatus,
} from "@/lib/admin-orders-api";
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

const STATUS_SELECT_STYLES: Record<string, string> = {
  pending: "border-amber-300 text-amber-800 bg-amber-50",
  confirmed: "border-sky-300 text-sky-800 bg-sky-50",
  preparing: "border-indigo-300 text-indigo-800 bg-indigo-50",
  ready: "border-emerald-300 text-emerald-800 bg-emerald-50",
  completed: "border-gray-300 text-gray-700 bg-gray-50",
  cancelled: "border-rose-300 text-rose-800 bg-rose-50",
};

const DELIVERY_LABELS: Record<string, string> = {
  pickup: "Recoger en tienda",
  delivery: "Domicilio",
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

function getDeliveryMapsUrl(order: OrderHistoryItem) {
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

export default function AdminOrdersPage() {
  const router = useRouter();
  const { token, authReady, user } = useAuth();

  const [orders, setOrders] = useState<OrderHistoryItem[]>([]);
  const [count, setCount] = useState(0);
  const [page, setPage] = useState(1);
  const [hasNext, setHasNext] = useState(false);
  const [hasPrevious, setHasPrevious] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [expandedOrders, setExpandedOrders] = useState<Record<number, boolean>>(
    {},
  );
  const [statusDrafts, setStatusDrafts] = useState<
    Record<number, OrderHistoryItem["status"]>
  >({});
  const [updatingOrderId, setUpdatingOrderId] = useState<number | null>(null);
  const [deletingOrderId, setDeletingOrderId] = useState<number | null>(null);

  const [deliveryMethod, setDeliveryMethod] = useState<
    "" | "pickup" | "delivery" | "scheduled"
  >("");
  const [status, setStatus] = useState<
    | ""
    | "pending"
    | "confirmed"
    | "preparing"
    | "ready"
    | "completed"
    | "cancelled"
  >("");
  const [ordering, setOrdering] = useState<"-created_at" | "created_at">(
    "-created_at",
  );
  const [todayOnly, setTodayOnly] = useState(false);
  const [search, setSearch] = useState("");
  const [searchInput, setSearchInput] = useState("");

  const canAccess = Boolean(token && user?.is_staff);

  const loadOrders = useCallback(async () => {
    if (!canAccess) return;

    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      const data = await getAdminOrders({
        page,
        delivery_method: deliveryMethod || undefined,
        status: status || undefined,
        ordering,
        today: todayOnly,
        search: search || undefined,
      });

      setOrders(data.results || []);
      setCount(Number(data.count || 0));
      setStatusDrafts(
        (data.results || []).reduce(
          (
            acc: Record<number, OrderHistoryItem["status"]>,
            order: OrderHistoryItem,
          ) => {
            acc[order.id] = order.status;
            return acc;
          },
          {},
        ),
      );
      setHasNext(Boolean(data.next));
      setHasPrevious(Boolean(data.previous));
    } catch (error: unknown) {
      setError(getErrorMessage(error, "No se pudieron cargar los pedidos"));
    } finally {
      setLoading(false);
    }
  }, [canAccess, page, deliveryMethod, status, ordering, todayOnly, search]);

  useEffect(() => {
    if (!authReady) {
      return;
    }

    if (!token) {
      router.replace("/login");
      return;
    }

    if (user && !user.is_staff) {
      router.replace("/catalogo");
      return;
    }

    void loadOrders();
  }, [token, authReady, user, router, loadOrders]);

  const handleSaveStatus = async (orderId: number) => {
    const nextStatus = statusDrafts[orderId];
    const order = orders.find((item: OrderHistoryItem) => item.id === orderId);
    if (!nextStatus || !order || order.status === nextStatus) {
      return;
    }

    if (order.status === "cancelled") {
      setError("Un pedido cancelado no puede cambiar de estado.");
      return;
    }

    setUpdatingOrderId(orderId);
    setError(null);
    setSuccess(null);

    try {
      const updatedOrder = await updateAdminOrderStatus(orderId, nextStatus);

      setOrders((current: OrderHistoryItem[]) =>
        current.map((item: OrderHistoryItem) =>
          item.id === orderId ? updatedOrder : item,
        ),
      );
      setStatusDrafts(
        (current: Record<number, OrderHistoryItem["status"]>) => ({
          ...current,
          [orderId]: updatedOrder.status,
        }),
      );
      setSuccess(
        `Estado del pedido ${orderId} actualizado a ${STATUS_LABELS[updatedOrder.status]}.`,
      );
    } catch (error: unknown) {
      setError(
        getErrorMessage(error, "No se pudo actualizar el estado del pedido"),
      );
    } finally {
      setUpdatingOrderId(null);
    }
  };

  const handleDeleteOrder = async (orderId: number) => {
    const confirmed = window.confirm(
      `Se eliminara permanentemente el pedido ${orderId}. Esta accion no se puede deshacer.`,
    );
    if (!confirmed) {
      return;
    }

    setDeletingOrderId(orderId);
    setError(null);
    setSuccess(null);

    try {
      await deleteAdminOrder(orderId);
      setOrders((current: OrderHistoryItem[]) =>
        current.filter((item: OrderHistoryItem) => item.id !== orderId),
      );
      setStatusDrafts((current: Record<number, OrderHistoryItem["status"]>) => {
        const next = { ...current };
        delete next[orderId];
        return next;
      });
      setExpandedOrders((current) => {
        const next = { ...current };
        delete next[orderId];
        return next;
      });
      setCount((current) => Math.max(0, current - 1));
      setSuccess(`Pedido ${orderId} eliminado correctamente.`);
    } catch (error: unknown) {
      setError(getErrorMessage(error, "No se pudo borrar el pedido"));
    } finally {
      setDeletingOrderId(null);
    }
  };

  const pendingOrders = useMemo(
    () =>
      orders.filter((order: OrderHistoryItem) => order.status === "pending")
        .length,
    [orders],
  );

  if (!authReady || !token || !canAccess) {
    return (
      <main className="min-h-screen bg-[var(--cce-beige)] px-4 py-8 md:px-8">
        <div className="mx-auto max-w-6xl rounded-xl bg-white p-6 text-center text-[var(--cce-text-muted)] shadow-[0_8px_30px_rgba(31,77,58,0.09)]">
          Verificando permisos...
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[var(--cce-beige)] px-4 py-8 md:px-8">
      <div className="mx-auto max-w-6xl space-y-6">
        <section className="rounded-xl bg-white p-6 shadow-[0_8px_30px_rgba(31,77,58,0.09)]">
          <h1 className="text-2xl font-bold text-[var(--cce-green-dark)]">
            Gestion de pedidos
          </h1>
          <p className="mt-1 text-sm text-[var(--cce-text-muted)]">
            Vista administrativa para monitorear pedidos, filtrar por modalidad
            y revisar detalles.
          </p>

          <div className="mt-5 grid grid-cols-1 gap-3 md:grid-cols-2">
            <div className="rounded-lg border border-[color-mix(in_srgb,var(--cce-green-dark)_15%,white)] p-4">
              <p className="text-sm text-[var(--cce-text-muted)]">
                Total pedidos
              </p>
              <p className="text-2xl font-bold text-[var(--cce-green-dark)]">
                {count}
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
          <div className="grid grid-cols-1 gap-3 md:grid-cols-5">
            <select
              value={deliveryMethod}
              onChange={(event) => {
                setPage(1);
                setDeliveryMethod(
                  event.target.value as
                    | ""
                    | "pickup"
                    | "delivery"
                    | "scheduled",
                );
              }}
              className="rounded-lg border border-[color-mix(in_srgb,var(--cce-green-dark)_20%,white)] px-3 py-2"
            >
              <option value="">Tipo: todos</option>
              <option value="delivery">Domicilios</option>
              <option value="scheduled">Programados</option>
              <option value="pickup">Recoger en tienda</option>
            </select>

            <select
              value={status}
              onChange={(event) => {
                setPage(1);
                setStatus(
                  event.target.value as
                    | ""
                    | "pending"
                    | "confirmed"
                    | "preparing"
                    | "ready"
                    | "completed"
                    | "cancelled",
                );
              }}
              className="rounded-lg border border-[color-mix(in_srgb,var(--cce-green-dark)_20%,white)] px-3 py-2"
            >
              <option value="">Estado: todos</option>
              <option value="pending">Pendiente</option>
              <option value="confirmed">Confirmado</option>
              <option value="preparing">En preparacion</option>
              <option value="ready">Listo</option>
              <option value="completed">Completado</option>
              <option value="cancelled">Cancelado</option>
            </select>

            <select
              value={ordering}
              onChange={(event) => {
                setPage(1);
                setOrdering(event.target.value as "-created_at" | "created_at");
              }}
              className="rounded-lg border border-[color-mix(in_srgb,var(--cce-green-dark)_20%,white)] px-3 py-2"
            >
              <option value="-created_at">Mas reciente a mas antiguo</option>
              <option value="created_at">Mas antiguo a mas reciente</option>
            </select>

            <input
              value={searchInput}
              onChange={(event) => setSearchInput(event.target.value)}
              placeholder="Buscar por cliente, email o telefono"
              className="rounded-lg border border-[color-mix(in_srgb,var(--cce-green-dark)_20%,white)] px-3 py-2 md:col-span-2"
            />

            <div className="md:col-span-5 flex flex-wrap items-center gap-3">
              <label className="flex items-center gap-2 text-sm text-[var(--cce-green-dark)]">
                <input
                  type="checkbox"
                  checked={todayOnly}
                  onChange={(event) => {
                    setPage(1);
                    setTodayOnly(event.target.checked);
                  }}
                />
                Solo pedidos de hoy
              </label>

              <button
                type="button"
                onClick={() => {
                  setPage(1);
                  setSearch(searchInput);
                }}
                className="rounded-full bg-[var(--cce-green-dark)] px-5 py-2 text-sm font-semibold text-white"
              >
                Aplicar filtros
              </button>

              <button
                type="button"
                onClick={() => {
                  setPage(1);
                  setDeliveryMethod("");
                  setStatus("");
                  setOrdering("-created_at");
                  setTodayOnly(false);
                  setSearch("");
                  setSearchInput("");
                }}
                className="rounded-full border border-[var(--cce-green-dark)] px-5 py-2 text-sm font-semibold text-[var(--cce-green-dark)]"
              >
                Limpiar
              </button>
            </div>
          </div>
        </section>

        <section className="rounded-xl bg-white p-6 shadow-[0_8px_30px_rgba(31,77,58,0.09)]">
          <h2 className="text-xl font-bold text-[var(--cce-green-dark)]">
            Pedidos
          </h2>

          {success && (
            <div className="mt-4 rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">
              {success}
            </div>
          )}

          {loading ? (
            <p className="mt-4 text-sm text-[var(--cce-text-muted)]">
              Cargando pedidos...
            </p>
          ) : error ? (
            <div className="mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {error}
            </div>
          ) : orders.length === 0 ? (
            <p className="mt-4 text-sm text-[var(--cce-text-muted)]">
              No hay pedidos con los filtros actuales.
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
                    <div className="flex items-center gap-2">
                      <span
                        className={`rounded px-2 py-1 text-sm ${
                          STATUS_BADGE_STYLES[order.status] ||
                          "bg-gray-100 text-gray-700"
                        }`}
                      >
                        {STATUS_LABELS[order.status] || order.status}
                      </span>
                      <button
                        type="button"
                        onClick={() =>
                          setExpandedOrders((prev) => ({
                            ...prev,
                            [order.id]: !prev[order.id],
                          }))
                        }
                        className="rounded border border-[var(--cce-green-dark)] px-3 py-1 text-sm text-[var(--cce-green-dark)] hover:bg-[var(--cce-green-dark)] hover:text-white"
                      >
                        {expandedOrders[order.id]
                          ? "Ocultar detalle"
                          : "Ver detalle"}
                      </button>
                    </div>
                  </div>

                  <div className="mt-2 grid grid-cols-1 gap-1 text-sm text-gray-700 md:grid-cols-2">
                    <p>
                      <strong>Cliente:</strong> {order.customer_name}
                    </p>
                    <p>
                      <strong>Telefono:</strong> {order.customer_phone}
                    </p>
                    <p>
                      <strong>Email:</strong> {order.customer_email || "-"}
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
                    {order.delivery_method === "delivery" && (
                      <>
                        <p>
                          <strong>Direccion:</strong>{" "}
                          {order.delivery_address || "-"}
                        </p>
                        <p>
                          <strong>Validacion:</strong>{" "}
                          {order.address_validation_status || "not_validated"}
                        </p>
                        <p>
                          <strong>Distancia:</strong>{" "}
                          {order.delivery_distance_km
                            ? `${order.delivery_distance_km} km`
                            : "-"}
                        </p>
                      </>
                    )}
                  </div>

                  {order.delivery_method === "delivery" &&
                    getDeliveryMapsUrl(order) && (
                      <div className="mt-2">
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
                    order.address_validation_message && (
                      <p className="mt-2 text-sm text-gray-600">
                        {order.address_validation_message}
                      </p>
                    )}

                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <label
                      className="text-sm font-semibold text-[var(--cce-green-dark)]"
                      htmlFor={`status-${order.id}`}
                    >
                      Cambiar estado:
                    </label>
                    <select
                      id={`status-${order.id}`}
                      value={statusDrafts[order.id] ?? order.status}
                      onChange={(event) =>
                        setStatusDrafts((current) => ({
                          ...current,
                          [order.id]: event.target
                            .value as OrderHistoryItem["status"],
                        }))
                      }
                      className={`rounded border px-3 py-1 text-sm ${
                        STATUS_SELECT_STYLES[
                          statusDrafts[order.id] ?? order.status
                        ] ||
                        "border-[color-mix(in_srgb,var(--cce-green-dark)_20%,white)]"
                      }`}
                      disabled={
                        order.status === "cancelled" ||
                        deletingOrderId === order.id
                      }
                    >
                      <option value="pending">Pendiente</option>
                      <option value="confirmed">Confirmado</option>
                      <option value="preparing">En preparacion</option>
                      <option value="ready">Listo</option>
                      <option value="completed">Completado</option>
                      <option value="cancelled">Cancelado</option>
                    </select>
                    <button
                      type="button"
                      onClick={() => void handleSaveStatus(order.id)}
                      disabled={
                        order.status === "cancelled" ||
                        deletingOrderId === order.id ||
                        updatingOrderId === order.id ||
                        (statusDrafts[order.id] ?? order.status) ===
                          order.status
                      }
                      className="rounded bg-[var(--cce-green-dark)] px-3 py-1 text-sm font-semibold text-white disabled:opacity-50"
                    >
                      {updatingOrderId === order.id
                        ? "Guardando..."
                        : "Guardar estado"}
                    </button>
                    <button
                      type="button"
                      onClick={() => void handleDeleteOrder(order.id)}
                      disabled={
                        deletingOrderId === order.id ||
                        updatingOrderId === order.id
                      }
                      className="rounded bg-red-600 px-3 py-1 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-50"
                    >
                      {deletingOrderId === order.id
                        ? "Borrando..."
                        : "Borrar pedido"}
                    </button>
                  </div>

                  {order.status === "cancelled" && (
                    <p className="mt-2 text-sm text-gray-500">
                      Este pedido fue cancelado y su estado ya no se puede
                      modificar.
                    </p>
                  )}

                  {expandedOrders[order.id] && (
                    <div className="mt-4 border-t pt-4">
                      <h4 className="mb-2 font-semibold">
                        Productos incluidos
                      </h4>
                      {order.items.length === 0 ? (
                        <p className="text-sm text-[var(--cce-text-muted)]">
                          Sin productos asociados.
                        </p>
                      ) : (
                        <div className="space-y-2">
                          {order.items.map(
                            (item: OrderHistoryItem["items"][number]) => (
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

          <div className="mt-6 flex items-center justify-between">
            <button
              type="button"
              onClick={() => setPage((prev) => Math.max(1, prev - 1))}
              disabled={!hasPrevious || loading}
              className="rounded-full border border-[var(--cce-green-dark)] px-4 py-2 text-sm font-semibold text-[var(--cce-green-dark)] disabled:opacity-50"
            >
              Anterior
            </button>

            <span className="text-sm text-[var(--cce-text-muted)]">
              Pagina {page}
            </span>

            <button
              type="button"
              onClick={() => setPage((prev) => prev + 1)}
              disabled={!hasNext || loading}
              className="rounded-full border border-[var(--cce-green-dark)] px-4 py-2 text-sm font-semibold text-[var(--cce-green-dark)] disabled:opacity-50"
            >
              Siguiente
            </button>
          </div>
        </section>
      </div>
    </main>
  );
}
