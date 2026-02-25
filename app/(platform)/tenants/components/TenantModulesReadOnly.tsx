import type { TenantModuleRecord } from "@/lib/repos/types";

export function TenantModulesReadOnly({ modules }: { modules: TenantModuleRecord[] }) {
  if (modules.length === 0) {
    return (
      <div className="rounded-[var(--radius-base)] border border-border bg-surface-2 p-4 text-sm text-muted">
        Sin modulos activos para este tenant. Gestion avanzada de modulos: proximamente.
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {modules.map((moduleItem) => (
        <div
          key={moduleItem.id}
          className="rounded-[var(--radius-base)] border border-border bg-surface-2 p-3"
        >
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm font-medium">{moduleItem.module?.name ?? moduleItem.module_key}</p>
            <span className="text-xs text-muted">{moduleItem.enabled ? "enabled" : "disabled"}</span>
          </div>
          <p className="mt-1 text-xs text-muted">
            {moduleItem.module?.description ?? "Modulo sin descripcion"}
          </p>
        </div>
      ))}
    </div>
  );
}
