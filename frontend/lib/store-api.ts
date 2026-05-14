const API_BASE_URL =
  (globalThis as { process?: { env?: { NEXT_PUBLIC_API_URL?: string } } })
    .process?.env?.NEXT_PUBLIC_API_URL ?? "http://localhost:8080/api";

export interface StoreLocationResponse {
  latitude: string | null;
  longitude: string | null;
  address: string;
  city: string;
  name: string;
}

export async function getStoreLocation(): Promise<StoreLocationResponse> {
  const response = await fetch(`${API_BASE_URL}/store-location/`, {
    method: "GET",
    headers: { "Content-Type": "application/json" },
    cache: "no-store",
  });

  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(body.error || "No se pudo obtener la ubicacion de la tienda");
  }

  return response.json() as Promise<StoreLocationResponse>;
}
