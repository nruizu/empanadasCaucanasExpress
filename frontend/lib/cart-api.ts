const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8080/api";

async function request(path: string, options: RequestInit = {}) {
  const res = await fetch(`${API_BASE_URL}${path}`, options);
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.detail || body.error || res.statusText);
  }
  return res.json().catch(() => ({}));
}

export const getCarts = (token: string) =>
  request('/cart/', { headers: { Authorization: `Token ${token}` } });

export const createCart = (token: string) =>
  request('/cart/create_cart/', { method: 'POST', headers: { Authorization: `Token ${token}` } });

export const addProduct = (cartId: number | string, token: string, productId: number, quantity = 1) =>
  request(`/cart/${cartId}/add_product/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Token ${token}` },
    body: JSON.stringify({ product_id: productId, quantity }),
  });

export const getCart = (cartId: number | string, token: string) =>
  request(`/cart/${cartId}/`, { headers: { Authorization: `Token ${token}` } });

export default { getCarts, createCart, addProduct, getCart };
