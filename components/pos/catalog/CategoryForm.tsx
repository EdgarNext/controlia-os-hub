"use client";

import Link from "next/link";
import { useActionState } from "react";
import type { CategoryActionState } from "@/actions/pos/catalog/categories.actions";
import { Button } from "@/components/ui/button";
import type { PosCatalogCategoryFormValues } from "@/types/pos-catalog";

type CategoryFormProps = {
  action: (previousState: CategoryActionState, formData: FormData) => Promise<CategoryActionState>;
  tenantSlug: string;
  cancelHref: string;
  returnHref?: string;
  categoryId?: string;
  initialValues?: PosCatalogCategoryFormValues;
  submitLabel: string;
};

const initialState: CategoryActionState = {
  error: null,
  fieldErrors: {},
};

export function CategoryForm({
  action,
  tenantSlug,
  cancelHref,
  returnHref,
  categoryId,
  initialValues,
  submitLabel,
}: CategoryFormProps) {
  const [state, formAction, isPending] = useActionState(action, initialState);

  return (
    <form action={formAction} className="space-y-4 rounded-[var(--radius-base)] border border-border bg-surface p-4">
      <input type="hidden" name="tenantSlug" value={tenantSlug} />
      {returnHref ? <input type="hidden" name="returnPath" value={returnHref} /> : null}
      {categoryId ? <input type="hidden" name="categoryId" value={categoryId} /> : null}

      <label className="block space-y-1 text-sm">
        <span className="text-muted">Nombre</span>
        <input
          type="text"
          name="name"
          required
          defaultValue={initialValues?.name ?? ""}
          className="w-full rounded-[var(--radius-base)] border border-border bg-surface-2 px-3 py-2"
          placeholder="Ej. Bebidas"
        />
        {state.fieldErrors.name ? <span className="text-xs text-danger">{state.fieldErrors.name}</span> : null}
      </label>

      <label className="block space-y-1 text-sm">
        <span className="text-muted">Orden</span>
        <input
          type="number"
          name="sort_order"
          defaultValue={initialValues?.sort_order ?? 0}
          className="w-full rounded-[var(--radius-base)] border border-border bg-surface-2 px-3 py-2"
        />
        {state.fieldErrors.sort_order ? (
          <span className="text-xs text-danger">{state.fieldErrors.sort_order}</span>
        ) : null}
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
