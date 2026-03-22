import Link from "next/link";
import { getTenantModuleLaunchTarget } from "@/lib/navigation/module-launch";
import type { TenantModuleRecord } from "@/lib/repos/types";

type TenantModulesReadOnlyProps = {
  modules: TenantModuleRecord[];
  tenantSlug: string;
};

export function TenantModulesReadOnly({ modules, tenantSlug }: TenantModulesReadOnlyProps) {
  if (modules.length === 0) {
    return (
      <div className="rounded-[var(--radius-base)] border border-border bg-surface-2 p-4 text-sm text-muted">
        <p>Sin modulos activos para este tenant. Gestion avanzada de modulos: proximamente.</p>
        <Link href="/catalog" className="mt-3 inline-flex text-xs font-medium text-foreground underline underline-offset-4">
          Ir al catalogo de modulos de plataforma
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {modules.map((moduleItem) => {
        const launchTarget = moduleItem.enabled ? getTenantModuleLaunchTarget(moduleItem.module_key) : null;

        return (
          <div
            key={moduleItem.id}
            className="rounded-[var(--radius-base)] border border-border bg-surface-2 p-3"
          >
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="space-y-1">
                <p className="text-sm font-medium">{moduleItem.module?.name ?? moduleItem.module_key}</p>
                <p className="text-xs text-muted">{moduleItem.module_key}</p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs text-muted">{moduleItem.enabled ? "enabled" : "disabled"}</span>
                {launchTarget ? (
                  <Link
                    href={launchTarget.href(tenantSlug)}
                    className="inline-flex items-center justify-center rounded-[var(--radius-base)] border border-border bg-surface px-3 py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-surface-2"
                  >
                    Abrir {launchTarget.label}
                  </Link>
                ) : moduleItem.enabled ? (
                  <span className="text-xs text-muted">Sin ruta directa</span>
                ) : null}
              </div>
            </div>
            <p className="mt-1 text-xs text-muted">
              {moduleItem.module?.description ?? "Modulo sin descripcion"}
            </p>
          </div>
        );
      })}
      <div className="pt-2">
        <Link href="/catalog" className="text-xs font-medium text-foreground underline underline-offset-4">
          Gestionar asignacion de modulos en plataforma
        </Link>
      </div>
    </div>
  );
}
