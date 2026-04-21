interface CartItemProps {
  id: number | string;
  product: any;
  quantity: number;
  onRemove: (cartProductId: number | string) => void;
  onUpdateQuantity: (cartProductId: number | string, quantity: number) => void;
}

export default function CartItem({ id, product, quantity, onRemove, onUpdateQuantity }: CartItemProps) {
  return (
    <div className="mb-3 rounded-xl border border-[color-mix(in_srgb,var(--primary)_12%,white)] bg-white p-4 shadow-sm">
      <div className="flex flex-wrap items-center gap-3">
        <div className="min-w-0 flex-1">
          <p className="truncate text-base font-semibold text-[var(--primary)]">{product?.name}</p>
          <p className="text-sm text-[var(--muted-foreground)]">${product?.price}</p>
        </div>

        <p className="order-2 w-full text-right text-sm font-semibold text-[var(--primary)] sm:order-none sm:w-24">
          ${(product?.price * quantity).toFixed(0)}
        </p>

        <button
          onClick={() => onRemove(id)}
          className="rounded-md px-2 py-1 text-sm text-red-500 transition-colors hover:bg-red-50 hover:text-red-700"
          aria-label={`Eliminar ${product?.name}`}
        >
          ✕
        </button>
      </div>

      <div className="mt-3 inline-flex items-center rounded-lg border border-[color-mix(in_srgb,var(--primary)_15%,white)] bg-[var(--background)]">
        <button
          onClick={() => onUpdateQuantity(id, quantity - 1)}
          disabled={quantity <= 1}
          className="rounded-l-lg px-3 py-1.5 text-sm font-semibold text-[var(--primary)] transition-colors hover:bg-[color-mix(in_srgb,var(--secondary)_22%,white)] disabled:opacity-40"
        >
          −
        </button>
        <span className="min-w-10 px-2 text-center text-sm font-semibold text-[var(--primary)]">{quantity}</span>
        <button
          onClick={() => onUpdateQuantity(id, quantity + 1)}
          className="rounded-r-lg px-3 py-1.5 text-sm font-semibold text-[var(--primary)] transition-colors hover:bg-[color-mix(in_srgb,var(--secondary)_22%,white)]"
        >
          +
        </button>
      </div>
    </div>
  );
}