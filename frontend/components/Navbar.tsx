"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import useAuth from "@/hooks/useAuth";
import { useEffect, useState } from "react";
import * as cartApi from "@/lib/cart-api";

export default function Navbar() {
  const router = useRouter();
  const { token, user, logout } = useAuth();
  const [cartCount, setCartCount] = useState<number>(0);

  // fetch cart count when token changes
  useEffect(() => {
    if (!token) {
      setCartCount(0);
      return;
    }

    const load = async () => {
      try {
        const carts = await cartApi.getCarts(token);
        let id: number | null = null;
        if (Array.isArray(carts) && carts.length > 0) {
          // find cart with items or most recent
          const withItems = carts.find((c: any) => c.products?.length > 0);
          id = withItems ? withItems.id : carts[carts.length - 1].id;
        }
        if (id != null) {
          const detail = await cartApi.getCart(id, token);
          setCartCount(detail.total_items || 0);
        }
      } catch {
        setCartCount(0);
      }
    };

    load();
  }, [token]);

  const handleLogout = async () => {
    await logout();
    router.push("/");
  };

  return (
    <nav className="bg-white shadow">
      <div className="mx-auto max-w-6xl px-4">
        <div className="flex h-16 items-center justify-between">
          <div className="flex items-center">
            <Link href="/" className="text-xl font-bold text-[var(--cce-green-dark)]">
              CCE
            </Link>
            <Link
              href="/catalogo"
              className="ml-8 text-sm font-medium text-[var(--cce-green-dark)] hover:underline"
            >
              Catálogo
            </Link>
          </div>
          <div className="flex items-center gap-6">
            {token ? (
              <>
                <Link
                  href="/carrito"
                  className="relative text-sm font-medium text-[var(--cce-green-dark)] hover:underline"
                >
                  Carrito
                  {cartCount > 0 && (
                    <span className="absolute -top-2 -right-3 inline-flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-xs text-white">
                      {cartCount}
                    </span>
                  )}
                </Link>
                <button
                  onClick={handleLogout}
                  className="text-sm font-medium text-[var(--cce-green-dark)] hover:underline"
                >
                  Cerrar sesión
                </button>
              </>
            ) : (
              <>
                <Link
                  href="/login"
                  className="text-sm font-medium text-[var(--cce-green-dark)] hover:underline"
                >
                  Iniciar sesión
                </Link>
                <Link
                  href="/registro"
                  className="text-sm font-medium text-[var(--cce-green-dark)] hover:underline"
                >
                  Registrarse
                </Link>
              </>
            )}
          </div>
        </div>
      </div>
    </nav>
  );
}
