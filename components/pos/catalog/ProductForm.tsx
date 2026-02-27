"use client";

import Image from "next/image";
import Link from "next/link";
import { useActionState, useMemo, useState } from "react";
import type { ProductActionState } from "@/actions/pos/catalog/products.actions";
import { Button } from "@/components/ui/button";
import { getPublicCatalogImageUrl } from "@/lib/pos/catalog/images";
import type { PosCatalogCategorySelectItem, PosCatalogProductFormValues } from "@/types/pos-catalog";

type ProductFormProps = {
  action: (previousState: ProductActionState, formData: FormData) => Promise<ProductActionState>;
  tenantSlug: string;
  cancelHref: string;
  categories: PosCatalogCategorySelectItem[];
  productId?: string;
  initialValues?: PosCatalogProductFormValues;
  initialImagePath?: string | null;
  submitLabel: string;
};

const initialState: ProductActionState = {
  error: null,
  fieldErrors: {},
};

function priceCentsToUiValue(priceCents?: number): string {
  if (typeof priceCents !== "number") {
    return "0.00";
  }

  return (priceCents / 100).toFixed(2);
}

export function ProductForm({
  action,
  tenantSlug,
  cancelHref,
  categories,
  productId,
  initialValues,
  initialImagePath,
  submitLabel,
}: ProductFormProps) {
  const [state, formAction, isPending] = useActionState(action, initialState);
  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const currentImageUrl = useMemo(() => getPublicCatalogImageUrl(initialImagePath), [initialImagePath]);

  return (
    <form
      action={formAction}
      className="space-y-4 rounded-[var(--radius-base)] border border-border bg-surface p-4"
    >
      <input type="hidden" name="tenantSlug" value={tenantSlug} />
      {productId ? <input type="hidden" name="productId" value={productId} /> : null}

      <label className="block space-y-1 text-sm">
        <span className="text-muted">Nombre</span>
        <input
          type="text"
          name="name"
          required
          defaultValue={initialValues?.name ?? ""}
          className="w-full rounded-[var(--radius-base)] border border-border bg-surface-2 px-3 py-2"
          placeholder="Ej. Agua natural"
        />
        {state.fieldErrors.name ? <span className="text-xs text-danger">{state.fieldErrors.name}</span> : null}
      </label>

      <label className="block space-y-1 text-sm">
        <span className="text-muted">Categoría</span>
        <select
          name="category_id"
          defaultValue={initialValues?.category_id ?? ""}
          className="w-full rounded-[var(--radius-base)] border border-border bg-surface-2 px-3 py-2"
        >
          <option value="">Sin categoría</option>
          {categories.map((category) => (
            <option key={category.id} value={category.id}>
              {category.name}
            </option>
          ))}
        </select>
        {state.fieldErrors.category_id ? (
          <span className="text-xs text-danger">{state.fieldErrors.category_id}</span>
        ) : null}
      </label>

      <label className="block space-y-1 text-sm">
        <span className="text-muted">Precio (MXN)</span>
        <input
          type="number"
          name="price"
          required
          min="0"
          step="0.01"
          defaultValue={priceCentsToUiValue(initialValues?.price_cents)}
          className="w-full rounded-[var(--radius-base)] border border-border bg-surface-2 px-3 py-2"
        />
        {state.fieldErrors.price ? <span className="text-xs text-danger">{state.fieldErrors.price}</span> : null}
      </label>

      <label className="inline-flex items-center gap-2 text-sm text-foreground">
        <input
          type="checkbox"
          name="is_active"
          defaultChecked={initialValues?.is_active ?? true}
          className="h-4 w-4 accent-primary"
        />
        Activo
      </label>

      <div className="space-y-2">
        <label className="block text-sm text-muted">Imagen del producto</label>
        <input
          type="file"
          name="image"
          accept="image/*"
          onChange={(event) => setSelectedImage(event.target.files?.[0] ?? null)}
          className="w-full rounded-[var(--radius-base)] border border-border bg-surface-2 px-3 py-2 text-sm"
        />
        {selectedImage ? (
          <p className="text-xs text-muted">Archivo seleccionado: {selectedImage.name}</p>
        ) : null}
        {currentImageUrl ? (
          <Image
            src={currentImageUrl}
            alt="Imagen actual del producto"
            width={128}
            height={128}
            className="h-32 w-32 rounded-[var(--radius-base)] border border-border object-cover"
            unoptimized
          />
        ) : (
          <p className="text-xs text-muted">Sin imagen cargada.</p>
        )}
      </div>

      <p className="text-xs text-muted">
        SKU y barcode no están disponibles en el schema actual de `catalog_items`.
      </p>

      {state.error ? (
        <p className="rounded-[var(--radius-base)] border border-danger/40 bg-danger-soft px-3 py-2 text-sm text-danger">
          {state.error}
        </p>
      ) : null}

      <div className="flex items-center gap-2">
        <Button type="submit" isLoading={isPending}>
          {submitLabel}
        </Button>
        <Link
          href={cancelHref}
          className="inline-flex items-center justify-center rounded-[var(--radius-base)] border border-border bg-surface-2 px-4 py-2 text-sm font-medium text-foreground transition-opacity duration-200 hover:opacity-90"
        >
          Cancelar
        </Link>
      </div>
    </form>
  );
}
