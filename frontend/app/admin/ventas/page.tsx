"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import useAuth from "@/context/AuthContext";
import { getAdminProducts } from "@/lib/admin-catalog-api";
import {
  deleteManualSale,
  getSalesHistory,
  getSalesMetrics,
  registerManualSale,
} from "@/lib/admin-sales-api";
import type { Product } from "@/types/catalog";
import type {
  ManualSalePayload,
  SalesHistoryFilters,
  SalesMetrics,
  SalesOrder,
} from "@/types/sales";

interface ItemFormRow {
  product_id: string;
  quantity: string;
}

interface ManualSaleFormState {
  customer_name: string;
  customer_phone: string;
  customer_email: string;
  status: string;
  notes: string;
  items: ItemFormRow[];
}

const INITIAL_FORM: ManualSaleFormState = {
  customer_name: "",
  customer_phone: "",
  customer_email: "",
  status: "completed",
  notes: "",
  items: [{ product_id: "", quantity: "1" }],
};

const toPayload = (form: ManualSaleFormState): ManualSalePayload => ({
  customer_name: form.customer_name.trim(),
  customer_phone: form.customer_phone.trim(),
  customer_email: form.customer_email.trim() || undefined,
  status: form.status,
  notes: form.notes.trim() || undefined,
  items: form.items.map((item) => ({
    product_id: Number(item.product_id),
    quantity: Number(item.quantity),
  })),
});

export default function AdminSalesPage() {
  const router = useRouter();
  const { token, user } = useAuth();

  const [products, setProducts] = useState<Product[]>([]);
  const [history, setHistory] = useState<SalesOrder[]>([]);
  const [metrics, setMetrics] = useState<SalesMetrics | null>(null);
  const [filters, setFilters] = useState<SalesHistoryFilters>({
    time_basis: "created",
    order_source: "manual",
  });

  const [form, setForm] = useState<ManualSaleFormState>(INITIAL_FORM);

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [deletingSaleId, setDeletingSaleId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [orderPendingDelete, setOrderPendingDelete] =
    useState<SalesOrder | null>(null);
  const [orderDetail, setOrderDetail] = useState<SalesOrder | null>(null);

  const canAccess = useMemo(
    () => Boolean(token && user?.is_staff),
    [token, user],
  );

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const [productsResponse, historyResponse, metricsResponse] =
        await Promise.all([
          getAdminProducts(),
          getSalesHistory(filters),
          getSalesMetrics(filters),
        ]);
      setProducts(productsResponse.results);
      setHistory(historyResponse.results);
      setMetrics(metricsResponse);
    } catch (loadError) {
      console.error(loadError);
      setError("No fue posible cargar la información de ventas.");
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    if (!token) {
      router.replace("/login");
      return;
    }

    if (user && !user.is_staff) {
      router.replace("/catalogo");
      return;
    }

    if (canAccess) {
      void loadData();
    }
  }, [token, user, canAccess, loadData, router]);

  const updateForm = (field: keyof ManualSaleFormState, value: string) => {
    setForm((current) => ({ ...current, [field]: value }));
  };

  const updateItem = (
    index: number,
    field: keyof ItemFormRow,
    value: string,
  ) => {
    setForm((current) => ({
      ...current,
      items: current.items.map((item, itemIndex) =>
        itemIndex === index ? { ...item, [field]: value } : item,
      ),
    }));
  };

  const addItemRow = () => {
    setForm((current) => ({
      ...current,
      items: [...current.items, { product_id: "", quantity: "1" }],
    }));
  };

  const removeItemRow = (index: number) => {
    setForm((current) => {
      if (current.items.length === 1) {
        return current;
      }
      return {
        ...current,
        items: current.items.filter((_, itemIndex) => itemIndex !== index),
      };
    });
  };

  const validateForm = () => {
    if (!form.customer_name.trim() || !form.customer_phone.trim()) {
      setError("Nombre y teléfono son obligatorios.");
      return false;
    }

    for (const item of form.items) {
      const quantity = Number(item.quantity);
      if (!item.product_id || Number.isNaN(quantity) || quantity < 1) {
        setError("Todos los productos deben tener cantidad válida.");
        return false;
      }
    }

    return true;
  };

  const formatDeliveryLabel = (order: SalesOrder) => {
    if (order.order_source === "manual") {
      return "Tienda física";
    }
    if (order.delivery_method === "pickup") {
      return "Recoger en sede";
    }
    if (order.delivery_method === "scheduled") {
      return "Fecha futura";
    }
    return "Domicilio";
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    setSuccess(null);

    if (!validateForm()) {
      return;
    }

    setSubmitting(true);
    try {
      await registerManualSale(toPayload(form));
      setSuccess("Venta registrada correctamente.");
      setForm(INITIAL_FORM);
      await loadData();
    } catch (submitError) {
      console.error(submitError);
      if (submitError instanceof Error) {
        setError(submitError.message);
      } else {
        setError("No fue posible registrar la venta.");
      }
    } finally {
      setSubmitting(false);
    }
  };

  const applyFilter = (field: keyof SalesHistoryFilters, value: string) => {
    setFilters((current) => ({ ...current, [field]: value || undefined }));
  };

  const handleDeleteManualSale = async (saleId: number) => {
    setDeletingSaleId(saleId);
    setError(null);
    setSuccess(null);
    try {
      await deleteManualSale(saleId);
      setSuccess("Venta manual eliminada correctamente.");
      await loadData();
    } catch (deleteError) {
      console.error(deleteError);
      if (deleteError instanceof Error) {
        setError(deleteError.message);
      } else {
        setError("No fue posible eliminar la venta manual.");
      }
    } finally {
      setDeletingSaleId(null);
      setOrderPendingDelete(null);
    }
  };

  if (!token || !canAccess) {
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
            Registro manual e historial de ventas
          </h1>
          <p className="mt-1 text-sm text-[var(--cce-text-muted)]">
            Registra ventas administrativas y consulta su impacto en el
            historial.
          </p>

          {error && (
            <div className="mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {error}
            </div>
          )}

          {success && (
            <div className="mt-4 rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">
              {success}
            </div>
          )}
        </section>

        <section className="rounded-xl bg-white p-6 shadow-[0_8px_30px_rgba(31,77,58,0.09)]">
          <h2 className="text-xl font-bold text-[var(--cce-green-dark)]">
            Registrar venta manual
          </h2>
          <p className="mt-2 text-sm text-[var(--cce-text-muted)]">
            Este formulario registra ventas en tienda física.
          </p>

          <form
            onSubmit={handleSubmit}
            className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2"
          >
            <input
              value={form.customer_name}
              onChange={(event) =>
                updateForm("customer_name", event.target.value)
              }
              placeholder="Nombre cliente"
              className="rounded-lg border border-[color-mix(in_srgb,var(--cce-green-dark)_20%,white)] px-3 py-2 outline-none focus:border-[var(--cce-green-dark)]"
            />

            <input
              value={form.customer_phone}
              onChange={(event) =>
                updateForm("customer_phone", event.target.value)
              }
              placeholder="Teléfono"
              className="rounded-lg border border-[color-mix(in_srgb,var(--cce-green-dark)_20%,white)] px-3 py-2 outline-none focus:border-[var(--cce-green-dark)]"
            />

            <input
              value={form.customer_email}
              onChange={(event) =>
                updateForm("customer_email", event.target.value)
              }
              placeholder="Email (opcional)"
              className="rounded-lg border border-[color-mix(in_srgb,var(--cce-green-dark)_20%,white)] px-3 py-2 outline-none focus:border-[var(--cce-green-dark)]"
            />

            <select
              value={form.status}
              onChange={(event) => updateForm("status", event.target.value)}
              className="rounded-lg border border-[color-mix(in_srgb,var(--cce-green-dark)_20%,white)] px-3 py-2 outline-none focus:border-[var(--cce-green-dark)]"
            >
              <option value="pending">Pendiente</option>
              <option value="confirmed">Confirmado</option>
              <option value="preparing">En preparación</option>
              <option value="ready">Listo</option>
              <option value="completed">Completado</option>
            </select>

            <textarea
              value={form.notes}
              onChange={(event) => updateForm("notes", event.target.value)}
              placeholder="Notas"
              className="md:col-span-2 rounded-lg border border-[color-mix(in_srgb,var(--cce-green-dark)_20%,white)] px-3 py-2 outline-none focus:border-[var(--cce-green-dark)]"
            />

            <div className="md:col-span-2 space-y-2">
              <p className="text-sm font-semibold text-[var(--cce-green-dark)]">
                Productos
              </p>
              {form.items.map((item, index) => (
                <div
                  key={`${index}-${item.product_id}`}
                  className="grid grid-cols-1 gap-2 md:grid-cols-[2fr_1fr_auto]"
                >
                  <select
                    value={item.product_id}
                    onChange={(event) =>
                      updateItem(index, "product_id", event.target.value)
                    }
                    className="rounded-lg border border-[color-mix(in_srgb,var(--cce-green-dark)_20%,white)] px-3 py-2 outline-none focus:border-[var(--cce-green-dark)]"
                  >
                    <option value="">Selecciona producto</option>
                    {products.map((product) => (
                      <option key={product.id} value={product.id}>
                        {product.name} - ${product.price}
                      </option>
                    ))}
                  </select>

                  <input
                    type="number"
                    min="1"
                    value={item.quantity}
                    onChange={(event) =>
                      updateItem(index, "quantity", event.target.value)
                    }
                    className="rounded-lg border border-[color-mix(in_srgb,var(--cce-green-dark)_20%,white)] px-3 py-2 outline-none focus:border-[var(--cce-green-dark)]"
                  />

                  <button
                    type="button"
                    onClick={() => removeItemRow(index)}
                    className="rounded-lg border border-red-300 px-3 py-2 text-sm font-semibold text-red-700"
                  >
                    Quitar
                  </button>
                </div>
              ))}

              <button
                type="button"
                onClick={addItemRow}
                className="rounded-full border border-[var(--cce-green-dark)] px-4 py-1 text-sm font-semibold text-[var(--cce-green-dark)]"
              >
                Agregar producto
              </button>
            </div>

            <div className="md:col-span-2">
              <button
                type="submit"
                disabled={submitting}
                className="rounded-full bg-[var(--cce-green-dark)] px-5 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
              >
                {submitting ? "Registrando..." : "Registrar venta"}
              </button>
            </div>
          </form>
        </section>

        <section className="rounded-xl bg-white p-6 shadow-[0_8px_30px_rgba(31,77,58,0.09)]">
          <h2 className="text-xl font-bold text-[var(--cce-green-dark)]">
            Consulta por período
          </h2>

          <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-4">
            <input
              type="date"
              value={filters.start_date ?? ""}
              onChange={(event) =>
                applyFilter("start_date", event.target.value)
              }
              className="rounded-lg border border-[color-mix(in_srgb,var(--cce-green-dark)_20%,white)] px-3 py-2 outline-none focus:border-[var(--cce-green-dark)]"
            />
            <input
              type="date"
              value={filters.end_date ?? ""}
              onChange={(event) => applyFilter("end_date", event.target.value)}
              className="rounded-lg border border-[color-mix(in_srgb,var(--cce-green-dark)_20%,white)] px-3 py-2 outline-none focus:border-[var(--cce-green-dark)]"
            />
            <select
              value={filters.time_basis ?? "created"}
              onChange={(event) =>
                applyFilter("time_basis", event.target.value)
              }
              className="rounded-lg border border-[color-mix(in_srgb,var(--cce-green-dark)_20%,white)] px-3 py-2 outline-none focus:border-[var(--cce-green-dark)]"
            >
              <option value="created">Fecha de registro</option>
              <option value="service">Fecha de servicio</option>
            </select>
            <select
              value={filters.order_source ?? ""}
              onChange={(event) =>
                applyFilter("order_source", event.target.value)
              }
              className="rounded-lg border border-[color-mix(in_srgb,var(--cce-green-dark)_20%,white)] px-3 py-2 outline-none focus:border-[var(--cce-green-dark)]"
            >
              <option value="">Todas las fuentes</option>
              <option value="manual">Manual</option>
              <option value="online">Online</option>
            </select>
          </div>

          <div className="mt-4 flex gap-2">
            <button
              type="button"
              onClick={() => void loadData()}
              className="rounded-full bg-[var(--cce-green-dark)] px-4 py-2 text-sm font-semibold text-white"
            >
              Aplicar filtros
            </button>
            <button
              type="button"
              onClick={() => {
                setFilters({ time_basis: "created", order_source: "manual" });
              }}
              className="rounded-full border border-[var(--cce-green-dark)] px-4 py-2 text-sm font-semibold text-[var(--cce-green-dark)]"
            >
              Restablecer
            </button>
          </div>
        </section>

        <section className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <article className="rounded-xl bg-white p-5 shadow-[0_8px_30px_rgba(31,77,58,0.09)]">
            <p className="text-sm text-[var(--cce-text-muted)]">
              Total vendido
            </p>
            <p className="mt-2 text-2xl font-bold text-[var(--cce-green-dark)]">
              ${metrics?.total_sold ?? "0.00"}
            </p>
          </article>
          <article className="rounded-xl bg-white p-5 shadow-[0_8px_30px_rgba(31,77,58,0.09)]">
            <p className="text-sm text-[var(--cce-text-muted)]">
              Número de pedidos
            </p>
            <p className="mt-2 text-2xl font-bold text-[var(--cce-green-dark)]">
              {metrics?.total_orders ?? 0}
            </p>
          </article>
          <article className="rounded-xl bg-white p-5 shadow-[0_8px_30px_rgba(31,77,58,0.09)]">
            <p className="text-sm text-[var(--cce-text-muted)]">
              Ticket promedio
            </p>
            <p className="mt-2 text-2xl font-bold text-[var(--cce-green-dark)]">
              ${metrics?.average_ticket ?? "0.00"}
            </p>
          </article>
        </section>

        <section className="rounded-xl bg-white p-6 shadow-[0_8px_30px_rgba(31,77,58,0.09)]">
          <h2 className="text-xl font-bold text-[var(--cce-green-dark)]">
            Historial de ventas
          </h2>

          {loading ? (
            <p className="mt-4 text-sm text-[var(--cce-text-muted)]">
              Cargando historial...
            </p>
          ) : history.length === 0 ? (
            <p className="mt-4 text-sm text-[var(--cce-text-muted)]">
              No hay ventas para mostrar.
            </p>
          ) : (
            <div className="mt-4 overflow-x-auto">
              <table className="min-w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-[color-mix(in_srgb,var(--cce-green-dark)_15%,white)] text-[var(--cce-green-dark)]">
                    <th className="px-3 py-2">Pedido</th>
                    <th className="px-3 py-2">Cliente</th>
                    <th className="px-3 py-2">Modalidad</th>
                    <th className="px-3 py-2">Fuente</th>
                    <th className="px-3 py-2">Registró</th>
                    <th className="px-3 py-2">Estado</th>
                    <th className="px-3 py-2">Total</th>
                    <th className="px-3 py-2">Fecha</th>
                    <th className="px-3 py-2">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {history.map((order) => (
                    <tr
                      key={order.id}
                      className="border-b border-[color-mix(in_srgb,var(--cce-green-dark)_10%,white)]"
                    >
                      <td className="px-3 py-2">#{order.id}</td>
                      <td className="px-3 py-2">{order.customer_name}</td>
                      <td className="px-3 py-2">
                        {formatDeliveryLabel(order)}
                      </td>
                      <td className="px-3 py-2">{order.order_source}</td>
                      <td className="px-3 py-2">
                        {order.created_by_username ?? "-"}
                      </td>
                      <td className="px-3 py-2">{order.status}</td>
                      <td className="px-3 py-2">${order.total_amount}</td>
                      <td className="px-3 py-2">
                        {new Date(order.created_at).toLocaleString()}
                      </td>
                      <td className="px-3 py-2">
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            title="Ver detalle del pedido"
                            aria-label={`Ver detalle del pedido #${order.id}`}
                            onClick={() => setOrderDetail(order)}
                            className="inline-flex items-center rounded-md p-2 text-[var(--cce-green-dark)] hover:bg-[color-mix(in_srgb,var(--cce-green-dark)_10%,white)]"
                          >
                            <svg
                              xmlns="http://www.w3.org/2000/svg"
                              viewBox="0 0 24 24"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="2"
                              className="h-4 w-4"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7S1 12 1 12z"
                              />
                              <circle cx="12" cy="12" r="3" />
                            </svg>
                          </button>

                          {order.order_source === "manual" ? (
                            <button
                              type="button"
                              title="Eliminar venta manual"
                              aria-label={`Eliminar venta manual #${order.id}`}
                              onClick={() => setOrderPendingDelete(order)}
                              disabled={deletingSaleId === order.id}
                              className="inline-flex items-center rounded-md p-2 text-red-600 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-60"
                            >
                              <svg
                                xmlns="http://www.w3.org/2000/svg"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="2"
                                className="h-4 w-4"
                              >
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  d="M3 6h18"
                                />
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  d="M8 6V4h8v2m-1 0v13a1 1 0 01-1 1H10a1 1 0 01-1-1V6h6z"
                                />
                              </svg>
                            </button>
                          ) : (
                            <span className="text-xs text-[var(--cce-text-muted)]">
                              -
                            </span>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>

      {orderPendingDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
          <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-2xl">
            <h3 className="text-lg font-bold text-[var(--cce-green-dark)]">
              Confirmar eliminación
            </h3>
            <p className="mt-2 text-sm text-[var(--cce-text-muted)]">
              estas seguro de querer eliminar
            </p>
            <p className="mt-1 text-sm text-[var(--cce-text-muted)]">
              Pedido #{orderPendingDelete.id} -{" "}
              {orderPendingDelete.customer_name}
            </p>

            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setOrderPendingDelete(null)}
                className="rounded-lg border border-[color-mix(in_srgb,var(--cce-green-dark)_20%,white)] px-4 py-2 text-sm font-semibold text-[var(--cce-green-dark)]"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() =>
                  void handleDeleteManualSale(orderPendingDelete.id)
                }
                disabled={deletingSaleId === orderPendingDelete.id}
                className="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
              >
                {deletingSaleId === orderPendingDelete.id
                  ? "Eliminando..."
                  : "Eliminar"}
              </button>
            </div>
          </div>
        </div>
      )}

      {orderDetail && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
          <div className="max-h-[85vh] w-full max-w-2xl overflow-y-auto rounded-xl bg-white p-6 shadow-2xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h3 className="text-lg font-bold text-[var(--cce-green-dark)]">
                  Detalle del pedido #{orderDetail.id}
                </h3>
                <p className="mt-1 text-sm text-[var(--cce-text-muted)]">
                  {new Date(orderDetail.created_at).toLocaleString()}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setOrderDetail(null)}
                className="rounded-md p-2 text-[var(--cce-text-muted)] hover:bg-[color-mix(in_srgb,var(--cce-green-dark)_10%,white)]"
                aria-label="Cerrar detalle"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  className="h-4 w-4"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M18 6L6 18M6 6l12 12"
                  />
                </svg>
              </button>
            </div>

            <div className="mt-4 grid grid-cols-1 gap-3 rounded-lg bg-[color-mix(in_srgb,var(--cce-green-dark)_6%,white)] p-4 text-sm md:grid-cols-2">
              <p>
                <span className="font-semibold text-[var(--cce-green-dark)]">
                  Cliente:
                </span>{" "}
                {orderDetail.customer_name}
              </p>
              <p>
                <span className="font-semibold text-[var(--cce-green-dark)]">
                  Teléfono:
                </span>{" "}
                {orderDetail.customer_phone}
              </p>
              <p>
                <span className="font-semibold text-[var(--cce-green-dark)]">
                  Email:
                </span>{" "}
                {orderDetail.customer_email || "-"}
              </p>
              <p>
                <span className="font-semibold text-[var(--cce-green-dark)]">
                  Fuente:
                </span>{" "}
                {orderDetail.order_source}
              </p>
              <p>
                <span className="font-semibold text-[var(--cce-green-dark)]">
                  Modalidad:
                </span>{" "}
                {formatDeliveryLabel(orderDetail)}
              </p>
              <p>
                <span className="font-semibold text-[var(--cce-green-dark)]">
                  Estado:
                </span>{" "}
                {orderDetail.status}
              </p>
              <p>
                <span className="font-semibold text-[var(--cce-green-dark)]">
                  Total:
                </span>{" "}
                ${orderDetail.total_amount}
              </p>
              <p>
                <span className="font-semibold text-[var(--cce-green-dark)]">
                  Registró:
                </span>{" "}
                {orderDetail.created_by_username || "-"}
              </p>
            </div>

            <div className="mt-4">
              <h4 className="text-sm font-semibold text-[var(--cce-green-dark)]">
                Notas del pedido
              </h4>
              <p className="mt-1 rounded-lg border border-[color-mix(in_srgb,var(--cce-green-dark)_15%,white)] p-3 text-sm text-[var(--cce-text-muted)]">
                {orderDetail.notes || "Sin notas"}
              </p>
            </div>

            <div className="mt-4">
              <h4 className="text-sm font-semibold text-[var(--cce-green-dark)]">
                Productos
              </h4>
              {orderDetail.items.length === 0 ? (
                <p className="mt-2 text-sm text-[var(--cce-text-muted)]">
                  Este pedido no tiene productos asociados.
                </p>
              ) : (
                <div className="mt-2 overflow-x-auto">
                  <table className="min-w-full text-left text-sm">
                    <thead>
                      <tr className="border-b border-[color-mix(in_srgb,var(--cce-green-dark)_15%,white)] text-[var(--cce-green-dark)]">
                        <th className="px-2 py-2">Producto</th>
                        <th className="px-2 py-2">Cantidad</th>
                        <th className="px-2 py-2">Precio unitario</th>
                        <th className="px-2 py-2">Subtotal</th>
                      </tr>
                    </thead>
                    <tbody>
                      {orderDetail.items.map((item) => (
                        <tr
                          key={item.id}
                          className="border-b border-[color-mix(in_srgb,var(--cce-green-dark)_10%,white)]"
                        >
                          <td className="px-2 py-2">{item.product.name}</td>
                          <td className="px-2 py-2">{item.quantity}</td>
                          <td className="px-2 py-2">${item.unit_price}</td>
                          <td className="px-2 py-2">${item.subtotal}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
