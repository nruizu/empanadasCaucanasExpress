"use client";

import Link from "next/link";
import { useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import useAuth from "@/context/AuthContext";

const adminSections = [
  {
    title: "Catálogo",
    description: "Crear, editar y ocultar productos visibles para clientes.",
    href: "/admin/catalogo",
  },
  {
    title: "Pedidos",
    description: "Revisar pedidos y operar el flujo de atención.",
    href: "/admin/pedidos",
  },
  {
    title: "Repartidores",
    description: "Gestionar usuarios repartidores y sus roles.",
    href: "/admin/repartidores",
  },
  {
    title: "Ventas manuales",
    description: "Registrar ventas de mostrador con historial y filtros.",
    href: "/admin/ventas",
  },
  {
    title: "Reporte de ventas",
    description: "Analizar ingresos, productos más vendidos y categorías.",
    href: "/admin/reporte-ventas",
  },
  {
    title: "Cobertura domicilio",
    description: "Configurar dirección base y radio máximo de entrega.",
    href: "/admin/cobertura",
  },
  {
    title: "Horarios y restricciones",
    description: "Ajustar horarios de servicio y fechas bloqueadas.",
    href: "/admin/horarios",
  },
];

export default function AdminHomePage() {
  const router = useRouter();
  const { token, authReady, user } = useAuth();

  const canAccess = useMemo(
    () => Boolean(token && user?.is_staff),
    [token, user],
  );

  useEffect(() => {
    if (!authReady) {
      return;
    }

    if (!token) {
      router.replace("/login");
      return;
    }

    if (user && !user.is_staff) {
      router.replace("/catalogo");
    }
  }, [authReady, router, token, user]);

  if (!authReady || !token || !canAccess) {
    return (
      <main className="min-h-screen bg-[var(--cce-beige)] px-4 py-8 md:px-8">
        <div className="mx-auto max-w-6xl rounded-xl bg-white p-6 text-center text-[var(--cce-text-muted)] shadow-[0_8px_30px_rgba(31,77,58,0.09)]">
          Verificando permisos...
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[linear-gradient(180deg,#f4eadb_0%,#faf7f0_100%)] px-4 py-8 md:px-8">
      <div className="mx-auto max-w-6xl space-y-6">
        <section className="overflow-hidden rounded-3xl bg-[linear-gradient(135deg,#1f5c3a_0%,#2f7a4f_55%,#f0c96f_100%)] p-8 text-white shadow-[0_16px_50px_rgba(31,92,58,0.24)] md:p-10">
          <p className="text-sm uppercase tracking-[0.28em] text-white/80">
            Panel de administración
          </p>
          <h1 className="mt-3 text-3xl font-bold md:text-4xl">
            Operación central del restaurante
          </h1>
          <p className="mt-3 max-w-2xl text-sm text-white/90 md:text-base">
            Accede rápido a las nuevas herramientas integradas tras el merge:
            catálogo, pedidos, ventas, cobertura y horarios.
          </p>
        </section>

        <section className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {adminSections.map((section) => (
            <Link
              key={section.href}
              href={section.href}
              className="group rounded-2xl border border-[color-mix(in_srgb,var(--cce-green-dark)_12%,white)] bg-white p-5 shadow-[0_10px_30px_rgba(31,77,58,0.08)] transition-transform duration-200 hover:-translate-y-1 hover:shadow-[0_16px_40px_rgba(31,77,58,0.14)]"
            >
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h2 className="text-lg font-semibold text-[var(--cce-green-dark)]">
                    {section.title}
                  </h2>
                  <p className="mt-2 text-sm leading-6 text-[var(--cce-text-muted)]">
                    {section.description}
                  </p>
                </div>
                <span className="rounded-full bg-[color-mix(in_srgb,var(--cce-green-dark)_10%,white)] px-3 py-1 text-xs font-semibold text-[var(--cce-green-dark)] transition-colors group-hover:bg-[color-mix(in_srgb,var(--cce-green-dark)_18%,white)]">
                  Abrir
                </span>
              </div>
            </Link>
          ))}
        </section>
      </div>
    </main>
  );
}
