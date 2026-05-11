const API_BASE_URL =
  (globalThis as { process?: { env?: { NEXT_PUBLIC_API_URL?: string } } })
    .process?.env?.NEXT_PUBLIC_API_URL ?? "http://localhost:8080/api";

export interface AdminUser {
  id: number;
  username: string;
  email: string;
  full_name: string;
  phone: string;
  role: "customer" | "courier";
}

export async function getAdminUsers(token: string): Promise<AdminUser[]> {
  const response = await fetch(`${API_BASE_URL}/auth/admin/users/`, {
    headers: {
      Authorization: `Token ${token}`,
    },
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.detail || "Error al cargar usuarios");
  }

  return response.json();
}

export async function updateAdminUserRole(
  token: string,
  userId: number,
  role: "customer" | "courier"
): Promise<AdminUser> {
  const response = await fetch(`${API_BASE_URL}/auth/admin/users/${userId}/`, {
    method: "PATCH",
    headers: {
      Authorization: `Token ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ role }),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.detail || "Error al actualizar usuario");
  }

  return response.json();
}
