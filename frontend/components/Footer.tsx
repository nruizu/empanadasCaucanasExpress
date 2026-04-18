export default function Footer() {
  return (
    <footer className="bg-[var(--primary)] px-6 py-8 text-white">
      <div className="mx-auto max-w-6xl">
        <div className="mb-6 grid grid-cols-1 gap-8 md:grid-cols-2">
          <div>
            <h3 className="text-lg font-semibold">Empanadas Caucanas</h3>
            <p className="mt-3 text-sm text-white/80">
              Sabor tradicional colombiano desde 1972. Disfruta de nuestras empanadas,
              picadas y bebidas preparadas con recetas artesanales.
            </p>
          </div>

          <div>
            <h3 className="text-lg font-semibold">Contacto</h3>
            <div className="mt-3 space-y-2 text-sm text-white/80">
              <p>El Retiro, Antioquia, Colombia</p>
              <p>+57 300 123 4567</p>
              <p>Lun - Dom: 8:00 AM - 8:00 PM</p>
            </div>
          </div>
        </div>

        <div className="border-t border-white/20 pt-6 text-center text-xs text-white/70">
          <p>© 2026 Empanadas Caucanas. Todos los derechos reservados.</p>
          <p className="mt-1">Proyecto académico - Sistema de pedidos en línea</p>
        </div>
      </div>
    </footer>
  );
}
