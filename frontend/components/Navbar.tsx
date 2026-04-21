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
  const [searchQuery, setSearchQuery] = useState("");

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

  const handleSearch = (event: React.FormEvent) => {
    event.preventDefault();
    const query = searchQuery.trim();
    if (!query) {
      router.push("/");
      return;
    }
    router.push(`/?search=${encodeURIComponent(query)}#todos-productos`);
  };

  return (
    <>
      <nav className="fixed top-0 left-0 right-0 z-30 h-20 bg-[var(--primary)] px-4 text-white shadow-md md:px-6">
        <div className="mx-auto grid h-full w-full max-w-6xl grid-cols-[auto_1fr_auto] items-center gap-2">
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

          <Link href="/" className="mx-auto flex min-w-0 items-center gap-2 sm:gap-3">
            <img
              src="/logo.png"
              alt="Empanadas Caucanas"
              className="h-12 w-auto object-contain sm:h-14"
            />
            <span className="truncate text-lg font-semibold tracking-wide sm:text-xl md:text-2xl">
              Empanadas Caucanas <span className="text-[var(--secondary)]">Express</span>
            </span>
          </Link>

          <div className="flex items-center justify-end gap-1 sm:gap-2">
            <form
              onSubmit={handleSearch}
              className="hidden items-center rounded-full border border-white/25 bg-white/10 pl-2 pr-1 backdrop-blur-sm sm:flex"
              role="search"
              aria-label="Buscar productos"
            >
              <input
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                placeholder="Buscar productos"
                className="w-28 bg-transparent py-1.5 text-sm text-white placeholder:text-white/80 outline-none md:w-40"
              />
              <button
                type="submit"
                className="rounded-full p-2 transition-colors hover:bg-white/20"
                aria-label="Buscar productos"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-4.35-4.35" />
                  <circle cx="11" cy="11" r="6" />
                </svg>
              </button>
            </form>

            <button
              type="button"
              onClick={() => {
                const query = window.prompt("Buscar productos", searchQuery)?.trim() ?? "";
                setSearchQuery(query);
                router.push(query ? `/?search=${encodeURIComponent(query)}#todos-productos` : "/");
              }}
              className="rounded-lg p-2.5 transition-colors hover:bg-white/10 sm:hidden"
              aria-label="Buscar productos"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-4.35-4.35" />
                <circle cx="11" cy="11" r="6" />
              </svg>
            </button>

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

        <div className="flex h-[calc(100%-72px)] flex-col p-4">
          <nav className="space-y-2">
            <Link href="/" onClick={() => setOpen(false)} className="block rounded-lg px-4 py-3 font-medium text-[var(--foreground)] transition-colors hover:bg-[color-mix(in_srgb,var(--secondary)_20%,transparent)]">
              Inicio
            </Link>
            {token && (
              <Link href="/cuenta" onClick={() => setOpen(false)} className="block rounded-lg px-4 py-3 font-medium text-[var(--foreground)] transition-colors hover:bg-[color-mix(in_srgb,var(--secondary)_20%,transparent)]">
                Cuenta
              </Link>
            )}
            {token && (
              <Link href="/mi-pedido" onClick={() => setOpen(false)} className="block rounded-lg px-4 py-3 font-medium text-[var(--foreground)] transition-colors hover:bg-[color-mix(in_srgb,var(--secondary)_20%,transparent)]">
                Mis pedidos
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

          {token && user?.is_staff && (
            <div className="mt-auto border-t border-[color-mix(in_srgb,var(--muted)_35%,white)] pt-4">
              <p className="px-4 text-xs font-semibold tracking-[0.08em] text-[var(--muted-foreground)]">
                ADMINISTRACIÓN
              </p>
              <nav className="mt-2 space-y-2">
                <Link href="/admin/catalogo" onClick={() => setOpen(false)} className="block rounded-lg px-4 py-3 font-medium text-[var(--foreground)] transition-colors hover:bg-[color-mix(in_srgb,var(--secondary)_20%,transparent)]">
                  Gestión catálogo
                </Link>
                <Link href="/admin/pedidos" onClick={() => setOpen(false)} className="block rounded-lg px-4 py-3 font-medium text-[var(--foreground)] transition-colors hover:bg-[color-mix(in_srgb,var(--secondary)_20%,transparent)]">
                  Gestión de pedidos
                </Link>
                <Link href="/admin/cobertura" onClick={() => setOpen(false)} className="block rounded-lg px-4 py-3 font-medium text-[var(--foreground)] transition-colors hover:bg-[color-mix(in_srgb,var(--secondary)_20%,transparent)]">
                  Cobertura domicilios
                </Link>
                <Link href="/admin/ventas" onClick={() => setOpen(false)} className="block rounded-lg px-4 py-3 font-medium text-[var(--foreground)] transition-colors hover:bg-[color-mix(in_srgb,var(--secondary)_20%,transparent)]">
                  Historial de ventas
                </Link>
                <Link href="/admin/reporte-ventas" onClick={() => setOpen(false)} className="block rounded-lg px-4 py-3 font-medium text-[var(--foreground)] transition-colors hover:bg-[color-mix(in_srgb,var(--secondary)_20%,transparent)]">
                  Reporte de ventas
                </Link>
                <Link href="/admin/horarios" onClick={() => setOpen(false)} className="block rounded-lg px-4 py-3 font-medium text-[var(--foreground)] transition-colors hover:bg-[color-mix(in_srgb,var(--secondary)_20%,transparent)]">
                  Gestión horarios
                </Link>
              </nav>
            </div>
          )}

          {!token && (
            <div className="mt-auto rounded-lg bg-[color-mix(in_srgb,var(--muted)_70%,white)] p-4 text-center">
              <p className="text-xs text-[var(--muted-foreground)]">Empanadas Caucanas</p>
              <p className="mt-1 text-xs text-[var(--muted-foreground)]">Tradición desde 1972</p>
            </div>
          )}
        </div>
      </aside>
    </>
  );
}