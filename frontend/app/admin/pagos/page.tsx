"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import useAuth from "@/context/AuthContext";
import {
  getAdminManualPaymentSettings,
  updateAdminManualPaymentSettings,
  type ManualPaymentSettingsPayload,
} from "@/lib/admin-payment-settings-api";

const INITIAL_FORM: ManualPaymentSettingsPayload = {
  is_active: true,
  bank_name: "",
  account_number: "",
  account_type: "",
  account_holder: "",
  transfer_key: "",
  instructions: "",
  qr_image: null,
};

export default function AdminPagosPage() {
  const router = useRouter();
  const { token, user, authReady } = useAuth();

  const [form, setForm] = useState<ManualPaymentSettingsPayload>(INITIAL_FORM);
  const [currentQrUrl, setCurrentQrUrl] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const canAccess = useMemo(() => Boolean(token && user?.is_staff), [token, user]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getAdminManualPaymentSettings();
      setForm({
        is_active: data.is_active,
        bank_name: data.bank_name ?? "",
        account_number: data.account_number ?? "",
        account_type: data.account_type ?? "",
        account_holder: data.account_holder ?? "",
        transfer_key: data.transfer_key ?? "",
        instructions: data.instructions ?? "",
        qr_image: null,
      });
      setCurrentQrUrl(data.qr_image ?? null);
    } catch (err) {
      console.error(err);
      setError("No se pudo cargar la configuración de pagos.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!authReady) return;
    if (!token) {
      router.replace("/login");
      return;
    }
    if (user && !user.is_staff) {
      router.replace("/catalogo");
      return;
    }
    void load();
  }, [authReady, token, user, router, load]);

  const handleQrChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] ?? null;
    setForm((prev) => ({ ...prev, qr_image: file, remove_qr_image: false }));
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(file ? URL.createObjectURL(file) : null);
  };

  const handleRemoveQr = () => {
    setForm((prev) => ({ ...prev, qr_image: null, remove_qr_image: true }));
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(null);
    setCurrentQrUrl(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      const saved = await updateAdminManualPaymentSettings(form);
      setCurrentQrUrl(saved.qr_image ?? null);
      setForm((prev) => ({ ...prev, qr_image: null, remove_qr_image: false }));
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
        setPreviewUrl(null);
      }
      setSuccess("Configuración guardada correctamente.");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Error al guardar";
      setError(msg);
    } finally {
      setSaving(false);
    }
  };

  if (!authReady || !canAccess) {
    return (
      <main className="min-h-screen bg-[var(--cce-beige)] px-4 py-8">
        <div className="mx-auto max-w-3xl rounded-xl bg-white p-6 text-center text-[var(--cce-text-muted)]">
          Verificando permisos...
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[linear-gradient(180deg,#f4eadb_0%,#faf7f0_100%)] px-4 py-8 md:px-8">
      <div className="mx-auto max-w-3xl space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <Link href="/admin" className="text-sm text-[var(--cce-green-dark)] hover:underline">
              ← Volver al panel
            </Link>
            <h1 className="mt-2 text-2xl font-bold text-[var(--cce-green-dark)] md:text-3xl">
              Pagos en línea
            </h1>
            <p className="text-sm text-[var(--cce-text-muted)]">
              Configura los datos de transferencia y el código QR para los clientes.
            </p>
          </div>
        </div>

        {loading ? (
          <div className="rounded-xl bg-white p-6 text-center text-[var(--cce-text-muted)] shadow">
            Cargando...
          </div>
        ) : (
          <form
            onSubmit={handleSubmit}
            className="space-y-5 rounded-2xl border border-[color-mix(in_srgb,var(--cce-green-dark)_10%,white)] bg-white p-6 shadow-[0_10px_30px_rgba(31,77,58,0.08)]"
          >
            <label className="flex items-center gap-2 text-sm font-medium text-[var(--cce-green-dark)]">
              <input
                type="checkbox"
                checked={form.is_active}
                onChange={(e) => setForm({ ...form, is_active: e.target.checked })}
              />
              Pago online activo
            </label>

            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label className="mb-1 block text-sm font-medium">Banco</label>
                <input
                  type="text"
                  value={form.bank_name}
                  onChange={(e) => setForm({ ...form, bank_name: e.target.value })}
                  className="w-full rounded-lg border px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium">Número de cuenta</label>
                <input
                  type="text"
                  value={form.account_number}
                  onChange={(e) => setForm({ ...form, account_number: e.target.value })}
                  className="w-full rounded-lg border px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium">Tipo de cuenta</label>
                <input
                  type="text"
                  value={form.account_type}
                  onChange={(e) => setForm({ ...form, account_type: e.target.value })}
                  className="w-full rounded-lg border px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium">Titular</label>
                <input
                  type="text"
                  value={form.account_holder}
                  onChange={(e) => setForm({ ...form, account_holder: e.target.value })}
                  className="w-full rounded-lg border px-3 py-2 text-sm"
                />
              </div>
              <div className="md:col-span-2">
                <label className="mb-1 block text-sm font-medium">Llave de transferencia (Nequi/Daviplata/etc.)</label>
                <input
                  type="text"
                  value={form.transfer_key}
                  onChange={(e) => setForm({ ...form, transfer_key: e.target.value })}
                  className="w-full rounded-lg border px-3 py-2 text-sm"
                />
              </div>
              <div className="md:col-span-2">
                <label className="mb-1 block text-sm font-medium">Instrucciones para el cliente</label>
                <textarea
                  value={form.instructions}
                  onChange={(e) => setForm({ ...form, instructions: e.target.value })}
                  rows={3}
                  className="w-full rounded-lg border px-3 py-2 text-sm"
                />
              </div>
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-[var(--cce-green-dark)]">
                Código QR de pago
              </label>
              <div className="flex flex-wrap items-start gap-4">
                <div className="flex h-32 w-32 items-center justify-center rounded-lg border border-dashed bg-[var(--cce-beige)]">
                  {previewUrl || currentQrUrl ? (
                    <img
                      src={previewUrl || currentQrUrl || ""}
                      alt="QR pago"
                      className="h-28 w-28 object-contain"
                    />
                  ) : (
                    <span className="text-xs text-[var(--cce-text-muted)]">Sin QR</span>
                  )}
                </div>
                <div className="flex-1 space-y-2">
                  <label
                    htmlFor="qr-upload"
                    className="inline-flex cursor-pointer items-center gap-2 rounded-lg bg-[var(--cce-green-dark)] px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:opacity-90"
                  >
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      width="16"
                      height="16"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                      <polyline points="17 8 12 3 7 8" />
                      <line x1="12" y1="3" x2="12" y2="15" />
                    </svg>
                    Da click aquí para subir el QR
                  </label>
                  <input
                    id="qr-upload"
                    type="file"
                    accept="image/png,image/jpeg,image/webp"
                    onChange={handleQrChange}
                    className="hidden"
                  />
                  {form.qr_image instanceof File && (
                    <p className="text-xs font-medium text-[var(--cce-green-dark)]">
                      Archivo seleccionado: {form.qr_image.name}
                    </p>
                  )}
                  <p className="text-xs text-[var(--cce-text-muted)]">
                    Formatos aceptados: PNG, JPG o WebP.
                  </p>
                  {(previewUrl || currentQrUrl) && (
                    <button
                      type="button"
                      onClick={handleRemoveQr}
                      className="text-xs font-semibold text-red-700 hover:underline"
                    >
                      Quitar QR
                    </button>
                  )}
                </div>
              </div>
            </div>

            {error && (
              <div className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>
            )}
            {success && (
              <div className="rounded-lg bg-green-50 px-3 py-2 text-sm text-green-700">{success}</div>
            )}

            <div className="flex justify-end">
              <button
                type="submit"
                disabled={saving}
                className="rounded-lg bg-[var(--cce-green-dark)] px-5 py-2 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50"
              >
                {saving ? "Guardando..." : "Guardar cambios"}
              </button>
            </div>
          </form>
        )}
      </div>
    </main>
  );
}
