"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  applyInventoryImportBatchAction,
  createInventoryImportBatchFromLocalFileAction,
  validateInventoryImportBatchAction,
  type KitchenImportActionState,
} from "@/lib/kitchen/inventory/import-actions";

const initialKitchenImportActionState: KitchenImportActionState = {
  ok: true,
  message: "",
};

export function CreateInventoryImportBatchForm({ tenantSlug }: { tenantSlug: string }) {
  const [state, formAction, isPending] = useActionState(
    createInventoryImportBatchFromLocalFileAction,
    initialKitchenImportActionState,
  );

  return (
    <form action={formAction} className="space-y-3 rounded-[var(--radius-base)] border border-border bg-surface p-4">
      <input type="hidden" name="tenantSlug" value={tenantSlug} />
      <p className="text-sm font-semibold text-foreground">Crear batch desde archivo local</p>
      <div className="space-y-1">
        <Label htmlFor="local-path">Ruta local Excel</Label>
        <Input
          id="local-path"
          name="localPath"
          defaultValue="/home/developer/dev/controlia-os/docs/tmp/kitchen-import-samples/INVENTARIO FEBRERO 2026.xlsx"
        />
      </div>
      {state.message ? <p className={`text-xs ${state.ok ? "text-success" : "text-danger"}`}>{state.message}</p> : null}
      <Button type="submit" isLoading={isPending}>Parsear a staging</Button>
    </form>
  );
}

export function ValidateInventoryImportBatchForm({ tenantSlug, batchId }: { tenantSlug: string; batchId: string }) {
  const [state, formAction, isPending] = useActionState(
    validateInventoryImportBatchAction,
    initialKitchenImportActionState,
  );

  return (
    <form action={formAction} className="rounded-[var(--radius-base)] border border-border bg-surface p-3">
      <input type="hidden" name="tenantSlug" value={tenantSlug} />
      <input type="hidden" name="batchId" value={batchId} />
      <div className="flex items-center gap-3">
        <Button type="submit" variant="secondary" isLoading={isPending}>Validar batch</Button>
        {state.message ? <p className={`text-xs ${state.ok ? "text-success" : "text-danger"}`}>{state.message}</p> : null}
      </div>
    </form>
  );
}

export function ApplyInventoryImportBatchForm({ tenantSlug, batchId }: { tenantSlug: string; batchId: string }) {
  const [state, formAction, isPending] = useActionState(
    applyInventoryImportBatchAction,
    initialKitchenImportActionState,
  );

  return (
    <form action={formAction} className="rounded-[var(--radius-base)] border border-border bg-surface p-3">
      <input type="hidden" name="tenantSlug" value={tenantSlug} />
      <input type="hidden" name="batchId" value={batchId} />
      <div className="flex items-center gap-3">
        <Button type="submit" variant="success" isLoading={isPending}>Aplicar batch</Button>
        {state.message ? <p className={`text-xs ${state.ok ? "text-success" : "text-danger"}`}>{state.message}</p> : null}
      </div>
    </form>
  );
}
