"use client";

import Link from "next/link";
import { useActionState, useMemo, useState } from "react";
import type { CatalogV2ActionState } from "@/actions/pos/catalog-v2.actions";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import type {
  PosCatalogCategorySelectItem,
} from "@/types/pos-catalog";
import type {
  PosCatalogV2ProductFormValues,
} from "@/types/pos-catalog-v2";
import type { PosCatalogV2VariantSelectItem } from "@/lib/pos/catalog-v2/queries";

type ProductV2FormProps = {
  action: (previousState: CatalogV2ActionState, formData: FormData) => Promise<CatalogV2ActionState>;
  tenantSlug: string;
  cancelHref: string;
  returnHref?: string;
  categories: PosCatalogCategorySelectItem[];
  defaultVariantOptions: PosCatalogV2VariantSelectItem[];
  productId?: string;
  initialValues?: PosCatalogV2ProductFormValues;
  submitLabel: string;
};

const initialState: CatalogV2ActionState = {
  error: null,
  fieldErrors: {},
};

function priceCentsToUiValue(priceCents?: number | null): string {
  if (typeof priceCents !== "number") {
    return "";
  }

  return (priceCents / 100).toFixed(2);
}

function renderError(state: CatalogV2ActionState, field: string) {
  return state.fieldErrors[field] ? <span className="text-xs text-danger">{state.fieldErrors[field]}</span> : null;
}

export function ProductV2Form({
  action,
  tenantSlug,
  cancelHref,
  returnHref,
  categories,
  defaultVariantOptions,
  productId,
  initialValues,
  submitLabel,
}: ProductV2FormProps) {
  const [state, formAction, isPending] = useActionState(action, initialState);
  const [productType, setProductType] = useState(initialValues?.product_type ?? "simple");
  const [basePriceInput, setBasePriceInput] = useState(priceCentsToUiValue(initialValues?.base_price_cents));

  const isConfigurable = productType === "configurable";
  const priceHelp = useMemo(() => {
    if (isConfigurable) {
      return "Si la variante define el precio, el precio base puede quedar vacío.";
    }

    if (productType === "combo") {
      return "El precio base es obligatorio para combos.";
    }

    return "Precio operativo del producto simple.";
  }, [isConfigurable, productType]);

  return (
    <Card className="space-y-4">
      <form action={formAction} className="space-y-4">
        <input type="hidden" name="tenantSlug" value={tenantSlug} />
        {returnHref ? <input type="hidden" name="returnPath" value={returnHref} /> : null}
        {productId ? <input type="hidden" name="productId" value={productId} /> : null}

        <div className="grid gap-4 md:grid-cols-2">
          <label className="block space-y-1 text-sm">
            <span className="text-muted">Nombre</span>
            <input
              type="text"
              name="name"
              required
              defaultValue={initialValues?.name ?? ""}
              className="w-full rounded-[var(--radius-base)] border border-border bg-surface-2 px-3 py-2"
              placeholder="Ej. Latte"
            />
            {renderError(state, "name")}
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
            {renderError(state, "category_id")}
          </label>

          <label className="block space-y-1 text-sm">
            <span className="text-muted">Tipo de producto</span>
            <select
              name="product_type"
              value={productType}
              onChange={(event) => {
                const nextType = event.target.value as "simple" | "configurable" | "combo";
                setProductType(nextType);
                if (nextType === "configurable") {
                  setBasePriceInput("");
                }
              }}
              className="w-full rounded-[var(--radius-base)] border border-border bg-surface-2 px-3 py-2"
            >
              <option value="simple">Simple</option>
              <option value="configurable">Configurable</option>
              <option value="combo">Combo</option>
            </select>
            {renderError(state, "product_type")}
          </label>

          <label className="block space-y-1 text-sm">
            <span className="text-muted">Clase</span>
            <select
              name="class"
              defaultValue={initialValues?.class ?? "food"}
              className="w-full rounded-[var(--radius-base)] border border-border bg-surface-2 px-3 py-2"
            >
              <option value="food">Alimento</option>
              <option value="drink">Bebida</option>
            </select>
          </label>

          <label className="block space-y-1 text-sm">
            <span className="text-muted">Precio base (pesos MXN)</span>
            <input
              type="number"
              name="base_price_cents"
              min="0"
              step="0.01"
              disabled={isConfigurable}
              value={isConfigurable ? "" : basePriceInput}
              onChange={(event) => setBasePriceInput(event.target.value)}
              className="w-full rounded-[var(--radius-base)] border border-border bg-surface-2 px-3 py-2"
            />
            {renderError(state, "base_price_cents")}
            <p className="text-xs text-muted">{priceHelp} El valor se ingresa en pesos y se guarda en centavos.</p>
          </label>

          <div className="rounded-[var(--radius-base)] border border-border bg-surface-2 px-3 py-2 text-sm text-foreground">
            <p className="font-medium">
              Selección de variante: {isConfigurable ? "requerida" : "no aplica"}
            </p>
            <p className="mt-1 text-xs text-muted">
              El tipo de producto determina este comportamiento para evitar combinaciones inválidas.
            </p>
          </div>

          <label className="inline-flex items-center gap-2 text-sm text-foreground">
            <input
              type="checkbox"
              name="is_active"
              defaultChecked={initialValues?.is_active ?? true}
              className="h-4 w-4 accent-primary"
            />
            Activo
          </label>

          <label className="inline-flex items-center gap-2 text-sm text-foreground">
            <input
              type="checkbox"
              name="is_sold_out"
              defaultChecked={initialValues?.is_sold_out ?? false}
              className="h-4 w-4 accent-primary"
            />
            Agotado
          </label>

          <label className="inline-flex items-center gap-2 text-sm text-foreground">
            <input
              type="checkbox"
              name="is_popular"
              defaultChecked={initialValues?.is_popular ?? false}
              className="h-4 w-4 accent-primary"
            />
            Popular
          </label>

          {isConfigurable ? (
            <label className="block space-y-1 text-sm md:col-span-2">
              <span className="text-muted">Variante por defecto</span>
              <select
                name="default_variant_id"
                defaultValue={initialValues?.default_variant_id ?? ""}
                className="w-full rounded-[var(--radius-base)] border border-border bg-surface-2 px-3 py-2"
              >
                <option value="">Sin variante por defecto</option>
                {defaultVariantOptions.map((variant) => (
                  <option key={variant.id} value={variant.id}>
                    {variant.name}
                  </option>
                ))}
              </select>
              <p className="text-xs text-muted">Solo muestra variantes existentes para este producto.</p>
              {renderError(state, "default_variant_id")}
            </label>
          ) : null}
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
