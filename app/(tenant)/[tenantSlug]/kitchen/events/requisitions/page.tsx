import { Suspense } from "react";
import Link from "next/link";
import { StatePanel } from "@/components/ui/state-panel";
import { KitchenTableSkeleton } from "@/app/(tenant)/[tenantSlug]/kitchen/_components/kitchen-loading-skeletons";
import { KitchenPageHeader } from "@/app/(tenant)/[tenantSlug]/kitchen/_components/kitchen-page-header";
import { listCateringRequisitionOperationalIndex } from "@/lib/kitchen/event-catering/queries";
import { resolveKitchenPage } from "../../_lib/page-access";

type KitchenEventsRequisitionsPageProps = {
  params: Promise<{ tenantSlug: string }>;
};

const statusCopy: Record<string, string> = {
  draft: "Borrador",
  reviewed: "Revisada",
  approved: "Autorizada",
  canceled: "Cancelada",
};

export default async function KitchenEventsRequisitionsPage({ params }: KitchenEventsRequisitionsPageProps) {
  const { tenantSlug } = await params;
  const result = await resolveKitchenPage(tenantSlug, "event_catering", "requisitions");

  if (!result.ok) {
    return (
      <StatePanel
        kind="permission"
        title="Sin permisos para requisiciones"
        message="No tienes acceso a la página de requisiciones de catering."
      />
    );
  }

  return (
    <div className="space-y-4">
      <KitchenPageHeader
        eyebrow="Compras sugeridas"
        title="Requisiciones de catering"
        description="Consulta estado operativo, cotización y recepción por evento y servicio."
      />
      <Suspense fallback={<KitchenTableSkeleton rows={8} columns={6} />}>
        <RequisitionOverviewSection tenantSlug={result.tenant.tenantSlug} uiTenantSlug={tenantSlug} />
      </Suspense>
    </div>
  );
}

async function RequisitionOverviewSection({ tenantSlug, uiTenantSlug }: { tenantSlug: string; uiTenantSlug: string }) {
  const requisitions = await listCateringRequisitionOperationalIndex(tenantSlug);

  if (requisitions.length === 0) {
    return (
      <StatePanel
        kind="empty"
        title="Sin requisiciones"
        message="Genera una requisición sugerida desde un servicio de catering con faltantes."
      />
    );
  }

  return (
    <section className="rounded-[var(--radius-base)] border border-border bg-surface p-4">
      <div className="overflow-x-auto">
        <table className="min-w-full text-xs">
          <thead>
            <tr className="text-left text-muted">
              <th className="px-2 py-1">Requisición</th>
              <th className="px-2 py-1">Evento</th>
              <th className="px-2 py-1">Servicio</th>
              <th className="px-2 py-1">Estado</th>
              <th className="px-2 py-1">Totales</th>
              <th className="px-2 py-1">Recepción</th>
              <th className="px-2 py-1">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {requisitions.map((req) => (
              <tr key={req.requisition_id} className="border-t border-border transition-colors hover:bg-surface-2/50">
                <td className="px-2 py-1 text-foreground">{req.requisition_id.slice(0, 8)}</td>
                <td className="px-2 py-1 text-muted">
                  <p>{req.event_name ?? "Evento"}</p>
                  <p className="text-[11px]">{req.event_date ? new Date(req.event_date).toLocaleString("es-MX") : "—"}</p>
                </td>
                <td className="px-2 py-1 text-foreground">{req.plan_name ?? `Servicio ${req.plan_id.slice(0, 8)}`}</td>
                <td className="px-2 py-1 text-foreground">{statusCopy[req.status] ?? req.status}</td>
                <td className="px-2 py-1 text-muted">
                  <p>Preliminar: ${req.preliminary_total.toLocaleString("es-MX", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                  <p>Cotizado: ${req.quoted_total.toLocaleString("es-MX", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                  <p>Autorizado: ${req.approved_total.toLocaleString("es-MX", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                  <p className="text-[11px]">Pend. cotizar: {req.pending_quote_lines}</p>
                </td>
                <td className="px-2 py-1 text-foreground">{req.receipt_status_summary}</td>
                <td className="px-2 py-1">
                  <div className="flex flex-col gap-1">
                    <Link href={`/${uiTenantSlug}/kitchen/events/requisitions/${req.requisition_id}`} className="underline underline-offset-2">
                      Abrir requisición
                    </Link>
                    {req.event_id ? (
                      <Link href={`/${uiTenantSlug}/kitchen/events/${req.event_id}/catering/${req.plan_id}`} className="underline underline-offset-2">
                        Abrir plan
                      </Link>
                    ) : null}
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
