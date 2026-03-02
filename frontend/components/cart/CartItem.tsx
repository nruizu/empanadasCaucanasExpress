"use client";

import type { Product } from "@/types/catalog";

interface Props {
  id: number;
  product: Product;
  quantity: number;
}

export default function CartItem({ id, product, quantity }: Props) {
  return (
    <div className="flex items-center justify-between border-b py-3">
      <div>
        <div className="font-semibold">{product.name}</div>
        <div className="text-sm text-gray-600">{product.category?.name ?? ''}</div>
      </div>
      <div className="text-right">
        <div>{quantity} × ${product.price}</div>
      </div>
    </div>
  );
}
