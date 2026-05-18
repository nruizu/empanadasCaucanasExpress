export interface ManualPaymentSettings {
  singleton_id: number;
  is_active: boolean;
  bank_name: string;
  account_number: string;
  account_type: string;
  account_holder: string;
  transfer_key: string;
  qr_image?: string | null;
  instructions?: string | null;
  updated_at?: string | null;
  receipt_max_bytes?: number;
}

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8080/api";

export async function getManualPaymentSettings() {
  const response = await fetch(`${API_BASE_URL}/payment-settings/`, {
    method: "GET",
    headers: {
      "Content-Type": "application/json",
    },
    cache: "no-store",
  });

  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    const message = body.detail || body.error || "No se pudo cargar la informacion de pago";
    throw new Error(message);
  }

  return (await response.json()) as ManualPaymentSettings;
}
