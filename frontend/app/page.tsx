import type { Metadata } from "next";

import CatalogPageClient from "@/components/catalog/CatalogPageClient";

export const metadata: Metadata = {
  title: "Catálogo | Empanadas Caucanas Express",
  description: "Catálogo de Empanadas Caucanas Express",
};

export default function CatalogPage() {
  return <CatalogPageClient />;
}
