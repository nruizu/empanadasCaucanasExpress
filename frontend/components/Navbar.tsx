"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import useAuth from "@/hooks/useAuth";
import { useEffect, useState } from "react";
import * as cartApi from "@/lib/cart-api";

export default function Navbar() {
  const router = useRouter();
  const { token, logout } = useAuth();
  const [cartCount, setCartCount] = useState<number>(0);
  const [open, setOpen] = useState(false);

  // cargar carrito cuando cambia token
  useEffect(() => {
    if (!token) {
      setCartCount(0);
      return;
    }

    const load = async () => {
      try {
        const cart = await cartApi.getMyCart(token);
        setCartCount(cart.total_items || 0);
      } catch {
        setCartCount(0);
      }
    };

    load();
  }, [token]);

  const handleLogout = async () => {
    await logout();
    setOpen(false);
    router.push("/");
  };

  return (
    <>
      {/* Top bar */}
      <nav className="bg-white shadow px-4 h-16 flex items-center justify-between">
        <button
          onClick={() => setOpen(true)}
          className="text-2xl font-bold text-[var(--cce-green-dark)]"
        >
          ☰
        </button>

        <Link
          href="/"
          className="text-xl font-bold text-[var(--cce-green-dark)]"
        >
          CCE
        </Link>
      </nav>

      {/* Overlay */}
      {open && (
        <div
          onClick={() => setOpen(false)}
          className="fixed inset-0 bg-black/40 z-40"
        />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed top-0 left-0 h-full w-72 bg-white shadow-lg z-50 transform transition-transform duration-300 ${
          open ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="p-6 flex flex-col gap-6">
          <button
            onClick={() => setOpen(false)}
            className="self-end text-xl"
          >
            ✕
          </button>

          <Link
            href="/"
            onClick={() => setOpen(false)}
            className="text-lg font-semibold"
          >
            Inicio
          </Link>

          <Link
            href="/catalogo"
            onClick={() => setOpen(false)}
            className="text-lg font-semibold"
          >
            Catálogo
          </Link>

          {token ? (
            <>
              <Link
                href="/carrito"
                onClick={() => setOpen(false)}
                className="relative text-lg font-semibold"
              >
                Carrito
                {cartCount > 0 && (
                  <span className="ml-2 inline-flex h-6 w-6 items-center justify-center rounded-full bg-red-500 text-xs text-white">
                    {cartCount}
                  </span>
                )}
              </Link>

              <button
                onClick={handleLogout}
                className="text-left text-lg font-semibold text-red-600"
              >
                Cerrar sesión
              </button>
            </>
          ) : (
            <>
              <Link
                href="/login"
                onClick={() => setOpen(false)}
                className="text-lg font-semibold"
              >
                Iniciar sesión
              </Link>

              <Link
                href="/registro"
                onClick={() => setOpen(false)}
                className="text-lg font-semibold"
              >
                Registrarse
              </Link>
            </>
          )}
        </div>
      </aside>
    </>
  );
}