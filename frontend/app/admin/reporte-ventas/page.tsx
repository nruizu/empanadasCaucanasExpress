"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import useAuth from "@/context/AuthContext";
import { getSalesAnalysis } from "@/lib/admin-sales-api";
import type {
  SalesAnalysisFilters,
  SalesAnalysisResponse,
} from "@/types/sales";

const GROUP_BY_OPTIONS: Array<{
  value: NonNullable<SalesAnalysisFilters["group_by"]>;
  label: string;
}> = [
  { value: "weekday", label: "Día de la semana" },
  { value: "week", label: "Semana" },
  { value: "month", label: "Mes" },
];

const RANGE_OPTIONS: Array<{
  value: NonNullable<SalesAnalysisFilters["range"]>;
  label: string;
}> = [
  { value: "last_week", label: "Última semana" },
  { value: "last_month", label: "Último mes" },
  { value: "last_year", label: "Último año" },
  { value: "all", label: "Todos los datos" },
];

const CURRENCY = new Intl.NumberFormat("es-CO", {
  style: "currency",
  currency: "COP",
  maximumFractionDigits: 0,
});

export default function AdminSalesReportPage() {
  const router = useRouter();
  const { token, authReady, user } = useAuth();

  const [filters, setFilters] = useState<SalesAnalysisFilters>({
    group_by: "weekday",
    range: "last_week",
  });
  const [analysis, setAnalysis] = useState<SalesAnalysisResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const canAccess = useMemo(
    () => Boolean(token && user?.is_staff),
    [token, user],
  );

  const loadAnalysis = useCallback(async () => {
    if (!canAccess) return;

    setLoading(true);
    setError(null);

    try {
      const response = await getSalesAnalysis(filters);
      setAnalysis(response);
    } catch (loadError) {
      console.error(loadError);
      setError("No fue posible generar el análisis de ventas.");
    } finally {
      setLoading(false);
    }
  }, [canAccess, filters]);

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
      return;
    }

    if (canAccess) {
      void loadAnalysis();
    }
  }, [token, authReady, user, canAccess, router, loadAnalysis]);

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
    <main className="min-h-screen bg-[var(--cce-beige)] px-4 py-8 md:px-8">
      <div className="mx-auto max-w-6xl space-y-6">
        <section className="rounded-xl bg-white p-6 shadow-[0_8px_30px_rgba(31,77,58,0.09)]">
          <h1 className="text-2xl font-bold text-[var(--cce-green-dark)]">
            Reporte de ventas
          </h1>
          <p className="mt-1 text-sm text-[var(--cce-text-muted)]">
            Analiza ingresos por periodo, ranking de productos y ventas por
            categoría.
          </p>

          <div className="mt-5 grid grid-cols-1 gap-3 md:grid-cols-2">
            <select
              value={filters.group_by}
              onChange={(event) =>
                setFilters((current) => ({
                  ...current,
                  group_by: event.target
                    .value as SalesAnalysisFilters["group_by"],
                }))
              }
              className="rounded-lg border border-[color-mix(in_srgb,var(--cce-green-dark)_20%,white)] px-3 py-2"
            >
              {GROUP_BY_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  Agrupar por: {option.label}
                </option>
              ))}
            </select>

            <select
              value={filters.range}
              onChange={(event) =>
                setFilters((current) => ({
                  ...current,
                  range: event.target.value as SalesAnalysisFilters["range"],
                }))
              }
              className="rounded-lg border border-[color-mix(in_srgb,var(--cce-green-dark)_20%,white)] px-3 py-2"
            >
              {RANGE_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  Periodo: {option.label}
                </option>
              ))}
            </select>
          </div>
        </section>

        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        {loading ? (
          <section className="rounded-xl bg-white p-6 text-sm text-[var(--cce-text-muted)] shadow-[0_8px_30px_rgba(31,77,58,0.09)]">
            Generando análisis...
          </section>
        ) : analysis ? (
          <>
            <section className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <div className="rounded-xl bg-white p-5 shadow-[0_8px_30px_rgba(31,77,58,0.09)]">
                <p className="text-sm text-[var(--cce-text-muted)]">
                  Órdenes analizadas
                </p>
                <p className="mt-1 text-2xl font-bold text-[var(--cce-green-dark)]">
                  {analysis.summary.total_orders}
                </p>
              </div>
              <div className="rounded-xl bg-white p-5 shadow-[0_8px_30px_rgba(31,77,58,0.09)]">
                <p className="text-sm text-[var(--cce-text-muted)]">
                  Ingreso total analizado
                </p>
                <p className="mt-1 text-2xl font-bold text-[var(--cce-green-dark)]">
                  {CURRENCY.format(analysis.summary.total_sold)}
                </p>
              </div>
            </section>

            <section className="rounded-xl bg-white p-6 shadow-[0_8px_30px_rgba(31,77,58,0.09)]">
              <h2 className="text-xl font-bold text-[var(--cce-green-dark)]">
                Ventas por periodo
              </h2>
              <p className="mt-1 text-sm text-[var(--cce-text-muted)]">
                Visualiza la distribución de ingresos por día, semana o mes.
              </p>

              <img
                src={analysis.sales_chart_image}
                alt="Gráfico de ventas por periodo"
                className="mt-4 w-full rounded-lg border border-[color-mix(in_srgb,var(--cce-green-dark)_15%,white)]"
              />
            </section>

            <section className="rounded-xl bg-white p-6 shadow-[0_8px_30px_rgba(31,77,58,0.09)]">
              <h2 className="text-xl font-bold text-[var(--cce-green-dark)]">
                Top 6 productos más vendidos
              </h2>

              {analysis.top_products.length === 0 ? (
                <p className="mt-3 text-sm text-[var(--cce-text-muted)]">
                  No hay productos vendidos en el rango seleccionado.
                </p>
              ) : (
                <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2">
                  {analysis.top_products.map((item, index) => (
                    <article
                      key={item.product_id}
                      className="rounded-lg border border-[color-mix(in_srgb,var(--cce-green-dark)_15%,white)] p-4"
                    >
                      <p className="text-xs font-semibold uppercase text-[var(--cce-text-muted)]">
                        #{index + 1}
                      </p>
                      <h3 className="mt-1 font-semibold text-[var(--cce-green-dark)]">
                        {item.name}
                      </h3>
                      <p className="mt-1 text-sm text-[var(--cce-text-muted)]">
                        Categoría: {item.category || "Sin categoría"}
                      </p>
                      <p className="mt-2 text-sm">
                        Unidades: <strong>{item.total_quantity}</strong>
                      </p>
                      <p className="text-sm">
                        Ingresos:{" "}
                        <strong>{CURRENCY.format(item.total_sold)}</strong>
                      </p>
                    </article>
                  ))}
                </div>
              )}
            </section>

            <section className="rounded-xl bg-white p-6 shadow-[0_8px_30px_rgba(31,77,58,0.09)]">
              <h2 className="text-xl font-bold text-[var(--cce-green-dark)]">
                Ventas por categoría
              </h2>

              <img
                src={analysis.category_chart_image}
                alt="Gráfico de ventas por categoría"
                className="mt-4 w-full rounded-lg border border-[color-mix(in_srgb,var(--cce-green-dark)_15%,white)]"
              />

              {analysis.category_sales.length > 0 && (
                <div className="mt-4 overflow-x-auto">
                  <table className="w-full border-collapse text-sm">
                    <thead>
                      <tr className="border-b border-[color-mix(in_srgb,var(--cce-green-dark)_20%,white)] text-left text-[var(--cce-text-muted)]">
                        <th className="py-2 pr-4">Categoría</th>
                        <th className="py-2 pr-4">Unidades</th>
                        <th className="py-2 pr-4">Ingresos</th>
                      </tr>
                    </thead>
                    <tbody>
                      {analysis.category_sales.map((row) => (
                        <tr
                          key={row.category}
                          className="border-b border-[color-mix(in_srgb,var(--cce-green-dark)_10%,white)]"
                        >
                          <td className="py-2 pr-4">{row.category}</td>
                          <td className="py-2 pr-4">{row.total_quantity}</td>
                          <td className="py-2 pr-4">
                            {CURRENCY.format(row.total_sold)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          </>
        ) : null}
      </div>
    </main>
  );
}
