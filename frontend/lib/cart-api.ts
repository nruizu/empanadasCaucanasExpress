const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8080";

async function request(path: string, options: RequestInit = {}) {
  const token =
    typeof window !== "undefined"
      ? localStorage.getItem("cce_token")
      : null;

  const res = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Token ${token}` } : {}),
      ...options.headers,
    },
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.detail || body.error || res.statusText);
  }

  return res.json().catch(() => ({}));
}

// 🔹 Obtener carrito del usuario autenticado
export function getMyCart() {
  return request("/api/cart/my_cart/");
}

// 🔹 Crear carrito
export function createCart() {
  return request("/api/cart/create_cart/", {
    method: "POST",
  });
}

// 🔹 Agregar producto
export function addProduct(productId: number, quantity: number) {
  return request("/api/cart/add_product/", {
    method: "POST",
    body: JSON.stringify({
      product_id: productId,
      quantity,
    }),
  });
}

// 🔹 Obtener carrito por ID
export function getCart(cartId: number | string) {
  return request(`/api/cart/${cartId}/`);
}