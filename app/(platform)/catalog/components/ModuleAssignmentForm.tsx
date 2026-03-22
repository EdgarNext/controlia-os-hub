"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { StatePanel } from "@/components/ui/state-panel";
import { setTenantModuleStateAction, type ModuleCatalogActionState } from "../actions";

type ModuleAssignmentFormProps = {
  moduleKey: string;
  tenants: Array<{
    id: string;
    name: string;
    slug: string;
    status: "active" | "inactive" | "archived";
  }>;
};

const initialState: ModuleCatalogActionState = {
  ok: false,
  message: "",
};

export function ModuleAssignmentForm({ moduleKey, tenants }: ModuleAssignmentFormProps) {
  const [state, formAction, isPending] = useActionState(setTenantModuleStateAction, initialState);

  return (
    <form action={formAction} className="space-y-3 rounded-[var(--radius-base)] border border-border bg-surface-2 p-3">
      <input type="hidden" name="moduleKey" value={moduleKey} />

      <div className="space-y-1">
        <label htmlFor={`${moduleKey}-tenant`} className="text-sm font-medium text-foreground">
          Tenant destino
        </label>
        <select
          id={`${moduleKey}-tenant`}
          name="tenantId"
          defaultValue=""
          className="h-11 w-full rounded-[var(--radius-base)] border border-border bg-surface px-3 text-sm text-foreground outline-none transition-colors focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/30"
          required
        >
          <option value="" disabled>
            Selecciona un tenant
          </option>
          {tenants.map((tenant) => (
            <option key={tenant.id} value={tenant.id}>
              {tenant.name} ({tenant.slug}){tenant.status !== "active" ? ` - ${tenant.status}` : ""}
            </option>
          ))}
        </select>
      </div>

      <div className="flex flex-wrap gap-2">
        <Button type="submit" name="enabled" value="true" isLoading={isPending}>
          Activar en tenant
        </Button>
        <Button type="submit" name="enabled" value="false" variant="secondary" isLoading={isPending}>
          Desactivar
        </Button>
      </div>

      {state.message ? (
        state.ok ? (
          <StatePanel kind="empty" title="Asignación actualizada" message={state.message} />
        ) : (
          <StatePanel kind="error" title="No se pudo actualizar" message={state.message} />
        )
      ) : null}
    </form>
  );
}
