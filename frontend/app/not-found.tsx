import Link from "next/link";

export default function NotFound() {
  return (
    <main className="flex min-h-[60vh] flex-col items-center justify-center px-4 text-center">
      <h1 className="text-6xl font-bold text-[var(--cce-green-dark)]">404</h1>
      <p className="mt-4 text-lg text-gray-600">
        Pagina no encontrada
      </p>
      <p className="mt-2 text-sm text-gray-500">
        La ruta a la que intentas acceder no existe.
      </p>
      <Link
        href="/"
        className="mt-6 rounded bg-[var(--cce-green-dark)] px-6 py-2 text-sm font-semibold text-white hover:opacity-90"
      >
        Volver al inicio
      </Link>
    </main>
  );
}
