"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import useAuth from "@/context/AuthContext";
import {
  getDeliveryCoverageSettings,
  saveDeliveryCoverageSettings,
  type DeliveryCoverageSettingsUpdatePayload,
} from "@/lib/admin-delivery-coverage-api";

interface CoverageFormState {
  id: number | null;
  name: string;
  local_address: string;
  local_city: string;
  local_region: string;
  local_country: string;
  local_reference: string;
  local_latitude: string;
  local_longitude: string;
  max_delivery_km: string;
  is_enabled: boolean;
  coverage_note: string;
}

const INITIAL_FORM: CoverageFormState = {
  id: null,
  name: "Cobertura principal",
  local_address: "",
  local_city: "",
  local_region: "",
  local_country: "Colombia",
  local_reference: "",
  local_latitude: "",
  local_longitude: "",
  max_delivery_km: "",
  is_enabled: true,
  coverage_note: "",
};

export default function AdminCoveragePage() {
  const router = useRouter();
  const { token, user } = useAuth();

  const [form, setForm] = useState<CoverageFormState>(INITIAL_FORM);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [lastUpdatedAt, setLastUpdatedAt] = useState<string | null>(null);

  const canAccess = useMemo(
    () => Boolean(token && user?.is_staff),
    [token, user],
  );

  const loadCoverage = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const data = await getDeliveryCoverageSettings();
      setForm({
        id: data.id,
        name: data.name || "Cobertura principal",
        local_address: data.local_address || "",
        local_city: data.local_city || "",
        local_region: data.local_region || "",
        local_country: data.local_country || "Colombia",
        local_reference: data.local_reference || "",
        local_latitude: data.local_latitude || "",
        local_longitude: data.local_longitude || "",
        max_delivery_km: data.max_delivery_km || "",
        is_enabled: Boolean(data.is_enabled),
        coverage_note: data.coverage_note || "",
      });
      setLastUpdatedAt(data.updated_at);
    } catch (loadError: unknown) {
      if (loadError instanceof Error) {
        setError(loadError.message);
      } else {
        setError("No se pudo cargar la configuración de cobertura");
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!token) {
      router.replace("/login");
      return;
    }

    if (user && !user.is_staff) {
      router.replace("/catalogo");
      return;
    }

    if (canAccess) {
      void loadCoverage();
    }
  }, [token, user, canAccess, loadCoverage, router]);

  const updateField = (
    field: keyof CoverageFormState,
    value: string | boolean,
  ) => {
    const clearsCoordinates =
      field === "local_address" ||
      field === "local_city" ||
      field === "local_region" ||
      field === "local_country" ||
      field === "local_reference";

    if (field === "max_delivery_km" && typeof value === "string") {
      const normalized = value.replace(",", ".");
      setForm((current) => ({
        ...current,
        [field]: normalized,
        ...(clearsCoordinates
          ? { local_latitude: "", local_longitude: "" }
          : {}),
      }));
      return;
    }

    setForm((current) => ({
      ...current,
      [field]: value,
      ...(clearsCoordinates ? { local_latitude: "", local_longitude: "" } : {}),
    }));
  };

  const validateForm = () => {
    const maxKm = Number(form.max_delivery_km);

    if (!form.name.trim()) {
      setError("El nombre de la cobertura es obligatorio");
      return false;
    }

    if (!form.local_address.trim()) {
      setError("La direccion del local es obligatoria");
      return false;
    }

    if (!form.local_city.trim()) {
      setError("La ciudad o pueblo del local es obligatorio");
      return false;
    }

    if (Number.isNaN(maxKm) || maxKm <= 0) {
      setError("El límite en kilómetros debe ser mayor a 0");
      return false;
    }

    return true;
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    setSuccess(null);

    if (!validateForm()) {
      return;
    }

    setSubmitting(true);
    try {
      const payload: DeliveryCoverageSettingsUpdatePayload = {
        id: form.id,
        name: form.name.trim(),
        local_address: form.local_address.trim(),
        local_city: form.local_city.trim(),
        local_region: form.local_region.trim(),
        local_country: form.local_country.trim() || "Colombia",
        local_reference: form.local_reference.trim(),
        max_delivery_km: form.max_delivery_km.trim(),
        is_enabled: form.is_enabled,
        coverage_note: form.coverage_note.trim(),
      };

      const saved = await saveDeliveryCoverageSettings(payload);
      setForm({
        id: saved.id,
        name: saved.name,
        local_address: saved.local_address,
        local_city: saved.local_city,
        local_region: saved.local_region,
        local_country: saved.local_country,
        local_reference: saved.local_reference,
        local_latitude: saved.local_latitude,
        local_longitude: saved.local_longitude,
        max_delivery_km: saved.max_delivery_km,
        is_enabled: saved.is_enabled,
        coverage_note: saved.coverage_note,
      });
      setLastUpdatedAt(saved.updated_at);
      setSuccess("Configuración de cobertura guardada correctamente.");
    } catch (submitError: unknown) {
      if (submitError instanceof Error) {
        setError(submitError.message);
      } else {
        setError("No fue posible guardar la cobertura");
      }
    } finally {
      setSubmitting(false);
    }
  };

  if (!token || !canAccess) {
    return (
      <main className="min-h-screen bg-[var(--cce-beige)] px-4 py-8 md:px-8">
        <div className="mx-auto max-w-4xl rounded-xl bg-white p-6 text-center text-[var(--cce-text-muted)] shadow-[0_8px_30px_rgba(31,77,58,0.09)]">
          Verificando permisos...
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[var(--cce-beige)] px-4 py-8 md:px-8">
      <div className="mx-auto max-w-4xl space-y-6">
        <section className="rounded-xl bg-white p-6 shadow-[0_8px_30px_rgba(31,77,58,0.09)]">
          <h1 className="text-2xl font-bold text-[var(--cce-green-dark)]">
            Cobertura de domicilios
          </h1>
          <p className="mt-1 text-sm text-[var(--cce-text-muted)]">
            Configura la direccion del local y el radio maximo de entrega en
            kilometros.
          </p>

          {error && (
            <div className="mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {error}
            </div>
          )}

          {success && (
            <div className="mt-4 rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">
              {success}
            </div>
          )}

          {loading ? (
            <p className="mt-4 text-sm text-[var(--cce-text-muted)]">
              Cargando configuración...
            </p>
          ) : (
            <form
              onSubmit={handleSubmit}
              className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2"
            >
              <input
                value={form.name}
                onChange={(event) => updateField("name", event.target.value)}
                placeholder="Nombre de la cobertura"
                className="md:col-span-2 rounded-lg border border-[color-mix(in_srgb,var(--cce-green-dark)_20%,white)] px-3 py-2 outline-none focus:border-[var(--cce-green-dark)]"
              />

              <input
                value={form.local_address}
                onChange={(event) =>
                  updateField("local_address", event.target.value)
                }
                placeholder="Direccion del local (ej: Calle 20B #80-15)"
                className="md:col-span-2 rounded-lg border border-[color-mix(in_srgb,var(--cce-green-dark)_20%,white)] px-3 py-2 outline-none focus:border-[var(--cce-green-dark)]"
              />

              <input
                value={form.local_city}
                onChange={(event) =>
                  updateField("local_city", event.target.value)
                }
                placeholder="Ciudad o pueblo (ej: Medellin)"
                className="rounded-lg border border-[color-mix(in_srgb,var(--cce-green-dark)_20%,white)] px-3 py-2 outline-none focus:border-[var(--cce-green-dark)]"
              />

              <input
                value={form.local_region}
                onChange={(event) =>
                  updateField("local_region", event.target.value)
                }
                placeholder="Departamento/region (ej: Antioquia)"
                className="rounded-lg border border-[color-mix(in_srgb,var(--cce-green-dark)_20%,white)] px-3 py-2 outline-none focus:border-[var(--cce-green-dark)]"
              />

              <input
                value={form.local_country}
                onChange={(event) =>
                  updateField("local_country", event.target.value)
                }
                placeholder="Pais (ej: Colombia)"
                className="rounded-lg border border-[color-mix(in_srgb,var(--cce-green-dark)_20%,white)] px-3 py-2 outline-none focus:border-[var(--cce-green-dark)]"
              />

              <input
                value={form.local_reference}
                onChange={(event) =>
                  updateField("local_reference", event.target.value)
                }
                placeholder="Referencia (opcional, ej: Barrio Belen)"
                className="rounded-lg border border-[color-mix(in_srgb,var(--cce-green-dark)_20%,white)] px-3 py-2 outline-none focus:border-[var(--cce-green-dark)]"
              />

              <input
                value={form.max_delivery_km}
                onChange={(event) =>
                  updateField("max_delivery_km", event.target.value)
                }
                placeholder="Limite de cobertura km (ej: 20)"
                className="rounded-lg border border-[color-mix(in_srgb,var(--cce-green-dark)_20%,white)] px-3 py-2 outline-none focus:border-[var(--cce-green-dark)]"
              />

              <input
                value={form.local_latitude}
                readOnly
                placeholder="Latitud resuelta automaticamente"
                className="rounded-lg border border-[color-mix(in_srgb,var(--cce-green-dark)_12%,white)] bg-gray-50 px-3 py-2 text-gray-600"
              />

              <input
                value={form.local_longitude}
                readOnly
                placeholder="Longitud resuelta automaticamente"
                className="rounded-lg border border-[color-mix(in_srgb,var(--cce-green-dark)_12%,white)] bg-gray-50 px-3 py-2 text-gray-600"
              />

              <label className="flex items-center gap-2 text-sm text-[var(--cce-green-dark)]">
                <input
                  type="checkbox"
                  checked={form.is_enabled}
                  onChange={(event) =>
                    updateField("is_enabled", event.target.checked)
                  }
                />
                Cobertura activa
              </label>

              <textarea
                value={form.coverage_note}
                onChange={(event) =>
                  updateField("coverage_note", event.target.value)
                }
                placeholder="Nota interna de cobertura (opcional)"
                rows={3}
                className="md:col-span-2 rounded-lg border border-[color-mix(in_srgb,var(--cce-green-dark)_20%,white)] px-3 py-2 outline-none focus:border-[var(--cce-green-dark)]"
              />

              <div className="md:col-span-2 flex items-center justify-between gap-4">
                <button
                  type="submit"
                  disabled={submitting}
                  className="rounded-full bg-[var(--cce-green-dark)] px-5 py-2 text-sm font-semibold text-white disabled:opacity-60"
                >
                  {submitting ? "Guardando..." : "Guardar configuración"}
                </button>

                <p className="text-xs text-[var(--cce-text-muted)]">
                  Última actualización:{" "}
                  {lastUpdatedAt
                    ? new Date(lastUpdatedAt).toLocaleString("es-CO")
                    : "Sin registros"}
                </p>
              </div>
            </form>
          )}
        </section>
      </div>
    </main>
  );
}
