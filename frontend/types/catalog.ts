export interface Category {
  id: number;
  name: string;
  slug: string;
  image: string;
}

export interface Product {
  id: number;
  name: string;
  slug: string;
  description: string;
  price: string;
  image: string;
  is_featured: boolean;
  // Sends the category within product information
  category: Category;
}

export interface PaginatedResponse<T> {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
}

export interface ProductFilters {
  page?: number;
  page_size?: number;
  search?: string;
  ordering?: "name" | "-name" | "price" | "-price";
  min_price?: number;
  max_price?: number;
  category?: string;
}
