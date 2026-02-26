"use client";

interface AddToCartButtonProps {
  productId: number;
  productName: string;
  onAdd?: (productId: number) => void;
}

export default function AddToCartButton({ productId, productName, onAdd }: AddToCartButtonProps) {
  const handleClick = () => {
    onAdd?.(productId);
    window.dispatchEvent(
      new CustomEvent("catalog:add-to-cart", {
        detail: { productId, productName },
      }),
    );
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      className="rounded-full bg-[var(--cce-mustard)] px-4 py-2 text-sm font-semibold text-[var(--cce-green-dark)] transition-colors hover:bg-[color-mix(in_srgb,var(--cce-mustard)_84%,black)]"
    >
      + Agregar
    </button>
  );
}
