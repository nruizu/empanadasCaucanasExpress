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
    comidas: "comidas.jpeg",
    "bebidas-calientes": "bebidaCaliente.jpg",
    "bebidas-frias": "bebidas_frias.jpg",
    "para-llevar": "/para-llevar.jpeg",
  };


  return (
    <button
      type="button"
      onClick={() => onSelect(category.slug)}
      className={`w-full overflow-hidden rounded-2xl bg-white text-left shadow-[0_8px_30px_rgba(31,77,58,0.09)] transition ${
        selected ? "ring-2 ring-[var(--cce-mustard)]" : "hover:-translate-y-0.5"
      }`}
      aria-pressed={selected}
    >
      <img
        src={category.image || CATEGORY_IMAGES[category.slug] || "/default.jpg"}
        alt={category.name}
        className="h-32 w-full object-cover"
      />
      <div className="p-3">
        <p className="text-sm font-bold text-[var(--cce-green-dark)]">{category.name}</p>
      </div>
    </button>
  );
}
