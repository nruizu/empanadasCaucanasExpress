const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8080/api";

async function request(path: string, options: RequestInit = {}) {
  const token =
    typeof window !== "undefined" ? localStorage.getItem("cce_token") : null;

  const headers: HeadersInit = {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Token ${token}` } : {}),
    ...(options.headers || {}),
  };

  const res = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers,
  });

  // 🔥 Manejo especial de 401
  if (res.status === 401) {
    console.warn("⚠️ Token inválido o expirado");

    // Limpiar sesión automáticamente
    if (typeof window !== "undefined") {
      localStorage.removeItem("cce_token");
      window.dispatchEvent(new Event("auth:changed"));
    }

    throw new Error("Sesión expirada. Inicia sesión nuevamente.");
  }

  if (!res.ok) {
    let body: any = {};
    try {
      body = await res.json();
    } catch {
      // no hizo parse → body vacío
    }

    console.error("❌ API Error:", body);

    throw new Error(
      body?.detail ||
        body?.error ||
        body?.message ||
        JSON.stringify(body) ||
        res.statusText ||
        "Error en la petición"
    );
  }

  // 🔥 evitar error si la respuesta viene vacía
  try {
    return await res.json();
  } catch {
    return {};
  }
}

// 🔹 Obtener carrito del usuario
export async function getMyCart() {
  return request("/cart/my_cart/");
}

// 🔹 Crear carrito
export function createCart() {
  return request("/cart/create_cart/", {
    method: "POST",
  });
}

// 🔹 Agregar producto
export function addProduct(productId: number, quantity: number) {
  return request("/cart/add_product/", {
    method: "POST",
    body: JSON.stringify({
      product_id: productId,
      quantity,
    }),
  });
}

// 🔹 Obtener carrito por ID
export function getCart(cartId: number | string) {
  return request(`/cart/${cartId}/`);
}

// 🔹 Eliminar producto del carrito
export function removeProduct(
  cartId: number | string,
  cartProductId: number | string
) {
  return request(`/cart/${cartId}/remove_product/", {
    method: "DELETE",
    body: JSON.stringify({
      cart_product_id: cartProductId,
    }),
  });
}

// 🔹 Vaciar carrito completo
export function clearCart(cartId: number | string) {
  return request(`/cart/${cartId}/clear_cart/", {
    method: "DELETE",
  });
}

// 🔹 Actualizar cantidad
export function updateQuantity(
  cartProductId: number | string,
  quantity: number
) {
  return request("/cart/update_quantity/", {
    method: "PATCH",
    body: JSON.stringify({
      cart_product_id: cartProductId,
      quantity,
    }),
  });
}