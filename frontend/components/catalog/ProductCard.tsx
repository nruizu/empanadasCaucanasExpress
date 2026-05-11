"use client";

import { useMemo, useState } from "react";

import AddToCartButton from "@/components/catalog/AddToCartButton";
import type { CatalogProduct } from "@/types/catalog";

interface ProductCardProps {
  product: CatalogProduct;
  onAddToCart?: (productId: number, productName: string) => void;
}

const formatPrice = (price: string) =>
  new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    maximumFractionDigits: 0,
  }).format(Number(price));

export default function ProductCard({ product, onAddToCart }: ProductCardProps) {
  const [selectedVariantId, setSelectedVariantId] = useState<number>(product.variants[0].id);

  const selectedVariant = useMemo(
    () => product.variants.find((variant) => variant.id === selectedVariantId) ?? product.variants[0],
    [product.variants, selectedVariantId],
  );

  const displayDescription = selectedVariant.description || product.description || "Preparación artesanal con sabor tradicional.";

  return (
    <article className="overflow-hidden rounded-xl bg-[var(--card)] shadow-md transition-shadow hover:shadow-xl">
      <img
        src={selectedVariant.image || "https://images.unsplash.com/photo-1512058564366-18510be2db19?auto=format&fit=crop&w=1200&q=80"}
        alt={product.name}
        className="h-44 w-full object-cover transition-transform duration-300 hover:scale-105"
      />
      <div className="flex min-h-48 flex-col gap-3 p-4">
        <div>
          <div className="flex items-center gap-2">
            <p className="text-xs font-semibold text-[var(--muted-foreground)]">{product.category.name}</p>
            {product.category.slug === "para-llevar" ? (
              <span className="rounded-full border border-[color-mix(in_srgb,var(--primary)_20%,white)] bg-[color-mix(in_srgb,var(--primary)_10%,white)] px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-[var(--primary)]">
                Paquete
              </span>
            ) : null}
          </div>
          <h3 className="mt-1 text-4xl font-bold leading-tight text-[var(--primary)]">{product.name}</h3>
          <p className="mt-2 line-clamp-3 text-base font-normal leading-relaxed text-[var(--muted-foreground)]">
            {displayDescription}
          </p>
          {product.variants.length > 1 ? (
            <div className="mt-2">
              <label htmlFor={`variant-${product.id}`} className="mb-1 block text-xs font-semibold text-[var(--muted-foreground)]">
                Presentación
              </label>
              <select
                id={`variant-${product.id}`}
                value={selectedVariantId}
                onChange={(event) => setSelectedVariantId(Number(event.target.value))}
                className="w-full rounded-lg border border-[color-mix(in_srgb,var(--primary)_20%,white)] bg-white px-3 py-2 text-sm outline-none focus:border-[var(--primary)]"
              >
                {product.variants.map((variant) => (
                  <option key={variant.id} value={variant.id}>
                    {variant.label}
                  </option>
                ))}
              </select>
            </div>
          ) : null}
        </div>
        <div className="mt-1 flex items-center gap-3">
          <span className="text-lg font-bold text-[var(--primary)]">{formatPrice(selectedVariant.price)}</span>
          <AddToCartButton
            productId={selectedVariant.id}
            productName={`${product.name} - ${selectedVariant.label}`}
            onAdd={onAddToCart}
          />
        </div>
      </div>
    </article>
  );
}
