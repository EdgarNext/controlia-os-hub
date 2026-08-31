import Link from "next/link";
import { Suspense } from "react";
import type { Metadata } from "next";
import { CalendarDays } from "lucide-react";
import { StatePanel } from "@/components/ui/state-panel";
import { KitchenPageHeader } from "../_components/kitchen-page-header";
import { listChefEventsOverviewForTenant } from "@/lib/kitchen/event-catering/chef-costing";
import { resolveTenantModuleContext } from "@/lib/auth/module-role-guard";
import { isTenantAccessDeniedError } from "../../../lib/access-errors";
import { resolveKitchenPage } from "../_lib/page-access";
import { EventCostingFilters } from "./_components/event-costing-filters";
import { EventCostingList } from "./_components/event-costing-list";
import { EventCostingSummaryCards } from "./_components/event-costing-summary-cards";
import { CostingStatusGuide } from "./_components/costing-status-guide";
import { KitchenEventsContentSkeleton } from "../_components/kitchen-loading-skeletons";
import { EventsNavigationShell, EventsResultsFrame } from "./_components/events-navigation-shell";

type KitchenEventsPageProps = {
  params: Promise<{ tenantSlug: string }>;
  searchParams: Promise<{ q?: string; status?: string; period?: string }>;
};

export const metadata: Metadata = { title: "Eventos y costeo" };

export default async function KitchenEventsPage({
  params,
  searchParams,
}: KitchenEventsPageProps) {
  const { tenantSlug } = await params;
  const rawSearchParams = await searchParams;

  return (
    <div className="space-y-4">
      <KitchenPageHeader
        eyebrow="Cocina"
        title="Eventos y costeo"
        description="Identifica qué evento requiere atención, qué falta por configurar y cuál es la siguiente acción para costearlo."
        icon={<CalendarDays className="h-5 w-5" aria-hidden="true" />}
      />
      <Suspense fallback={<KitchenEventsContentSkeleton />}>
        <KitchenEventsContent tenantSlug={tenantSlug} searchParams={rawSearchParams} />
      </Suspense>
    </div>
  );
}

async function KitchenEventsContent({
  tenantSlug,
  searchParams,
}: {
  tenantSlug: string;
  searchParams: { q?: string; status?: string; period?: string };
}) {
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

  const [overview, canCreateEvent] = await Promise.all([
    listChefEventsOverviewForTenant(result.tenant.tenantSlug, result.tenant.tenantId, {
      q: searchParams.q,
      status: searchParams.status,
      period: searchParams.period,
    }),
    canCreateCanonicalEvent(tenantSlug),
  ]);

  if (overview.totalEvents === 0) {
    return (
      <div className="space-y-4">
        {canCreateEvent ? <CreateEventLink tenantSlug={tenantSlug} /> : null}
        <StatePanel
          kind="empty"
          title="Todavía no hay eventos para costear."
          message="Crea el primer evento para empezar a configurar servicios y recetas."
        />
      </div>
    );
  }

  return (
    <EventsNavigationShell>
      <div className="space-y-4">
        {canCreateEvent ? <CreateEventLink tenantSlug={tenantSlug} /> : null}

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

        <EventsResultsFrame>
          <CostingStatusGuide />

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
        </EventsResultsFrame>
      </div>
    </EventsNavigationShell>
  );
}

async function canCreateCanonicalEvent(tenantSlug: string): Promise<boolean> {
  try {
    await resolveTenantModuleContext(tenantSlug, "event_core", "manage");
    return true;
  } catch (error) {
    if (isTenantAccessDeniedError(error)) {
      return false;
    }

    throw error;
  }
}

function CreateEventLink({ tenantSlug }: { tenantSlug: string }) {
  return (
    <div className="flex justify-end">
      <Link
        href={`/${tenantSlug}/events/new`}
        className="inline-flex rounded-[var(--radius-base)] border border-border bg-primary px-3 py-2 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90"
      >
        Crear evento
      </Link>
    </div>
  );
}
