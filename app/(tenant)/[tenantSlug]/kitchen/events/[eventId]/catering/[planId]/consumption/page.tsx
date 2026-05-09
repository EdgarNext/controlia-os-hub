import Link from "next/link";
import { StatePanel } from "@/components/ui/state-panel";
import { getCurrentTenantModulePageAccessMap, hasModulePageAccess } from "@/lib/auth/module-page-access";
import { createConsumptionDraftFromPlanAction, regenerateConsumptionDraftFromPlanAction } from "@/lib/kitchen/event-catering/actions";
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
  const draftRecord = rows.find((row) => row.status === "draft");
  const confirmedRecord = rows.find((row) => row.status === "confirmed");

  if (!plan || plan.event_id !== eventId) {
    return <StatePanel kind="empty" title="Plan no encontrado" message="El plan no existe o no corresponde al evento." />;
  }

  return (
    <div className="space-y-4">
      <section className="rounded-[var(--radius-base)] border border-border bg-surface p-4">
        <h1 className="text-lg font-semibold text-foreground">Consumo del plan {plan.name ?? plan.id.slice(0, 8)}</h1>
        <p className="mt-1 text-xs text-muted">
          El consumo en borrador no descuenta inventario. Al confirmar consumo se crearán salidas reales de inventario.
        </p>
        {canManage ? (
          <div className="mt-3 flex flex-wrap items-center gap-2">
            {draftRecord ? (
              <>
                <Link
                  href={`/${tenantSlug}/kitchen/events/${eventId}/catering/${planId}/consumption/${draftRecord.id}`}
                  className="inline-flex rounded border border-border bg-surface px-3 py-1 text-xs"
                >
                  Abrir consumo en borrador
                </Link>
                <form action={regenerateConsumptionDraftFromPlanAction}>
                  <input type="hidden" name="tenantSlug" value={tenantSlug} />
                  <input type="hidden" name="planId" value={plan.id} />
                  <input type="hidden" name="confirmRegenerate" value="true" />
                  <KitchenSubmitButton pendingLabel="Regenerando..." variant="secondary" className="px-3 py-1 text-xs">
                    Regenerar propuesta
                  </KitchenSubmitButton>
                </form>
              </>
            ) : confirmedRecord ? (
              <Link
                href={`/${tenantSlug}/kitchen/events/${eventId}/catering/${planId}/consumption/${confirmedRecord.id}`}
                className="inline-flex rounded border border-border bg-surface px-3 py-1 text-xs"
              >
                Ver consumo confirmado
              </Link>
            ) : (
              <form action={createConsumptionDraftFromPlanAction}>
                <input type="hidden" name="tenantSlug" value={tenantSlug} />
                <input type="hidden" name="planId" value={plan.id} />
                <KitchenSubmitButton pendingLabel="Preparando..." variant="secondary" className="px-3 py-1 text-xs">
                  Preparar consumo
                </KitchenSubmitButton>
              </form>
            )}
          </div>
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
                    <td className="px-2 py-1 text-foreground">{row.status === "draft" ? "Borrador" : row.status === "confirmed" ? "Confirmado" : "Cancelado"}</td>
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
