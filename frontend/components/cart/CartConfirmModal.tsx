"use client";

import { useEffect } from "react";

interface Props {
  productName: string;
  onClose: () => void;
  onGoToCart: () => void;
}

export default function CartConfirmModal({ productName, onClose, onGoToCart }: Props) {
  // Cerrar con Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center"
      >
        {/* Modal — stopPropagation para que el click adentro no cierre */}
        <div
          onClick={(e) => e.stopPropagation()}
          className="bg-white rounded-2xl shadow-xl p-6 w-80 flex flex-col items-center gap-4 z-51"
        >
          {/* Ícono check */}
          <div className="h-14 w-14 rounded-full bg-green-100 flex items-center justify-center">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          </div>

          <div className="text-center">
            <p className="font-semibold text-gray-800 text-base">¡Agregado al carrito!</p>
            <p className="text-sm text-gray-500 mt-1 line-clamp-1">{productName}</p>
          </div>

          <div className="flex gap-3 w-full">
            <button
              onClick={onClose}
              className="flex-1 py-2 rounded-lg border border-gray-300 text-sm font-medium text-gray-700 hover:bg-gray-50 transition"
            >
              Seguir comprando
            </button>
            <button
              onClick={onGoToCart}
              className="flex-1 py-2 rounded-lg bg-[var(--cce-green-dark)] text-white text-sm font-medium hover:opacity-90 transition"
            >
              Ver carrito
            </button>
          </div>
        </div>
      </div>
    </>
  );
}