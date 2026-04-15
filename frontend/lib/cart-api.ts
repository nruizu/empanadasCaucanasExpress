const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8080";

async function request(path: string, options: RequestInit = {}) {
  const token =
    typeof window !== "undefined" ? localStorage.getItem("cce_token") : null;

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

export function getMyCart() {
  return request("/api/cart/my_cart/");
}

export function createCart() {
  return request("/api/cart/create_cart/", { method: "POST" });
}

export function addProduct(productId: number, quantity: number) {
  return request("/api/cart/add_product/", {
    method: "POST",
    body: JSON.stringify({ product_id: productId, quantity }),
  });
}

export function getCart(cartId: number | string) {
  return request(`/api/cart/${cartId}/`);
}

// 🔹 Eliminar un producto del carrito
export function removeProduct(
  cartId: number | string,
  cartProductId: number | string,
) {
  return request(`/api/cart/${cartId}/remove_product/`, {
    method: "DELETE",
    body: JSON.stringify({ cart_product_id: cartProductId }),
  });
}

// 🔹 Vaciar carrito completo
export function clearCart(cartId: number | string) {
  return request(`/api/cart/${cartId}/clear_cart/`, {
    method: "DELETE",
  });
}

// 🔹 Actualizar cantidad de un producto
export function updateQuantity(
  cartProductId: number | string,
  quantity: number,
) {
  return request("/api/cart/update_quantity/", {
    method: "PATCH",
    body: JSON.stringify({ cart_product_id: cartProductId, quantity }),
  });
}
