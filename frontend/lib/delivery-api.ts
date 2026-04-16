const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8080";

export interface DeliveryValidationResponse {
  status:
    | "not_validated"
    | "valid"
    | "invalid"
    | "out_of_coverage"
    | "service_error";
  message: string;
  latitude?: string | null;
  longitude?: string | null;
  distance_km?: string | null;
  delivery_maps_url?: string;
}

export async function validateDeliveryAddress(deliveryAddress: string) {
  const response = await fetch(
    `${API_BASE_URL}/api/orders/delivery/validate/`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ delivery_address: deliveryAddress }),
    },
  );

  const body = (await response
    .json()
    .catch(() => ({}))) as DeliveryValidationResponse & {
    detail?: string;
  };

  if (!response.ok) {
    if (body?.message) {
      throw new Error(body.message);
    }

    throw new Error(body.detail || "No se pudo validar la direccion");
  }

  return body;
}
