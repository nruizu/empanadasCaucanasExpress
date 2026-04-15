import type { Product } from "@/types/catalog";

export interface OrderItemDetail {
  id: number;
  product: Product;
  quantity: number;
  unit_price: string;
  subtotal: string;
}

export interface SalesOrder {
  id: number;
  customer_name: string;
  customer_phone: string;
  customer_email?: string | null;
  delivery_method: "pickup" | "delivery" | "scheduled";
  status: string;
  pickup_date?: string | null;
  pickup_time?: string | null;
  scheduled_date?: string | null;
  delivery_address?: string | null;
  notes?: string | null;
  total_amount: string;
  order_source: "online" | "manual";
  created_by?: number | null;
  created_by_username?: string | null;
  items: OrderItemDetail[];
  created_at: string;
  updated_at: string;
}

export interface SalesHistoryFilters {
  start_date?: string;
  end_date?: string;
  status?: string;
  order_source?: "online" | "manual";
  delivery_method?: "pickup" | "delivery" | "scheduled";
  time_basis?: "created" | "service";
  page?: number;
}

export interface SalesHistoryResponse {
  count: number;
  next: string | null;
  previous: string | null;
  results: SalesOrder[];
}

export interface SalesByDelivery {
  delivery_method: string;
  total_orders: number;
  total_sold: string;
}

export interface SalesMetrics {
  filters: {
    start_date?: string;
    end_date?: string;
    status?: string;
    order_source?: string;
    delivery_method?: string;
    time_basis?: string;
  };
  total_sold: string;
  total_orders: number;
  average_ticket: string;
  by_delivery_method: SalesByDelivery[];
}

export interface ManualSaleItemInput {
  product_id: number;
  quantity: number;
}

export interface ManualSalePayload {
  customer_name: string;
  customer_phone: string;
  customer_email?: string;
  status?: string;
  notes?: string;
  items: ManualSaleItemInput[];
}
