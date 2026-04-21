"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import useAuth from "@/context/AuthContext";
import * as cartApi from "@/lib/cart-api";
import { getOrderAvailability, type PublicOrderAvailability } from "@/lib/catalog-api";
import { getBogotaISODate } from "@/lib/colombia-time";
import CartItem from "./CartItem";

export function emitCartUpdate() {
  window.dispatchEvent(new CustomEvent("cart:updated"));
}

export default function CartPageClient() {
  const router = useRouter();
  const { token } = useAuth();
  const [cart, setCart] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isClient, setIsClient] = useState(false);
  const [availability, setAvailability] = useState<PublicOrderAvailability | null>(null);

  useEffect(() => { setIsClient(true); }, []);

  useEffect(() => {
    if (token === null) return;
    if (!token) { setLoading(false); return; }

    const load = async () => {
      try {
        const data = await cartApi.getMyCart();
        setCart(data);
        if (typeof window !== "undefined") {
          localStorage.setItem("cce_cart_id", data.id);
        }
      } catch (err: any) {
        setError(err.message || "Error cargando carrito");
      } finally {
        setLoading(false);
      }
    };

    void load();
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

  const todayRestriction = availability?.restricted_dates?.find(
    (item) => item.is_active && item.date === getBogotaISODate(),
  );
  const ordersDisabledGlobally = availability ? !availability.is_accepting_orders : false;
  const checkoutBlocked = Boolean(todayRestriction) || ordersDisabledGlobally;

  const handleRemove = async (cartProductId: number | string) => {
    if (!cart) return;
    try {
      const updated = await cartApi.removeProduct(cart.id, cartProductId);
      setCart(updated);
      emitCartUpdate();
    } catch (err: any) {
      setError(err.message || "Error eliminando producto");
    }
  };

  const handleUpdateQuantity = async (cartProductId: number | string, quantity: number) => {
    try {
      const updated = await cartApi.updateQuantity(cartProductId, quantity);
      setCart(updated);
      emitCartUpdate();
    } catch (err: any) {
      setError(err.message || "Error actualizando cantidad");
    }
  };

  const handleClearCart = async () => {
    if (!cart) return;
    try {
      const updated = await cartApi.clearCart(cart.id);
      setCart(updated);
      emitCartUpdate();
    } catch (err: any) {
      setError(err.message || "Error vaciando carrito");
    }
  };

  if (!isClient) {
    return (
      <main className="min-h-screen bg-[var(--background)] px-4 py-10 md:px-10">
        <div className="mx-auto max-w-3xl rounded-2xl bg-white p-6 text-center text-[var(--muted-foreground)] shadow-md">
          Cargando carrito...
        </div>
      </main>
    ) as any;
  }

  if (!token) {
    return (
      <main className="min-h-screen bg-[var(--background)] px-4 py-10 md:px-10">
        <div className="mx-auto max-w-2xl rounded-2xl bg-white p-8 text-center shadow-md">
          <h2 className="text-xl font-bold text-[var(--primary)]">Tu carrito te está esperando</h2>
          <p className="mt-2 text-sm text-[var(--muted-foreground)]">Debes iniciar sesión para ver tus productos y continuar con el pedido.</p>
        </div>
      </main>
    );
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-[var(--background)] px-4 py-10 md:px-10">
        <div className="mx-auto max-w-3xl rounded-2xl bg-white p-6 text-center text-[var(--muted-foreground)] shadow-md">
          Cargando carrito...
        </div>
      </main>
    );
  }

  if (error) {
    return (
      <main className="min-h-screen bg-[var(--background)] px-4 py-10 md:px-10">
        <div className="mx-auto max-w-3xl rounded-2xl border border-red-200 bg-red-50 p-6 text-center text-red-700 shadow-sm">
          {error}
        </div>
      </main>
    );
  }

  const hasProducts = cart?.products?.length > 0;

  return (
    <main className="min-h-screen bg-[var(--background)] px-4 py-10 md:px-10">
      <div className="mx-auto max-w-3xl rounded-2xl bg-white p-6 shadow-[0_8px_30px_rgba(31,92,58,0.08)] md:p-8">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-2xl font-bold text-[var(--primary)]">Mi carrito</h2>
          {hasProducts && (
            <button
              onClick={handleClearCart}
              className="rounded-md px-2 py-1 text-sm text-red-600 transition-colors hover:bg-red-50"
            >
              Vaciar carrito
            </button>
          )}
        </div>

        {hasProducts ? (
          <>
            {cart.products.map((p: any) => (
              <CartItem
                key={p.id}
                id={p.id}
                product={p.product}
                quantity={p.quantity}
                onRemove={handleRemove}
                onUpdateQuantity={handleUpdateQuantity}
              />
            ))}

            {/* Total y botón checkout */}
            {cart.total_price !== undefined && (
              <div className="mt-6 rounded-xl border border-[color-mix(in_srgb,var(--primary)_14%,white)] bg-[var(--background)] p-4">
                {checkoutBlocked && (
                  <div className="mb-4 rounded-lg border border-red-300 bg-red-100 p-3 text-sm font-medium text-red-800">
                    {ordersDisabledGlobally
                      ? "No puedes continuar al checkout porque los pedidos están cerrados temporalmente."
                      : "No puedes continuar al checkout porque hay una restricción activa hoy."}
                    {!ordersDisabledGlobally && todayRestriction?.reason ? ` Motivo: ${todayRestriction.reason}` : ""}
                  </div>
                )}
                <div className="flex justify-end mb-4">
                  <span className="text-lg font-bold text-[var(--primary)]">
                    Total: ${Number(cart.total_price).toFixed(0)}
                  </span>
                </div>
                <div className="flex justify-end">
                  <button
                    disabled={checkoutBlocked}
                    onClick={() => void router.push("/checkout")}
                    className="rounded-lg bg-[var(--accent)] px-6 py-3 font-semibold text-[var(--accent-foreground)] shadow-sm transition-colors hover:bg-[color-mix(in_srgb,var(--accent)_88%,black)] disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    Proceder al checkout
                  </button>
                </div>
              </div>
            )}
          </>
        ) : (
          <div className="rounded-xl border border-dashed border-[color-mix(in_srgb,var(--primary)_20%,white)] bg-[var(--background)] p-8 text-center text-[var(--muted-foreground)]">
            No hay productos en el carrito.
          </div>
        )}
      </div>
    </main>
  );
}