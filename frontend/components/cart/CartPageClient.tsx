"use client";

import { useEffect, useState } from "react";
import useAuth from "@/hooks/useAuth";
import * as cartApi from "@/lib/cart-api";
import CartItem from "./CartItem";

export default function CartPageClient() {
  const { token } = useAuth();
  const [cart, setCart] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // avoid rendering auth-dependent UI on the server; the server doesn't
  // know whether a token is stored in localStorage, so it would render the
  // "please log in" message while the client may already be authenticated.
  // we use a simple flag that flips true once the component runs on the
  // client; until then we show a generic loading state that matches both
  // server and client initial output.
  const [isClient, setIsClient] = useState(false);
  useEffect(() => {
    setIsClient(true);
  }, []);

  useEffect(() => {
    // only start loading when we know the login state; token === null means
    // we haven't yet read from localStorage, so wait a bit.
    if (token === null) {
      return;
    }
    if (!token) {
      setLoading(false);
      return;
    }

    const load = async () => {
      try {
        // if we previously stored a cart id (when adding products), try
        // loading it directly rather than listing all carts.
        let cartId: string | null = null;
        if (typeof window !== "undefined") {
          cartId = localStorage.getItem('cce_cart_id');
        }
        if (cartId) {
          const detail = await cartApi.getCart(cartId, token);
          setCart(detail);
          return;
        }

        const carts = await cartApi.getCarts(token);
        if (Array.isArray(carts) && carts.length > 0) {
          // prefer the most recently created cart, or one with items
          let selected = carts[carts.length - 1];
          for (let i = carts.length - 1; i >= 0; i--) {
            if (carts[i].products && carts[i].products.length > 0) {
              selected = carts[i];
              break;
            }
          }
          const detail = await cartApi.getCart(selected.id, token);
          setCart(detail);
        } else {
          const created = await cartApi.createCart(token);
          setCart(created);
        }
      } catch (err: any) {
        setError(err.message || 'Error cargando carrito');
      } finally {
        setLoading(false);
      }
    };

    void load();
  }, [token]);

  // until we know whether we're running on the client, show the same
  // loading indicator the server outputs. this ensures the DOM matches on
  // hydration.
  if (!isClient) {
    return <div>Loading...</div>;
  }

  if (!token) {
    return (
      <main className="min-h-screen flex items-center justify-center">
        <div className="p-6 bg-white rounded">Debes iniciar sesión para ver tu carrito.</div>
      </main>
    );
  }

  if (loading) return <div>Loading...</div>;
  if (error) return <div className="text-red-600">{error}</div>;

  return (
    <main className="min-h-screen bg-[var(--cce-beige)] px-4 py-10 md:px-10">
      <div className="mx-auto max-w-3xl bg-white p-6 rounded">
        <h2 className="text-xl font-semibold mb-4">Mi carrito</h2>
        {cart && cart.products && cart.products.length > 0 ? (
          cart.products.map((p: any) => (
            <CartItem key={p.id} id={p.id} product={p.product} quantity={p.quantity} />
          ))
        ) : (
          <div>No hay productos en el carrito.</div>
        )}
      </div>
    </main>
  );
}
