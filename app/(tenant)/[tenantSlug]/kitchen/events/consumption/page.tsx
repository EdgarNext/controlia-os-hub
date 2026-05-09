import Link from "next/link";
import { StatePanel } from "@/components/ui/state-panel";
import { getConsumptionDraftReadiness, getConsumptionLineAvailability, listEventConsumptionOverview } from "@/lib/kitchen/event-catering/queries";
import { resolveKitchenPage } from "../../_lib/page-access";

type KitchenConsumptionOverviewPageProps = {
  params: Promise<{ tenantSlug: string }>;
};

export default async function KitchenConsumptionOverviewPage({ params }: KitchenConsumptionOverviewPageProps) {
  const { tenantSlug } = await params;
  const result = await resolveKitchenPage(tenantSlug, "event_catering", "consumption");
  if (!result.ok) {
    return (
      <StatePanel
        kind="permission"
        title="Sin permisos para consumos"
        message="No tienes acceso al tablero de consumos de catering."
      />
    );
  }

  const rows = await listEventConsumptionOverview(result.tenant.tenantSlug);
  const availabilityByConsumption = new Map<string, Awaited<ReturnType<typeof getConsumptionLineAvailability>>>();
  for (const row of rows) {
    availabilityByConsumption.set(row.id, await getConsumptionLineAvailability(result.tenant.tenantSlug, row.id));
  }

  return (
    <div className="space-y-4">
      <section className="rounded-[var(--radius-base)] border border-border bg-surface p-4">
        <h1 className="text-lg font-semibold text-foreground">Consumos de Catering</h1>
        <p className="mt-1 text-xs text-muted">
          En esta fase solo se gestiona consumo draft. La confirmación con salida de inventario queda para 7G-D.
        </p>
      </section>

      {rows.length === 0 ? (
        <StatePanel kind="empty" title="Sin consumos" message="Aún no existen registros de consumo para este tenant." />
      ) : (
        <section className="rounded-[var(--radius-base)] border border-border bg-surface p-4">
          <div className="overflow-x-auto">
            <table className="min-w-full text-xs">
              <thead>
                <tr className="text-left text-muted">
                  <th className="px-2 py-1">Consumo</th>
                  <th className="px-2 py-1">Estado</th>
                  <th className="px-2 py-1">Listo para confirmar</th>
                  <th className="px-2 py-1">Evento/Plan</th>
                  <th className="px-2 py-1">Creado</th>
                  <th className="px-2 py-1">Acción</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.id} className="border-t border-border">
                    <td className="px-2 py-1 text-foreground">{row.id.slice(0, 8)}</td>
                    <td className="px-2 py-1 text-foreground">{row.status}</td>
                    <td className="px-2 py-1 text-muted">
                      {(() => {
                        const readiness = getConsumptionDraftReadiness(
                          row.status,
                          availabilityByConsumption.get(row.id) ?? [],
                        );
                        return readiness.ready_to_confirm
                          ? "Sí"
                          : readiness.reason === "pending_location"
                            ? "Pendiente ubicación"
                            : readiness.reason === "insufficient_stock"
                              ? "Stock insuficiente"
                              : readiness.reason === "no_output"
                                ? "Sin salida"
                                : "Pendiente";
                      })()}
                    </td>
                    <td className="px-2 py-1 text-muted">{row.events?.name ?? row.event_id.slice(0, 8)} / {row.event_catering_plans?.name ?? row.plan_id.slice(0, 8)}</td>
                    <td className="px-2 py-1 text-muted">{new Date(row.created_at).toLocaleString("es-MX")}</td>
                    <td className="px-2 py-1">
                      <Link
                        href={`/${tenantSlug}/kitchen/events/${row.event_id}/catering/${row.plan_id}/consumption/${row.id}`}
                        className="inline-flex rounded border border-border bg-surface px-2 py-1 text-xs"
                      >
                        Ver detalle
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
