"use client";

import Image from "next/image";
import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  Archive,
  Check,
  ImagePlus,
  Pencil,
  Power,
  Star,
  StarOff,
  X,
} from "lucide-react";
import {
  archiveProductInlineAction,
  createProductInlineAction,
  restoreProductInlineAction,
  updateProductFlagsInlineAction,
  updateProductInlineAction,
} from "@/actions/pos/catalog/products.actions";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { StatePanel } from "@/components/ui/state-panel";
import { getPublicCatalogImageUrl } from "@/lib/pos/catalog/images";
import { cn } from "@/lib/utils";
import type {
  PosCatalogCategoryListItem,
  PosCatalogProductListItem,
} from "@/types/pos-catalog";

type ProductDraft = {
  name: string;
  category_id: string;
  class: "food" | "drink";
  price: string;
  is_active: boolean;
};

function formatDateTime(value?: string | null): string {
  if (!value) {
    return "-";
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return "-";
  }

  return parsed.toLocaleString("es-MX");
}

function formatMoneyFromCents(cents: number): string {
  return new Intl.NumberFormat("es-MX", {
    style: "currency",
    currency: "MXN",
    minimumFractionDigits: 2,
  }).format(cents / 100);
}

function toDraft(item?: PosCatalogProductListItem | null): ProductDraft {
  if (!item) {
    return {
      name: "",
      category_id: "",
      class: "food",
      price: "0.00",
      is_active: true,
    };
  }

  return {
    name: item.name,
    category_id: item.category_id ?? "",
    class: item.class === "drink" ? "drink" : "food",
    price: (item.price_cents / 100).toFixed(2),
    is_active: item.is_active,
  };
}

function StatusBadge({ label, className }: { label: string; className: string }) {
  return (
    <span className={cn("rounded-full border px-2 py-0.5 text-[11px] font-medium", className)}>
      {label}
    </span>
  );
}

type ProductListProps = {
  products: PosCatalogProductListItem[];
  categories: PosCatalogCategoryListItem[];
  tenantSlug: string;
};

export function ProductList({ products, categories, tenantSlug }: ProductListProps) {
  const router = useRouter();
  const imageInputRef = useRef<HTMLInputElement | null>(null);
  const [query, setQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [showArchived, setShowArchived] = useState(false);
  const [mode, setMode] = useState<"view" | "edit" | "create">("view");
  const [selectedId, setSelectedId] = useState<string | null>(products[0]?.id ?? null);
  const [draft, setDraft] = useState<ProductDraft>(toDraft(products[0] ?? null));
  const [selectedImageFile, setSelectedImageFile] = useState<File | null>(null);
  const [selectedImagePreviewUrl, setSelectedImagePreviewUrl] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const [confirmArchive, setConfirmArchive] = useState(false);
  const [isPending, startTransition] = useTransition();

  const categoryOptions = useMemo(
    () => categories.filter((category) => category.deleted_at == null),
    [categories],
  );

  const categoryNameById = useMemo(() => {
    return new Map(categories.map((category) => [category.id, category.name]));
  }, [categories]);

  const filteredProducts = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();

    return products.filter((product) => {
      if (!showArchived && product.deleted_at) {
        return false;
      }

      if (categoryFilter && product.category_id !== categoryFilter) {
        return false;
      }

      if (normalizedQuery && !product.name.toLowerCase().includes(normalizedQuery)) {
        return false;
      }

      return true;
    });
  }, [products, query, categoryFilter, showArchived]);

  const selectedProduct = useMemo(() => {
    const found = filteredProducts.find((product) => product.id === selectedId);
    return found ?? filteredProducts[0] ?? null;
  }, [filteredProducts, selectedId]);

  const currentImageUrl = useMemo(() => {
    return getPublicCatalogImageUrl(selectedProduct?.image_path ?? null);
  }, [selectedProduct?.image_path]);

  useEffect(() => {
    return () => {
      if (selectedImagePreviewUrl) {
        URL.revokeObjectURL(selectedImagePreviewUrl);
      }
    };
  }, [selectedImagePreviewUrl]);

  function updateSelectedImage(file: File | null) {
    setSelectedImagePreviewUrl((previousPreviewUrl) => {
      if (previousPreviewUrl) {
        URL.revokeObjectURL(previousPreviewUrl);
      }

      return file ? URL.createObjectURL(file) : "";
    });
    setSelectedImageFile(file);
  }

  function openImagePicker() {
    imageInputRef.current?.click();
  }

  function openCreateMode() {
    setMode("create");
    setFormError(null);
    setConfirmArchive(false);
    updateSelectedImage(null);
    setDraft(toDraft(null));
  }

  function openEditMode() {
    if (!selectedProduct) {
      return;
    }

    setMode("edit");
    setFormError(null);
    setConfirmArchive(false);
    updateSelectedImage(null);
    setDraft(toDraft(selectedProduct));
  }

  function openViewMode(productId: string) {
    const found = products.find((product) => product.id === productId) ?? null;
    setSelectedId(productId);
    setMode("view");
    setFormError(null);
    setConfirmArchive(false);
    updateSelectedImage(null);
    setDraft(toDraft(found));
  }

  function updateDraft<K extends keyof ProductDraft>(key: K, value: ProductDraft[K]) {
    setDraft((current) => ({ ...current, [key]: value }));
  }

  function buildProductFormData(productId?: string): FormData {
    const formData = new FormData();
    formData.set("tenantSlug", tenantSlug);
    formData.set("name", draft.name);
    formData.set("price", draft.price);
    formData.set("category_id", draft.category_id);
    formData.set("class", draft.class);
    if (draft.is_active) {
      formData.set("is_active", "on");
    }
    if (productId) {
      formData.set("productId", productId);
    }
    if (selectedImageFile) {
      formData.set("image", selectedImageFile);
    }
    return formData;
  }

  function handleSave() {
    if (mode === "create") {
      startTransition(async () => {
        const result = await createProductInlineAction(buildProductFormData());
        if (!result.ok) {
          setFormError(result.error ?? "No se pudo crear el producto.");
          return;
        }

        setFormError(null);
        setMode("view");
        updateSelectedImage(null);
        setQuery("");
        setCategoryFilter("");
        router.refresh();
      });
      return;
    }

    if (mode === "edit" && selectedProduct) {
      startTransition(async () => {
        const result = await updateProductInlineAction(buildProductFormData(selectedProduct.id));
        if (!result.ok) {
          setFormError(result.error ?? "No se pudo actualizar el producto.");
          return;
        }

        setFormError(null);
        setMode("view");
        updateSelectedImage(null);
        router.refresh();
      });
    }
  }

  function handleArchiveOrRestore(product: PosCatalogProductListItem) {
    startTransition(async () => {
      const formData = new FormData();
      formData.set("tenantSlug", tenantSlug);
      formData.set("productId", product.id);

      const result = product.deleted_at
        ? await restoreProductInlineAction(formData)
        : await archiveProductInlineAction(formData);

      if (!result.ok) {
        setFormError(result.error ?? "No se pudo actualizar el estado del producto.");
        return;
      }

      setConfirmArchive(false);
      setFormError(null);
      setMode("view");
      router.refresh();
    });
  }

  function handleFlagsUpdate(product: PosCatalogProductListItem, values: {
    is_active: boolean;
    is_sold_out: boolean;
    is_popular: boolean;
  }) {
    startTransition(async () => {
      const formData = new FormData();
      formData.set("tenantSlug", tenantSlug);
      formData.set("productId", product.id);
      if (values.is_active) {
        formData.set("is_active", "on");
      }
      if (values.is_sold_out) {
        formData.set("is_sold_out", "on");
      }
      if (values.is_popular) {
        formData.set("is_popular", "on");
      }

      const result = await updateProductFlagsInlineAction(formData);
      if (!result.ok) {
        setFormError(result.error ?? "No se pudo actualizar el producto.");
        return;
      }

      setFormError(null);
      router.refresh();
    });
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(280px,360px)_1fr]">
      <Card className="space-y-4 p-4">
        <div className="flex items-center justify-between gap-2">
          <div>
            <p className="text-sm font-semibold text-foreground">Productos</p>
            <p className="text-xs text-muted">{filteredProducts.length} resultados</p>
          </div>
          <Button type="button" variant="secondary" onClick={openCreateMode}>
            Agregar
          </Button>
        </div>

        <Input
          placeholder="Buscar por nombre"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />

        <div className="space-y-1">
          <Label htmlFor="category-filter">Categoría</Label>
          <select
            id="category-filter"
            value={categoryFilter}
            onChange={(event) => setCategoryFilter(event.target.value)}
            className="h-11 w-full rounded-[var(--radius-base)] border border-border bg-surface-2 px-3 text-sm text-foreground outline-none transition-colors focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/30"
          >
            <option value="">Todas</option>
            {categoryOptions.map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
          </select>
        </div>

        <label className="flex items-center gap-2 text-xs text-muted">
          <input
            type="checkbox"
            checked={showArchived}
            onChange={(event) => setShowArchived(event.target.checked)}
            className="h-4 w-4 accent-primary"
          />
          Ver archivados
        </label>

        {filteredProducts.length === 0 ? (
          <StatePanel
            kind="empty"
            title="Sin coincidencias"
            message="Ajusta los filtros para encontrar productos."
          />
        ) : (
          <div className="space-y-2">
            {filteredProducts.map((product) => (
              <button
                key={product.id}
                type="button"
                onClick={() => openViewMode(product.id)}
                aria-current={selectedProduct?.id === product.id ? "true" : undefined}
                className={cn(
                  "relative w-full rounded-md border px-3 py-2 text-left transition-colors duration-120",
                  selectedProduct?.id === product.id
                    ? "border-border bg-[var(--nav-item-active)]"
                    : "border-transparent hover:border-border hover:bg-surface-2",
                  product.deleted_at && "opacity-70",
                )}
              >
                {selectedProduct?.id === product.id ? (
                  <span className="absolute inset-y-1 left-0 w-1 rounded-r bg-primary" aria-hidden="true" />
                ) : null}
                <p
                  className={cn(
                    "truncate pr-2 text-sm text-foreground",
                    selectedProduct?.id === product.id ? "font-semibold" : "font-medium",
                  )}
                >
                  {product.name}
                </p>
                <p className="text-xs text-muted">{formatMoneyFromCents(product.price_cents)}</p>
                <div className="mt-1.5 flex flex-wrap gap-1">
                  {product.is_sold_out ? (
                    <StatusBadge
                      label="Agotado"
                      className="border-warning/40 bg-warning/15 text-warning"
                    />
                  ) : null}
                  {!product.is_active ? (
                    <StatusBadge
                      label="Inactivo"
                      className="border-border bg-surface text-muted"
                    />
                  ) : null}
                  {product.is_popular ? (
                    <StatusBadge
                      label="Popular"
                      className="border-success/40 bg-success-soft text-success"
                    />
                  ) : null}
                </div>
              </button>
            ))}
          </div>
        )}
      </Card>

      <Card className="space-y-4 p-4">
        {formError ? (
          <p className="rounded-[var(--radius-base)] border border-danger/40 bg-danger-soft px-3 py-2 text-sm text-danger">
            {formError}
          </p>
        ) : null}

        {(mode === "create" || mode === "edit" || selectedProduct) ? (
          <div className="grid gap-4 md:grid-cols-[200px_1fr] md:items-start">
            <div className="space-y-2">
              <div className="relative aspect-square w-full overflow-hidden rounded-[var(--radius-base)] border border-border bg-surface-2">
                {selectedImagePreviewUrl || (mode !== "create" && currentImageUrl) ? (
                  <Image
                    src={selectedImagePreviewUrl || currentImageUrl}
                    alt={
                      mode === "create"
                        ? "Vista previa de imagen del producto"
                        : `Imagen de ${selectedProduct?.name ?? "producto"}`
                    }
                    fill
                    unoptimized
                    className="object-cover transition-opacity duration-150"
                  />
                ) : (
                  <div className="flex h-full items-center justify-center text-xs text-muted">
                    Sin imagen
                  </div>
                )}
                {(mode === "create" || mode === "edit") ? (
                  <>
                    <input
                      ref={imageInputRef}
                      type="file"
                      accept="image/*"
                      className="sr-only"
                      onChange={(event) => updateSelectedImage(event.target.files?.[0] ?? null)}
                    />
                    <button
                      type="button"
                      onClick={openImagePicker}
                      className="absolute inset-x-2 bottom-2 inline-flex items-center justify-center gap-2 rounded-[var(--radius-base)] border border-border bg-surface/90 px-3 py-1.5 text-xs font-medium text-foreground transition-opacity duration-150 hover:opacity-90"
                    >
                      <ImagePlus className="h-4 w-4" aria-hidden="true" />
                      Cambiar imagen
                    </button>
                  </>
                ) : null}
              </div>
              {selectedImageFile ? (
                <p className="truncate text-xs text-muted">{selectedImageFile.name}</p>
              ) : null}
            </div>

            <div
              className="space-y-4"
              style={{ animation: "page-enter 140ms ease-out both" }}
            >
              {mode === "create" || mode === "edit" ? (
                <>
                  <div>
                    <p className="text-lg font-semibold text-foreground">
                      {mode === "create" ? "Nuevo producto" : "Editar producto"}
                    </p>
                    <p className="text-sm text-muted">
                      Define nombre, categoría, precio y estado para catálogo POS.
                    </p>
                  </div>

                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-1 md:col-span-2">
                      <Label htmlFor="product-name">Nombre</Label>
                      <Input
                        id="product-name"
                        value={draft.name}
                        onChange={(event) => updateDraft("name", event.target.value)}
                        placeholder="Ej. Latte mediano"
                      />
                    </div>

                    <div className="space-y-1">
                      <Label htmlFor="product-category">Categoría</Label>
                      <select
                        id="product-category"
                        value={draft.category_id}
                        onChange={(event) => updateDraft("category_id", event.target.value)}
                        className="h-11 w-full rounded-[var(--radius-base)] border border-border bg-surface-2 px-3 text-sm text-foreground outline-none transition-colors focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/30"
                      >
                        <option value="">Sin categoría</option>
                        {categoryOptions.map((category) => (
                          <option key={category.id} value={category.id}>
                            {category.name}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="space-y-1">
                      <Label htmlFor="product-class">Tipo</Label>
                      <select
                        id="product-class"
                        value={draft.class}
                        onChange={(event) => updateDraft("class", event.target.value as "food" | "drink")}
                        className="h-11 w-full rounded-[var(--radius-base)] border border-border bg-surface-2 px-3 text-sm text-foreground outline-none transition-colors focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/30"
                      >
                        <option value="food">Alimento</option>
                        <option value="drink">Bebida</option>
                      </select>
                    </div>

                    <div className="space-y-1">
                      <Label htmlFor="product-price">Precio (MXN)</Label>
                      <Input
                        id="product-price"
                        type="number"
                        min="0"
                        step="0.01"
                        value={draft.price}
                        onChange={(event) => updateDraft("price", event.target.value)}
                      />
                    </div>
                  </div>

                  <label className="inline-flex items-center gap-2 text-sm text-foreground">
                    <input
                      type="checkbox"
                      checked={draft.is_active}
                      onChange={(event) => updateDraft("is_active", event.target.checked)}
                      className="h-4 w-4 accent-primary"
                    />
                    Producto activo
                  </label>

                  <div className="flex flex-wrap items-center gap-2">
                    <Button type="button" onClick={handleSave} isLoading={isPending}>
                      <Check className="h-4 w-4" aria-hidden="true" />
                      {mode === "create" ? "Guardar cambios" : "Guardar cambios"}
                    </Button>
                    <Button
                      type="button"
                      variant="secondary"
                      disabled={isPending}
                      onClick={() => {
                        if (selectedProduct) {
                          openViewMode(selectedProduct.id);
                          return;
                        }
                        setMode("view");
                        setFormError(null);
                      }}
                    >
                      <X className="h-4 w-4" aria-hidden="true" />
                      Cancelar
                    </Button>
                  </div>
                </>
              ) : selectedProduct ? (
                <>
                  <div>
                    <p className="text-lg font-semibold text-foreground">{selectedProduct.name}</p>
                    <p className="text-sm text-muted">
                      ID: {selectedProduct.id} · Actualizado: {formatDateTime(selectedProduct.updated_at)}
                    </p>
                  </div>

                  <div className="grid gap-3 md:grid-cols-2">
                    <div className="rounded-[var(--radius-base)] border border-border bg-surface-2 p-3">
                      <p className="text-xs text-muted">Precio</p>
                      <p className="text-sm font-medium text-foreground">
                        {formatMoneyFromCents(selectedProduct.price_cents)}
                      </p>
                    </div>
                    <div className="rounded-[var(--radius-base)] border border-border bg-surface-2 p-3">
                      <p className="text-xs text-muted">Categoría</p>
                      <p className="text-sm font-medium text-foreground">
                        {selectedProduct.category_id
                          ? categoryNameById.get(selectedProduct.category_id) ?? "Sin categoría"
                          : "Sin categoría"}
                      </p>
                    </div>
                    <div className="rounded-[var(--radius-base)] border border-border bg-surface-2 p-3">
                      <p className="text-xs text-muted">Tipo</p>
                      <p className="text-sm font-medium text-foreground">
                        {selectedProduct.class === "drink" ? "Bebida" : "Alimento"}
                      </p>
                    </div>
                  </div>

                  <div className="space-y-3">
                    <div className="flex flex-wrap gap-2">
                      <Button type="button" onClick={openEditMode} disabled={isPending}>
                        <Pencil className="h-4 w-4" aria-hidden="true" />
                        Editar
                      </Button>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      <Button
                        type="button"
                        variant="secondary"
                        className="border-warning/40 hover:bg-warning/10"
                        disabled={isPending || Boolean(selectedProduct.deleted_at)}
                        onClick={() =>
                          handleFlagsUpdate(selectedProduct, {
                            is_active: selectedProduct.is_active,
                            is_sold_out: !selectedProduct.is_sold_out,
                            is_popular: selectedProduct.is_popular,
                          })
                        }
                      >
                        <AlertTriangle className="h-4 w-4" aria-hidden="true" />
                        {selectedProduct.is_sold_out ? "Marcar disponible" : "Marcar agotado"}
                      </Button>
                      <Button
                        type="button"
                        variant="secondary"
                        disabled={isPending || Boolean(selectedProduct.deleted_at)}
                        onClick={() =>
                          handleFlagsUpdate(selectedProduct, {
                            is_active: selectedProduct.is_active,
                            is_sold_out: selectedProduct.is_sold_out,
                            is_popular: !selectedProduct.is_popular,
                          })
                        }
                      >
                        {selectedProduct.is_popular ? (
                          <StarOff className="h-4 w-4" aria-hidden="true" />
                        ) : (
                          <Star className="h-4 w-4" aria-hidden="true" />
                        )}
                        {selectedProduct.is_popular ? "Quitar popular" : "Marcar popular"}
                      </Button>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      <Button
                        type="button"
                        variant="secondary"
                        className="border-border bg-transparent"
                        disabled={isPending || Boolean(selectedProduct.deleted_at)}
                        onClick={() =>
                          handleFlagsUpdate(selectedProduct, {
                            is_active: !selectedProduct.is_active,
                            is_sold_out: selectedProduct.is_sold_out,
                            is_popular: selectedProduct.is_popular,
                          })
                        }
                      >
                        <Power className="h-4 w-4" aria-hidden="true" />
                        {selectedProduct.is_active ? "Desactivar" : "Activar"}
                      </Button>
                    </div>
                  </div>

                  <div className="rounded-[var(--radius-base)] border border-border bg-surface-2 p-3 text-sm text-muted">
                    <p>
                      Estado:{" "}
                      <span className="font-medium text-foreground">
                        {selectedProduct.deleted_at
                          ? "Archivado"
                          : selectedProduct.is_active
                            ? "Activo"
                            : "Inactivo"}
                      </span>
                    </p>
                    <p>Agotado: {selectedProduct.is_sold_out ? "Sí" : "No"}</p>
                    <p>Popular: {selectedProduct.is_popular ? "Sí" : "No"}</p>
                  </div>

                  {selectedProduct.deleted_at ? (
                    <Button
                      type="button"
                      variant="secondary"
                      isLoading={isPending}
                      onClick={() => handleArchiveOrRestore(selectedProduct)}
                    >
                      <Archive className="h-4 w-4" aria-hidden="true" />
                      Restaurar producto
                    </Button>
                  ) : (
                    <div className="space-y-2 border-t border-border pt-3">
                      {confirmArchive ? (
                        <div className="rounded-[var(--radius-base)] border border-danger/40 bg-danger-soft px-3 py-2 text-sm text-danger">
                          Esta acción archivará el producto. Puedes restaurarlo después.
                        </div>
                      ) : null}
                      <div className="flex flex-wrap gap-2">
                        <Button
                          type="button"
                          variant="danger"
                          disabled={isPending}
                          onClick={() => {
                            if (!confirmArchive) {
                              setConfirmArchive(true);
                              return;
                            }
                            handleArchiveOrRestore(selectedProduct);
                          }}
                        >
                          <Archive className="h-4 w-4" aria-hidden="true" />
                          {confirmArchive ? "Confirmar archivado" : "Archivar"}
                        </Button>
                        {confirmArchive ? (
                          <Button
                            type="button"
                            variant="secondary"
                            disabled={isPending}
                            onClick={() => setConfirmArchive(false)}
                          >
                            <X className="h-4 w-4" aria-hidden="true" />
                            Cancelar
                          </Button>
                        ) : null}
                      </div>
                    </div>
                  )}
                </>
              ) : null}
            </div>
          </div>
        ) : (
          <StatePanel
            kind="empty"
            title="Selecciona un producto"
            message="Elige un producto de la lista para ver y editar sus detalles."
          />
        )}
      </Card>
    </div>
  );
}
