import { Suspense } from "react";
import Link from "next/link";
import { StatePanel } from "@/components/ui/state-panel";
import { getCurrentTenantModulePageAccessMap, hasModulePageAccess } from "@/lib/auth/module-page-access";
import {
  getCateringOverviewSummary,
  listCateringPlanSummaries,
  listCateringShortageSummary,
  listEventsForCatering,
} from "@/lib/kitchen/event-catering/queries";
import {
  KitchenCardGridSkeleton,
  KitchenTableSkeleton,
} from "../_components/kitchen-loading-skeletons";
import { KitchenMetricCard } from "../_components/kitchen-metric-card";
import { KitchenPageHeader } from "../_components/kitchen-page-header";
import { KitchenStatusBadge } from "../_components/kitchen-status-badge";
import { resolveKitchenPage } from "../_lib/page-access";
import { EventCateringBadge } from "./_components/event-catering-badge";

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

  const summaryPromise = getCateringOverviewSummary(result.tenant.tenantSlug);
  const eventsPromise = listEventsForCatering(result.tenant.tenantSlug);
  const planSummariesPromise = canReadPlans ? listCateringPlanSummaries(result.tenant.tenantSlug) : null;
  const shortageSummaryPromise = canReadRequirements ? listCateringShortageSummary(result.tenant.tenantSlug) : null;

  return (
    <div className="space-y-4">
      <KitchenPageHeader
        eyebrow="Catering"
        title="Panel operativo de catering"
        description="Vista general de servicios, faltantes y avance operativo de cocina por evento."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Link href={`/${tenantSlug}/kitchen/events/plans`} className="inline-flex rounded-[var(--radius-base)] border border-border bg-surface-2 px-3 py-2 text-sm">
              Abrir servicios
            </Link>
            {canReadRequisitions ? (
              <Link
                href={`/${tenantSlug}/kitchen/events/requisitions`}
                className="inline-flex rounded-[var(--radius-base)] border border-border bg-surface-2 px-3 py-2 text-sm"
              >
                Requisiciones
              </Link>
            ) : null}
          </div>
        }
      />

      <Suspense fallback={<KitchenCardGridSkeleton cards={4} />}>
        <CateringSummarySection summaryPromise={summaryPromise} />
      </Suspense>

      <Suspense fallback={<KitchenTableSkeleton rows={8} columns={5} />}>
        <CateringEventsTableSection
          tenantSlug={tenantSlug}
          eventsPromise={eventsPromise}
          planSummariesPromise={planSummariesPromise}
        />
      </Suspense>

      {canReadPlans && planSummariesPromise ? (
        <Suspense fallback={<KitchenTableSkeleton rows={8} columns={7} />}>
          <RecentPlansSection tenantSlug={tenantSlug} planSummariesPromise={planSummariesPromise} />
        </Suspense>
      ) : null}

      {canReadRequirements && shortageSummaryPromise ? (
        <Suspense fallback={<KitchenTableSkeleton rows={8} columns={7} />}>
          <ShortageSummarySection shortageSummaryPromise={shortageSummaryPromise} />
        </Suspense>
      ) : null}
    </div>
  );
}

async function CateringSummarySection({
  summaryPromise,
}: {
  summaryPromise: ReturnType<typeof getCateringOverviewSummary>;
}) {
  const summary = await summaryPromise;
  return (
    <>
      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <KitchenMetricCard label="Servicios activos" value={summary.active_services_count} />
        <KitchenMetricCard
          label="Costo estimado total"
          value={`$${summary.total_estimated_catering_cost.toLocaleString("es-MX", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
        />
        <KitchenMetricCard label="Servicios con faltantes" value={summary.services_with_shortages_count} tone={summary.services_with_shortages_count > 0 ? "warning" : "default"} />
        <KitchenMetricCard
          label="Servicios listos para requisición"
          value={summary.services_ready_for_requisition_count}
        />
        <KitchenMetricCard label="Servicios listos para consumo" value={summary.services_ready_for_consumption_count} />
      </section>
      <p className="text-xs text-muted">Las requisiciones aprobadas siguen siendo sugerencias de compra; aún no descuentan inventario.</p>
    </>
  );
}

async function CateringEventsTableSection({
  tenantSlug,
  eventsPromise,
  planSummariesPromise,
}: {
  tenantSlug: string;
  eventsPromise: ReturnType<typeof listEventsForCatering>;
  planSummariesPromise: ReturnType<typeof listCateringPlanSummaries> | null;
}) {
  const [events, planSummaries] = await Promise.all([eventsPromise, planSummariesPromise ?? Promise.resolve([])]);
  const planCountByEvent = new Map<string, number>();
  for (const plan of planSummaries) {
    planCountByEvent.set(plan.event_id, (planCountByEvent.get(plan.event_id) ?? 0) + 1);
  }
  if (events.length === 0) {
    return (
      <StatePanel
        kind="empty"
        title="Sin eventos disponibles"
        message="Crea eventos en el módulo de Eventos para iniciar planeación de catering."
      />
    );
  }

  return (
    <section className="rounded-[var(--radius-base)] border border-border bg-surface p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-foreground">Eventos para planear catering</h2>
          <p className="mt-1 text-xs text-muted">Eventos del tenant que pueden abrir o recibir servicios de catering.</p>
        </div>
      </div>
      <div className="mt-2 overflow-x-auto">
        <table className="w-full min-w-[980px] text-left text-sm">
          <thead className="text-xs uppercase tracking-[0.08em] text-muted">
            <tr>
              <th className="py-2">Evento</th>
              <th className="py-2">Estado</th>
              <th className="py-2">Inicio</th>
              <th className="py-2">Invitados</th>
              <th className="py-2">Servicios</th>
              <th className="py-2">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {events.map((event) => (
              <tr key={event.id} className="border-t border-border transition-colors hover:bg-surface-2/50">
                <td className="py-2">{event.name}</td>
                <td className="py-2"><KitchenStatusBadge status={event.status} /></td>
                <td className="py-2">{event.starts_at ? new Date(event.starts_at).toLocaleString("es-MX") : "—"}</td>
                <td className="py-2">{event.expected_attendance ?? "—"}</td>
                <td className="py-2">{planCountByEvent.get(event.id) ?? 0}</td>
                <td className="py-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <Link href={`/${tenantSlug}/kitchen/events/${event.id}/catering`} className="underline underline-offset-2">
                      Abrir servicios
                    </Link>
                    <Link href={`/${tenantSlug}/kitchen/events/${event.id}/catering`} className="underline underline-offset-2">
                      Crear servicio
                    </Link>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

async function RecentPlansSection({
  tenantSlug,
  planSummariesPromise,
}: {
  tenantSlug: string;
  planSummariesPromise: ReturnType<typeof listCateringPlanSummaries>;
}) {
  const planSummaries = await planSummariesPromise;
  return (
    <section className="rounded-[var(--radius-base)] border border-border bg-surface p-4">
      <h2 className="text-sm font-semibold text-foreground">Servicios recientes</h2>
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
                <tr key={plan.plan_id} className="border-t border-border transition-colors hover:bg-surface-2/50">
                  <td className="py-2">{plan.plan_name ?? `Plan ${plan.plan_id.slice(0, 8)}`}</td>
                  <td className="py-2"><KitchenStatusBadge status={plan.plan_status} /></td>
                  <td className="py-2">
                    <Link href={`/${tenantSlug}/kitchen/events/${plan.event_id}/catering/${plan.plan_id}`} className="underline underline-offset-2">
                      {plan.event_name ?? plan.event_id.slice(0, 8)}
                    </Link>
                  </td>
                  <td className="py-2 text-right">{plan.recipe_count}</td>
                  <td className="py-2 text-right">
                    {plan.shortages_count > 0 ? <EventCateringBadge label={`${plan.shortages_count} con faltante`} tone="warning" /> : <EventCateringBadge label="Sin faltantes" tone="success" />}
                  </td>
                  <td className="py-2">
                    {plan.requisition_id ? (
                      <Link href={`/${tenantSlug}/kitchen/events/requisitions/${plan.requisition_id}`} className="underline underline-offset-2">
                        <KitchenStatusBadge status={plan.requisition_status} />
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
  );
}

async function ShortageSummarySection({
  shortageSummaryPromise,
}: {
  shortageSummaryPromise: ReturnType<typeof listCateringShortageSummary>;
}) {
  const shortageSummary = await shortageSummaryPromise;
  return (
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
                <tr key={`${row.item_id}:${row.unit_id}`} className="border-t border-border transition-colors hover:bg-surface-2/50">
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
  );
}
