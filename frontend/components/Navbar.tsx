"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import useAuth from "@/context/AuthContext";
import { useEffect, useRef, useState } from "react";
import * as cartApi from "@/lib/cart-api";

export default function Navbar() {
  const router = useRouter();
  const { token, logout } = useAuth();
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
      <nav className="fixed top-0 left-0 right-0 z-30 bg-white shadow px-4 h-16 flex items-center justify-between">
        <button onClick={() => setOpen(true)} className="text-2xl font-bold text-[var(--cce-green-dark)]">
          ☰
        </button>

        <Link href="/" className="text-xl font-bold text-[var(--cce-green-dark)]">
          ECE
        </Link>

        {/* Derecha: carrito */}
        {token ? (
          <Link href="/carrito" className="relative p-2">
            {/* Ícono SVG carrito */}
            <svg xmlns="http://www.w3.org/2000/svg" className="h-7 w-7 text-[var(--cce-green-dark)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13l-1.5 6h13M7 13L5.4 5M10 21a1 1 0 100-2 1 1 0 000 2zm7 0a1 1 0 100-2 1 1 0 000 2z" />
            </svg>
            {/* Contador */}
            {cartCount > 0 && (
              <span className="absolute -top-1 -right-1 h-5 w-5 flex items-center justify-center rounded-full bg-red-500 text-xs text-white font-bold">
                {cartCount > 99 ? "99+" : cartCount}
              </span>
            )}
          </Link>
        ) : (
          <div className="w-9" />
        )}
      </nav>

      <div className="h-16" />

      {open && <div onClick={() => setOpen(false)} className="fixed inset-0 bg-black/40 z-40" />}

      <aside className={`fixed top-0 left-0 h-full w-72 bg-white shadow-lg z-50 transform transition-transform duration-300 ${open ? "translate-x-0" : "-translate-x-full"}`}>
        <div className="p-6 flex flex-col gap-6">
          <button onClick={() => setOpen(false)} className="self-end text-xl">✕</button>

          <Link href="/" onClick={() => setOpen(false)} className="text-lg font-semibold">Inicio</Link>

          {token ? (
            <button onClick={handleLogout} className="text-left text-lg font-semibold text-red-600">
              Cerrar sesión
            </button>
          ) : (
            <>
              <Link href="/login" onClick={() => setOpen(false)} className="text-lg font-semibold">Iniciar sesión</Link>
              <Link href="/registro" onClick={() => setOpen(false)} className="text-lg font-semibold">Registrarse</Link>
            </>
          )}
        </div>
      </aside>
    </>
  );
}