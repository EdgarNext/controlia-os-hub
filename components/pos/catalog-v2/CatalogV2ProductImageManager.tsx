"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ImagePlus, Search, Sparkles, Upload } from "lucide-react";
import { saveCatalogV2ProductImageAction } from "@/actions/pos/catalog-v2.actions";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { StatePanel } from "@/components/ui/state-panel";
import { getPublicCatalogImageUrl } from "@/lib/pos/catalog/images";
import { cn } from "@/lib/utils";
import { getCatalogV2ProductDetailPath } from "@/lib/pos/catalog-v2/paths";
import type { PosCatalogCategoryListItem } from "@/types/pos-catalog";
import type { PosCatalogV2ProductListItem } from "@/types/pos-catalog-v2";

type CatalogV2ProductImageManagerProps = {
  tenantSlug: string;
  canManage: boolean;
  categories: PosCatalogCategoryListItem[];
  products: PosCatalogV2ProductListItem[];
};

function formatMoneyFromCents(cents?: number | null): string {
  if (typeof cents !== "number") {
    return "-";
  }

  return new Intl.NumberFormat("es-MX", {
    style: "currency",
    currency: "MXN",
    minimumFractionDigits: 2,
  }).format(cents / 100);
}

function getProductStatusLabel(product: PosCatalogV2ProductListItem): string {
  if (product.deleted_at) {
    return "Archivado";
  }

  if (!product.is_active) {
    return "Inactivo";
  }

  return product.image_path ? "Con imagen" : "Sin imagen";
}

export function CatalogV2ProductImageManager({
  tenantSlug,
  canManage,
  categories,
  products,
}: CatalogV2ProductImageManagerProps) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [query, setQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(products[0]?.id ?? null);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [pendingPreviewUrl, setPendingPreviewUrl] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const activeCategories = useMemo(
    () => categories.filter((category) => category.deleted_at == null),
    [categories],
  );

  const categoryNameById = useMemo(() => {
    return new Map(categories.map((category) => [category.id, category.name]));
  }, [categories]);

  const activeProducts = useMemo(() => {
    return products.filter((product) => product.deleted_at == null);
  }, [products]);

  const filteredProducts = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();

    return activeProducts.filter((product) => {
      if (categoryFilter && product.category_id !== categoryFilter) {
        return false;
      }

      if (normalizedQuery && !product.name.toLowerCase().includes(normalizedQuery)) {
        return false;
      }

      return true;
    });
  }, [activeProducts, categoryFilter, query]);

  const selectedProduct = useMemo(() => {
    return filteredProducts.find((product) => product.id === selectedId) ?? filteredProducts[0] ?? null;
  }, [filteredProducts, selectedId]);

  useEffect(() => {
    return () => {
      if (pendingPreviewUrl) {
        URL.revokeObjectURL(pendingPreviewUrl);
      }
    };
  }, [pendingPreviewUrl]);

  const currentImageUrl = useMemo(() => {
    return getPublicCatalogImageUrl(selectedProduct?.image_path ?? null);
  }, [selectedProduct?.image_path]);

  const imagePreviewUrl = pendingPreviewUrl || currentImageUrl;
  const isBlobPreview = imagePreviewUrl.startsWith("blob:");

  function resetPendingImage() {
    setPendingFile(null);
    setPendingPreviewUrl("");
    if (inputRef.current) {
      inputRef.current.value = "";
    }
  }

  function handleSelectProduct(productId: string) {
    setSelectedId(productId);
    setError(null);
    resetPendingImage();
  }

  function handleImageChange(file: File | null) {
    setPendingFile(file);
    setError(null);

    setPendingPreviewUrl((previousPreviewUrl) => {
      if (previousPreviewUrl) {
        URL.revokeObjectURL(previousPreviewUrl);
      }

      return file ? URL.createObjectURL(file) : "";
    });
  }

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!canManage) {
      setError("No tienes permisos para asignar imágenes en este tenant.");
      return;
    }

    if (!selectedProduct) {
      setError("Selecciona un producto.");
      return;
    }

    if (!pendingFile) {
      setError("Selecciona una imagen antes de guardar.");
      return;
    }

    const formData = new FormData();
    formData.set("tenantSlug", tenantSlug);
    formData.set("productId", selectedProduct.id);
    formData.set("image", pendingFile);

    startTransition(async () => {
      const result = await saveCatalogV2ProductImageAction(formData);
      if (!result.ok) {
        setError(result.error ?? "No se pudo guardar la imagen.");
        return;
      }

      setError(null);
      resetPendingImage();
      router.refresh();
    });
  }

  const totalCount = activeProducts.length;
  const withImageCount = activeProducts.filter((product) => Boolean(product.image_path)).length;
  const withoutImageCount = Math.max(totalCount - withImageCount, 0);

  if (totalCount === 0) {
    return (
      <StatePanel
        kind="empty"
        title="Todavía no hay productos"
        message="Crea productos primero para poder asignarles imágenes desde esta pantalla."
      >
        <div className="mt-3 flex flex-wrap gap-2">
          <Link
            href={`/${tenantSlug}/pos/catalog-v2/products/new`}
            className="inline-flex items-center justify-center rounded-[var(--radius-base)] border border-border bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-opacity duration-200 hover:opacity-90"
          >
            Crear producto
          </Link>
        </div>
      </StatePanel>
    );
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-3 md:grid-cols-3">
        <Card className="border-border/80 bg-surface p-4">
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-muted">Productos activos</p>
          <p className="mt-2 text-2xl font-semibold text-foreground">{totalCount}</p>
          <p className="text-sm text-muted">Lista completa para gestión visual de imágenes.</p>
        </Card>
        <Card className="border-border/80 bg-surface p-4">
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-muted">Con imagen</p>
          <p className="mt-2 text-2xl font-semibold text-foreground">{withImageCount}</p>
          <p className="text-sm text-muted">Productos que ya están listos visualmente.</p>
        </Card>
        <Card className="border-border/80 bg-surface p-4">
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-muted">Pendientes</p>
          <p className="mt-2 text-2xl font-semibold text-foreground">{withoutImageCount}</p>
          <p className="text-sm text-muted">Aún necesitan una imagen en el catálogo.</p>
        </Card>
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.45fr)_minmax(340px,0.85fr)]">
        <Card className="space-y-4 border-border/80 bg-surface p-4">
          <div className="space-y-1">
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-muted">Lista completa</p>
            <h2 className="text-lg font-semibold text-foreground">Selecciona el producto a ilustrar</h2>
            <p className="text-sm text-muted">
              Busca rápido, selecciona la tarjeta y sube o reemplaza la imagen sin salir de esta pantalla.
            </p>
          </div>

          <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_220px]">
            <label className="relative block">
              <span className="sr-only">Buscar producto</span>
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
              <Input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Buscar por nombre..."
                className="pl-9"
              />
            </label>

            <select
              value={categoryFilter}
              onChange={(event) => setCategoryFilter(event.target.value)}
              className="h-10 rounded-[var(--radius-base)] border border-border bg-surface-2 px-3 text-sm text-foreground"
            >
              <option value="">Todas las categorías</option>
              {activeCategories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </select>
          </div>

          <div className="overflow-hidden rounded-[var(--radius-base)] border border-border">
            <div className="max-h-[68vh] overflow-auto">
              <table className="w-full text-left text-sm">
                <thead className="sticky top-0 z-10 bg-surface-2 text-xs uppercase tracking-[0.08em] text-muted">
                  <tr>
                    <th className="px-4 py-3 font-semibold">Imagen</th>
                    <th className="px-4 py-3 font-semibold">Producto</th>
                    <th className="px-4 py-3 font-semibold">Categoría</th>
                    <th className="px-4 py-3 font-semibold">Precio</th>
                    <th className="px-4 py-3 font-semibold">Estado</th>
                    <th className="px-4 py-3 font-semibold">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredProducts.map((product) => {
                    const isSelected = product.id === selectedProduct?.id;
                    const imageUrl = getPublicCatalogImageUrl(product.image_path);

                    return (
                      <tr
                        key={product.id}
                        className={cn(
                          "border-t border-border transition-colors",
                          isSelected ? "bg-primary/5" : "hover:bg-surface-2/70",
                        )}
                      >
                        <td className="px-4 py-3">
                          {imageUrl ? (
                            <Image
                              src={imageUrl}
                              alt={`Imagen de ${product.name}`}
                              width={56}
                              height={56}
                              className="h-14 w-14 rounded-[var(--radius-base)] border border-border object-cover"
                              unoptimized
                            />
                          ) : (
                            <div className="flex h-14 w-14 items-center justify-center rounded-[var(--radius-base)] border border-border bg-surface-2 text-muted">
                              <ImagePlus className="h-5 w-5" />
                            </div>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <p className="font-medium text-foreground">{product.name}</p>
                          <p className="text-xs text-muted">
                            {product.product_type} · {product.class === "drink" ? "Bebida" : "Alimento"}
                          </p>
                        </td>
                        <td className="px-4 py-3 text-muted">
                          {product.category_id ? categoryNameById.get(product.category_id) ?? "Sin categoría" : "Sin categoría"}
                        </td>
                        <td className="px-4 py-3 text-muted">{formatMoneyFromCents(product.base_price_cents)}</td>
                        <td className="px-4 py-3">
                          <span className="rounded-full border border-border bg-surface-2 px-2.5 py-1 text-xs font-medium text-foreground">
                            {getProductStatusLabel(product)}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex flex-wrap gap-2">
                            <button
                              type="button"
                              onClick={() => handleSelectProduct(product.id)}
                              className={cn(
                                "inline-flex items-center justify-center rounded-[var(--radius-base)] border px-3 py-1.5 text-xs font-medium transition-opacity hover:opacity-90",
                                isSelected
                                  ? "border-primary bg-primary text-primary-foreground"
                                  : "border-border bg-surface-2 text-foreground",
                              )}
                            >
                              Seleccionar
                            </button>
                            <Link
                              href={getCatalogV2ProductDetailPath(tenantSlug, product.id)}
                              className="inline-flex items-center justify-center rounded-[var(--radius-base)] border border-border bg-surface-2 px-3 py-1.5 text-xs font-medium text-foreground transition-opacity hover:opacity-90"
                            >
                              Abrir detalle
                            </Link>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </Card>

        <Card className="space-y-4 border-border/80 bg-surface p-4 xl:sticky xl:top-4 xl:self-start">
          <div className="space-y-1">
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-muted">Imagen seleccionada</p>
            <h2 className="text-lg font-semibold text-foreground">
              {selectedProduct ? selectedProduct.name : "Selecciona un producto"}
            </h2>
            <p className="text-sm text-muted">
              {selectedProduct
                ? "Vista previa, reemplazo y guardado rápido desde aquí."
                : "Usa la lista para escoger el producto que quieras ilustrar."}
            </p>
          </div>

          {selectedProduct ? (
            <>
              <div className="rounded-[var(--radius-base)] border border-border bg-surface-2 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="space-y-1">
                    <p className="text-sm font-medium text-foreground">{selectedProduct.name}</p>
                    <p className="text-xs text-muted">
                      {selectedProduct.category_id
                        ? categoryNameById.get(selectedProduct.category_id) ?? "Sin categoría"
                        : "Sin categoría"}
                    </p>
                    <p className="text-xs text-muted">{formatMoneyFromCents(selectedProduct.base_price_cents)}</p>
                  </div>
                  <span className="rounded-full border border-border bg-surface px-2.5 py-1 text-xs font-medium text-foreground">
                    {getProductStatusLabel(selectedProduct)}
                  </span>
                </div>

                <div className="mt-4 overflow-hidden rounded-[var(--radius-base)] border border-border bg-surface">
                  {imagePreviewUrl ? (
                    isBlobPreview ? (
                      // Local blob preview: usamos img porque Next/Image no es ideal para URLs temporales de archivo.
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={imagePreviewUrl}
                        alt={`Imagen de ${selectedProduct.name}`}
                        className="h-64 w-full object-cover"
                      />
                    ) : (
                      <Image
                        src={imagePreviewUrl}
                        alt={`Imagen de ${selectedProduct.name}`}
                        width={640}
                        height={480}
                        className="h-64 w-full object-cover"
                        unoptimized
                      />
                    )
                  ) : (
                    <div className="flex h-64 flex-col items-center justify-center gap-3 px-6 text-center text-muted">
                      <div className="flex h-16 w-16 items-center justify-center rounded-full border border-border bg-surface-2">
                        <Sparkles className="h-7 w-7" />
                      </div>
                      <p className="text-sm">Sin imagen asignada todavía.</p>
                    </div>
                  )}
                </div>
              </div>

              {canManage ? (
                <form onSubmit={handleSubmit} className="space-y-3">
                  <div className="space-y-2">
                    <Label className="text-sm text-muted">Nueva imagen</Label>
                    <input
                      key={`${selectedProduct.id}-${pendingFile ? "file" : "empty"}`}
                      ref={inputRef}
                      type="file"
                      accept="image/*"
                      onChange={(event) => handleImageChange(event.target.files?.[0] ?? null)}
                      className="w-full rounded-[var(--radius-base)] border border-border bg-surface-2 px-3 py-2 text-sm"
                    />
                    <p className="text-xs text-muted">
                      La imagen se guarda en el bucket público de catálogo y se replica en la vista del producto.
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    <Button type="submit" isLoading={isPending} className="inline-flex items-center gap-2">
                      <Upload className="h-4 w-4" />
                      Guardar imagen
                    </Button>
                    <button
                      type="button"
                      onClick={() => handleSelectProduct(selectedProduct.id)}
                      className="inline-flex items-center justify-center rounded-[var(--radius-base)] border border-border bg-surface-2 px-4 py-2 text-sm font-medium text-foreground transition-opacity hover:opacity-90"
                    >
                      Limpiar archivo
                    </button>
                  </div>

                  {error ? (
                    <p className="rounded-[var(--radius-base)] border border-danger/40 bg-danger-soft px-3 py-2 text-sm text-danger">
                      {error}
                    </p>
                  ) : null}
                </form>
              ) : (
                <StatePanel kind="permission" title="Solo lectura" message="No tienes permisos para asignar imágenes.">
                  <p className="text-xs text-muted">
                    Puedes revisar el estado visual de los productos, pero para cargar imágenes necesitas permisos de
                    manejo del catálogo.
                  </p>
                </StatePanel>
              )}
            </>
          ) : (
            <StatePanel
              kind="empty"
              title="Sin selección"
              message="Selecciona un producto desde la lista para ver y reemplazar su imagen."
            />
          )}
        </Card>
      </div>
    </div>
  );
}
