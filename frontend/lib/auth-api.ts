const API_BASE_URL =
  (globalThis as { process?: { env?: { NEXT_PUBLIC_API_URL?: string } } })
    .process?.env?.NEXT_PUBLIC_API_URL ?? "http://localhost:8080/api";

export interface MeResponse {
  user_id: number;
  username: string;
  email: string;
  is_staff: boolean;
  role: "customer" | "courier";
  full_name: string;
  phone: string;
  address: string;
  delivery_local_address?: string;
  delivery_city?: string;
  delivery_region?: string;
}

export interface AuthResponse {
  token: string;
  user_id: number;
  username: string;
  is_staff: boolean;
  role: "customer" | "courier";
}

export interface OrderHistoryItem {
  id: number;
  customer_name: string;
  customer_phone: string;
  customer_email: string | null;
  delivery_method: "pickup" | "delivery" | "scheduled";
  status:
    | "pending"
    | "confirmed"
    | "preparing"
    | "ready"
    | "completed"
    | "cancelled";
  pickup_date: string | null;
  pickup_time: string | null;
  scheduled_date: string | null;
  delivery_address: string | null;
  delivery_latitude?: string | null;
  delivery_longitude?: string | null;
  delivery_distance_km?: string | null;
  address_validation_status?:
    | "not_validated"
    | "valid"
    | "invalid"
    | "out_of_coverage"
    | "service_error";
  address_validation_message?: string;
  delivery_maps_url?: string;
  assigned_courier?: number | null;
  assigned_courier_display_name?: string | null;
  assigned_at?: string | null;
  notes: string | null;
  total_amount: string;
  created_at: string;
  updated_at: string;
  items: OrderHistoryLineItem[];
}

export interface OrderHistoryLineItem {
  id: number;
  quantity: number;
  unit_price: string;
  subtotal: string;
  product: {
    id: number;
    name: string;
    slug: string;
    description: string;
    price: string;
    image: string;
    is_featured: boolean;
    category: {
      id: number;
      name: string;
      slug: string;
      image: string;
    };
  };
}

export interface PaginatedResponse<T> {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
}

async function request(path: string, options: RequestInit = {}) {
  const { headers, ...restOptions } = options;

  const res = await fetch(`${API_BASE_URL}${path}`, {
    ...restOptions,
    headers: {
      "Content-Type": "application/json",
      ...(headers || {}),
    },
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    // Si tiene campos de validación (password, username, etc), lanza el objeto completo
    const hasFieldErrors = Object.keys(body).some(
      (k) => k !== "detail" && k !== "error",
    );
    if (hasFieldErrors) throw body;
    throw new Error(body.detail || body.error || res.statusText);
  }

  return res.json().catch(() => ({}));
}

export async function register({
  username,
  password,
  email,
  full_name,
  phone,
  address,
  delivery_local_address,
  delivery_city,
  delivery_region,
}: {
  username: string;
  password: string;
  email?: string;
  full_name: string;
  phone: string;
  address: string;
  delivery_local_address?: string;
  delivery_city?: string;
  delivery_region?: string;
}): Promise<AuthResponse> {
  const res = await fetch(`${API_BASE_URL}/auth/registro/`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      username,
      password,
      email: email ?? "",
      full_name,
      phone,
      address,
      delivery_local_address: delivery_local_address ?? "",
      delivery_city: delivery_city ?? "",
      delivery_region: delivery_region ?? "",
    }),
  });

  const data = await res.json();

  if (!res.ok) {
    throw data;
  }

  return data as AuthResponse;
}

export const login = (payload: { username: string; password: string }) =>
  request("/auth/login/", { method: "POST", body: JSON.stringify(payload) }) as Promise<AuthResponse>;

export async function logout(token: string) {
  return fetch(`${API_BASE_URL}/auth/logout/`, {
    method: "POST",
    headers: {
      Authorization: `Token ${token}`,
    },
  });
}

export async function me(token: string) {
  return request("/auth/me/", {
    method: "GET",
    headers: {
      Authorization: `Token ${token}`,
    },
  }) as Promise<MeResponse>;
}

export async function updateMe(
  token: string,
  payload: {
    email?: string;
    full_name?: string;
    phone?: string;
    address?: string;
    delivery_local_address?: string;
    delivery_city?: string;
    delivery_region?: string;
  },
) {
  return request("/auth/me/", {
    method: "PATCH",
    headers: {
      Authorization: `Token ${token}`,
    },
    body: JSON.stringify(payload),
  });
}

export async function myOrderHistory(token: string) {
  return request("/report/orders/me/", {
    method: "GET",
    headers: {
      Authorization: `Token ${token}`,
    },
  }) as Promise<PaginatedResponse<OrderHistoryItem>>;
}

export async function cancelMyOrder(token: string, orderId: number) {
  return request(`/report/orders/me/${orderId}/cancel/`, {
    method: "POST",
    headers: {
      Authorization: `Token ${token}`,
    },
  }) as Promise<OrderHistoryItem>;
}

const authApi = {
  register,
  login,
  logout,
  me,
  updateMe,
  myOrderHistory,
  cancelMyOrder,
};

export default authApi;
