import { render, screen } from "@testing-library/react";
import { vi } from "vitest";

import OrderHistoryPage from "./page";

const myOrderHistoryMock = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: vi.fn(),
  }),
}));

vi.mock("@/context/AuthContext", () => ({
  __esModule: true,
  default: () => ({
    token: "fake-token",
  }),
}));

vi.mock("@/lib/auth-api", () => ({
  myOrderHistory: (...args: unknown[]) => myOrderHistoryMock(...args),
}));

describe("OrderHistoryPage", () => {
  beforeEach(() => {
    myOrderHistoryMock.mockReset();
  });

  it("muestra link de Google Maps cuando el pedido delivery trae delivery_maps_url", async () => {
    myOrderHistoryMock.mockResolvedValue({
      results: [
        {
          id: 101,
          customer_name: "Cliente 1",
          customer_phone: "3000000000",
          customer_email: null,
          delivery_method: "delivery",
          status: "pending",
          pickup_date: null,
          pickup_time: null,
          scheduled_date: null,
          delivery_address: "Calle 20B #80-15, Medellin",
          delivery_maps_url:
            "https://www.google.com/maps/dir/?api=1&destination=6.23,-75.60",
          notes: null,
          total_amount: "10000",
          created_at: "2026-04-15T20:00:00Z",
          updated_at: "2026-04-15T20:00:00Z",
          items: [],
        },
      ],
    });

    render(<OrderHistoryPage />);

    const mapsLink = await screen.findByRole("link", {
      name: /https:\/\/www\.google\.com\/maps\/dir\//i,
    });

    expect(mapsLink).toBeInTheDocument();
    expect(mapsLink).toHaveAttribute(
      "href",
      "https://www.google.com/maps/dir/?api=1&destination=6.23,-75.60",
    );

    expect(
      screen.getByRole("link", { name: /abrir en google maps/i }),
    ).toBeInTheDocument();
  });

  it("construye link fallback de Google Maps cuando no viene delivery_maps_url", async () => {
    myOrderHistoryMock.mockResolvedValue({
      results: [
        {
          id: 102,
          customer_name: "Cliente 2",
          customer_phone: "3000000001",
          customer_email: null,
          delivery_method: "delivery",
          status: "pending",
          pickup_date: null,
          pickup_time: null,
          scheduled_date: null,
          delivery_address: "Calle 20B #80-15, Medellin",
          delivery_maps_url: "",
          notes: null,
          total_amount: "12000",
          created_at: "2026-04-15T20:00:00Z",
          updated_at: "2026-04-15T20:00:00Z",
          items: [],
        },
      ],
    });

    render(<OrderHistoryPage />);

    const fallbackUrl =
      "https://www.google.com/maps/dir/?api=1&destination=Calle%2020B%20%2380-15%2C%20Medellin";

    const mapsLink = await screen.findByRole("link", {
      name: new RegExp(fallbackUrl.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i"),
    });

    expect(mapsLink).toBeInTheDocument();
    expect(mapsLink).toHaveAttribute("href", fallbackUrl);
  });
});
