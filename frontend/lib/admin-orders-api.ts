import type { PaginatedResponse } from "@/types/catalog";
import type { OrderHistoryItem } from "@/lib/auth-api";

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8080/api";

class AdminOrdersApiError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
    this.name = "AdminOrdersApiError";
  }
}

const getToken = () => {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("cce_token");
};

export interface AdminOrdersQuery {
  page?: number;
  delivery_method?: "pickup" | "delivery" | "scheduled";
  status?:
    | "pending"
    | "confirmed"
    | "preparing"
    | "ready"
    | "completed"
    | "cancelled";
  ordering?: "-created_at" | "created_at";
  today?: boolean;
  search?: string;
}

export interface AdminCourierOption {
  id: number;
  username: string;
  full_name: string;
  role: "courier";
}

export interface UpdateAdminOrderPayload {
  status?:
    | "pending"
    | "confirmed"
    | "preparing"
    | "ready"
    | "in_transit"
    | "completed"
    | "cancelled";
  assigned_courier?: number | null;
}

export async function getAdminOrders(query: AdminOrdersQuery = {}) {
  const token = getToken();
  const params = new URLSearchParams();

  if (query.page) params.set("page", String(query.page));
  if (query.delivery_method)
    params.set("delivery_method", query.delivery_method);
  if (query.status) params.set("status", query.status);
  if (query.ordering) params.set("ordering", query.ordering);
  if (query.today) params.set("today", "true");
  if (query.search?.trim()) params.set("search", query.search.trim());

  const url = `${API_BASE_URL}/orders/${params.toString() ? `?${params.toString()}` : ""}`;

  const response = await fetch(url, {
    method: "GET",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Token ${token}` } : {}),
    },
    cache: "no-store",
  });

  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    const message = body.detail || body.error || "Error al consultar pedidos";
    throw new AdminOrdersApiError(message, response.status);
  }

  return (await response.json()) as PaginatedResponse<OrderHistoryItem>;
}

export async function updateAdminOrderStatus(
  orderId: number,
  status:
    | "pending"
    | "confirmed"
    | "preparing"
    | "ready"
    | "completed"
    | "cancelled",
) {
  return updateAdminOrder(orderId, { status });
}

export async function updateAdminOrder(
  orderId: number,
  payload: UpdateAdminOrderPayload,
) {
  const token = getToken();

  const response = await fetch(`${API_BASE_URL}/orders/${orderId}/`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Token ${token}` } : {}),
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    const message =
      body.detail ||
      body.error ||
      body.status?.[0] ||
      body.assigned_courier?.[0] ||
      "No se pudo actualizar el estado";
    throw new AdminOrdersApiError(message, response.status);
  }

  return (await response.json()) as OrderHistoryItem;
}

export async function getAdminCouriers() {
  const token = getToken();

  const response = await fetch(`${API_BASE_URL}/auth/admin/couriers/`, {
    method: "GET",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Token ${token}` } : {}),
    },
    cache: "no-store",
  });

  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    const message = body.detail || body.error || "Error al consultar repartidores";
    throw new AdminOrdersApiError(message, response.status);
  }

  return (await response.json()) as AdminCourierOption[];
}

export async function deleteAdminOrder(orderId: number) {
  const token = getToken();

  const response = await fetch(`${API_BASE_URL}/orders/${orderId}/`, {
    method: "DELETE",
    headers: {
      ...(token ? { Authorization: `Token ${token}` } : {}),
    },
  });

  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    const message = body.detail || body.error || "No se pudo borrar el pedido";
    throw new AdminOrdersApiError(message, response.status);
  }
}

export async function approveAdminOrderPayment(orderId: number) {
  return updateAdminOrderPayment(orderId, "approve");
}

export async function rejectAdminOrderPayment(orderId: number) {
  return updateAdminOrderPayment(orderId, "reject");
}

async function updateAdminOrderPayment(orderId: number, action: "approve" | "reject") {
  const token = getToken();

  const response = await fetch(
    `${API_BASE_URL}/orders/${orderId}/payment/${action}/`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Token ${token}` } : {}),
      },
    },
  );

  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    const message = body.detail || body.error || "No se pudo actualizar el pago";
    throw new AdminOrdersApiError(message, response.status);
  }

  return (await response.json()) as OrderHistoryItem;
}
