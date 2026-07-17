import Link from "next/link";
import { CalendarDays } from "lucide-react";
import { StatePanel } from "@/components/ui/state-panel";
import { listChefEventsOverviewForTenant } from "@/lib/kitchen/event-catering/chef-costing";
import { resolveKitchenPage } from "../_lib/page-access";
import { EventCostingFilters } from "./_components/event-costing-filters";
import { EventCostingList } from "./_components/event-costing-list";
import { EventCostingSummaryCards } from "./_components/event-costing-summary-cards";

type KitchenEventsPageProps = {
  params: Promise<{ tenantSlug: string }>;
  searchParams: Promise<{ q?: string; status?: string; period?: string }>;
};

export default async function KitchenEventsPage({
  params,
  searchParams,
}: KitchenEventsPageProps) {
  const { tenantSlug } = await params;
  const rawSearchParams = await searchParams;
  const result = await resolveKitchenPage(tenantSlug, "event_catering", "overview");

  if (!result.ok) {
    return (
      <StatePanel
        kind="permission"
        title="Sin permisos de catering"
        message="Tu usuario no tiene acceso a eventos y costeo de cocina en este tenant."
      />
    );
  }

  const overview = await listChefEventsOverviewForTenant(result.tenant.tenantSlug, result.tenant.tenantId, {
    q: rawSearchParams.q,
    status: rawSearchParams.status,
    period: rawSearchParams.period,
  });

  if (overview.totalEvents === 0) {
    return (
      <div className="space-y-4">
        <section className="rounded-[var(--radius-base)] border border-border bg-surface p-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="space-y-2">
              <div className="inline-flex items-center gap-2">
                <span className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-border bg-surface-2">
                  <CalendarDays className="h-5 w-5 text-primary" aria-hidden="true" />
                </span>
                <div>
                  <p className="text-xs font-medium uppercase tracking-[0.08em] text-muted">Cocina</p>
                  <h1 className="text-xl font-semibold text-foreground">Eventos y costeo</h1>
                </div>
              </div>
              <p className="max-w-2xl text-sm text-muted">
                Configura servicios y recetas, guarda el costo inicial y actualízalo cuando cambien los precios.
              </p>
            </div>
            <Link
              href={`/${tenantSlug}/events/new`}
              className="inline-flex rounded-[var(--radius-base)] border border-border bg-surface-2 px-3 py-2 text-sm"
            >
              Crear evento
            </Link>
          </div>
        </section>
        <StatePanel
          kind="empty"
          title="Todavía no hay eventos para costear."
          message="Crea el primer evento para empezar a configurar servicios y recetas."
        />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <section className="rounded-[var(--radius-base)] border border-border bg-surface p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2">
              <span className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-border bg-surface-2">
                <CalendarDays className="h-5 w-5 text-primary" aria-hidden="true" />
              </span>
              <div>
                <p className="text-xs font-medium uppercase tracking-[0.08em] text-muted">Cocina</p>
                <h1 className="text-xl font-semibold text-foreground">Eventos y costeo</h1>
              </div>
            </div>
            <p className="max-w-2xl text-sm text-muted">
              Identifica qué evento requiere atención, qué falta por configurar y cuál es la siguiente acción para costearlo.
            </p>
          </div>
          <Link
            href={`/${tenantSlug}/events/new`}
            className="inline-flex rounded-[var(--radius-base)] border border-border bg-surface-2 px-3 py-2 text-sm"
          >
            Crear evento
          </Link>
        </div>
      </section>

      <EventCostingSummaryCards
        upcomingEvents={overview.metrics.upcomingEvents}
        requiresAttention={overview.metrics.requiresAttention}
        withNewPrices={overview.metrics.withNewPrices}
        costed={overview.metrics.costed}
      />

      <EventCostingFilters
        initialQuery={overview.filters.q}
        initialStatus={overview.filters.status}
        initialPeriod={overview.filters.period}
      />

      {overview.rows.length === 0 ? (
        <section className="rounded-[var(--radius-base)] border border-border bg-surface p-6">
          <StatePanel
            kind="empty"
            title="No encontramos eventos con estos filtros."
            message="Limpia o ajusta los filtros para ver más eventos."
          />
          <div className="mt-4 flex justify-center">
            <Link
              href={`/${tenantSlug}/kitchen/events`}
              className="inline-flex rounded-[var(--radius-base)] border border-border bg-surface-2 px-3 py-2 text-sm text-foreground"
            >
              Limpiar filtros
            </Link>
          </div>
        </section>
      ) : (
        <>
          <EventCostingList
            tenantSlug={tenantSlug}
            title="Próximos eventos que requieren acción"
            description="Eventos futuros que todavía necesitan configuración, costeo o revisión de precios."
            rows={overview.groupedRows.futureActionRequired}
          />
          <EventCostingList
            tenantSlug={tenantSlug}
            title="Próximos eventos con precios nuevos"
            description="Eventos futuros que ya pueden actualizar su costo con precios vigentes."
            rows={overview.groupedRows.futureAttention}
          />
          <EventCostingList
            tenantSlug={tenantSlug}
            title="Próximos eventos al día"
            description="Eventos futuros con costo inicial vigente o costo actualizado."
            rows={overview.groupedRows.futureCurrent}
          />
          <EventCostingList
            tenantSlug={tenantSlug}
            title="Eventos recientes"
            description="Referencia rápida de eventos pasados para consultar su costeo más reciente."
            rows={overview.groupedRows.recent}
          />
        </>
      )}
    </div>
  );
}
