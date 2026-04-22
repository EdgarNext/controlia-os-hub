"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import type { CatalogV2ActionState } from "@/actions/pos/catalog-v2.actions";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import type {
  PosCatalogV2ProductSelectItem,
} from "@/lib/pos/catalog-v2/queries";
import type {
  PosCatalogV2ComboSlotListItem,
  PosCatalogV2ComboSlotOptionFormValues,
  PosCatalogV2SellableVariantListItem,
} from "@/types/pos-catalog-v2";

type ComboSlotOptionV2FormProps = {
  action: (previousState: CatalogV2ActionState, formData: FormData) => Promise<CatalogV2ActionState>;
  tenantSlug: string;
  cancelHref: string;
  returnHref?: string;
  comboSlots: PosCatalogV2ComboSlotListItem[];
  productTargets: PosCatalogV2ProductSelectItem[];
  variantTargets: PosCatalogV2SellableVariantListItem[];
  comboSlotOptionId?: string;
  initialValues?: PosCatalogV2ComboSlotOptionFormValues;
  submitLabel: string;
};

const initialState: CatalogV2ActionState = {
  error: null,
  fieldErrors: {},
};

function renderError(state: CatalogV2ActionState, field: string) {
  return state.fieldErrors[field] ? <span className="text-xs text-danger">{state.fieldErrors[field]}</span> : null;
}

function priceCentsToUiValue(priceCents?: number): string {
  if (typeof priceCents !== "number") {
    return "0.00";
  }

  return (priceCents / 100).toFixed(2);
}

export function ComboSlotOptionV2Form({
  action,
  tenantSlug,
  cancelHref,
  returnHref,
  comboSlots,
  productTargets,
  variantTargets,
  comboSlotOptionId,
  initialValues,
  submitLabel,
}: ComboSlotOptionV2FormProps) {
  const [state, formAction, isPending] = useActionState(action, initialState);
  const initialTargetMode = initialValues?.linked_sellable_variant_id ? "variant" : "product";
  const [targetMode, setTargetMode] = useState<"product" | "variant">(initialTargetMode);
  const productNameById = new Map(productTargets.map((product) => [product.id, product.name]));
  const variantNameById = new Map(variantTargets.map((variant) => [variant.id, variant.name]));
  const [linkedProductId, setLinkedProductId] = useState(initialValues?.linked_product_id ?? "");
  const [linkedVariantId, setLinkedVariantId] = useState(initialValues?.linked_sellable_variant_id ?? "");

  const derivedName =
    targetMode === "product"
      ? productNameById.get(linkedProductId) ?? ""
      : variantNameById.get(linkedVariantId) ?? "";

  return (
    <Card className="space-y-4">
      <form action={formAction} className="space-y-4">
        <input type="hidden" name="tenantSlug" value={tenantSlug} />
        {returnHref ? <input type="hidden" name="returnPath" value={returnHref} /> : null}
        {comboSlotOptionId ? <input type="hidden" name="comboSlotOptionId" value={comboSlotOptionId} /> : null}
        <input type="hidden" name="name" value={derivedName} />

        <div className="grid gap-4 md:grid-cols-2">
          <label className="block space-y-1 text-sm md:col-span-2">
            <span className="text-muted">Slot del combo</span>
            <select
              name="combo_slot_id"
              defaultValue={initialValues?.combo_slot_id ?? ""}
              className="w-full rounded-[var(--radius-base)] border border-border bg-surface-2 px-3 py-2"
            >
              <option value="">Selecciona un slot</option>
              {comboSlots.map((slot) => (
                <option key={slot.id} value={slot.id}>
                  {slot.name}
                </option>
              ))}
            </select>
            {renderError(state, "combo_slot_id")}
          </label>

          <div className="block space-y-1 text-sm">
            <span className="text-muted">Nombre</span>
            <div className="rounded-[var(--radius-base)] border border-border bg-surface-2 px-3 py-2">
              <p className="text-sm font-medium text-foreground">{derivedName || "Selecciona un destino"}</p>
              <p className="text-xs text-muted">El nombre se hereda automáticamente del destino seleccionado.</p>
            </div>
            {renderError(state, "name")}
          </div>

          <label className="block space-y-1 text-sm">
            <span className="text-muted">Precio delta (pesos MXN)</span>
            <input
              type="number"
              name="price_delta_cents"
              min="0"
              step="0.01"
              defaultValue={priceCentsToUiValue(initialValues?.price_delta_cents)}
              className="w-full rounded-[var(--radius-base)] border border-border bg-surface-2 px-3 py-2"
            />
            {renderError(state, "price_delta_cents")}
            <p className="text-xs text-muted">Ingresa el delta en pesos; el sistema lo guarda en centavos.</p>
          </label>

          <label className="block space-y-1 text-sm">
            <span className="text-muted">Modo de destino</span>
            <select
              name="target_mode"
              value={targetMode}
              onChange={(event) => {
                const nextMode = event.target.value as "product" | "variant";
                setTargetMode(nextMode);
                if (nextMode === "product") {
                  setLinkedVariantId("");
                } else {
                  setLinkedProductId("");
                }
              }}
              className="w-full rounded-[var(--radius-base)] border border-border bg-surface-2 px-3 py-2"
            >
              <option value="product">Producto simple</option>
              <option value="variant">Variante configurable</option>
            </select>
            <p className="text-xs text-muted">Selecciona exactamente un target para la opción del combo.</p>
            {renderError(state, "target_mode")}
          </label>

          {targetMode === "product" ? (
            <label className="block space-y-1 text-sm md:col-span-2">
              <span className="text-muted">Producto simple destino</span>
              <select
                name="linked_product_id"
                value={linkedProductId}
                onChange={(event) => setLinkedProductId(event.target.value)}
                className="w-full rounded-[var(--radius-base)] border border-border bg-surface-2 px-3 py-2"
              >
                <option value="">Selecciona un producto simple</option>
                {productTargets.map((product) => (
                  <option key={product.id} value={product.id}>
                    {product.name}
                  </option>
                ))}
              </select>
              {renderError(state, "linked_product_id")}
            </label>
          ) : (
            <label className="block space-y-1 text-sm md:col-span-2">
              <span className="text-muted">Variante destino</span>
              <select
                name="linked_sellable_variant_id"
                value={linkedVariantId}
                onChange={(event) => setLinkedVariantId(event.target.value)}
                className="w-full rounded-[var(--radius-base)] border border-border bg-surface-2 px-3 py-2"
              >
                <option value="">Selecciona una variante vendible</option>
                {variantTargets.map((variant) => (
                  <option key={variant.id} value={variant.id}>
                    {variant.name} · {productNameById.get(variant.product_id) ?? "Producto"}
                  </option>
                ))}
              </select>
              {renderError(state, "linked_sellable_variant_id")}
            </label>
          )}

          <label className="block space-y-1 text-sm">
            <span className="text-muted">Orden</span>
            <input
              type="number"
              name="sort_order"
              defaultValue={initialValues?.sort_order ?? 0}
              className="w-full rounded-[var(--radius-base)] border border-border bg-surface-2 px-3 py-2"
            />
          </label>

          <label className="block space-y-1 text-sm md:col-span-2">
            <span className="text-muted">Reporting key</span>
            <input
              type="text"
              name="reporting_key"
              defaultValue={initialValues?.reporting_key ?? ""}
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
            Default
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
