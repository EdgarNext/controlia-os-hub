"use client";

import Link from "next/link";
import { useActionState } from "react";
import type { CatalogV2ActionState } from "@/actions/pos/catalog-v2.actions";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import type {
  PosCatalogV2ModifierGroupSelectItem,
  PosCatalogV2ProductSelectItem,
} from "@/lib/pos/catalog-v2/queries";
import type { PosCatalogV2ProductModifierGroupAssignmentFormValues } from "@/types/pos-catalog-v2";

type AssignmentV2FormProps = {
  action: (previousState: CatalogV2ActionState, formData: FormData) => Promise<CatalogV2ActionState>;
  tenantSlug: string;
  cancelHref: string;
  products: PosCatalogV2ProductSelectItem[];
  modifierGroups: PosCatalogV2ModifierGroupSelectItem[];
  assignmentId?: string;
  initialValues?: PosCatalogV2ProductModifierGroupAssignmentFormValues;
  submitLabel: string;
};

const initialState: CatalogV2ActionState = {
  error: null,
  fieldErrors: {},
};

function renderError(state: CatalogV2ActionState, field: string) {
  return state.fieldErrors[field] ? <span className="text-xs text-danger">{state.fieldErrors[field]}</span> : null;
}

export function AssignmentV2Form({
  action,
  tenantSlug,
  cancelHref,
  products,
  modifierGroups,
  assignmentId,
  initialValues,
  submitLabel,
}: AssignmentV2FormProps) {
  const [state, formAction, isPending] = useActionState(action, initialState);

  return (
    <Card className="space-y-4">
      <form action={formAction} className="space-y-4">
        <input type="hidden" name="tenantSlug" value={tenantSlug} />
        {assignmentId ? <input type="hidden" name="assignmentId" value={assignmentId} /> : null}

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

          <label className="block space-y-1 text-sm md:col-span-2">
            <span className="text-muted">Grupo de modifiers</span>
            <select
              name="modifier_group_id"
              defaultValue={initialValues?.modifier_group_id ?? ""}
              className="w-full rounded-[var(--radius-base)] border border-border bg-surface-2 px-3 py-2"
            >
              <option value="">Selecciona un grupo</option>
              {modifierGroups.map((group) => (
                <option key={group.id} value={group.id}>
                  {group.name}
                </option>
              ))}
            </select>
            {renderError(state, "modifier_group_id")}
          </label>

          <label className="block space-y-1 text-sm">
            <span className="text-muted">Override requerido</span>
            <select
              name="is_required_override"
              defaultValue={
                initialValues?.is_required_override === null
                  ? ""
                  : initialValues?.is_required_override
                    ? "true"
                    : "false"
              }
              className="w-full rounded-[var(--radius-base)] border border-border bg-surface-2 px-3 py-2"
            >
              <option value="">Heredar</option>
              <option value="true">Sí</option>
              <option value="false">No</option>
            </select>
            {renderError(state, "is_required_override")}
          </label>

          <label className="block space-y-1 text-sm">
            <span className="text-muted">Override mínimo</span>
            <input
              type="number"
              name="min_selected_override"
              min="0"
              defaultValue={initialValues?.min_selected_override ?? ""}
              className="w-full rounded-[var(--radius-base)] border border-border bg-surface-2 px-3 py-2"
            />
            {renderError(state, "min_selected_override")}
          </label>

          <label className="block space-y-1 text-sm">
            <span className="text-muted">Override máximo</span>
            <input
              type="number"
              name="max_selected_override"
              min="0"
              defaultValue={initialValues?.max_selected_override ?? ""}
              className="w-full rounded-[var(--radius-base)] border border-border bg-surface-2 px-3 py-2"
            />
            {renderError(state, "max_selected_override")}
          </label>

          <label className="block space-y-1 text-sm">
            <span className="text-muted">Orden</span>
            <input
              type="number"
              name="sort_order"
              defaultValue={initialValues?.sort_order ?? 0}
              className="w-full rounded-[var(--radius-base)] border border-border bg-surface-2 px-3 py-2"
            />
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
