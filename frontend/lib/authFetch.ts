export async function authFetch(url: string, options: RequestInit = {}) {
  const token = localStorage.getItem("cce_token");
  const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8080/api";

  return fetch(`${apiUrl}${url}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Token ${token}` } : {}),
      ...options.headers,
    },
  });
}
