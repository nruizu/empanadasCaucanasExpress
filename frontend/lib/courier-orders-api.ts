import type { PaginatedResponse } from "@/types/catalog";
import type { OrderHistoryItem } from "@/lib/auth-api";

const API_BASE_URL =
  (globalThis as { process?: { env?: { NEXT_PUBLIC_API_URL?: string } } })
    .process?.env?.NEXT_PUBLIC_API_URL ?? "http://localhost:8080/api";

const getToken = () => {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("cce_token");
};

export async function getCourierAssignedOrders() {
  const token = getToken();

  const response = await fetch(`${API_BASE_URL}/orders/assigned/`, {
    method: "GET",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Token ${token}` } : {}),
    },
    cache: "no-store",
  });

  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    const message =
      body.detail || body.error || "Error al consultar pedidos asignados";
    throw new Error(message);
  }

  return (await response.json()) as PaginatedResponse<OrderHistoryItem>;
}
