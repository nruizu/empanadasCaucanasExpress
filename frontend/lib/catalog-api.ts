import type {
  Category,
  PaginatedResponse,
  Product,
  ProductFilters,
} from "@/types/catalog";

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8080/api";

class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

type QueryParams = Record<string, string | number | undefined | null>;

const toQueryParams = (filters?: ProductFilters): QueryParams | undefined => {
  if (!filters) {
    return undefined;
  }
  return {
    page: filters.page,
    page_size: filters.page_size,
    search: filters.search,
    ordering: filters.ordering,
    min_price: filters.min_price,
    max_price: filters.max_price,
    category: filters.category,
  };
};

const buildUrl = (path: string, params?: QueryParams) => {
  const url = new URL(`${API_BASE_URL}${path}`);
  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      if (value !== "" && value !== undefined && value !== null) {
        url.searchParams.set(key, String(value));
      }
    });
  }
  return url.toString();
};

const request = async <T>(path: string, params?: QueryParams): Promise<T> => {
  const response = await fetch(buildUrl(path, params), {
    method: "GET",
    headers: {
      Accept: "application/json",
    },
    cache: "no-store",
  });

  if (!response.ok) {
    throw new ApiError("Error al consultar el catálogo", response.status);
  }

  return (await response.json()) as T;
};

const toArrayResponse = <T>(payload: T[] | PaginatedResponse<T>): T[] => {
  if (Array.isArray(payload)) {
    return payload;
  }
  return payload.results;
};

export const getCategories = async () => {
  const response = await request<Category[] | PaginatedResponse<Category>>(
    "/categories/",
  );
  return toArrayResponse(response);
};

export const getFeaturedProducts = () =>
  request<Product[]>("/products/featured/");

export const getProducts = (filters?: ProductFilters) =>
  request<PaginatedResponse<Product>>("/products/", toQueryParams(filters));

export const getProductsByCategory = (slug: string, filters?: ProductFilters) =>
  request<PaginatedResponse<Product>>(
    `/categories/${slug}/products/`,
    toQueryParams(filters),
  );

export { ApiError };
