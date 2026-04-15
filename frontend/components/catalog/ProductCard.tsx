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

export default function ProductCard({
  product,
  onAddToCart,
}: ProductCardProps) {
  const [selectedVariantId, setSelectedVariantId] = useState<number>(
    product.variants[0].id,
  );

  const selectedVariant = useMemo(
    () =>
      product.variants.find((variant) => variant.id === selectedVariantId) ??
      product.variants[0],
    [product.variants, selectedVariantId],
  );

  return (
    <article className="overflow-hidden rounded-2xl bg-white shadow-[0_8px_30px_rgba(31,77,58,0.09)]">
      <img
        src={
          selectedVariant.image ||
          "https://images.unsplash.com/photo-1512058564366-18510be2db19?auto=format&fit=crop&w=1200&q=80"
        }
        alt={product.name}
        className="h-48 w-full object-cover"
      />
      <div className="flex min-h-44 flex-col justify-between p-4">
        <div>
          <div className="flex items-center gap-2">
            <p className="text-xs font-semibold text-[var(--cce-text-muted)]">
              {product.category.name}
            </p>
            {product.category.slug === "para-llevar" ? (
              <span className="rounded-full border border-[color-mix(in_srgb,var(--cce-green-dark)_28%,white)] bg-[color-mix(in_srgb,var(--cce-green-dark)_12%,white)] px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-[var(--cce-green-dark)]">
                Paquete
              </span>
            ) : null}
          </div>
          <h3 className="mt-1 text-lg font-bold text-[var(--cce-green-dark)]">
            {product.name}
          </h3>
          <p className="mt-2 line-clamp-2 text-sm text-[var(--cce-text-muted)]">
            {product.description}
          </p>
          {product.variants.length > 1 ? (
            <div className="mt-3">
              <label
                htmlFor={`variant-${product.id}`}
                className="mb-1 block text-xs font-semibold text-[var(--cce-text-muted)]"
              >
                Presentación
              </label>
              <select
                id={`variant-${product.id}`}
                value={selectedVariantId}
                onChange={(event) =>
                  setSelectedVariantId(Number(event.target.value))
                }
                className="w-full rounded-lg border border-[color-mix(in_srgb,var(--cce-green-dark)_20%,white)] bg-white px-3 py-2 text-sm outline-none focus:border-[var(--cce-green-dark)]"
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
        <div className="mt-4 flex items-center justify-between gap-3">
          <span className="text-lg font-bold text-[var(--cce-green-dark)]">
            {formatPrice(selectedVariant.price)}
          </span>
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
