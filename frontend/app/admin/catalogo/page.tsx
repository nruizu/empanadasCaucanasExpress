"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import useAuth from "@/context/AuthContext";
import { getCategories } from "@/lib/catalog-api";
import {
  createAdminProduct,
  deleteAdminProduct,
  getAdminProducts,
  updateAdminProduct,
  type ProductAdminPayload,
} from "@/lib/admin-catalog-api";
import type { Category, Product } from "@/types/catalog";

const API_IMG_BASE =
  process.env.NEXT_PUBLIC_API_URL?.replace(/\/api\/?$/, "") ??
  "http://localhost:8080";

interface ProductFormState {
  name: string;
  slug: string;
  description: string;
  price: string;
  is_featured: boolean;
  is_active: boolean;
  category_id: string;
  imageFile: File | null;
  removeImage: boolean;
  existingImage: string | null;
}

const INITIAL_FORM: ProductFormState = {
  name: "",
  slug: "",
  description: "",
  price: "",
  is_featured: false,
  is_active: true,
  category_id: "",
  imageFile: null,
  removeImage: false,
  existingImage: null,
};

const toPayload = (form: ProductFormState): ProductAdminPayload => {
  const payload: ProductAdminPayload = {
    name: form.name.trim(),
    slug: form.slug.trim(),
    description: form.description.trim(),
    price: form.price,
    is_featured: form.is_featured,
    is_active: form.is_active,
    category_id: Number(form.category_id),
  };
  if (form.imageFile) {
    payload.image = form.imageFile;
  } else if (form.removeImage) {
    payload.image = null;
  }
  return payload;
};

export default function AdminCatalogPage() {
  const router = useRouter();
  const { token, user } = useAuth();

  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [form, setForm] = useState<ProductFormState>(INITIAL_FORM);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const canAccess = useMemo(() => Boolean(token && user?.is_staff), [token, user]);

  const resetForm = () => {
    setForm(INITIAL_FORM);
    setEditingId(null);
  };

  const previewUrl = form.imageFile
    ? URL.createObjectURL(form.imageFile)
    : form.existingImage && !form.removeImage
      ? `${API_IMG_BASE}${form.existingImage}`
      : null;

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const [productsData, categoriesResponse] = await Promise.all([
        getAdminProducts(),
        getCategories(),
      ]);
      setProducts(productsData);
      setCategories(categoriesResponse);
    } catch (loadError) {
      console.error(loadError);
      setError("No se pudo cargar la gestión de productos.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!token) {
      router.replace("/login");
      return;
    }

    if (user && !user.is_staff) {
      router.replace("/catalogo");
      return;
    }

    if (canAccess) {
      void loadData();
    }
  }, [token, user, canAccess, loadData, router]);

  const handleFieldChange = (
    field: keyof ProductFormState,
    value: string | boolean,
  ) => {
    setForm((current) => ({ ...current, [field]: value }));
  };

  const handleEdit = (product: Product) => {
    setEditingId(product.id);
    setSuccess(null);
    setError(null);
    setForm({
      name: product.name,
      slug: product.slug,
      description: product.description ?? "",
      price: product.price,
      is_featured: product.is_featured,
      is_active: product.is_active ?? true,
      category_id: String(product.category.id),
      imageFile: null,
      removeImage: false,
      existingImage: product.image || null,
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const validateForm = () => {
    if (!form.name.trim() || !form.slug.trim() || !form.price.trim() || !form.category_id) {
      setError("Nombre, slug, precio y categoría son obligatorios.");
      return false;
    }

    const numericPrice = Number(form.price);
    if (Number.isNaN(numericPrice) || numericPrice <= 0) {
      setError("El precio debe ser un número mayor que 0.");
      return false;
    }

    return true;
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setSuccess(null);
    setError(null);

    if (!validateForm()) {
      return;
    }

    setSubmitting(true);

    try {
      const payload = toPayload(form);
      if (editingId) {
        await updateAdminProduct(editingId, payload);
        setSuccess("Producto actualizado correctamente.");
      } else {
        await createAdminProduct(payload);
        setSuccess("Producto creado correctamente.");
      }

      resetForm();
      await loadData();
    } catch (submitError: unknown) {
      console.error(submitError);
      if (submitError instanceof Error) {
        setError(submitError.message);
      } else {
        setError("No fue posible guardar el producto.");
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (productId: number) => {
    const accepted = window.confirm("¿Seguro que deseas eliminar este producto?");
    if (!accepted) {
      return;
    }

    setSuccess(null);
    setError(null);

    try {
      await deleteAdminProduct(productId);
      setSuccess("Producto eliminado correctamente.");
      if (editingId === productId) {
        resetForm();
      }
      await loadData();
    } catch (deleteError: unknown) {
      console.error(deleteError);
      if (deleteError instanceof Error) {
        setError(deleteError.message);
      } else {
        setError("No fue posible eliminar el producto.");
      }
    }
  };

  if (!token || !canAccess) {
    return (
      <main className="min-h-screen bg-[var(--cce-beige)] px-4 py-8 md:px-8">
        <div className="mx-auto max-w-5xl rounded-xl bg-white p-6 text-center text-[var(--cce-text-muted)] shadow-[0_8px_30px_rgba(31,77,58,0.09)]">
          Verificando permisos...
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[var(--cce-beige)] px-4 py-8 md:px-8">
      <div className="mx-auto max-w-5xl space-y-6">
        <section className="rounded-xl bg-white p-6 shadow-[0_8px_30px_rgba(31,77,58,0.09)]">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h1 className="text-2xl font-bold text-[var(--cce-green-dark)]">Gestión de catálogo</h1>
              <p className="mt-1 text-sm text-[var(--cce-text-muted)]">
                Crea, edita y elimina productos visibles para clientes.
              </p>
            </div>
            <Link
              href="/admin/horarios"
              className="rounded-full border border-[var(--cce-green-dark)] px-4 py-2 text-sm font-semibold text-[var(--cce-green-dark)]"
            >
              Ir a gestión de horarios
            </Link>
          </div>

          {error && (
            <div className="mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {error}
            </div>
          )}

          {success && (
            <div className="mt-4 rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">
              {success}
            </div>
          )}

          <form onSubmit={handleSubmit} className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2">
            <input
              value={form.name}
              onChange={(event) => handleFieldChange("name", event.target.value)}
              placeholder="Nombre"
              className="rounded-lg border border-[color-mix(in_srgb,var(--cce-green-dark)_20%,white)] px-3 py-2 outline-none focus:border-[var(--cce-green-dark)]"
            />

            <input
              value={form.slug}
              onChange={(event) => handleFieldChange("slug", event.target.value)}
              placeholder="Slug"
              className="rounded-lg border border-[color-mix(in_srgb,var(--cce-green-dark)_20%,white)] px-3 py-2 outline-none focus:border-[var(--cce-green-dark)]"
            />

            <input
              value={form.price}
              onChange={(event) => handleFieldChange("price", event.target.value)}
              placeholder="Precio"
              type="number"
              min="0"
              step="0.01"
              className="rounded-lg border border-[color-mix(in_srgb,var(--cce-green-dark)_20%,white)] px-3 py-2 outline-none focus:border-[var(--cce-green-dark)]"
            />

            <select
              value={form.category_id}
              onChange={(event) => handleFieldChange("category_id", event.target.value)}
              className="rounded-lg border border-[color-mix(in_srgb,var(--cce-green-dark)_20%,white)] px-3 py-2 outline-none focus:border-[var(--cce-green-dark)]"
            >
              <option value="">Selecciona una categoría</option>
              {categories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </select>

            <textarea
              value={form.description}
              onChange={(event) => handleFieldChange("description", event.target.value)}
              placeholder="Descripción"
              rows={4}
              className="md:col-span-2 rounded-lg border border-[color-mix(in_srgb,var(--cce-green-dark)_20%,white)] px-3 py-2 outline-none focus:border-[var(--cce-green-dark)]"
            />

            <div className="md:col-span-2 space-y-2">
              <p className="text-sm font-medium text-[var(--cce-green-dark)]">Imagen del producto</p>

              {previewUrl ? (
                <div className="relative inline-block">
                  <img
                    src={previewUrl}
                    alt="Vista previa"
                    className="h-32 w-32 rounded-lg border border-gray-200 object-cover"
                  />
                  <button
                    type="button"
                    onClick={() =>
                      setForm((prev) => ({
                        ...prev,
                        imageFile: null,
                        removeImage: true,
                      }))
                    }
                    className="absolute -right-2 -top-2 flex h-6 w-6 items-center justify-center rounded-full bg-red-500 text-xs text-white hover:bg-red-600"
                    title="Quitar imagen"
                  >
                    &times;
                  </button>
                </div>
              ) : (
                <div className="flex h-32 w-32 items-center justify-center rounded-lg border-2 border-dashed border-gray-300 bg-gray-50 text-xs text-gray-400">
                  Sin imagen
                </div>
              )}

              <label className="inline-flex cursor-pointer items-center gap-2 rounded-full border border-[var(--cce-green-dark)] px-4 py-1.5 text-sm font-semibold text-[var(--cce-green-dark)] hover:bg-[var(--cce-green-dark)] hover:text-white">
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0] || null;
                    setForm((prev) => ({
                      ...prev,
                      imageFile: file,
                      removeImage: false,
                    }));
                  }}
                />
                {form.imageFile ? "Cambiar imagen" : "Subir imagen"}
              </label>
            </div>

            <label className="flex items-center gap-2 text-sm text-[var(--cce-green-dark)]">
              <input
                type="checkbox"
                checked={form.is_featured}
                onChange={(event) => handleFieldChange("is_featured", event.target.checked)}
              />
              Producto destacado
            </label>

            <label className="flex items-center gap-2 text-sm text-[var(--cce-green-dark)]">
              <input
                type="checkbox"
                checked={form.is_active}
                onChange={(event) => handleFieldChange("is_active", event.target.checked)}
              />
              Producto activo
            </label>

            <div className="md:col-span-2 flex flex-wrap gap-2">
              <button
                type="submit"
                disabled={submitting}
                className="rounded-full bg-[var(--cce-green-dark)] px-5 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
              >
                {submitting ? "Guardando..." : editingId ? "Actualizar producto" : "Crear producto"}
              </button>

              {editingId && (
                <button
                  type="button"
                  onClick={resetForm}
                  className="rounded-full border border-[var(--cce-green-dark)] px-5 py-2 text-sm font-semibold text-[var(--cce-green-dark)]"
                >
                  Cancelar edición
                </button>
              )}
            </div>
          </form>
        </section>

        <section className="rounded-xl bg-white p-6 shadow-[0_8px_30px_rgba(31,77,58,0.09)]">
          <h2 className="text-xl font-bold text-[var(--cce-green-dark)]">Productos existentes</h2>

          {loading ? (
            <p className="mt-4 text-sm text-[var(--cce-text-muted)]">Cargando productos...</p>
          ) : products.length === 0 ? (
            <p className="mt-4 text-sm text-[var(--cce-text-muted)]">No hay productos para mostrar.</p>
          ) : (
            <div className="mt-4 overflow-x-auto">
              <table className="min-w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-[color-mix(in_srgb,var(--cce-green-dark)_15%,white)] text-[var(--cce-green-dark)]">
                    <th className="px-3 py-2">Nombre</th>
                    <th className="px-3 py-2">Slug</th>
                    <th className="px-3 py-2">Precio</th>
                    <th className="px-3 py-2">Categoría</th>
                    <th className="px-3 py-2">Estado</th>
                    <th className="px-3 py-2">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {products.map((product) => (
                    <tr key={product.id} className="border-b border-[color-mix(in_srgb,var(--cce-green-dark)_10%,white)]">
                      <td className="px-3 py-2">{product.name}</td>
                      <td className="px-3 py-2">{product.slug}</td>
                      <td className="px-3 py-2">${product.price}</td>
                      <td className="px-3 py-2">{product.category.name}</td>
                      <td className="px-3 py-2">{product.is_active ? "Activo" : "Inactivo"}</td>
                      <td className="px-3 py-2">
                        <div className="flex gap-2">
                          <button
                            type="button"
                            onClick={() => handleEdit(product)}
                            className="rounded-full border border-[var(--cce-green-dark)] px-3 py-1 text-xs font-semibold text-[var(--cce-green-dark)]"
                          >
                            Editar
                          </button>
                          <button
                            type="button"
                            onClick={() => void handleDelete(product.id)}
                            className="rounded-full border border-red-300 px-3 py-1 text-xs font-semibold text-red-700"
                          >
                            Eliminar
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
