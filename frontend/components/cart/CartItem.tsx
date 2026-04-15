interface CartItemProps {
  id: number | string;
  product: {
    id: number;
    name: string;
    price: number | string;
  };
  quantity: number;
  onRemove: (cartProductId: number | string) => void;
  onUpdateQuantity: (cartProductId: number | string, quantity: number) => void;
}

export default function CartItem({
  id,
  product,
  quantity,
  onRemove,
  onUpdateQuantity,
}: CartItemProps) {
  const unitPrice = Number(product?.price ?? 0);

  return (
    <div className="flex items-center justify-between border-b py-3 gap-4">
      <div className="flex-1">
        <p className="font-medium">{product?.name}</p>
        <p className="text-sm text-gray-500">${product?.price}</p>
      </div>

      {/* Controles de cantidad */}
      <div className="flex items-center gap-2">
        <button
          onClick={() => onUpdateQuantity(id, quantity - 1)}
          disabled={quantity <= 1}
          className="px-2 py-1 border rounded disabled:opacity-40"
        >
          −
        </button>
        <span className="w-6 text-center">{quantity}</span>
        <button
          onClick={() => onUpdateQuantity(id, quantity + 1)}
          className="px-2 py-1 border rounded"
        >
          +
        </button>
      </div>

      {/* Subtotal */}
      <p className="w-20 text-right text-sm font-medium">
        ${(unitPrice * quantity).toFixed(0)}
      </p>

      {/* Eliminar */}
      <button
        onClick={() => onRemove(id)}
        className="text-red-400 hover:text-red-600 text-sm"
      >
        ✕
      </button>
    </div>
  );
}
