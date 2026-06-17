import Link from "next/link";
import { StatePanel } from "@/components/ui/state-panel";
import { KitchenPageHeader } from "@/app/(tenant)/[tenantSlug]/kitchen/_components/kitchen-page-header";
import { KitchenStatusBadge } from "@/app/(tenant)/[tenantSlug]/kitchen/_components/kitchen-status-badge";
import { listCateringPlanOperationalIndex } from "@/lib/kitchen/event-catering/queries";
import { resolveKitchenPage } from "../../_lib/page-access";
import { EventCateringBadge } from "../_components/event-catering-badge";

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

function getReceiptTone(status: string) {
  if (status === "received") return "success" as const;
  if (status === "draft" || status === "mixed") return "warning" as const;
  return "muted" as const;
}

function getConsumptionTone(status: string) {
  if (status === "confirmed") return "success" as const;
  if (status === "draft" || status === "mixed") return "warning" as const;
  return "muted" as const;
}

function getOperationalTone(status: string) {
  if (status === "Servicio cerrado" || status === "Listo para consumo") return "success" as const;
  if (status === "Con faltantes" || status === "Compra por recibir" || status === "Requisición pendiente") return "warning" as const;
  return "info" as const;
}

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
        description="Índice operativo para abrir servicios, revisar costo, faltantes y avance."
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
                  <th className="px-2 py-1">Base plan</th>
                  <th className="px-2 py-1">Recetas</th>
                  <th className="px-2 py-1">Requerimientos</th>
                  <th className="px-2 py-1">Faltantes</th>
                  <th className="px-2 py-1">Costo estimado</th>
                  <th className="px-2 py-1">Revisión de precios</th>
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
                    <td className="px-2 py-1 text-foreground">{row.planned_guest_count != null ? Number(row.planned_guest_count).toLocaleString("es-MX", { maximumFractionDigits: 2 }) : "—"}</td>
                    <td className="px-2 py-1 text-foreground">{row.recipes_count}</td>
                    <td className="px-2 py-1 text-foreground">{row.requirements_count}</td>
                    <td className="px-2 py-1 text-foreground">
                      {row.shortage_count > 0 ? <EventCateringBadge label={`${row.shortage_count} pendientes`} tone="warning" /> : <EventCateringBadge label="Listo" tone="success" />}
                    </td>
                    <td className="px-2 py-1 text-foreground">${Number(row.estimated_total_cost).toLocaleString("es-MX", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                    <td className="px-2 py-1 text-muted">
                      <EventCateringBadge
                        label={row.price_review_label}
                        tone={
                          row.price_review_status === "priced"
                            ? "success"
                            : row.price_review_status === "missing_prices"
                              ? "warning"
                              : row.price_review_status === "ready_to_review"
                                ? "info"
                                : "muted"
                        }
                      />
                    </td>
                    <td className="px-2 py-1 text-muted">
                      {row.latest_requisition_status ? <KitchenStatusBadge status={row.latest_requisition_status} /> : <EventCateringBadge label="Sin requisición" tone="muted" />}
                    </td>
                    <td className="px-2 py-1 text-muted"><EventCateringBadge label={receiptCopy[row.receipt_status_summary] ?? row.receipt_status_summary} tone={getReceiptTone(row.receipt_status_summary)} /></td>
                    <td className="px-2 py-1 text-muted"><EventCateringBadge label={consumptionCopy[row.consumption_status_summary] ?? row.consumption_status_summary} tone={getConsumptionTone(row.consumption_status_summary)} /></td>
                    <td className="px-2 py-1 text-foreground"><EventCateringBadge label={row.operational_status} tone={getOperationalTone(row.operational_status)} /></td>
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
