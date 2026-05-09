"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  applyRecipeImportBatchAction,
  createRecipeImportBatchFromLocalFileAction,
  createRecipeIngredientAliasAction,
  revalidateRecipeImportBatchAction,
  validateRecipeImportBatchAction,
} from "@/lib/kitchen/recipes/import-actions";
import { initialKitchenRecipeImportActionState } from "@/lib/kitchen/recipes/import-action-state";

type InventoryItemOption = { id: string; name: string };

export function CreateRecipeImportBatchForm({ tenantSlug }: { tenantSlug: string }) {
  const [state, action, pending] = useActionState(
    createRecipeImportBatchFromLocalFileAction,
    initialKitchenRecipeImportActionState,
  );

  return (
    <form action={action} className="space-y-3 rounded-[var(--radius-base)] border border-border bg-surface p-4">
      <input type="hidden" name="tenantSlug" value={tenantSlug} />
      <p className="text-sm font-semibold text-foreground">Crear batch recetario desde archivo local</p>
      <div className="space-y-1">
        <Label htmlFor="recipe-local-path">Ruta local Excel</Label>
        <Input
          id="recipe-local-path"
          name="localPath"
          defaultValue="/home/developer/dev/controlia-os/docs/tmp/kitchen-import-samples/RECETARIO.xlsx"
        />
      </div>
      {state.message ? <p className={`text-xs ${state.ok ? "text-success" : "text-danger"}`}>{state.message}</p> : null}
      <Button type="submit" isLoading={pending}>Parsear recetario a staging</Button>
    </form>
  );
}

export function ValidateRecipeImportBatchForm({ tenantSlug, batchId }: { tenantSlug: string; batchId: string }) {
  const [state, action, pending] = useActionState(validateRecipeImportBatchAction, initialKitchenRecipeImportActionState);
  return (
    <form action={action} className="rounded-[var(--radius-base)] border border-border bg-surface p-3">
      <input type="hidden" name="tenantSlug" value={tenantSlug} />
      <input type="hidden" name="batchId" value={batchId} />
      <div className="flex items-center gap-3">
        <Button type="submit" variant="secondary" isLoading={pending}>Validar batch</Button>
        {state.message ? <p className={`text-xs ${state.ok ? "text-success" : "text-danger"}`}>{state.message}</p> : null}
      </div>
    </form>
  );
}

export function RevalidateRecipeImportBatchForm({ tenantSlug, batchId }: { tenantSlug: string; batchId: string }) {
  const [state, action, pending] = useActionState(revalidateRecipeImportBatchAction, initialKitchenRecipeImportActionState);
  return (
    <form action={action} className="rounded-[var(--radius-base)] border border-border bg-surface p-3">
      <input type="hidden" name="tenantSlug" value={tenantSlug} />
      <input type="hidden" name="batchId" value={batchId} />
      <div className="flex items-center gap-3">
        <Button type="submit" variant="secondary" isLoading={pending}>Revalidar batch</Button>
        {state.message ? <p className={`text-xs ${state.ok ? "text-success" : "text-danger"}`}>{state.message}</p> : null}
      </div>
    </form>
  );
}

export function ApplyRecipeImportBatchForm({ tenantSlug, batchId }: { tenantSlug: string; batchId: string }) {
  const [state, action, pending] = useActionState(applyRecipeImportBatchAction, initialKitchenRecipeImportActionState);
  return (
    <form action={action} className="rounded-[var(--radius-base)] border border-border bg-surface p-3">
      <input type="hidden" name="tenantSlug" value={tenantSlug} />
      <input type="hidden" name="batchId" value={batchId} />
      <div className="flex items-center gap-3">
        <Button type="submit" variant="success" isLoading={pending}>Aplicar batch</Button>
        {state.message ? <p className={`text-xs ${state.ok ? "text-success" : "text-danger"}`}>{state.message}</p> : null}
      </div>
    </form>
  );
}

export function CreateRecipeAliasForm({
  tenantSlug,
  batchId,
  rowId,
  alias,
  items,
}: {
  tenantSlug: string;
  batchId: string;
  rowId: string;
  alias: string;
  items: InventoryItemOption[];
}) {
  const [state, action, pending] = useActionState(createRecipeIngredientAliasAction, initialKitchenRecipeImportActionState);

  return (
    <form action={action} className="space-y-2 rounded border border-border bg-surface-2 p-2">
      <input type="hidden" name="tenantSlug" value={tenantSlug} />
      <input type="hidden" name="batchId" value={batchId} />
      <input type="hidden" name="rowId" value={rowId} />
      <input type="hidden" name="alias" value={alias} />
      <select
        name="itemId"
        className="h-9 w-full rounded-[var(--radius-base)] border border-border bg-surface px-2 text-xs"
        defaultValue=""
        required
      >
        <option value="" disabled>Selecciona insumo para alias</option>
        {items.map((item) => (
          <option key={item.id} value={item.id}>{item.name}</option>
        ))}
      </select>
      <Button type="submit" variant="secondary" isLoading={pending}>Vincular insumo (opcional)</Button>
      {state.message ? <p className={`text-[11px] ${state.ok ? "text-success" : "text-danger"}`}>{state.message}</p> : null}
    </form>
  );
}
