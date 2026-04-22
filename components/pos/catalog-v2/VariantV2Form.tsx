"use client";

import Link from "next/link";
import { useActionState } from "react";
import type { CatalogV2ActionState } from "@/actions/pos/catalog-v2.actions";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import type {
  PosCatalogV2ProductSelectItem,
} from "@/lib/pos/catalog-v2/queries";
import type { PosCatalogV2SellableVariantFormValues } from "@/types/pos-catalog-v2";

type VariantV2FormProps = {
  action: (previousState: CatalogV2ActionState, formData: FormData) => Promise<CatalogV2ActionState>;
  tenantSlug: string;
  cancelHref: string;
  returnHref?: string;
  products: PosCatalogV2ProductSelectItem[];
  variantId?: string;
  initialValues?: PosCatalogV2SellableVariantFormValues;
  submitLabel: string;
};

const initialState: CatalogV2ActionState = {
  error: null,
  fieldErrors: {},
};

function priceCentsToUiValue(priceCents?: number): string {
  if (typeof priceCents !== "number") {
    return "0.00";
  }

  return (priceCents / 100).toFixed(2);
}

function renderError(state: CatalogV2ActionState, field: string) {
  return state.fieldErrors[field] ? <span className="text-xs text-danger">{state.fieldErrors[field]}</span> : null;
}

export function VariantV2Form({
  action,
  tenantSlug,
  cancelHref,
  returnHref,
  products,
  variantId,
  initialValues,
  submitLabel,
}: VariantV2FormProps) {
  const [state, formAction, isPending] = useActionState(action, initialState);

  return (
    <Card className="space-y-4">
      <form action={formAction} className="space-y-4">
        <input type="hidden" name="tenantSlug" value={tenantSlug} />
        {returnHref ? <input type="hidden" name="returnPath" value={returnHref} /> : null}
        {variantId ? <input type="hidden" name="variantId" value={variantId} /> : null}

        <div className="grid gap-4 md:grid-cols-2">
          <label className="block space-y-1 text-sm md:col-span-2">
            <span className="text-muted">Producto</span>
            <select
              name="product_id"
              defaultValue={initialValues?.product_id ?? ""}
              className="w-full rounded-[var(--radius-base)] border border-border bg-surface-2 px-3 py-2"
            >
              <option value="">Selecciona un producto</option>
              {products.map((product) => (
                <option key={product.id} value={product.id}>
                  {product.name}
                </option>
              ))}
            </select>
            {renderError(state, "product_id")}
          </label>

          <label className="block space-y-1 text-sm">
            <span className="text-muted">Nombre</span>
            <input
              type="text"
              name="name"
              required
              defaultValue={initialValues?.name ?? ""}
              className="w-full rounded-[var(--radius-base)] border border-border bg-surface-2 px-3 py-2"
              placeholder="Ej. Grande"
            />
            {renderError(state, "name")}
          </label>

          <label className="block space-y-1 text-sm">
            <span className="text-muted">Precio (pesos MXN)</span>
            <input
              type="number"
              name="price_cents"
              required
              min="0"
              step="0.01"
              defaultValue={priceCentsToUiValue(initialValues?.price_cents)}
              className="w-full rounded-[var(--radius-base)] border border-border bg-surface-2 px-3 py-2"
            />
            {renderError(state, "price_cents")}
            <p className="text-xs text-muted">Ingresa el valor en pesos; el sistema lo guarda en centavos.</p>
          </label>

          <label className="block space-y-1 text-sm">
            <span className="text-muted">Orden</span>
            <input
              type="number"
              name="sort_order"
              defaultValue={initialValues?.sort_order ?? 0}
              className="w-full rounded-[var(--radius-base)] border border-border bg-surface-2 px-3 py-2"
            />
            {renderError(state, "sort_order")}
          </label>

          <label className="block space-y-1 text-sm">
            <span className="text-muted">Barcode</span>
            <input
              type="text"
              name="barcode"
              defaultValue={initialValues?.barcode ?? ""}
              className="w-full rounded-[var(--radius-base)] border border-border bg-surface-2 px-3 py-2"
              placeholder="Opcional"
            />
          </label>

          <label className="block space-y-1 text-sm">
            <span className="text-muted">SKU</span>
            <input
              type="text"
              name="sku"
              defaultValue={initialValues?.sku ?? ""}
              className="w-full rounded-[var(--radius-base)] border border-border bg-surface-2 px-3 py-2"
              placeholder="Opcional"
            />
          </label>

          <label className="inline-flex items-center gap-2 text-sm text-foreground">
            <input
              type="checkbox"
              name="is_default"
              defaultChecked={initialValues?.is_default ?? false}
              className="h-4 w-4 accent-primary"
            />
            Variante por defecto
          </label>

          <label className="inline-flex items-center gap-2 text-sm text-foreground">
            <input
              type="checkbox"
              name="is_active"
              defaultChecked={initialValues?.is_active ?? true}
              className="h-4 w-4 accent-primary"
            />
            Activa
          </label>
        </div>

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
    </Card>
  );
}
