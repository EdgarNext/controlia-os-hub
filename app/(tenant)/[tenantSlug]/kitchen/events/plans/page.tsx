import Link from "next/link";
import { StatePanel } from "@/components/ui/state-panel";
import { KitchenPageHeader } from "@/app/(tenant)/[tenantSlug]/kitchen/_components/kitchen-page-header";
import { listCateringPlanOperationalIndex } from "@/lib/kitchen/event-catering/queries";
import { resolveKitchenPage } from "../../_lib/page-access";

type KitchenEventsPlansPageProps = {
  params: Promise<{ tenantSlug: string }>;
};

const receiptCopy: Record<string, string> = {
  none: "Sin recepción",
  draft: "Borrador",
  received: "Recibida",
  mixed: "Mixto",
};

const consumptionCopy: Record<string, string> = {
  none: "Sin consumo",
  draft: "Borrador",
  confirmed: "Confirmado",
  mixed: "Mixto",
};

export default async function KitchenEventsPlansPage({ params }: KitchenEventsPlansPageProps) {
  const { tenantSlug } = await params;
  const result = await resolveKitchenPage(tenantSlug, "event_catering", "plans");
  if (!result.ok) {
    return (
      <StatePanel
        kind="permission"
        title="Sin permisos para servicios"
        message="No tienes acceso al índice operativo de servicios de catering."
      />
    );
  }

  const rows = await listCateringPlanOperationalIndex(result.tenant.tenantSlug);

  return (
    <div className="space-y-4">
      <KitchenPageHeader
        eyebrow="Catering por Evento"
        title="Servicios de catering"
        description="Índice operativo global para abrir servicios, revisar estatus y avanzar compras/consumo."
      />

      <section className="rounded-[var(--radius-base)] border border-border bg-surface p-4">
        {rows.length === 0 ? (
          <StatePanel kind="empty" title="Sin servicios" message="Crea un servicio desde un evento para iniciar operación." />
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-xs">
              <thead>
                <tr className="text-left text-muted">
                  <th className="px-2 py-1">Servicio</th>
                  <th className="px-2 py-1">Evento</th>
                  <th className="px-2 py-1">Fecha</th>
                  <th className="px-2 py-1">Recetas</th>
                  <th className="px-2 py-1">Req.</th>
                  <th className="px-2 py-1">Faltantes</th>
                  <th className="px-2 py-1">Requisición</th>
                  <th className="px-2 py-1">Recepción</th>
                  <th className="px-2 py-1">Consumo</th>
                  <th className="px-2 py-1">Estado operativo</th>
                  <th className="px-2 py-1">Acción</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.plan_id} className="border-t border-border transition-colors hover:bg-surface-2/50">
                    <td className="px-2 py-1 text-foreground">{row.plan_name ?? `Servicio ${row.plan_id.slice(0, 8)}`}</td>
                    <td className="px-2 py-1 text-foreground">{row.event_name ?? row.event_id.slice(0, 8)}</td>
                    <td className="px-2 py-1 text-muted">{row.event_date ? new Date(row.event_date).toLocaleString("es-MX") : "—"}</td>
                    <td className="px-2 py-1 text-foreground">{row.recipes_count}</td>
                    <td className="px-2 py-1 text-foreground">{row.requirements_count}</td>
                    <td className="px-2 py-1 text-foreground">{row.shortage_count}</td>
                    <td className="px-2 py-1 text-muted">{row.latest_requisition_status ? row.latest_requisition_status : "Sin requisición"}</td>
                    <td className="px-2 py-1 text-muted">{receiptCopy[row.receipt_status_summary] ?? row.receipt_status_summary}</td>
                    <td className="px-2 py-1 text-muted">{consumptionCopy[row.consumption_status_summary] ?? row.consumption_status_summary}</td>
                    <td className="px-2 py-1 text-foreground">{row.operational_status}</td>
                    <td className="px-2 py-1">
                      <Link
                        href={`/${tenantSlug}/kitchen/events/${row.event_id}/catering/${row.plan_id}`}
                        className="inline-flex rounded border border-border bg-surface px-2 py-1 text-xs"
                      >
                        Abrir servicio
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
