"use client";

import Link from "next/link";
import { useActionState } from "react";
import type { CatalogV2ActionState } from "@/actions/pos/catalog-v2.actions";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import type { PosCatalogV2ModifierGroupFormValues } from "@/types/pos-catalog-v2";

type ModifierGroupV2FormProps = {
  action: (previousState: CatalogV2ActionState, formData: FormData) => Promise<CatalogV2ActionState>;
  tenantSlug: string;
  cancelHref: string;
  returnHref?: string;
  modifierGroupId?: string;
  initialValues?: PosCatalogV2ModifierGroupFormValues;
  submitLabel: string;
};

const initialState: CatalogV2ActionState = {
  error: null,
  fieldErrors: {},
};

function renderError(state: CatalogV2ActionState, field: string) {
  return state.fieldErrors[field] ? <span className="text-xs text-danger">{state.fieldErrors[field]}</span> : null;
}

export function ModifierGroupV2Form({
  action,
  tenantSlug,
  cancelHref,
  returnHref,
  modifierGroupId,
  initialValues,
  submitLabel,
}: ModifierGroupV2FormProps) {
  const [state, formAction, isPending] = useActionState(action, initialState);

  return (
    <Card className="space-y-4">
      <form action={formAction} className="space-y-4">
        <input type="hidden" name="tenantSlug" value={tenantSlug} />
        {returnHref ? <input type="hidden" name="returnPath" value={returnHref} /> : null}
        {modifierGroupId ? <input type="hidden" name="modifierGroupId" value={modifierGroupId} /> : null}

        <div className="grid gap-4 md:grid-cols-2">
          <label className="block space-y-1 text-sm md:col-span-2">
            <span className="text-muted">Nombre</span>
            <input
              type="text"
              name="name"
              required
              defaultValue={initialValues?.name ?? ""}
              className="w-full rounded-[var(--radius-base)] border border-border bg-surface-2 px-3 py-2"
              placeholder="Ej. Milk choice"
            />
            {renderError(state, "name")}
          </label>

          <label className="block space-y-1 text-sm">
            <span className="text-muted">Modo de selección</span>
            <select
              name="selection_mode"
              defaultValue={initialValues?.selection_mode ?? "single"}
              className="w-full rounded-[var(--radius-base)] border border-border bg-surface-2 px-3 py-2"
            >
              <option value="single">Single</option>
              <option value="multiple">Multiple</option>
            </select>
          </label>

          <label className="inline-flex items-center gap-2 text-sm text-foreground">
            <input
              type="checkbox"
              name="is_required"
              defaultChecked={initialValues?.is_required ?? false}
              className="h-4 w-4 accent-primary"
            />
            Requerido
          </label>

          <label className="block space-y-1 text-sm">
            <span className="text-muted">Mínimo</span>
            <input
              type="number"
              name="min_selected"
              min="0"
              defaultValue={initialValues?.min_selected ?? 0}
              className="w-full rounded-[var(--radius-base)] border border-border bg-surface-2 px-3 py-2"
            />
            {renderError(state, "min_selected")}
          </label>

          <label className="block space-y-1 text-sm">
            <span className="text-muted">Máximo</span>
            <input
              type="number"
              name="max_selected"
              min="0"
              defaultValue={initialValues?.max_selected ?? 1}
              className="w-full rounded-[var(--radius-base)] border border-border bg-surface-2 px-3 py-2"
            />
            {renderError(state, "max_selected")}
          </label>

          <label className="block space-y-1 text-sm">
            <span className="text-muted">Scope de display</span>
            <select
              name="display_scope"
              defaultValue={initialValues?.display_scope ?? "cashier"}
              className="w-full rounded-[var(--radius-base)] border border-border bg-surface-2 px-3 py-2"
            >
              <option value="cashier">Cashier</option>
              <option value="kitchen">Kitchen</option>
              <option value="both">Both</option>
            </select>
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
