"use client";

interface AddToCartButtonProps {
  productId: number;
  productName: string;
  onAdd?: (productId: number, productName: string) => void;
}

export default function AddToCartButton({
  productId,
  productName,
  onAdd,
}: AddToCartButtonProps) {
  const handleClick = () => {
    onAdd?.(productId, productName); // 👈 agregar productName
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      className="rounded-lg bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-[var(--accent-foreground)] shadow-sm transition-colors hover:bg-[color-mix(in_srgb,var(--accent)_88%,black)] hover:shadow-md"
    >
      Agregar
    </button>
  );
}
