import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { StatePanel } from "@/components/ui/state-panel";
import { listModuleCatalog, listTenantModuleAssignments } from "@/lib/repos/modulesRepo";
import { listTenants } from "@/lib/repos/tenantsRepo";
import { ModuleAssignmentForm } from "./components/ModuleAssignmentForm";

function getStatusVariant(status: "active" | "deprecated" | "planned"): "success" | "warning" | "danger" {
  if (status === "active") return "success";
  if (status === "planned") return "warning";
  return "danger";
}

function getTenantStatusBadgeVariant(
  status: "active" | "inactive" | "archived",
): "success" | "warning" | "danger" {
  if (status === "active") return "success";
  if (status === "inactive") return "warning";
  return "danger";
}

export default async function PlatformCatalogPage() {
  const [modules, tenants, assignments] = await Promise.all([
    listModuleCatalog(),
    listTenants(null),
    listTenantModuleAssignments(),
  ]);

  return (
    <div className="space-y-6">
      <Card className="space-y-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="space-y-1">
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-muted">Platform Catalog</p>
            <h1 className="text-2xl font-semibold text-foreground">Catálogo de módulos</h1>
            <p className="max-w-3xl text-sm text-muted">
              Aquí puedes ver los módulos declarados en la plataforma y asignarlos a tenants específicos.
              La asignación se guarda en <code>tenant_modules</code>.
            </p>
          </div>
          <div className="grid min-w-[220px] gap-2 rounded-[var(--radius-base)] border border-border bg-surface-2 p-3 text-sm">
            <div className="flex items-center justify-between gap-4">
              <span className="text-muted">Módulos definidos</span>
              <span className="font-semibold text-foreground">{modules.length}</span>
            </div>
            <div className="flex items-center justify-between gap-4">
              <span className="text-muted">Tenants disponibles</span>
              <span className="font-semibold text-foreground">{tenants.length}</span>
            </div>
            <div className="flex items-center justify-between gap-4">
              <span className="text-muted">Asignaciones registradas</span>
              <span className="font-semibold text-foreground">{assignments.length}</span>
            </div>
          </div>
        </div>
      </Card>

      {modules.length === 0 ? (
        <StatePanel
          kind="empty"
          title="Sin módulos registrados"
          message="No existen entradas en modules_catalog. Registra módulos primero para poder asignarlos."
        />
      ) : (
        <div className="grid gap-4 xl:grid-cols-2">
          {modules.map((moduleItem) => {
            const moduleAssignments = assignments.filter((assignment) => assignment.module_key === moduleItem.module_key);
            const enabledAssignments = moduleAssignments.filter((assignment) => assignment.enabled);
            const disabledAssignments = moduleAssignments.filter((assignment) => !assignment.enabled);

            return (
              <Card key={moduleItem.module_key} className="space-y-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="text-lg font-semibold text-foreground">{moduleItem.name}</h2>
                      <Badge variant={getStatusVariant(moduleItem.status)}>{moduleItem.status}</Badge>
                    </div>
                    <p className="font-mono text-xs text-muted">{moduleItem.module_key}</p>
                    <p className="text-sm text-muted">
                      {moduleItem.description || "Sin descripción documental todavía."}
                    </p>
                  </div>

                  <div className="grid min-w-[180px] gap-2 rounded-[var(--radius-base)] border border-border bg-surface-2 p-3 text-sm">
                    <div className="flex items-center justify-between gap-4">
                      <span className="text-muted">Tenants activos</span>
                      <span className="font-semibold text-foreground">{enabledAssignments.length}</span>
                    </div>
                    <div className="flex items-center justify-between gap-4">
                      <span className="text-muted">Tenants desactivados</span>
                      <span className="font-semibold text-foreground">{disabledAssignments.length}</span>
                    </div>
                  </div>
                </div>

                <ModuleAssignmentForm
                  moduleKey={moduleItem.module_key}
                  tenants={tenants.map((tenant) => ({
                    id: tenant.id,
                    name: tenant.name,
                    slug: tenant.slug,
                    status: tenant.status,
                  }))}
                />

                <div className="space-y-2">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm font-medium text-foreground">Asignaciones actuales</p>
                    <p className="text-xs text-muted">{moduleAssignments.length} registros</p>
                  </div>

                  {moduleAssignments.length === 0 ? (
                    <StatePanel
                      kind="empty"
                      title="Sin asignaciones todavía"
                      message="Este módulo aún no ha sido asignado a ningún tenant."
                    />
                  ) : (
                    <div className="space-y-2">
                      {moduleAssignments.map((assignment) => (
                        <div
                          key={assignment.id}
                          className="flex flex-wrap items-center justify-between gap-3 rounded-[var(--radius-base)] border border-border bg-surface-2 p-3"
                        >
                          <div className="space-y-1">
                            <p className="text-sm font-medium text-foreground">
                              {assignment.tenant?.name ?? "Tenant no disponible"}
                            </p>
                            <p className="text-xs text-muted">
                              {assignment.tenant?.slug ?? "sin-slug"} · creado {new Date(assignment.created_at).toLocaleString("es-MX")}
                            </p>
                          </div>
                          <div className="flex flex-wrap items-center gap-2">
                            {assignment.tenant ? (
                              <Badge variant={getTenantStatusBadgeVariant(assignment.tenant.status)}>
                                tenant {assignment.tenant.status}
                              </Badge>
                            ) : null}
                            <Badge variant={assignment.enabled ? "success" : "warning"}>
                              {assignment.enabled ? "enabled" : "disabled"}
                            </Badge>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
