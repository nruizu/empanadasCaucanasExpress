"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

type DeliveryMethod = "pickup" | "delivery" | "scheduled";

interface LastOrderItem {
  id: number;
  quantity: number;
  product: {
    id: number;
    name: string;
    image?: string | null;
    price?: number | string;
  };
}

interface LastOrder {
  id?: number;
  created_at: string;
  customer_name: string;
  customer_phone: string;
  delivery_method: DeliveryMethod;
  pickup_date?: string;
  pickup_time?: string;
  scheduled_date?: string;
  delivery_address?: string;
  notes?: string;
  estimated_delivery_time?: string | null;
  total_price?: number | string;
  items: LastOrderItem[];
}

const formatCurrency = (value: number) =>
  new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    maximumFractionDigits: 0,
  }).format(value);

const getMethodLabel = (method: DeliveryMethod) => {
  if (method === "delivery") return "Domicilio";
  if (method === "scheduled") return "Pedido programado";
  return "Recoger en sede";
};

export default function MiPedidoPage() {
  const [lastOrder, setLastOrder] = useState<LastOrder | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const rawOrder = localStorage.getItem("cce_last_order");
    if (!rawOrder) return;

    try {
      const parsedOrder = JSON.parse(rawOrder) as LastOrder;
      setLastOrder(parsedOrder);
    } catch {
      setLastOrder(null);
    }
  }, []);

  const total = useMemo(() => {
    if (!lastOrder) return 0;

    if (lastOrder.total_price !== undefined && lastOrder.total_price !== null) {
      return Number(lastOrder.total_price) || 0;
    }

    return lastOrder.items.reduce((acc, item) => {
      return acc + (Number(item.product?.price || 0) || 0) * item.quantity;
    }, 0);
  }, [lastOrder]);

  if (!lastOrder) {
    return (
      <main className="min-h-screen bg-[var(--background)] px-4 py-10 md:px-10">
        <div className="mx-auto max-w-3xl rounded-2xl bg-white p-8 text-center shadow-[0_8px_30px_rgba(31,92,58,0.08)]">
          <h1 className="text-2xl font-bold text-[var(--primary)]">No tienes pedidos recientes</h1>
          <p className="mt-2 text-sm text-[var(--muted-foreground)]">
            Cuando confirmes un pedido, aquí verás el resumen con productos e información de entrega.
          </p>
          <div className="mt-5 flex justify-center gap-3">
            <Link
              href="/"
              className="rounded-lg bg-[var(--accent)] px-4 py-2.5 font-semibold text-[var(--accent-foreground)]"
            >
              Ir al catálogo
            </Link>
            <Link
              href="/carrito"
              className="rounded-lg border border-[color-mix(in_srgb,var(--primary)_18%,white)] px-4 py-2.5 font-semibold text-[var(--primary)]"
            >
              Ver carrito
            </Link>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[var(--background)] px-4 py-10 md:px-10">
      <div className="mx-auto max-w-4xl rounded-2xl bg-white p-6 shadow-[0_8px_30px_rgba(31,92,58,0.08)] md:p-8">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3 border-b border-[color-mix(in_srgb,var(--primary)_12%,white)] pb-4">
          <div>
            <h1 className="text-2xl font-bold text-[var(--primary)] md:text-3xl">Pedido confirmado</h1>
            <p className="mt-1 text-sm text-[var(--muted-foreground)]">
              {lastOrder.id ? `Pedido #${lastOrder.id}` : "Pedido registrado"} · {new Date(lastOrder.created_at).toLocaleString("es-CO")}
            </p>
          </div>
          <span className="rounded-full bg-[color-mix(in_srgb,var(--secondary)_35%,white)] px-3 py-1 text-sm font-semibold text-[var(--primary)]">
            {getMethodLabel(lastOrder.delivery_method)}
          </span>
        </div>

        <section className="mb-6 rounded-xl border border-[color-mix(in_srgb,var(--primary)_14%,white)] bg-[var(--background)] p-4">
          <h2 className="text-lg font-semibold text-[var(--primary)]">Datos de tu pedido</h2>
          <div className="mt-3 grid gap-2 text-sm text-[var(--foreground)] md:grid-cols-2">
            <p><strong>Nombre:</strong> {lastOrder.customer_name}</p>
            <p><strong>Teléfono:</strong> {lastOrder.customer_phone}</p>
            {lastOrder.delivery_method === "pickup" && (
              <>
                <p><strong>Fecha de recogida:</strong> {lastOrder.pickup_date || "No registrada"}</p>
                <p><strong>Hora de recogida:</strong> {lastOrder.pickup_time || "No registrada"}</p>
              </>
            )}
            {lastOrder.delivery_method === "scheduled" && (
              <p><strong>Fecha programada:</strong> {lastOrder.scheduled_date || "No registrada"}</p>
            )}
            {lastOrder.delivery_method === "delivery" && (
              <>
                <p className="md:col-span-2"><strong>Dirección:</strong> {lastOrder.delivery_address || "No registrada"}</p>
                <p className="font-semibold text-[var(--primary)] md:col-span-2">
                  Tiempo aproximado de llegada: {lastOrder.estimated_delivery_time || "45-60 minutos"}
                </p>
              </>
            )}
            {lastOrder.notes && (
              <p className="md:col-span-2"><strong>Notas:</strong> {lastOrder.notes}</p>
            )}
          </div>
        </section>

        <section>
          <h2 className="mb-3 text-lg font-semibold text-[var(--primary)]">Productos solicitados</h2>
          {lastOrder.items.length ? (
            <div className="space-y-3">
              {lastOrder.items.map((item) => {
                const unitPrice = Number(item.product?.price || 0) || 0;
                const subtotal = unitPrice * item.quantity;

                return (
                  <article
                    key={item.id}
                    className="flex items-center gap-3 rounded-xl border border-[color-mix(in_srgb,var(--primary)_12%,white)] p-3"
                  >
                    {item.product?.image ? (
                      <img
                        src={item.product.image}
                        alt={item.product.name}
                        className="h-16 w-16 rounded-lg object-cover"
                      />
                    ) : (
                      <div className="h-16 w-16 rounded-lg bg-[color-mix(in_srgb,var(--muted)_60%,white)]" />
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-semibold text-[var(--foreground)]">{item.product.name}</p>
                      <p className="text-sm text-[var(--muted-foreground)]">Cantidad: {item.quantity}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm text-[var(--muted-foreground)]">Subtotal</p>
                      <p className="font-semibold text-[var(--primary)]">{formatCurrency(subtotal)}</p>
                    </div>
                  </article>
                );
              })}
            </div>
          ) : (
            <div className="rounded-xl border border-dashed border-[color-mix(in_srgb,var(--primary)_20%,white)] p-4 text-sm text-[var(--muted-foreground)]">
              Este pedido no tiene productos visibles en el resumen.
            </div>
          )}

          <div className="mt-5 flex items-center justify-between rounded-xl bg-[var(--background)] p-4">
            <span className="text-base font-semibold text-[var(--primary)]">Total del pedido</span>
            <span className="text-lg font-bold text-[var(--primary)]">{formatCurrency(total)}</span>
          </div>

          <div className="mt-5 flex flex-wrap gap-3">
            <Link
              href="/"
              className="rounded-lg bg-[var(--accent)] px-4 py-2.5 font-semibold text-[var(--accent-foreground)]"
            >
              Hacer otro pedido
            </Link>
            <Link
              href="/carrito"
              className="rounded-lg border border-[color-mix(in_srgb,var(--primary)_18%,white)] px-4 py-2.5 font-semibold text-[var(--primary)]"
            >
              Ver carrito
            </Link>
          </div>
        </section>
      </div>
    </main>
  );
}
