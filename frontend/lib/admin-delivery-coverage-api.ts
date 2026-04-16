const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8080/api";

class AdminDeliveryCoverageApiError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
    this.name = "AdminDeliveryCoverageApiError";
  }
}

const getToken = () => {
  if (typeof window === "undefined") {
    return null;
  }
  return localStorage.getItem("cce_token");
};

const request = async <T>(
  path: string,
  options: RequestInit = {},
): Promise<T> => {
  const token = getToken();

  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Token ${token}` } : {}),
      ...(options.headers ?? {}),
    },
    cache: "no-store",
  });

  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    const message =
      body.detail ||
      body.error ||
      body.local_address?.[0] ||
      body.local_city?.[0] ||
      body.max_delivery_km?.[0] ||
      body.local_latitude?.[0] ||
      body.local_longitude?.[0] ||
      "No se pudo guardar la cobertura";

    throw new AdminDeliveryCoverageApiError(message, response.status);
  }

  return (await response.json()) as T;
};

export interface DeliveryCoverageSettingsDto {
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
  updated_at: string | null;
}

export const getDeliveryCoverageSettings = () =>
  request<DeliveryCoverageSettingsDto>("/admin/delivery-coverage/");

export const saveDeliveryCoverageSettings = (
  payload: DeliveryCoverageSettingsDto,
) =>
  request<DeliveryCoverageSettingsDto>("/admin/delivery-coverage/", {
    method: "PUT",
    body: JSON.stringify(payload),
  });

export { AdminDeliveryCoverageApiError };
