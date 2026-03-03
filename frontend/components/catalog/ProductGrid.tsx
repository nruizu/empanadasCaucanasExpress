import ProductCard from "@/components/catalog/ProductCard";
import type { Product } from "@/types/catalog";

interface ProductGridProps {
  products: Product[];
  emptyMessage: string;
  onAddToCart?: (productId: number, productName: string) => void;
}

export default function ProductGrid({ products, emptyMessage, onAddToCart }: ProductGridProps) {
  if (!products.length) {
    return (
      <div className="rounded-2xl bg-white p-8 text-center text-sm text-[var(--cce-text-muted)] shadow-[0_8px_30px_rgba(31,77,58,0.09)]">
        {emptyMessage}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
      {products.map((product) => (
        <ProductCard
          key={product.id}
          product={product}
          onAddToCart={onAddToCart}
        />
      ))}
    </div>
  );
}