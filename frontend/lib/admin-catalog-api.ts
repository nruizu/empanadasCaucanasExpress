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
      body.slug?.[0] ||
      body.name?.[0] ||
      body.price?.[0] ||
      "Error al gestionar productos";

    throw new AdminApiError(message, response.status);
  }

  if (response.status === 204) {
    return {} as T;
  }

  return (await response.json()) as T;
};

export const getAdminProducts = () =>
  request<PaginatedResponse<Product>>("/admin/products/");

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

export { AdminApiError };
