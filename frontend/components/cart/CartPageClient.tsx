"use client";

import { useEffect, useState } from "react";
import useAuth from "@/context/AuthContext";
import * as cartApi from "@/lib/cart-api";
import CartItem from "./CartItem";

export function emitCartUpdate() {
  window.dispatchEvent(new CustomEvent("cart:updated"));
}

export default function CartPageClient() {
  const { token } = useAuth();
  const [cart, setCart] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isClient, setIsClient] = useState(false);

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

  if (!isClient) return <div>Loading...</div>;

  if (!token) {
    return (
      <main className="min-h-screen flex items-center justify-center">
        <div className="p-6 bg-white rounded">Debes iniciar sesión para ver tu carrito.</div>
      </main>
    );
  }

  if (loading) return <div>Loading...</div>;
  if (error) return <div className="text-red-600">{error}</div>;

  const hasProducts = cart?.products?.length > 0;

  return (
    <main className="min-h-screen bg-[var(--cce-beige)] px-4 py-10 md:px-10">
      <div className="mx-auto max-w-3xl bg-white p-6 rounded">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold">Mi carrito</h2>
          {hasProducts && (
            <button
              onClick={handleClearCart}
              className="text-sm text-red-500 hover:underline"
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

            {/* Total */}
            {cart.total_price !== undefined && (
              <div className="mt-6 flex justify-end border-t pt-4">
                <span className="text-lg font-semibold">
                  Total: ${Number(cart.total_price).toFixed(0)}
                </span>
              </div>
            )}
          </>
        ) : (
          <div>No hay productos en el carrito.</div>
        )}
      </div>
    </main>
  );
}