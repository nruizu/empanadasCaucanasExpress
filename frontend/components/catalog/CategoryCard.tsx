import type { Category } from "@/types/catalog";

interface CategoryCardProps {
  category: Category;
  selected?: boolean;
  onSelect: (slug: string) => void;
}

export default function CategoryCard({ category, selected = false, onSelect }: CategoryCardProps) {


  const CATEGORY_IMAGES: Record<string, string> = {
    entradas: "/entradas.jpeg",
    desayunos: "/desayuno.jpeg",
    comidas: "/comidas.jpeg",
    "bebidas-calientes": "/bebidaCaliente.jpg",
    "bebidas-frias": "/bebidas_frias.jpg",
    "para-llevar": "/para-llevar.jpeg",
  };


  return (
    <button
      type="button"
      onClick={() => onSelect(category.slug)}
      className={`group relative h-40 w-full overflow-hidden rounded-xl text-left shadow-md transition-all duration-200 md:h-44 ${
        selected ? "ring-2 ring-[var(--secondary)]" : "hover:-translate-y-0.5 hover:shadow-xl"
      }`}
      aria-pressed={selected}
    >
      <img
        src={category.image || CATEGORY_IMAGES[category.slug] || "/default.jpg"}
        alt={category.name}
        className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
      />
      <div className="absolute inset-0 flex flex-col justify-end bg-gradient-to-t from-black/80 via-black/40 to-transparent p-4">
        <p className="text-lg font-semibold text-white">{category.name}</p>
        <p className="text-sm text-[var(--secondary)]">Explorar productos</p>
      </div>
    </button>
  );
}
