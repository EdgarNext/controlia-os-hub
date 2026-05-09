import Link from "next/link";
import { StatePanel } from "@/components/ui/state-panel";
import { createCateringPlanAction } from "@/lib/kitchen/event-catering/actions";
import { getEventForCatering, listCateringPlans } from "@/lib/kitchen/event-catering/queries";
import { resolveKitchenPage } from "../../../_lib/page-access";

type KitchenEventCateringPageProps = {
  params: Promise<{ tenantSlug: string; eventId: string }>;
};

export default async function KitchenEventCateringPage({ params }: KitchenEventCateringPageProps) {
  const { tenantSlug, eventId } = await params;
  const result = await resolveKitchenPage(tenantSlug, "event_catering", "plans");

  if (!result.ok) {
    return <StatePanel kind="permission" title="Sin permisos" message="No tienes acceso a planes de catering." />;
  }

  const [plans, event] = await Promise.all([
    listCateringPlans(result.tenant.tenantSlug, eventId),
    getEventForCatering(result.tenant.tenantSlug, eventId),
  ]);
  const suggestedGuestCount =
    event?.expected_attendance != null && Number(event.expected_attendance) > 0
      ? Number(event.expected_attendance)
      : null;

  return (
    <div className="space-y-4">
      <section className="rounded-[var(--radius-base)] border border-border bg-surface p-4">
        <h1 className="text-lg font-semibold text-foreground">Catering por evento</h1>
        <p className="mt-2 text-sm text-muted">
          Evento: {event?.name ?? eventId}
          {suggestedGuestCount != null ? ` · asistencia esperada ${suggestedGuestCount.toLocaleString("es-MX")}` : ""}
        </p>
      </section>

      <form action={createCateringPlanAction} className="space-y-2 rounded-[var(--radius-base)] border border-border bg-surface p-4">
        <input type="hidden" name="tenantSlug" value={tenantSlug} />
        <input type="hidden" name="eventId" value={eventId} />
        <p className="text-sm font-semibold text-foreground">Crear plan de catering</p>
        <input name="name" placeholder="Plan principal" className="h-10 w-full rounded-[var(--radius-base)] border border-border bg-surface-2 px-3 text-sm" />
        <input
          name="plannedGuestCount"
          type="number"
          min="1"
          step="1"
          defaultValue={suggestedGuestCount != null ? String(suggestedGuestCount) : undefined}
          placeholder="Invitados/base del plan"
          aria-label="Invitados o base del plan"
          className="h-10 w-full rounded-[var(--radius-base)] border border-border bg-surface-2 px-3 text-sm"
        />
        <p className="text-xs text-muted">
          Se sugiere la asistencia esperada del evento. Puedes ajustarla si este plan aplica solo a una parte de asistentes.
        </p>
        <textarea name="notes" placeholder="Notas" className="min-h-20 w-full rounded-[var(--radius-base)] border border-border bg-surface-2 px-3 py-2 text-sm" />
        <button type="submit" className="inline-flex rounded-[var(--radius-base)] border border-border bg-surface-2 px-3 py-2 text-sm">Crear plan</button>
      </form>

      {plans.length === 0 ? (
        <StatePanel kind="empty" title="Sin planes" message="Crea el primer plan para este evento." />
      ) : (
        <section className="rounded-[var(--radius-base)] border border-border bg-surface p-4">
          <h2 className="text-sm font-semibold text-foreground">Planes del evento</h2>
          <div className="mt-2 space-y-2">
            {plans.map((plan) => (
              <div key={plan.id} className="flex items-center justify-between rounded border border-border bg-surface-2 p-2 text-sm">
                <div>
                  <p className="font-medium text-foreground">{plan.name ?? `Plan ${plan.id.slice(0, 8)}`}</p>
                  <p className="text-xs text-muted">
                    status={plan.status} · base plan={plan.planned_guest_count ?? "—"} · costo=${Number(plan.estimated_total_cost).toLocaleString("es-MX", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </p>
                </div>
                <Link href={`/${tenantSlug}/kitchen/events/${eventId}/catering/${plan.id}`} className="underline underline-offset-2">
                  Abrir
                </Link>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
