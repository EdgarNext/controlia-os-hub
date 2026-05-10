import Link from "next/link";
import { StatePanel } from "@/components/ui/state-panel";
import { KitchenPageHeader } from "@/app/(tenant)/[tenantSlug]/kitchen/_components/kitchen-page-header";
import { KitchenSubmitButton } from "@/app/(tenant)/[tenantSlug]/kitchen/_components/kitchen-submit-button";
import { createConsumptionDraftFromPlanAction } from "@/lib/kitchen/event-catering/actions";
import { listConsumptionOperationalCandidates, listEventConsumptionOverview } from "@/lib/kitchen/event-catering/queries";
import { resolveKitchenPage } from "../../_lib/page-access";

type KitchenConsumptionOverviewPageProps = {
  params: Promise<{ tenantSlug: string }>;
};

const requisitionChipCopy: Record<string, string> = {
  none: "Sin requisición",
  draft: "Requisición: borrador",
  reviewed: "Requisición: revisada",
  approved: "Requisición: autorizada",
  canceled: "Requisición: cancelada",
};

const receiptChipCopy: Record<string, string> = {
  none: "Recepción: pendiente",
  draft: "Recepción: borrador",
  received: "Recepción: recibida",
  mixed: "Recepción: mixta",
};

export default async function KitchenConsumptionOverviewPage({ params }: KitchenConsumptionOverviewPageProps) {
  const { tenantSlug } = await params;
  const result = await resolveKitchenPage(tenantSlug, "event_catering", "consumption");
  if (!result.ok) {
    return (
      <StatePanel
        kind="permission"
        title="Sin permisos para consumo real"
        message="No tienes acceso al tablero de consumo real de catering."
      />
    );
  }

  const [candidates, consumptions] = await Promise.all([
    listConsumptionOperationalCandidates(result.tenant.tenantSlug),
    listEventConsumptionOverview(result.tenant.tenantSlug),
  ]);

  const readyToPrepare = candidates.filter((row) => row.operational_bucket === "ready_to_prepare");
  const preparableWithWarnings = candidates.filter((row) => row.operational_bucket === "preparable_with_warnings");
  const blocked = candidates.filter((row) => row.operational_bucket === "blocked");

  const draftConsumptions = consumptions.filter((row) => row.status === "draft");
  const confirmedConsumptions = consumptions.filter((row) => row.status === "confirmed");

  return (
    <div className="space-y-4">
      <KitchenPageHeader
        eyebrow="Consumo real"
        title="Consumo real de eventos"
        description="Preparar consumo no descuenta inventario. La salida real ocurre solo al confirmar consumo."
      />

      <section className="rounded-[var(--radius-base)] border border-border bg-surface p-4">
        <h2 className="text-sm font-semibold text-foreground">Listos para preparar consumo</h2>
        {readyToPrepare.length === 0 ? (
          <p className="mt-2 text-xs text-muted">No hay planes listos para preparar consumo.</p>
        ) : (
          <CandidateTable tenantSlug={tenantSlug} rows={readyToPrepare} />
        )}
      </section>

      <section className="rounded-[var(--radius-base)] border border-primary/20 bg-primary/10 p-4">
        <h2 className="text-sm font-semibold text-foreground">Preparables con advertencias</h2>
        <p className="mt-1 text-xs text-muted">
          Puedes preparar el borrador operativo, pero no podrás confirmar salida hasta que haya inventario disponible/reservado.
        </p>
        {preparableWithWarnings.length === 0 ? (
          <p className="mt-2 text-xs text-muted">No hay planes preparables con advertencias.</p>
        ) : (
          <CandidateTable tenantSlug={tenantSlug} rows={preparableWithWarnings} showWarnings />
        )}
      </section>

      <section className="rounded-[var(--radius-base)] border border-border bg-surface p-4">
        <h2 className="text-sm font-semibold text-foreground">Consumos en borrador</h2>
        {draftConsumptions.length === 0 ? (
          <p className="mt-2 text-xs text-muted">No hay consumos en borrador.</p>
        ) : (
          <div className="mt-2 space-y-2">
            {draftConsumptions.map((row) => (
              <div key={row.id} className="rounded border border-border p-3 text-xs">
                <p className="text-foreground">{row.events?.name ?? row.event_id.slice(0, 8)} · {row.event_catering_plans?.name ?? row.plan_id.slice(0, 8)}</p>
                <div className="mt-1 flex flex-wrap items-center gap-2">
                  <Link href={`/${tenantSlug}/kitchen/events/${row.event_id}/catering/${row.plan_id}/consumption/${row.id}`} className="underline underline-offset-2">Abrir borrador</Link>
                  <Link href={`/${tenantSlug}/kitchen/events/${row.event_id}/catering/${row.plan_id}`} className="underline underline-offset-2">Abrir plan</Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="rounded-[var(--radius-base)] border border-border bg-surface p-4">
        <h2 className="text-sm font-semibold text-foreground">Consumos confirmados</h2>
        {confirmedConsumptions.length === 0 ? (
          <p className="mt-2 text-xs text-muted">No hay consumos confirmados.</p>
        ) : (
          <div className="mt-2 space-y-2">
            {confirmedConsumptions.map((row) => (
              <div key={row.id} className="rounded border border-border p-3 text-xs">
                <p className="text-foreground">{row.events?.name ?? row.event_id.slice(0, 8)} · {row.event_catering_plans?.name ?? row.plan_id.slice(0, 8)}</p>
                <p className="text-muted">Confirmado en: {row.confirmed_at ? new Date(row.confirmed_at).toLocaleString("es-MX") : "—"}</p>
                <Link href={`/${tenantSlug}/kitchen/events/${row.event_id}/catering/${row.plan_id}/consumption/${row.id}`} className="mt-1 inline-flex underline underline-offset-2">Ver consumo</Link>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="rounded-[var(--radius-base)] border border-border bg-surface p-4">
        <h2 className="text-sm font-semibold text-foreground">Bloqueados</h2>
        {blocked.length === 0 ? (
          <p className="mt-2 text-xs text-muted">Sin planes bloqueados.</p>
        ) : (
          <div className="mt-2 space-y-1">
            {blocked.map((plan) => (
              <div key={plan.plan_id} className="flex items-center justify-between gap-2 text-xs">
                <span className="text-foreground">{plan.event_name ?? "Evento"} · {plan.plan_name ?? plan.plan_id.slice(0, 8)} · {plan.blocking_reason ?? "Bloqueado"}</span>
                <Link href={`/${tenantSlug}/kitchen/events/${plan.event_id}/catering/${plan.plan_id}`} className="underline underline-offset-2">Abrir plan</Link>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function CandidateTable({
  tenantSlug,
  rows,
  showWarnings = false,
}: {
  tenantSlug: string;
  rows: Awaited<ReturnType<typeof listConsumptionOperationalCandidates>>;
  showWarnings?: boolean;
}) {
  return (
    <div className="mt-2 overflow-x-auto">
      <table className="min-w-full text-xs">
        <thead>
          <tr className="text-left text-muted">
            <th className="px-2 py-1">Evento</th>
            <th className="px-2 py-1">Servicio</th>
            <th className="px-2 py-1">Fecha</th>
            <th className="px-2 py-1">Chips operativos</th>
            <th className="px-2 py-1">Estado</th>
            <th className="px-2 py-1">Acción</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((plan) => (
            <tr key={plan.plan_id} className="border-t border-border transition-colors hover:bg-surface-2/50">
              <td className="px-2 py-1 text-foreground">{plan.event_name ?? plan.event_id.slice(0, 8)}</td>
              <td className="px-2 py-1 text-foreground">{plan.plan_name ?? plan.plan_id.slice(0, 8)}</td>
              <td className="px-2 py-1 text-muted">{plan.event_date ? new Date(plan.event_date).toLocaleString("es-MX") : "—"}</td>
              <td className="px-2 py-1 text-muted">
                <div className="flex flex-wrap gap-1">
                  <span className="rounded border border-border px-2 py-0.5">Req. calculados: {plan.requirements_count}</span>
                  <span className="rounded border border-border px-2 py-0.5">{requisitionChipCopy[plan.requisition_status_summary] ?? plan.requisition_status_summary}</span>
                  <span className="rounded border border-border px-2 py-0.5">{receiptChipCopy[plan.receipt_status_summary] ?? plan.receipt_status_summary}</span>
                  <span className="rounded border border-border px-2 py-0.5">Reserva suficiente: {plan.reserve_sufficient ? "Sí" : "No"}</span>
                  <span className="rounded border border-border px-2 py-0.5">Faltantes: {plan.shortage_count}</span>
                </div>
              </td>
              <td className="px-2 py-1 text-foreground">{plan.blocking_reason ?? "Listo para preparar consumo"}</td>
              <td className="px-2 py-1">
                <div className="flex flex-col gap-1">
                  <form action={createConsumptionDraftFromPlanAction}>
                    <input type="hidden" name="tenantSlug" value={tenantSlug} />
                    <input type="hidden" name="planId" value={plan.plan_id} />
                    <KitchenSubmitButton pendingLabel="Preparando..." className="px-2 py-1 text-xs">
                      Preparar consumo
                    </KitchenSubmitButton>
                  </form>
                  {showWarnings ? <span className="text-[11px] text-warning">Confirmación se bloquea hasta resolver stock/reserva.</span> : null}
                  <Link href={`/${tenantSlug}/kitchen/events/${plan.event_id}/catering/${plan.plan_id}`} className="underline underline-offset-2">Abrir plan</Link>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
