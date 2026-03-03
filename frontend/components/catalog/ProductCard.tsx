import AddToCartButton from "@/components/catalog/AddToCartButton";
import type { Product } from "@/types/catalog";

interface ProductCardProps {
  product: Product;
  onAddToCart?: (productId: number, productName: string) => void;
}

const formatPrice = (price: string) =>
  new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    maximumFractionDigits: 0,
  }).format(Number(price));

export default function ProductCard({ product, onAddToCart }: ProductCardProps) {
  return (
    <article className="overflow-hidden rounded-2xl bg-white shadow-[0_8px_30px_rgba(31,77,58,0.09)]">
      <img
        src={product.image || "https://images.unsplash.com/photo-1512058564366-18510be2db19?auto=format&fit=crop&w=1200&q=80"}
        alt={product.name}
        className="h-48 w-full object-cover"
      />
      <div className="flex min-h-44 flex-col justify-between p-4">
        <div>
          <p className="text-xs font-semibold text-[var(--cce-text-muted)]">{product.category.name}</p>
          <h3 className="mt-1 text-lg font-bold text-[var(--cce-green-dark)]">{product.name}</h3>
          <p className="mt-2 line-clamp-2 text-sm text-[var(--cce-text-muted)]">{product.description}</p>
        </div>
        <div className="mt-4 flex items-center justify-between gap-3">
          <span className="text-lg font-bold text-[var(--cce-green-dark)]">{formatPrice(product.price)}</span>
          <AddToCartButton
            productId={product.id}
            productName={product.name}
            onAdd={onAddToCart}
          />
        </div>
      </div>
    </article>
  );
}
