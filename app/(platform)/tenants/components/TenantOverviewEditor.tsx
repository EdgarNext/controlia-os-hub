"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Collapsible } from "@/components/ui/Collapsible";
import type { TenantRecord } from "@/lib/repos/types";
import { archiveTenantAction, updateTenantAction } from "../actions/tenantActions";

type TenantOverviewEditorProps = {
  tenant: TenantRecord;
};

export function TenantOverviewEditor({ tenant }: TenantOverviewEditorProps) {
  const [isPending, startTransition] = useTransition();

  return (
    <form
      className="space-y-4"
      onSubmit={(event) => {
        event.preventDefault();
        const formData = new FormData(event.currentTarget);

        startTransition(async () => {
          const result = await updateTenantAction(formData);
          if (!result.ok) {
            toast.error(result.message);
            return;
          }

          toast.success(result.message);
        });
      }}
    >
      <input type="hidden" name="tenantId" value={tenant.id} />

      <div className="grid gap-4 md:grid-cols-2">
        <label className="block space-y-1 text-sm">
          <span className="text-muted">Nombre</span>
          <input
            name="name"
            defaultValue={tenant.name}
            required
            className="w-full rounded-[var(--radius-base)] border border-border bg-surface-2 px-3 py-2"
          />
        </label>

        <label className="block space-y-1 text-sm">
          <span className="text-muted">Slug</span>
          <input
            name="slug"
            defaultValue={tenant.slug}
            required
            className="w-full rounded-[var(--radius-base)] border border-border bg-surface-2 px-3 py-2"
          />
        </label>
      </div>

      <Collapsible title="Configuracion avanzada" defaultOpen>
        <div className="space-y-3">
          <label className="block space-y-1 text-sm">
            <span className="text-muted">Estado</span>
            <select
              name="status"
              defaultValue={tenant.status}
              className="w-full rounded-[var(--radius-base)] border border-border bg-surface-2 px-3 py-2"
            >
              <option value="active">Activo</option>
              <option value="inactive">Inactivo</option>
              <option value="archived">Archivado</option>
            </select>
          </label>

          <p className="text-xs text-muted">Creado: {new Date(tenant.created_at).toLocaleString()}</p>
          <p className="text-xs text-muted">Actualizado: {new Date(tenant.updated_at).toLocaleString()}</p>
        </div>
      </Collapsible>

      <div className="flex flex-wrap justify-between gap-3">
        <Button
          type="button"
          variant="danger"
          disabled={tenant.status === "archived" || isPending}
          onClick={() => {
            startTransition(async () => {
              const formData = new FormData();
              formData.set("tenantId", tenant.id);

              const result = await archiveTenantAction(formData);
              if (!result.ok) {
                toast.error(result.message);
                return;
              }

              toast.success(result.message);
            });
          }}
        >
          Archivar tenant
        </Button>

        <Button type="submit" isLoading={isPending}>
          Guardar cambios
        </Button>
      </div>
    </form>
  );
}
