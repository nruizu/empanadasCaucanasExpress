"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import useAuth from "@/context/AuthContext";
import { useEffect, useRef, useState } from "react";
import * as cartApi from "@/lib/cart-api";

export default function Navbar() {
  const router = useRouter();
  const { token, user, logout } = useAuth();
  const [cartCount, setCartCount] = useState<number>(0);
  const [open, setOpen] = useState(false);

  const tokenRef = useRef(token);
  useEffect(() => { tokenRef.current = token; }, [token]);

  const loadCart = async () => {
    const t = tokenRef.current;
    if (!t) { setCartCount(0); return; }
    try {
      const cart = await cartApi.getMyCart();
      setCartCount(cart.total_items || 0);
    } catch {
      setCartCount(0);
    }
  };

  useEffect(() => { loadCart(); }, [token]);

  useEffect(() => {
    window.addEventListener("cart:updated", loadCart);
    window.addEventListener("auth:changed", loadCart);
    return () => {
      window.removeEventListener("cart:updated", loadCart);
      window.removeEventListener("auth:changed", loadCart);
    };
  }, []);

  const handleLogout = async () => {
    await logout();
    setCartCount(0);
    setOpen(false);
    router.push("/");
  };

  return (
    <>
      <nav className="fixed top-0 left-0 right-0 z-30 h-20 bg-[var(--primary)] px-4 text-white shadow-md md:px-6">
        <div className="mx-auto flex h-full w-full max-w-6xl items-center justify-between">
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="rounded-lg p-2.5 transition-colors hover:bg-white/10"
            aria-label="Abrir menú"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-7 w-7" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>

          <Link href="/" className="text-center text-lg font-semibold tracking-wide sm:text-xl">
            Empanadas Caucanas <span className="text-[var(--secondary)]">Express</span>
          </Link>

          <div className="flex items-center gap-2">
            <Link href="/" aria-label="Ir al inicio" className="hidden rounded-md p-1 transition-colors hover:bg-white/10 sm:block">
              <img
                src="/logo.png"
                alt="Empanadas Caucanas"
                className="h-16 w-auto object-contain"
              />
            </Link>
            {token ? (
              <Link href="/carrito" className="relative rounded-lg p-2.5 transition-colors hover:bg-white/10" aria-label="Ir al carrito">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13l-1.5 6h13M10 21a1 1 0 100-2 1 1 0 000 2zm7 0a1 1 0 100-2 1 1 0 000 2z" />
                </svg>
                {cartCount > 0 && (
                  <span className="absolute -right-1 -top-1 flex h-6 w-6 items-center justify-center rounded-full bg-[var(--accent)] text-xs font-bold text-[var(--accent-foreground)]">
                    {cartCount > 99 ? "99+" : cartCount}
                  </span>
                )}
              </Link>
            ) : (
              <div className="w-10" />
            )}
          </div>
        </div>
      </nav>

      <div className="h-20" />

      {open && <div onClick={() => setOpen(false)} className="fixed inset-0 z-40 bg-black/50" />}

      <aside className={`fixed left-0 top-0 z-50 h-full w-72 bg-[var(--card)] shadow-2xl transition-transform duration-300 ${open ? "translate-x-0" : "-translate-x-full"}`}>
        <div className="flex items-center justify-between bg-[var(--primary)] px-6 py-4 text-white">
          <h2 className="text-lg">Menú</h2>
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="rounded-lg p-2 transition-colors hover:bg-white/10"
            aria-label="Cerrar menú"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="flex h-[calc(100%-72px)] flex-col justify-between p-4">
          <nav className="space-y-2">
            <Link href="/" onClick={() => setOpen(false)} className="block rounded-lg px-4 py-3 font-medium text-[var(--foreground)] transition-colors hover:bg-[color-mix(in_srgb,var(--secondary)_20%,transparent)]">
              Inicio
            </Link>
            {token && (
              <Link href="/carrito" onClick={() => setOpen(false)} className="block rounded-lg px-4 py-3 font-medium text-[var(--foreground)] transition-colors hover:bg-[color-mix(in_srgb,var(--secondary)_20%,transparent)]">
                Mi pedido
              </Link>
            )}
            {token && user?.is_staff && (
              <Link href="/admin/catalogo" onClick={() => setOpen(false)} className="block rounded-lg px-4 py-3 font-medium text-[var(--foreground)] transition-colors hover:bg-[color-mix(in_srgb,var(--secondary)_20%,transparent)]">
                Gestión catálogo
              </Link>
            )}

            {token ? (
              <button
                type="button"
                onClick={handleLogout}
                className="w-full rounded-lg px-4 py-3 text-left font-medium text-red-700 transition-colors hover:bg-red-50"
              >
                Cerrar sesión
              </button>
            ) : (
              <>
                <Link href="/login" onClick={() => setOpen(false)} className="block rounded-lg px-4 py-3 font-medium text-[var(--foreground)] transition-colors hover:bg-[color-mix(in_srgb,var(--secondary)_20%,transparent)]">
                  Iniciar sesión
                </Link>
                <Link href="/registro" onClick={() => setOpen(false)} className="block rounded-lg px-4 py-3 font-medium text-[var(--foreground)] transition-colors hover:bg-[color-mix(in_srgb,var(--secondary)_20%,transparent)]">
                  Registrarse
                </Link>
              </>
            )}
          </nav>

          <div className="rounded-lg bg-[color-mix(in_srgb,var(--muted)_70%,white)] p-4 text-center">
            <p className="text-xs text-[var(--muted-foreground)]">Empanadas Caucanas</p>
            <p className="mt-1 text-xs text-[var(--muted-foreground)]">Tradición desde 1972</p>
          </div>
        </div>
      </aside>
    </>
  );
}