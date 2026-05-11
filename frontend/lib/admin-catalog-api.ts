import type { PaginatedResponse, Product } from "@/types/catalog";

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8080/api";

export interface ProductAdminPayload {
  name: string;
  slug: string;
  description: string;
  price: string;
  is_featured: boolean;
  is_active: boolean;
  category_id: number;
}

export interface OrderAvailabilityConfigPayload {
  pickup_weekday_open: string;
  pickup_weekday_close: string;
  pickup_sunday_open: string;
  pickup_sunday_close: string;
  delivery_weekday_open: string;
  delivery_weekday_close: string;
  delivery_sunday_open: string;
  delivery_sunday_close: string;
  is_accepting_orders: boolean;
  order_notice: string;
}

export interface OrderAvailabilityConfig extends OrderAvailabilityConfigPayload {
  updated_at: string;
}

export interface RestrictedDate {
  id: number;
  date: string;
  applies_to: "all" | "pickup" | "delivery" | "scheduled";
  reason: string;
  is_active: boolean;
  created_at: string;
}

export interface RestrictedDatePayload {
  date: string;
  applies_to: "all" | "pickup" | "delivery" | "scheduled";
  reason: string;
  is_active: boolean;
}

class AdminApiError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
    this.name = "AdminApiError";
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
      body.non_field_errors?.[0] ||
      body.slug?.[0] ||
      body.name?.[0] ||
      body.date?.[0] ||
      body.price?.[0] ||
      "Error al gestionar catálogo u horarios";

    throw new AdminApiError(message, response.status);
  }

  if (response.status === 204) {
    return {} as T;
  }

  return (await response.json()) as T;
};

export const getAdminProducts = () =>
  request<PaginatedResponse<Product>>("/admin/products/").catch((error) => {
    console.warn("No se pudo cargar productos admin", error);
    return {
      count: 0,
      next: null,
      previous: null,
      results: [],
    };
  });

export const createAdminProduct = (payload: ProductAdminPayload) =>
  request<Product>("/admin/products/", {
    method: "POST",
    body: JSON.stringify(payload),
  });

export const updateAdminProduct = (
  productId: number,
  payload: ProductAdminPayload,
) =>
  request<Product>(`/admin/products/${productId}/`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });

export const deleteAdminProduct = (productId: number) =>
  request<void>(`/admin/products/${productId}/`, {
    method: "DELETE",
  });

export const getAdminOrderAvailability = () =>
  request<OrderAvailabilityConfig>("/admin/order-availability/").catch((error) => {
    console.warn("No se pudo cargar configuración de horarios", error);
    return {
      pickup_weekday_open: "09:00:00",
      pickup_weekday_close: "20:00:00",
      pickup_sunday_open: "08:00:00",
      pickup_sunday_close: "20:00:00",
      delivery_weekday_open: "09:00:00",
      delivery_weekday_close: "19:30:00",
      delivery_sunday_open: "08:00:00",
      delivery_sunday_close: "19:30:00",
      is_accepting_orders: true,
      order_notice: "",
      updated_at: new Date().toISOString(),
    };
  });

export const updateAdminOrderAvailability = (payload: OrderAvailabilityConfigPayload) =>
  request<OrderAvailabilityConfig>("/admin/order-availability/", {
    method: "PATCH",
    body: JSON.stringify(payload),
  });

export const getAdminRestrictedDates = () =>
  request<RestrictedDate[]>("/admin/restricted-dates/").catch((error) => {
    console.warn("No se pudo cargar días restringidos", error);
    return [];
  });

export const createAdminRestrictedDate = (payload: RestrictedDatePayload) =>
  request<RestrictedDate>("/admin/restricted-dates/", {
    method: "POST",
    body: JSON.stringify(payload),
  });

export const updateAdminRestrictedDate = (id: number, payload: RestrictedDatePayload) =>
  request<RestrictedDate>(`/admin/restricted-dates/${id}/`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });

export const deleteAdminRestrictedDate = (id: number) =>
  request<void>(`/admin/restricted-dates/${id}/`, {
    method: "DELETE",
  });

export { AdminApiError };
