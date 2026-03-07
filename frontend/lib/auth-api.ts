const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8080/api";

async function request(path: string, options: RequestInit = {}) {
  const res = await fetch(`${API_BASE_URL}${path}`, {
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
    ...options,
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    // Si tiene campos de validación (password, username, etc), lanza el objeto completo
    const hasFieldErrors = Object.keys(body).some((k) => k !== "detail" && k !== "error");
    if (hasFieldErrors) throw body;
    throw new Error(body.detail || body.error || res.statusText);
  }

  return res.json().catch(() => ({}));
}

export async function register({ username, password, email }: { username: string; password: string; email?: string }) {
  const res = await fetch(`${API_BASE_URL}/auth/registro/`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password, email }),
  });

  const data = await res.json();

  if (!res.ok) {
    throw data;
  }

  return data;
}

export const login = (payload: { username: string; password: string }) =>
  request('/auth/login/', { method: 'POST', body: JSON.stringify(payload) });

export async function logout(token: string) {
  return fetch(`${API_BASE_URL}/auth/logout/`, {
    method: "POST",
    headers: {
      Authorization: `Token ${token}`,
    },
  });
}

export async function me(token: string) {
  return request('/auth/me/', {
    method: 'GET',
    headers: {
      Authorization: `Token ${token}`,
    },
  });
}

export default { register, login, logout, me };
