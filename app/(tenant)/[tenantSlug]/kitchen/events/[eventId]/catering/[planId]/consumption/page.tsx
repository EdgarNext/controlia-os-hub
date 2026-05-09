import Link from "next/link";
import { StatePanel } from "@/components/ui/state-panel";
import { getCurrentTenantModulePageAccessMap, hasModulePageAccess } from "@/lib/auth/module-page-access";
import { createConsumptionDraftFromPlanAction } from "@/lib/kitchen/event-catering/actions";
import { getCateringPlan, listConsumptionRecordsForPlan } from "@/lib/kitchen/event-catering/queries";
import { resolveKitchenPage } from "../../../../../_lib/page-access";
import { KitchenSubmitButton } from "@/app/(tenant)/[tenantSlug]/kitchen/_components/kitchen-submit-button";

type KitchenPlanConsumptionPageProps = {
  params: Promise<{ tenantSlug: string; eventId: string; planId: string }>;
};

export default async function KitchenPlanConsumptionPage({ params }: KitchenPlanConsumptionPageProps) {
  const { tenantSlug, eventId, planId } = await params;
  const result = await resolveKitchenPage(tenantSlug, "event_catering", "consumption");
  if (!result.ok) {
    return <StatePanel kind="permission" title="Sin permisos" message="No tienes acceso a consumo de catering." />;
  }

  const [plan, rows, accessMap] = await Promise.all([
    getCateringPlan(result.tenant.tenantSlug, planId),
    listConsumptionRecordsForPlan(result.tenant.tenantSlug, planId),
    getCurrentTenantModulePageAccessMap(result.tenant.tenantId, "event_catering"),
  ]);
  const canManage = hasModulePageAccess(accessMap.consumption ?? "none", "manage");

  if (!plan || plan.event_id !== eventId) {
    return <StatePanel kind="empty" title="Plan no encontrado" message="El plan no existe o no corresponde al evento." />;
  }

  return (
    <div className="space-y-4">
      <section className="rounded-[var(--radius-base)] border border-border bg-surface p-4">
        <h1 className="text-lg font-semibold text-foreground">Consumo del plan {plan.name ?? plan.id.slice(0, 8)}</h1>
        <p className="mt-1 text-xs text-muted">Esta fase no confirma consumo ni descuenta inventario.</p>
        {canManage ? (
          <form action={createConsumptionDraftFromPlanAction} className="mt-3">
            <input type="hidden" name="tenantSlug" value={tenantSlug} />
            <input type="hidden" name="planId" value={plan.id} />
            <KitchenSubmitButton
              pendingLabel="Creando..."
              variant="secondary"
              className="px-3 py-1 text-xs"
            >
              Crear/Refrescar consumo draft
            </KitchenSubmitButton>
          </form>
        ) : null}
      </section>

      {rows.length === 0 ? (
        <StatePanel kind="empty" title="Sin consumos" message="Aún no existe consumo draft para este plan." />
      ) : (
        <section className="rounded-[var(--radius-base)] border border-border bg-surface p-4">
          <div className="overflow-x-auto">
            <table className="min-w-full text-xs">
              <thead>
                <tr className="text-left text-muted">
                  <th className="px-2 py-1">Consumo</th>
                  <th className="px-2 py-1">Estado</th>
                  <th className="px-2 py-1">Creado</th>
                  <th className="px-2 py-1">Acción</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.id} className="border-t border-border">
                    <td className="px-2 py-1 text-foreground">{row.id.slice(0, 8)}</td>
                    <td className="px-2 py-1 text-foreground">{row.status}</td>
                    <td className="px-2 py-1 text-muted">{new Date(row.created_at).toLocaleString("es-MX")}</td>
                    <td className="px-2 py-1">
                      <Link
                        href={`/${tenantSlug}/kitchen/events/${eventId}/catering/${planId}/consumption/${row.id}`}
                        className="inline-flex rounded border border-border bg-surface px-2 py-1 text-xs"
                      >
                        Abrir
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  );
}
