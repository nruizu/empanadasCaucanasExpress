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
  image?: File | null;
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
  authToken?: string,
): Promise<T> => {
  const token = authToken ?? getToken();

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
  request<Product[]>("/admin/products/").catch((error) => {
    console.warn("No se pudo cargar productos admin", error);
    return [];
  });

function buildProductFormData(payload: ProductAdminPayload): FormData {
  const fd = new FormData();
  fd.append("name", payload.name);
  fd.append("slug", payload.slug);
  fd.append("description", payload.description);
  fd.append("price", payload.price);
  fd.append("is_featured", payload.is_featured ? "true" : "false");
  fd.append("is_active", payload.is_active ? "true" : "false");
  fd.append("category_id", String(payload.category_id));
  if (payload.image instanceof File) {
    fd.append("image", payload.image);
  }
  return fd;
}

async function formDataRequest<T>(
  path: string,
  method: string,
  payload: ProductAdminPayload,
  authToken?: string,
): Promise<T> {
  const token = authToken ?? getToken();
  const fd = buildProductFormData(payload);

  const response = await fetch(`${API_BASE_URL}${path}`, {
    method,
    headers: {
      ...(token ? { Authorization: `Token ${token}` } : {}),
    },
    body: fd,
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
      body.price?.[0] ||
      "Error al gestionar catálogo";
    throw new AdminApiError(message, response.status);
  }

  return (await response.json()) as T;
}

export const createAdminProduct = (payload: ProductAdminPayload): Promise<Product> => {
  if (payload.image instanceof File) {
    return formDataRequest<Product>("/admin/products/", "POST", payload);
  }
  const { image: _image, ...jsonPayload } = payload;
  return request<Product>("/admin/products/", {
    method: "POST",
    body: JSON.stringify(jsonPayload),
  });
};

export const updateAdminProduct = (
  productId: number,
  payload: ProductAdminPayload,
) => {
  if (payload.image instanceof File) {
    return formDataRequest<Product>(`/admin/products/${productId}/`, "PATCH", payload);
  }
  const body: Record<string, unknown> = {
    name: payload.name,
    slug: payload.slug,
    description: payload.description,
    price: payload.price,
    is_featured: payload.is_featured,
    is_active: payload.is_active,
    category_id: payload.category_id,
  };
  if (payload.image === null) {
    body.image = null;
  }
  return request<Product>(`/admin/products/${productId}/`, {
    method: "PATCH",
    body: JSON.stringify(body),
  });
};

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
