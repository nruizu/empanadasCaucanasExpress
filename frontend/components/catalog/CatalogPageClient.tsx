"use client";

import CartConfirmModal from "@/components/cart/CartConfirmModal";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import useAuth from "@/context/AuthContext";
import * as cartApi from "@/lib/cart-api";

import CategoryCard from "@/components/catalog/CategoryCard";
import ProductGrid from "@/components/catalog/ProductGrid";
import SectionTitle from "@/components/catalog/SectionTitle";
import TrustSection from "@/components/TrustSection";
import Footer from "@/components/Footer";
import {
  getCategories,
  getFeaturedProducts,
  getProducts,
  getProductsByCategory,
} from "@/lib/catalog-api";
import type { CatalogProduct, Category, Product } from "@/types/catalog";

const toNumberPrice = (value: string) => Number(value);

const normalizeSearchText = (value: string) =>
  value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();

const extractVariantLabel = (name: string) => {
  const sizeMatch = name.match(/\b(pequeñ[ao]|median[ao]|grande)\b/i);
  if (sizeMatch?.[0]) {
    return sizeMatch[0][0].toUpperCase() + sizeMatch[0].slice(1).toLowerCase();
  }

  const xMatch = name.match(/\bx\s*\d+\b/i);
  if (xMatch?.[0]) {
    return xMatch[0].toUpperCase().replace(/\s+/g, "");
  }

  const weightMatch = name.match(/\b\d+\s*(g|ml)\b/i);
  if (weightMatch?.[0]) {
    return weightMatch[0].replace(/\s+/g, " ").toUpperCase();
  }

  const portionMatch = name.match(/\b(1\/2\s*porción|porción\s*completa)\b/i);
  if (portionMatch?.[0]) {
    return portionMatch[0][0].toUpperCase() + portionMatch[0].slice(1);
  }

  const peopleMatch = name.match(/\b\d+\s*(–|-)?\s*\d*\s*personas\b/i);
  if (peopleMatch?.[0]) {
    return peopleMatch[0][0].toUpperCase() + peopleMatch[0].slice(1);
  }

  return "Única";
};

const normalizeBaseName = (name: string) =>
  name
    .replace(/\b(pequeñ[ao]|median[ao]|grande)\b/gi, "")
    .replace(/\bx\s*\d+\b/gi, "")
    .replace(/\b\d+\s*(g|ml)\b/gi, "")
    .replace(/\b(1\/2\s*porción|porción\s*completa)\b/gi, "")
    .replace(/\b\d+\s*(–|-)?\s*\d*\s*personas\b/gi, "")
    .replace(/\s{2,}/g, " ")
    .trim();

const groupProductsWithVariants = (products: Product[]): CatalogProduct[] => {
  const grouped = new Map<string, CatalogProduct>();

  products.forEach((product) => {
    const baseName = normalizeBaseName(product.name) || product.name;
    const mapKey = `${product.category.slug}::${baseName.toLowerCase()}`;
    const variantLabel = extractVariantLabel(product.name);

    const variant = {
      id: product.id,
      name: product.name,
      price: product.price,
      image: product.image,
      label: variantLabel,
      description: product.description,
    };

    const existing = grouped.get(mapKey);
    if (existing) {
      existing.variants.push(variant);
      return;
    }

    grouped.set(mapKey, {
      id: product.id,
      slug: product.slug,
      name: baseName,
      description: product.description,
      category: product.category,
      variants: [variant],
    });
  });

  return Array.from(grouped.values()).map((groupedProduct) => ({
    ...groupedProduct,
    variants: groupedProduct.variants.sort(
      (left, right) => toNumberPrice(left.price) - toNumberPrice(right.price),
    ),
  }));
};

export default function CatalogPageClient() {
  const searchParams = useSearchParams();
  const initialSearch = useMemo(() => (searchParams.get("search") ?? "").trim(), [searchParams]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [featuredProducts, setFeaturedProducts] = useState<CatalogProduct[]>([]);
  const [allProducts, setAllProducts] = useState<CatalogProduct[]>([]);
  const [categoryProducts, setCategoryProducts] = useState<CatalogProduct[]>([]);
  const [selectedCategorySlug, setSelectedCategorySlug] = useState<string | null>(null);
  const [ordering, setOrdering] = useState<"name" | "-name" | "price" | "-price">("name");
  const [search, setSearch] = useState(initialSearch);
  const [page, setPage] = useState(1);
  const [totalProducts, setTotalProducts] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [loadingCategoryProducts, setLoadingCategoryProducts] = useState(false);
  const [confirmProduct, setConfirmProduct] = useState<string | null>(null);
  const categoryResultRef = useRef<HTMLParagraphElement | null>(null);
  const allProductsSectionRef = useRef<HTMLElement | null>(null);

  const selectedCategory = useMemo(
    () => categories.find((category) => category.slug === selectedCategorySlug),
    [categories, selectedCategorySlug],
  );

const loadInitialData = useCallback(async () => {
  setLoading(true);
  setError(null);

  try {
    const [categoriesData, featuredData, productsData] =
      await Promise.all([
        getCategories(),
        getFeaturedProducts(),
        getProducts({ page: 1, ordering: "name" }),
      ]);

    setCategories(categoriesData);
    setFeaturedProducts(groupProductsWithVariants(featuredData));
    setAllProducts(groupProductsWithVariants(productsData.results));
    setTotalProducts(productsData.count);

    if (categoriesData.length > 0) {
      const firstSlug = categoriesData[0].slug;
      setSelectedCategorySlug(firstSlug);
      const byCategoryData = await getProductsByCategory(firstSlug, { ordering: "name" });
      setCategoryProducts(groupProductsWithVariants(byCategoryData.results));
    }
  } catch (err) {
    console.error("loadInitialData error:", err);
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

      const normalizedSearch = normalizeSearchText(search);
      if (normalizedSearch && data.count === 0) {
        const fallbackData = await getProducts({
          page: 1,
          page_size: 100,
          ordering,
        });

        const filteredProducts = fallbackData.results.filter((product) => {
          const name = normalizeSearchText(product.name);
          const description = normalizeSearchText(product.description || "");
          return name.includes(normalizedSearch) || description.includes(normalizedSearch);
        });

        setAllProducts(groupProductsWithVariants(filteredProducts));
        setTotalProducts(filteredProducts.length);
        setError(null);
        return;
      }

      setAllProducts(groupProductsWithVariants(data.results));
      setTotalProducts(data.count);
      setError(null);
    } catch (err) {
      console.error('loadAllProducts error:', err);
      setError("No se pudieron actualizar los productos.");
    }
  }, [ordering, page, search]);

  const loadProductsByCategory = useCallback(async (slug: string) => {
    setLoadingCategoryProducts(true);
    setSelectedCategorySlug(slug);
    try {
      const data = await getProductsByCategory(slug, { ordering: "name" });
      setCategoryProducts(groupProductsWithVariants(data.results));
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
    setSearch((currentSearch) => (currentSearch === initialSearch ? currentSearch : initialSearch));
    setPage((currentPage) => (currentPage === 1 ? currentPage : 1));
  }, [initialSearch]);

  useEffect(() => {
    void loadAllProducts();
  }, [page, ordering, search]);

  const router = useRouter();
  const { token, user } = useAuth();

const handleAddToCart = async (productId: number, productName: string) => {
  if (!token) { router.push("/login"); return; }
  try {
    await cartApi.addProduct(productId, 1);
    window.dispatchEvent(new CustomEvent("cart:updated"));
    setConfirmProduct(productName);
  } catch (err) {
    console.error(err);
  }
};

  const handleCategorySelect = (slug: string) => {
    void loadProductsByCategory(slug);
    categoryResultRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const handleShowAllProducts = () => {
    allProductsSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const hasNextPage = page * 20 < totalProducts;

  if (loading) {
    return (
      <main className="min-h-screen bg-[var(--background)] px-4 py-10 md:px-10">
        <div className="mx-auto max-w-6xl rounded-2xl bg-[var(--card)] p-6 text-center text-[var(--muted-foreground)] shadow-md">
          Cargando catálogo...
        </div>
      </main>
    );
  }

  if (error && !categories.length && !featuredProducts.length && !allProducts.length) {
    return (
      <main className="min-h-screen bg-[var(--background)] px-4 py-10 md:px-10">
        <div className="mx-auto max-w-6xl rounded-2xl bg-[var(--card)] p-6 text-center text-red-700 shadow-md">
          {error}
          <div className="mt-4">
            <button
              type="button"
              onClick={() => void loadInitialData()}
              className="rounded-full bg-[var(--secondary)] px-4 py-2 font-semibold text-[var(--secondary-foreground)]"
            >
              Reintentar
            </button>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[var(--background)] pb-14">
      <section className="relative h-[340px] overflow-hidden">
        <img
          src="/hero-portada.jpg"
          alt="Empanadas tradicionales"
          className="h-full w-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/35 to-transparent" />
        <div className="absolute inset-0 mx-auto flex max-w-6xl flex-col justify-end px-4 pb-8 text-white md:px-8">
          <p className="text-2xl font-bold md:text-4xl">Tradición que encanta desde 1972</p>
          <p className="mt-1 text-sm text-[var(--secondary)] md:text-lg">El auténtico sabor caucano en cada bocado</p>
        </div>
      </section>

      <div className="mx-auto mt-8 flex w-full max-w-6xl flex-col gap-12 px-4 md:px-8">
        <section className="rounded-2xl border border-[color-mix(in_srgb,var(--primary)_15%,white)] bg-white p-4 shadow-[0_8px_24px_rgba(31,92,58,0.06)]">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm text-[var(--foreground)]">
              Modo actual: {user?.is_staff ? "Administrador" : token ? "Usuario" : "Invitado"}
            </p>
            {user?.is_staff ? (
              <span className="rounded-full bg-[color-mix(in_srgb,var(--secondary)_40%,white)] px-3 py-1 text-xs font-semibold text-[var(--primary)]">
                Acceso admin activo
              </span>
            ) : (
              <span className="rounded-full bg-[color-mix(in_srgb,var(--muted)_65%,white)] px-3 py-1 text-xs font-semibold text-[var(--muted-foreground)]">
                Acceso de cliente
              </span>
            )}
          </div>
        </section>

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
          <div className="mb-7 grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">
            {categories.map((category) => (
              <CategoryCard
                key={category.id}
                category={category}
                selected={selectedCategorySlug === category.slug}
                onSelect={handleCategorySelect}
              />
            ))}
          </div>

          <div className="mb-6 border-t border-[color-mix(in_srgb,var(--primary)_15%,white)] pt-8">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 ref={categoryResultRef} className="scroll-mt-24 text-4xl font-bold text-[var(--primary)]">
                  {selectedCategory ? selectedCategory.name : "Productos"}
                </h3>
                <p className="mt-1 text-sm text-[var(--muted-foreground)]">
                  {selectedCategory
                    ? `Mostrando productos de la categoría ${selectedCategory.name}.`
                    : "Selecciona una categoría para ver sus productos."}
                </p>
              </div>

              <button
                type="button"
                onClick={handleShowAllProducts}
                className="rounded-lg bg-[var(--accent)] px-5 py-2.5 text-lg font-semibold text-[var(--accent-foreground)] transition-colors hover:bg-[color-mix(in_srgb,var(--accent)_88%,black)]"
              >
                Ver todos
              </button>
            </div>
          </div>

          {loadingCategoryProducts ? (
            <div className="rounded-2xl bg-[var(--card)] p-6 text-center text-[var(--muted-foreground)] shadow-md">
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

        <section id="todos-productos" ref={allProductsSectionRef}>
          <SectionTitle
            title={search ? `Resultados para "${search}"` : "Todos los Productos"}
            subtitle={search ? "Estos son los productos que coinciden con tu búsqueda." : undefined}
          />
          <div className="mb-6 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <input
              value={search}
              onChange={(event) => {
                setPage(1);
                setSearch(event.target.value);
              }}
              placeholder="Buscar por nombre o descripción"
              className="w-full rounded-full border border-[color-mix(in_srgb,var(--primary)_20%,white)] bg-white px-4 py-2 text-sm outline-none focus:border-[var(--primary)] md:max-w-sm"
            />
            <select
              value={ordering}
              onChange={(event) => {
                setPage(1);
                setOrdering(event.target.value as "name" | "-name" | "price" | "-price");
              }}
              className="rounded-full border border-[color-mix(in_srgb,var(--primary)_20%,white)] bg-white px-4 py-2 text-sm outline-none focus:border-[var(--primary)]"
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
              className="rounded-full bg-[var(--primary)] px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
            >
              Anterior
            </button>
            <span className="text-sm font-semibold text-[var(--primary)]">Página {page}</span>
            <button
              type="button"
              onClick={() => setPage((currentPage) => currentPage + 1)}
              disabled={!hasNextPage}
              className="rounded-full bg-[var(--primary)] px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
            >
              Siguiente
            </button>
          </div>
        </section>
      </div>

      <div className="mt-12">
        <TrustSection />
      </div>
      <Footer />

      {confirmProduct && (
        <CartConfirmModal
          productName={confirmProduct}
          onClose={() => setConfirmProduct(null)}
          onGoToCart={() => { setConfirmProduct(null); router.push("/carrito"); }}
        />
      )}
    </main>
  );
}
