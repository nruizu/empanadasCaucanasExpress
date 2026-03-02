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
    throw new Error(body.detail || body.error || res.statusText);
  }
  return res.json().catch(() => ({}));
}

export const register = (payload: { username: string; password: string; email?: string }) =>
  request('/auth/registro/', { method: 'POST', body: JSON.stringify(payload) });

export const login = (payload: { username: string; password: string }) =>
  request('/auth/login/', { method: 'POST', body: JSON.stringify(payload) });

export const logout = (token: string) =>
  request('/auth/logout/', { method: 'POST', headers: { Authorization: `Token ${token}` } });

export default { register, login, logout };
