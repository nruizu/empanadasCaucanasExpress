"use client";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main className="flex min-h-[60vh] flex-col items-center justify-center px-4 text-center">
      <h1 className="text-6xl font-bold text-red-600">500</h1>
      <p className="mt-4 text-lg text-gray-600">
        Error interno del servidor
      </p>
      <p className="mt-2 text-sm text-gray-500">
        Ocurrio un error inesperado. Intenta de nuevo.
      </p>
      <button
        type="button"
        onClick={reset}
        className="mt-6 rounded bg-[var(--cce-green-dark)] px-6 py-2 text-sm font-semibold text-white hover:opacity-90"
      >
        Reintentar
      </button>
    </main>
  );
}
