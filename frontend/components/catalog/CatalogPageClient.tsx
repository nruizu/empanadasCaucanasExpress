"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import CategoryCard from "@/components/catalog/CategoryCard";
import ProductGrid from "@/components/catalog/ProductGrid";
import SectionTitle from "@/components/catalog/SectionTitle";
import {
  getCategories,
  getFeaturedProducts,
  getProducts,
  getProductsByCategory,
} from "@/lib/catalog-api";
import type { Category, Product } from "@/types/catalog";

export default function CatalogPageClient() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [featuredProducts, setFeaturedProducts] = useState<Product[]>([]);
  const [allProducts, setAllProducts] = useState<Product[]>([]);
  const [categoryProducts, setCategoryProducts] = useState<Product[]>([]);
  const [selectedCategorySlug, setSelectedCategorySlug] = useState<string | null>(null);
  const [ordering, setOrdering] = useState<"name" | "-name" | "price" | "-price">("name");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [totalProducts, setTotalProducts] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [loadingCategoryProducts, setLoadingCategoryProducts] = useState(false);

  const selectedCategory = useMemo(
    () => categories.find((category) => category.slug === selectedCategorySlug),
    [categories, selectedCategorySlug],
  );

  const loadInitialData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [categoriesData, featuredData, productsData] = await Promise.all([
        getCategories(),
        getFeaturedProducts(),
        getProducts({ page: 1, ordering: "name" }),
      ]);

      setCategories(categoriesData);
      setFeaturedProducts(featuredData);
      setAllProducts(productsData.results);
      setTotalProducts(productsData.count);

      if (categoriesData.length > 0) {
        const firstSlug = categoriesData[0].slug;
        setSelectedCategorySlug(firstSlug);
        const byCategoryData = await getProductsByCategory(firstSlug, { ordering: "name" });
        setCategoryProducts(byCategoryData.results);
      }
    } catch {
      setError("No se pudo cargar el catálogo. Intenta nuevamente.");
    } finally {
      setLoading(false);
    }
  }, []);

  const loadAllProducts = useCallback(async () => {
    try {
      const data = await getProducts({
        page,
        ordering,
        search,
      });
      setAllProducts(data.results);
      setTotalProducts(data.count);
      setError(null);
    } catch {
      setError("No se pudieron actualizar los productos.");
    }
  }, [ordering, page, search]);

  const loadProductsByCategory = useCallback(async (slug: string) => {
    setLoadingCategoryProducts(true);
    setSelectedCategorySlug(slug);
    try {
      const data = await getProductsByCategory(slug, { ordering: "name" });
      setCategoryProducts(data.results);
    } catch {
      setError("No se pudieron cargar los productos de la categoría seleccionada.");
    } finally {
      setLoadingCategoryProducts(false);
    }
  }, []);

  useEffect(() => {
    void loadInitialData();
  }, [loadInitialData]);

  useEffect(() => {
    if (!loading) {
      void loadAllProducts();
    }
  }, [loading, loadAllProducts]);

  const handleAddToCart = (productId: number) => {
    void productId;
  };

  const hasNextPage = page * 20 < totalProducts;

  if (loading) {
    return (
      <main className="min-h-screen bg-[var(--cce-beige)] px-4 py-10 md:px-10">
        <div className="mx-auto max-w-6xl rounded-2xl bg-white p-6 text-center text-[var(--cce-text-muted)] shadow-[0_8px_30px_rgba(31,77,58,0.09)]">
          Cargando catálogo...
        </div>
      </main>
    );
  }

  if (error && !categories.length && !featuredProducts.length && !allProducts.length) {
    return (
      <main className="min-h-screen bg-[var(--cce-beige)] px-4 py-10 md:px-10">
        <div className="mx-auto max-w-6xl rounded-2xl bg-white p-6 text-center text-red-700 shadow-[0_8px_30px_rgba(31,77,58,0.09)]">
          {error}
          <div className="mt-4">
            <button
              type="button"
              onClick={() => void loadInitialData()}
              className="rounded-full bg-[var(--cce-mustard)] px-4 py-2 font-semibold text-[var(--cce-green-dark)]"
            >
              Reintentar
            </button>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[var(--cce-beige)] pb-14">
      <section className="relative h-[340px] overflow-hidden">
        <img
          src="/Local_sede.jpeg"
          alt="Empanadas tradicionales"
          className="h-full w-full object-cover"
        />
        <div className="absolute inset-0 bg-black/55" />
        <div className="absolute inset-0 mx-auto flex max-w-6xl flex-col justify-center px-4 text-white md:px-8">
          <p className="text-2xl font-bold md:text-4xl">Tradición que encanta desde 1972</p>
          <p className="mt-2 text-sm md:text-xl">El auténtico sabor caucano en cada bocado</p>
        </div>
      </section>

      <div className="mx-auto mt-8 flex w-full max-w-6xl flex-col gap-12 px-4 md:px-8">
        <section>
          <SectionTitle title="Productos Destacados" />
          <ProductGrid
            products={featuredProducts}
            emptyMessage="No hay productos destacados por ahora."
            onAddToCart={handleAddToCart}
          />
        </section>

        <section>
          <SectionTitle
            title="Productos por Categorías"
            subtitle="Selecciona una categoría para ver sus productos sin recargar la página."
          />
          <div className="mb-6 grid grid-cols-1 gap-4 lg:grid-cols-3">
            {categories.map((category) => (
              <CategoryCard
                key={category.id}
                category={category}
                selected={selectedCategorySlug === category.slug}
                onSelect={(slug) => void loadProductsByCategory(slug)}
              />
            ))}
          </div>

          <p className="mb-4 text-sm font-semibold text-[var(--cce-green-dark)]">
            {selectedCategory ? `Mostrando: ${selectedCategory.name}` : "Selecciona una categoría"}
          </p>
          {loadingCategoryProducts ? (
            <div className="rounded-2xl bg-white p-6 text-center text-[var(--cce-text-muted)] shadow-[0_8px_30px_rgba(31,77,58,0.09)]">
              Cargando productos de la categoría...
            </div>
          ) : (
            <ProductGrid
              products={categoryProducts}
              emptyMessage="No hay productos disponibles en esta categoría."
              onAddToCart={handleAddToCart}
            />
          )}
        </section>

        <section>
          <SectionTitle title="Todos los Productos" />
          <div className="mb-6 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <input
              value={search}
              onChange={(event) => {
                setPage(1);
                setSearch(event.target.value);
              }}
              placeholder="Buscar por nombre o descripción"
              className="w-full rounded-full border border-[color-mix(in_srgb,var(--cce-green-dark)_20%,white)] bg-white px-4 py-2 text-sm outline-none focus:border-[var(--cce-green-dark)] md:max-w-sm"
            />
            <select
              value={ordering}
              onChange={(event) => {
                setPage(1);
                setOrdering(event.target.value as "name" | "-name" | "price" | "-price");
              }}
              className="rounded-full border border-[color-mix(in_srgb,var(--cce-green-dark)_20%,white)] bg-white px-4 py-2 text-sm outline-none focus:border-[var(--cce-green-dark)]"
            >
              <option value="name">Nombre (A-Z)</option>
              <option value="-name">Nombre (Z-A)</option>
              <option value="price">Precio (menor a mayor)</option>
              <option value="-price">Precio (mayor a menor)</option>
            </select>
          </div>

          <ProductGrid
            products={allProducts}
            emptyMessage="No se encontraron productos con estos filtros."
            onAddToCart={handleAddToCart}
          />

          <div className="mt-6 flex items-center justify-between">
            <button
              type="button"
              onClick={() => setPage((currentPage) => Math.max(currentPage - 1, 1))}
              disabled={page === 1}
              className="rounded-full bg-[var(--cce-green-dark)] px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
            >
              Anterior
            </button>
            <span className="text-sm font-semibold text-[var(--cce-green-dark)]">Página {page}</span>
            <button
              type="button"
              onClick={() => setPage((currentPage) => currentPage + 1)}
              disabled={!hasNextPage}
              className="rounded-full bg-[var(--cce-green-dark)] px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
            >
              Siguiente
            </button>
          </div>
        </section>
      </div>
    </main>
  );
}
