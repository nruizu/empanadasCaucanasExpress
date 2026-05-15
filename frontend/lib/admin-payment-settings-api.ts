import type { ManualPaymentSettings } from "@/lib/payment-settings-api";

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8080/api";

export interface ManualPaymentSettingsPayload {
  is_active: boolean;
  bank_name: string;
  account_number: string;
  account_type: string;
  account_holder: string;
  transfer_key: string;
  instructions: string;
  qr_image?: File | null;
  remove_qr_image?: boolean;
}

const getToken = () => {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("cce_token");
};

class AdminPaymentApiError extends Error {
  constructor(message: string, public status: number) {
    super(message);
    this.name = "AdminPaymentApiError";
  }
}

const parseError = async (response: Response) => {
  const body = await response.json().catch(() => ({}));
  return (
    body.detail ||
    body.error ||
    body.non_field_errors?.[0] ||
    body.qr_image?.[0] ||
    "Error al gestionar configuración de pagos"
  );
};

export const getAdminManualPaymentSettings = async (): Promise<ManualPaymentSettings> => {
  const token = getToken();
  const response = await fetch(`${API_BASE_URL}/admin/payment-settings/`, {
    method: "GET",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Token ${token}` } : {}),
    },
    cache: "no-store",
  });
  if (!response.ok) {
    throw new AdminPaymentApiError(await parseError(response), response.status);
  }
  return (await response.json()) as ManualPaymentSettings;
};

export const updateAdminManualPaymentSettings = async (
  payload: ManualPaymentSettingsPayload,
): Promise<ManualPaymentSettings> => {
  const token = getToken();
  const fd = new FormData();
  fd.append("is_active", payload.is_active ? "true" : "false");
  fd.append("bank_name", payload.bank_name);
  fd.append("account_number", payload.account_number);
  fd.append("account_type", payload.account_type);
  fd.append("account_holder", payload.account_holder);
  fd.append("transfer_key", payload.transfer_key);
  fd.append("instructions", payload.instructions);
  if (payload.qr_image instanceof File) {
    fd.append("qr_image", payload.qr_image);
  } else if (payload.remove_qr_image) {
    fd.append("qr_image", "");
  }

  const response = await fetch(`${API_BASE_URL}/admin/payment-settings/`, {
    method: "PATCH",
    headers: {
      ...(token ? { Authorization: `Token ${token}` } : {}),
    },
    body: fd,
    cache: "no-store",
  });

  if (!response.ok) {
    throw new AdminPaymentApiError(await parseError(response), response.status);
  }
  return (await response.json()) as ManualPaymentSettings;
};

export { AdminPaymentApiError };
