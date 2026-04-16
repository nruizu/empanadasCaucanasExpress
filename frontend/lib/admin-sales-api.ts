import type {
  SalesAnalysisFilters,
  SalesAnalysisResponse,
  ManualSalePayload,
  SalesHistoryFilters,
  SalesHistoryResponse,
  SalesMetrics,
  SalesOrder,
} from "@/types/sales";

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8080/api";

class AdminSalesApiError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
    this.name = "AdminSalesApiError";
  }
}

const getToken = () => {
  if (typeof window === "undefined") {
    return null;
  }
  return localStorage.getItem("cce_token");
};

const buildQuery = (filters?: SalesHistoryFilters) => {
  const params = new URLSearchParams();
  if (!filters) {
    return "";
  }

  Object.entries(filters).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "") {
      params.set(key, String(value));
    }
  });

  const qs = params.toString();
  return qs ? `?${qs}` : "";
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
      body.non_field_errors?.[0] ||
      body.items?.[0] ||
      "Error al gestionar ventas";

    throw new AdminSalesApiError(message, response.status);
  }

  if (response.status === 204) {
    return {} as T;
  }

  return (await response.json()) as T;
};

export const getSalesHistory = (filters?: SalesHistoryFilters) =>
  request<SalesHistoryResponse>(`/admin/sales/history/${buildQuery(filters)}`);

export const getSalesMetrics = (filters?: SalesHistoryFilters) =>
  request<SalesMetrics>(`/admin/sales/metrics/${buildQuery(filters)}`);

export const getSalesAnalysis = (filters?: SalesAnalysisFilters) =>
  request<SalesAnalysisResponse>(`/report/admin/sales/analysis/${buildQuery(filters)}`);

export const registerManualSale = (payload: ManualSalePayload) =>
  request<SalesOrder>("/admin/sales/register/", {
    method: "POST",
    body: JSON.stringify(payload),
  });

export const deleteManualSale = (saleId: number) =>
  request<void>(`/admin/sales/${saleId}/`, {
    method: "DELETE",
  });

export { AdminSalesApiError };
