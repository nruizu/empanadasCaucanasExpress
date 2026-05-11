export async function authFetch(url: string, options: RequestInit = {}) {
  const token = localStorage.getItem("cce_token");

  return fetch(`http://localhost:8080${url}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Token ${token}` } : {}),
      ...options.headers,
    },
  });
}
