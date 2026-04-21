"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import useAuth from "@/context/AuthContext";
import {
  createAdminRestrictedDate,
  deleteAdminRestrictedDate,
  getAdminOrderAvailability,
  getAdminRestrictedDates,
  updateAdminOrderAvailability,
  updateAdminRestrictedDate,
  type OrderAvailabilityConfigPayload,
  type RestrictedDate,
} from "@/lib/admin-catalog-api";

const INITIAL_AVAILABILITY_FORM: OrderAvailabilityConfigPayload = {
  pickup_weekday_open: "09:00",
  pickup_weekday_close: "20:00",
  pickup_sunday_open: "08:00",
  pickup_sunday_close: "20:00",
  delivery_weekday_open: "09:00",
  delivery_weekday_close: "19:30",
  delivery_sunday_open: "08:00",
  delivery_sunday_close: "19:30",
  is_accepting_orders: true,
  order_notice: "",
};

interface RestrictedDateFormState {
  date: string;
  applies_to: "all" | "pickup" | "delivery" | "scheduled";
  reason: string;
  is_active: boolean;
}

const INITIAL_RESTRICTED_DATE_FORM: RestrictedDateFormState = {
  date: "",
  applies_to: "all",
  reason: "",
  is_active: true,
};

const toTimeInput = (value: string) => value.slice(0, 5);
const toApiTime = (value: string) => `${value}:00`;

export default function AdminHorariosPage() {
  const router = useRouter();
  const { token, user } = useAuth();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [availabilityForm, setAvailabilityForm] = useState<OrderAvailabilityConfigPayload>(
    INITIAL_AVAILABILITY_FORM,
  );
  const [savingAvailability, setSavingAvailability] = useState(false);

  const [restrictedDates, setRestrictedDates] = useState<RestrictedDate[]>([]);
  const [restrictedDateForm, setRestrictedDateForm] =
    useState<RestrictedDateFormState>(INITIAL_RESTRICTED_DATE_FORM);
  const [editingRestrictedDateId, setEditingRestrictedDateId] = useState<number | null>(null);
  const [savingRestrictedDate, setSavingRestrictedDate] = useState(false);

  const canAccess = useMemo(() => Boolean(token && user?.is_staff), [token, user]);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const [availabilityResponse, restrictedDatesResponse] = await Promise.all([
        getAdminOrderAvailability(),
        getAdminRestrictedDates(),
      ]);

      setAvailabilityForm({
        pickup_weekday_open: toTimeInput(availabilityResponse.pickup_weekday_open),
        pickup_weekday_close: toTimeInput(availabilityResponse.pickup_weekday_close),
        pickup_sunday_open: toTimeInput(availabilityResponse.pickup_sunday_open),
        pickup_sunday_close: toTimeInput(availabilityResponse.pickup_sunday_close),
        delivery_weekday_open: toTimeInput(availabilityResponse.delivery_weekday_open),
        delivery_weekday_close: toTimeInput(availabilityResponse.delivery_weekday_close),
        delivery_sunday_open: toTimeInput(availabilityResponse.delivery_sunday_open),
        delivery_sunday_close: toTimeInput(availabilityResponse.delivery_sunday_close),
        is_accepting_orders: availabilityResponse.is_accepting_orders,
        order_notice: availabilityResponse.order_notice,
      });
      setRestrictedDates(restrictedDatesResponse);
    } catch (loadError) {
      console.error(loadError);
      setError("No se pudo cargar la gestión de horarios.");
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
      void loadData();
    }
  }, [token, user, canAccess, loadData, router]);

  const handleAvailabilityFieldChange = (
    field: keyof OrderAvailabilityConfigPayload,
    value: string | boolean,
  ) => {
    setAvailabilityForm((current) => ({ ...current, [field]: value }));
  };

  const handleSaveAvailability = async (event: React.FormEvent) => {
    event.preventDefault();
    setSavingAvailability(true);
    setError(null);
    setSuccess(null);

    try {
      const payload: OrderAvailabilityConfigPayload = {
        pickup_weekday_open: toApiTime(availabilityForm.pickup_weekday_open),
        pickup_weekday_close: toApiTime(availabilityForm.pickup_weekday_close),
        pickup_sunday_open: toApiTime(availabilityForm.pickup_sunday_open),
        pickup_sunday_close: toApiTime(availabilityForm.pickup_sunday_close),
        delivery_weekday_open: toApiTime(availabilityForm.delivery_weekday_open),
        delivery_weekday_close: toApiTime(availabilityForm.delivery_weekday_close),
        delivery_sunday_open: toApiTime(availabilityForm.delivery_sunday_open),
        delivery_sunday_close: toApiTime(availabilityForm.delivery_sunday_close),
        is_accepting_orders: availabilityForm.is_accepting_orders,
        order_notice: availabilityForm.order_notice,
      };

      const updated = await updateAdminOrderAvailability(payload);
      setAvailabilityForm({
        pickup_weekday_open: toTimeInput(updated.pickup_weekday_open),
        pickup_weekday_close: toTimeInput(updated.pickup_weekday_close),
        pickup_sunday_open: toTimeInput(updated.pickup_sunday_open),
        pickup_sunday_close: toTimeInput(updated.pickup_sunday_close),
        delivery_weekday_open: toTimeInput(updated.delivery_weekday_open),
        delivery_weekday_close: toTimeInput(updated.delivery_weekday_close),
        delivery_sunday_open: toTimeInput(updated.delivery_sunday_open),
        delivery_sunday_close: toTimeInput(updated.delivery_sunday_close),
        is_accepting_orders: updated.is_accepting_orders,
        order_notice: updated.order_notice,
      });
      setSuccess("Horarios y aviso actualizados correctamente.");
    } catch (availabilityError: unknown) {
      console.error(availabilityError);
      if (availabilityError instanceof Error) {
        setError(availabilityError.message);
      } else {
        setError("No fue posible actualizar horarios.");
      }
    } finally {
      setSavingAvailability(false);
    }
  };

  const handleRestrictedDateFieldChange = (
    field: keyof RestrictedDateFormState,
    value: string | boolean,
  ) => {
    setRestrictedDateForm((current) => ({ ...current, [field]: value }));
  };

  const resetRestrictedDateForm = () => {
    setRestrictedDateForm(INITIAL_RESTRICTED_DATE_FORM);
    setEditingRestrictedDateId(null);
  };

  const handleEditRestrictedDate = (item: RestrictedDate) => {
    setRestrictedDateForm({
      date: item.date,
      applies_to: item.applies_to,
      reason: item.reason,
      is_active: item.is_active,
    });
    setEditingRestrictedDateId(item.id);
  };

  const handleSubmitRestrictedDate = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    setSuccess(null);

    if (!restrictedDateForm.date) {
      setError("Debes seleccionar una fecha restringida.");
      return;
    }

    setSavingRestrictedDate(true);

    try {
      if (editingRestrictedDateId) {
        await updateAdminRestrictedDate(editingRestrictedDateId, restrictedDateForm);
        setSuccess("Día restringido actualizado correctamente.");
      } else {
        await createAdminRestrictedDate(restrictedDateForm);
        setSuccess("Día restringido creado correctamente.");
      }

      resetRestrictedDateForm();
      const updatedDates = await getAdminRestrictedDates();
      setRestrictedDates(updatedDates);
    } catch (restrictedDateError: unknown) {
      console.error(restrictedDateError);
      if (restrictedDateError instanceof Error) {
        setError(restrictedDateError.message);
      } else {
        setError("No fue posible guardar el día restringido.");
      }
    } finally {
      setSavingRestrictedDate(false);
    }
  };

  const handleDeleteRestrictedDate = async (id: number) => {
    const accepted = window.confirm("¿Seguro que deseas eliminar este día restringido?");
    if (!accepted) {
      return;
    }

    setError(null);
    setSuccess(null);
    try {
      await deleteAdminRestrictedDate(id);
      setSuccess("Día restringido eliminado correctamente.");
      if (editingRestrictedDateId === id) {
        resetRestrictedDateForm();
      }
      const updatedDates = await getAdminRestrictedDates();
      setRestrictedDates(updatedDates);
    } catch (deleteError: unknown) {
      console.error(deleteError);
      if (deleteError instanceof Error) {
        setError(deleteError.message);
      } else {
        setError("No fue posible eliminar el día restringido.");
      }
    }
  };

  const handleToggleRestrictedDate = async (item: RestrictedDate) => {
    setError(null);
    setSuccess(null);
    try {
      await updateAdminRestrictedDate(item.id, {
        date: item.date,
        applies_to: item.applies_to,
        reason: item.reason,
        is_active: !item.is_active,
      });
      setSuccess(item.is_active ? "Restricción desactivada." : "Restricción activada.");
      const updatedDates = await getAdminRestrictedDates();
      setRestrictedDates(updatedDates);
    } catch (toggleError: unknown) {
      console.error(toggleError);
      if (toggleError instanceof Error) {
        setError(toggleError.message);
      } else {
        setError("No fue posible cambiar el estado de la restricción.");
      }
    }
  };

  if (!token || !canAccess) {
    return (
      <main className="min-h-screen bg-[var(--cce-beige)] px-4 py-8 md:px-8">
        <div className="mx-auto max-w-5xl rounded-xl bg-white p-6 text-center text-[var(--cce-text-muted)] shadow-[0_8px_30px_rgba(31,77,58,0.09)]">
          Verificando permisos...
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[var(--cce-beige)] px-4 py-8 md:px-8">
      <div className="mx-auto max-w-5xl space-y-6">
        <section className="rounded-xl bg-white p-6 shadow-[0_8px_30px_rgba(31,77,58,0.09)]">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h1 className="text-2xl font-bold text-[var(--cce-green-dark)]">Gestión de horarios</h1>
              <p className="mt-1 text-sm text-[var(--cce-text-muted)]">
                Define horarios de atención, avisos y días restringidos.
              </p>
            </div>
            <Link
              href="/admin/catalogo"
              className="rounded-full border border-[var(--cce-green-dark)] px-4 py-2 text-sm font-semibold text-[var(--cce-green-dark)]"
            >
              Ir a gestión de catálogo
            </Link>
          </div>

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
            <p className="mt-4 text-sm text-[var(--cce-text-muted)]">Cargando horarios...</p>
          ) : (
            <>
              <form onSubmit={handleSaveAvailability} className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-2">
                <label className="text-sm text-[var(--cce-green-dark)]">
                  Recogida L-S apertura
                  <input
                    type="time"
                    value={availabilityForm.pickup_weekday_open}
                    onChange={(event) => handleAvailabilityFieldChange("pickup_weekday_open", event.target.value)}
                    className="mt-1 w-full rounded-lg border border-[color-mix(in_srgb,var(--cce-green-dark)_20%,white)] px-3 py-2 outline-none"
                  />
                </label>
                <label className="text-sm text-[var(--cce-green-dark)]">
                  Recogida L-S cierre
                  <input
                    type="time"
                    value={availabilityForm.pickup_weekday_close}
                    onChange={(event) => handleAvailabilityFieldChange("pickup_weekday_close", event.target.value)}
                    className="mt-1 w-full rounded-lg border border-[color-mix(in_srgb,var(--cce-green-dark)_20%,white)] px-3 py-2 outline-none"
                  />
                </label>
                <label className="text-sm text-[var(--cce-green-dark)]">
                  Recogida domingo apertura
                  <input
                    type="time"
                    value={availabilityForm.pickup_sunday_open}
                    onChange={(event) => handleAvailabilityFieldChange("pickup_sunday_open", event.target.value)}
                    className="mt-1 w-full rounded-lg border border-[color-mix(in_srgb,var(--cce-green-dark)_20%,white)] px-3 py-2 outline-none"
                  />
                </label>
                <label className="text-sm text-[var(--cce-green-dark)]">
                  Recogida domingo cierre
                  <input
                    type="time"
                    value={availabilityForm.pickup_sunday_close}
                    onChange={(event) => handleAvailabilityFieldChange("pickup_sunday_close", event.target.value)}
                    className="mt-1 w-full rounded-lg border border-[color-mix(in_srgb,var(--cce-green-dark)_20%,white)] px-3 py-2 outline-none"
                  />
                </label>
                <label className="text-sm text-[var(--cce-green-dark)]">
                  Domicilio L-S apertura
                  <input
                    type="time"
                    value={availabilityForm.delivery_weekday_open}
                    onChange={(event) => handleAvailabilityFieldChange("delivery_weekday_open", event.target.value)}
                    className="mt-1 w-full rounded-lg border border-[color-mix(in_srgb,var(--cce-green-dark)_20%,white)] px-3 py-2 outline-none"
                  />
                </label>
                <label className="text-sm text-[var(--cce-green-dark)]">
                  Domicilio L-S cierre
                  <input
                    type="time"
                    value={availabilityForm.delivery_weekday_close}
                    onChange={(event) => handleAvailabilityFieldChange("delivery_weekday_close", event.target.value)}
                    className="mt-1 w-full rounded-lg border border-[color-mix(in_srgb,var(--cce-green-dark)_20%,white)] px-3 py-2 outline-none"
                  />
                </label>
                <label className="text-sm text-[var(--cce-green-dark)]">
                  Domicilio domingo apertura
                  <input
                    type="time"
                    value={availabilityForm.delivery_sunday_open}
                    onChange={(event) => handleAvailabilityFieldChange("delivery_sunday_open", event.target.value)}
                    className="mt-1 w-full rounded-lg border border-[color-mix(in_srgb,var(--cce-green-dark)_20%,white)] px-3 py-2 outline-none"
                  />
                </label>
                <label className="text-sm text-[var(--cce-green-dark)]">
                  Domicilio domingo cierre
                  <input
                    type="time"
                    value={availabilityForm.delivery_sunday_close}
                    onChange={(event) => handleAvailabilityFieldChange("delivery_sunday_close", event.target.value)}
                    className="mt-1 w-full rounded-lg border border-[color-mix(in_srgb,var(--cce-green-dark)_20%,white)] px-3 py-2 outline-none"
                  />
                </label>

                <label className="md:col-span-2 text-sm text-[var(--cce-green-dark)]">
                  <span className="mb-1 block">Estado general de pedidos</span>
                  <span className="flex items-center gap-2 rounded-lg border border-[color-mix(in_srgb,var(--cce-green-dark)_20%,white)] px-3 py-2">
                    <input
                      type="checkbox"
                      checked={availabilityForm.is_accepting_orders}
                      onChange={(event) =>
                        handleAvailabilityFieldChange("is_accepting_orders", event.target.checked)
                      }
                    />
                    {availabilityForm.is_accepting_orders
                      ? "Recibir pedidos en todas las modalidades"
                      : "Bloquear todos los pedidos temporalmente"}
                  </span>
                </label>

                <label className="md:col-span-2 text-sm text-[var(--cce-green-dark)]">
                  Aviso para clientes
                  <textarea
                    rows={3}
                    value={availabilityForm.order_notice}
                    onChange={(event) => handleAvailabilityFieldChange("order_notice", event.target.value)}
                    placeholder="Ejemplo: No hay servicio el 1 de mayo por festivo."
                    className="mt-1 w-full rounded-lg border border-[color-mix(in_srgb,var(--cce-green-dark)_20%,white)] px-3 py-2 outline-none"
                  />
                </label>

                <div className="md:col-span-2">
                  <button
                    type="submit"
                    disabled={savingAvailability}
                    className="rounded-full bg-[var(--cce-green-dark)] px-5 py-2 text-sm font-semibold text-white disabled:opacity-60"
                  >
                    {savingAvailability ? "Guardando horarios..." : "Guardar horarios"}
                  </button>
                </div>
              </form>
            </>
          )}
        </section>

        <section className="rounded-xl bg-white p-6 shadow-[0_8px_30px_rgba(31,77,58,0.09)]">
          <h2 className="text-xl font-bold text-[var(--cce-green-dark)]">Días restringidos</h2>
          <p className="mt-1 text-sm text-[var(--cce-text-muted)]">
            Bloquea pedidos por modalidad para fechas específicas.
          </p>

          <form onSubmit={handleSubmitRestrictedDate} className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-4">
            <input
              type="date"
              value={restrictedDateForm.date}
              onChange={(event) => handleRestrictedDateFieldChange("date", event.target.value)}
              className="rounded-lg border border-[color-mix(in_srgb,var(--cce-green-dark)_20%,white)] px-3 py-2 outline-none"
            />
            <select
              value={restrictedDateForm.applies_to}
              onChange={(event) =>
                handleRestrictedDateFieldChange(
                  "applies_to",
                  event.target.value as RestrictedDateFormState["applies_to"],
                )
              }
              className="rounded-lg border border-[color-mix(in_srgb,var(--cce-green-dark)_20%,white)] px-3 py-2 outline-none"
            >
              <option value="all">Todas las modalidades</option>
              <option value="pickup">Recoger en sede</option>
              <option value="delivery">Domicilio</option>
              <option value="scheduled">Programado</option>
            </select>
            <input
              value={restrictedDateForm.reason}
              onChange={(event) => handleRestrictedDateFieldChange("reason", event.target.value)}
              placeholder="Motivo (opcional)"
              className="rounded-lg border border-[color-mix(in_srgb,var(--cce-green-dark)_20%,white)] px-3 py-2 outline-none md:col-span-2"
            />
            <label className="flex items-center gap-2 text-sm text-[var(--cce-green-dark)] md:col-span-2">
              <input
                type="checkbox"
                checked={restrictedDateForm.is_active}
                onChange={(event) => handleRestrictedDateFieldChange("is_active", event.target.checked)}
              />
              Restricción activa
            </label>

            <div className="md:col-span-4 flex flex-wrap gap-2">
              <button
                type="submit"
                disabled={savingRestrictedDate}
                className="rounded-full bg-[var(--cce-green-dark)] px-5 py-2 text-sm font-semibold text-white disabled:opacity-60"
              >
                {savingRestrictedDate
                  ? "Guardando..."
                  : editingRestrictedDateId
                    ? "Actualizar restricción"
                    : "Crear restricción"}
              </button>
              {editingRestrictedDateId && restrictedDateForm.is_active && (
                <button
                  type="button"
                  onClick={() =>
                    void handleToggleRestrictedDate({
                      id: editingRestrictedDateId,
                      date: restrictedDateForm.date,
                      applies_to: restrictedDateForm.applies_to,
                      reason: restrictedDateForm.reason,
                      is_active: true,
                      created_at: "",
                    })
                  }
                  className="rounded-full border border-amber-300 px-5 py-2 text-sm font-semibold text-amber-700"
                >
                  Quitar restricción
                </button>
              )}
              {editingRestrictedDateId && (
                <button
                  type="button"
                  onClick={resetRestrictedDateForm}
                  className="rounded-full border border-[var(--cce-green-dark)] px-5 py-2 text-sm font-semibold text-[var(--cce-green-dark)]"
                >
                  Cancelar edición
                </button>
              )}
            </div>
          </form>

          {restrictedDates.length > 0 && (
            <div className="mt-5 overflow-x-auto">
              <table className="min-w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-[color-mix(in_srgb,var(--cce-green-dark)_15%,white)] text-[var(--cce-green-dark)]">
                    <th className="px-3 py-2">Fecha</th>
                    <th className="px-3 py-2">Modalidad</th>
                    <th className="px-3 py-2">Motivo</th>
                    <th className="px-3 py-2">Estado</th>
                    <th className="px-3 py-2">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {restrictedDates.map((item) => (
                    <tr key={item.id} className="border-b border-[color-mix(in_srgb,var(--cce-green-dark)_10%,white)]">
                      <td className="px-3 py-2">{item.date}</td>
                      <td className="px-3 py-2">
                        {item.applies_to === "all"
                          ? "Todas"
                          : item.applies_to === "pickup"
                            ? "Recoger en sede"
                            : item.applies_to === "delivery"
                              ? "Domicilio"
                              : "Programado"}
                      </td>
                      <td className="px-3 py-2">{item.reason || "-"}</td>
                      <td className="px-3 py-2">{item.is_active ? "Activa" : "Inactiva"}</td>
                      <td className="px-3 py-2">
                        <div className="flex gap-2">
                          <button
                            type="button"
                            onClick={() => handleEditRestrictedDate(item)}
                            className="rounded-full border border-[var(--cce-green-dark)] px-3 py-1 text-xs font-semibold text-[var(--cce-green-dark)]"
                          >
                            Editar
                          </button>
                          <button
                            type="button"
                            onClick={() => void handleToggleRestrictedDate(item)}
                            className="rounded-full border border-amber-300 px-3 py-1 text-xs font-semibold text-amber-700"
                          >
                            {item.is_active ? "Quitar restricción" : "Activar restricción"}
                          </button>
                          <button
                            type="button"
                            onClick={() => void handleDeleteRestrictedDate(item.id)}
                            className="rounded-full border border-red-300 px-3 py-1 text-xs font-semibold text-red-700"
                          >
                            Eliminar
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
