import Link from "next/link";
import { StatePanel } from "@/components/ui/state-panel";
import { getCurrentTenantModulePageAccessMap, hasModulePageAccess } from "@/lib/auth/module-page-access";
import {
  getCateringOverviewSummary,
  listCateringPlanSummaries,
  listCateringShortageSummary,
  listEventsForCatering,
} from "@/lib/kitchen/event-catering/queries";
import { resolveKitchenPage } from "../_lib/page-access";

type KitchenEventsPageProps = {
  params: Promise<{ tenantSlug: string }>;
};

export default async function KitchenEventsPage({ params }: KitchenEventsPageProps) {
  const { tenantSlug } = await params;
  const result = await resolveKitchenPage(tenantSlug, "event_catering", "overview");

  if (!result.ok) {
    return (
      <StatePanel
        kind="permission"
        title="Sin permisos de catering"
        message="Tu usuario no tiene acceso a operación de catering por evento en este tenant."
      />
    );
  }

  const accessMap = await getCurrentTenantModulePageAccessMap(result.tenant.tenantId, "event_catering");
  const canReadPlans = hasModulePageAccess(accessMap.plans ?? "none", "read");
  const canReadRequirements = hasModulePageAccess(accessMap.requirements ?? "none", "read");
  const canReadRequisitions = hasModulePageAccess(accessMap.requisitions ?? "none", "read");

  const [events, summary, planSummaries, shortageSummary] = await Promise.all([
    listEventsForCatering(result.tenant.tenantSlug),
    getCateringOverviewSummary(result.tenant.tenantSlug),
    canReadPlans ? listCateringPlanSummaries(result.tenant.tenantSlug) : Promise.resolve([]),
    canReadRequirements ? listCateringShortageSummary(result.tenant.tenantSlug) : Promise.resolve([]),
  ]);

  return (
    <div className="space-y-4">
      <section className="rounded-[var(--radius-base)] border border-border bg-surface p-4">
        <h1 className="text-lg font-semibold text-foreground">Catering por Evento</h1>
        <p className="mt-2 text-sm text-muted">
          Esta sección se integrará con eventos existentes en <code>public.events</code>.
          No se creará una entidad paralela de eventos.
        </p>
      </section>

      <div className="flex flex-wrap items-center gap-2">
        {canReadRequisitions ? (
          <Link
            href={`/${tenantSlug}/kitchen/events/requisitions`}
            className="inline-flex rounded-[var(--radius-base)] border border-border bg-surface-2 px-3 py-2 text-sm"
          >
            Requisiciones
          </Link>
        ) : null}
      </div>

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <article className="rounded-[var(--radius-base)] border border-border bg-surface p-4">
          <p className="text-xs text-muted">Planes activos</p>
          <p className="mt-1 text-lg font-semibold text-foreground">
            {summary.plans_by_status.draft + summary.plans_by_status.planned}
          </p>
        </article>
        <article className="rounded-[var(--radius-base)] border border-border bg-surface p-4">
          <p className="text-xs text-muted">Costo estimado catering</p>
          <p className="mt-1 text-lg font-semibold text-foreground">
            ${summary.total_estimated_catering_cost.toLocaleString("es-MX", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </p>
        </article>
        <article className="rounded-[var(--radius-base)] border border-border bg-surface p-4">
          <p className="text-xs text-muted">Faltantes</p>
          <p className={`mt-1 text-lg font-semibold ${summary.total_shortages > 0 ? "text-amber-600" : "text-foreground"}`}>{summary.total_shortages}</p>
        </article>
        <article className="rounded-[var(--radius-base)] border border-border bg-surface p-4">
          <p className="text-xs text-muted">Requisiciones (D/R/A)</p>
          <p className="mt-1 text-lg font-semibold text-foreground">
            {summary.requisitions_by_status.draft}/{summary.requisitions_by_status.reviewed}/{summary.requisitions_by_status.approved}
          </p>
        </article>
      </section>
      <p className="text-xs text-muted">
        Las requisiciones aprobadas son sugerencias de compra; aún no descuentan inventario.
      </p>

      {events.length === 0 ? (
        <StatePanel
          kind="empty"
          title="Sin eventos disponibles"
          message="Crea eventos en el módulo de Eventos para iniciar planeación de catering."
        />
      ) : (
        <section className="rounded-[var(--radius-base)] border border-border bg-surface p-4">
          <h2 className="text-sm font-semibold text-foreground">Eventos disponibles</h2>
          <div className="mt-2 overflow-x-auto">
            <table className="w-full min-w-[860px] text-left text-sm">
              <thead className="text-xs uppercase tracking-[0.08em] text-muted">
                <tr>
                  <th className="py-2">Evento</th>
                  <th className="py-2">Estado</th>
                  <th className="py-2">Inicio</th>
                  <th className="py-2">Invitados</th>
                  <th className="py-2">Acción</th>
                </tr>
              </thead>
              <tbody>
                {events.map((event) => (
                  <tr key={event.id} className="border-t border-border">
                    <td className="py-2">{event.name}</td>
                    <td className="py-2">{event.status}</td>
                    <td className="py-2">{event.starts_at ? new Date(event.starts_at).toLocaleString("es-MX") : "—"}</td>
                    <td className="py-2">{event.expected_attendance ?? "—"}</td>
                    <td className="py-2">
                      <Link href={`/${tenantSlug}/kitchen/events/${event.id}/catering`} className="underline underline-offset-2">
                        Abrir catering
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {canReadPlans ? (
        <section className="rounded-[var(--radius-base)] border border-border bg-surface p-4">
        <h2 className="text-sm font-semibold text-foreground">Planes recientes</h2>
        {planSummaries.length === 0 ? (
          <p className="mt-2 text-sm text-muted">No hay planes de catering registrados.</p>
        ) : (
          <div className="mt-2 overflow-x-auto">
            <table className="w-full min-w-[860px] text-left text-sm">
              <thead className="text-xs uppercase tracking-[0.08em] text-muted">
                <tr>
                  <th className="py-2">Plan</th>
                  <th className="py-2">Estado</th>
                  <th className="py-2">Evento</th>
                  <th className="py-2 text-right">Recetas</th>
                  <th className="py-2 text-right">Faltantes</th>
                  <th className="py-2">Req.</th>
                  <th className="py-2 text-right">Costo estimado</th>
                </tr>
              </thead>
              <tbody>
                {planSummaries.slice(0, 20).map((plan) => (
                  <tr key={plan.plan_id} className="border-t border-border">
                    <td className="py-2">{plan.plan_name ?? `Plan ${plan.plan_id.slice(0, 8)}`}</td>
                    <td className="py-2">
                      <span className="inline-flex rounded-full border border-border px-2 py-0.5 text-xs">
                        {plan.plan_status}
                      </span>
                    </td>
                    <td className="py-2">
                      <Link href={`/${tenantSlug}/kitchen/events/${plan.event_id}/catering/${plan.plan_id}`} className="underline underline-offset-2">
                        {plan.event_name ?? plan.event_id.slice(0, 8)}
                      </Link>
                    </td>
                    <td className="py-2 text-right">{plan.recipe_count}</td>
                    <td className="py-2 text-right">{plan.shortages_count}</td>
                    <td className="py-2">
                      {plan.requisition_id ? (
                        <Link href={`/${tenantSlug}/kitchen/events/requisitions/${plan.requisition_id}`} className="underline underline-offset-2">
                          <span className="inline-flex rounded-full border border-border px-2 py-0.5 text-xs">
                            {plan.requisition_status ?? "—"}
                          </span>
                        </Link>
                      ) : "—"}
                    </td>
                    <td className="py-2 text-right">${Number(plan.estimated_plan_cost).toLocaleString("es-MX", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        </section>
      ) : null}

      {canReadRequirements ? (
        <section className="rounded-[var(--radius-base)] border border-border bg-surface p-4">
          <h2 className="text-sm font-semibold text-foreground">Principales faltantes consolidados</h2>
          {shortageSummary.length === 0 ? (
            <p className="mt-2 text-sm text-muted">Sin faltantes consolidados.</p>
          ) : (
            <div className="mt-2 overflow-x-auto">
              <table className="w-full min-w-[860px] text-left text-sm">
                <thead className="text-xs uppercase tracking-[0.08em] text-muted">
                  <tr>
                    <th className="py-2">Insumo</th>
                    <th className="py-2">Unidad</th>
                    <th className="py-2 text-right">Requerido</th>
                    <th className="py-2 text-right">Disponible</th>
                    <th className="py-2 text-right">Faltante</th>
                    <th className="py-2 text-right">Costo faltante</th>
                    <th className="py-2 text-right">Planes</th>
                  </tr>
                </thead>
                <tbody>
                  {shortageSummary.slice(0, 20).map((row) => (
                    <tr key={`${row.item_id}:${row.unit_id}`} className="border-t border-border">
                      <td className="py-2">{row.item_name ?? row.item_id.slice(0, 8)}</td>
                      <td className="py-2">{row.unit_code ?? "ud"}</td>
                      <td className="py-2 text-right">{row.total_required.toLocaleString("es-MX", { minimumFractionDigits: 2, maximumFractionDigits: 4 })}</td>
                      <td className="py-2 text-right">{row.total_available.toLocaleString("es-MX", { minimumFractionDigits: 2, maximumFractionDigits: 4 })}</td>
                      <td className="py-2 text-right">{row.total_shortage.toLocaleString("es-MX", { minimumFractionDigits: 2, maximumFractionDigits: 4 })}</td>
                      <td className="py-2 text-right">${row.estimated_shortage_cost.toLocaleString("es-MX", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                      <td className="py-2 text-right">{row.plans_affected}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      ) : null}
    </div>
  );
}
