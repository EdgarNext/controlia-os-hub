import { Suspense } from "react";
import Link from "next/link";
import { StatePanel } from "@/components/ui/state-panel";
import { KitchenTableSkeleton } from "@/app/(tenant)/[tenantSlug]/kitchen/_components/kitchen-loading-skeletons";
import { KitchenPageHeader } from "@/app/(tenant)/[tenantSlug]/kitchen/_components/kitchen-page-header";
import { KitchenStatusBadge } from "@/app/(tenant)/[tenantSlug]/kitchen/_components/kitchen-status-badge";
import { listCateringRequisitionLineCountsByRequisitionIds, listCateringRequisitions } from "@/lib/kitchen/event-catering/queries";
import { resolveKitchenPage } from "../../_lib/page-access";

type KitchenEventsRequisitionsPageProps = {
  params: Promise<{ tenantSlug: string }>;
};

export default async function KitchenEventsRequisitionsPage({
  params,
}: KitchenEventsRequisitionsPageProps) {
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
      <KitchenPageHeader eyebrow="Compras sugeridas" title="Requisiciones de catering" />
      <Suspense fallback={<KitchenTableSkeleton rows={8} columns={5} />}>
        <RequisitionOverviewSection tenantSlug={result.tenant.tenantSlug} uiTenantSlug={tenantSlug} />
      </Suspense>
    </div>
  );
}

async function RequisitionOverviewSection({ tenantSlug, uiTenantSlug }: { tenantSlug: string; uiTenantSlug: string }) {
  const requisitions = await listCateringRequisitions(tenantSlug);

  if (requisitions.length === 0) {
    return (
      <StatePanel
        kind="empty"
        title="Sin requisiciones"
        message="Genera una requisición sugerida desde un plan de catering con faltantes."
      />
    );
  }

  const lineCountMap = await listCateringRequisitionLineCountsByRequisitionIds(
    tenantSlug,
    requisitions.map((req) => req.id),
  );
  const statusSummary = requisitions.reduce(
    (acc, req) => {
      acc[req.status] += 1;
      acc.total += Number(req.estimated_total_cost ?? 0);
      return acc;
    },
    { draft: 0, reviewed: 0, approved: 0, canceled: 0, total: 0 } as Record<"draft" | "reviewed" | "approved" | "canceled" | "total", number>,
  );

  return (
    <section className="rounded-[var(--radius-base)] border border-border bg-surface p-4">
      <p className="mt-1 text-xs text-muted">
        Borrador: {statusSummary.draft} · Revisada: {statusSummary.reviewed} · Aprobada: {statusSummary.approved} · Cancelada: {statusSummary.canceled} ·
        Total estimado: ${statusSummary.total.toLocaleString("es-MX", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
      </p>
      <p className="mt-1 text-xs text-muted">
        Aprobada no significa comprada ni recibida; no descuenta inventario en este MVP.
      </p>
      <div className="mt-3 space-y-2">
        {requisitions.map((req) => (
          <div key={req.id} className="rounded border border-border bg-surface-2 p-3 text-sm">
            <div className="flex items-center justify-between gap-2">
              <div>
                <p className="font-medium text-foreground">{req.event_catering_plans?.name ?? `Plan ${req.plan_id.slice(0, 8)}`}</p>
                <p className="text-xs text-muted">
                  Estado: <KitchenStatusBadge status={req.status} />
                  {" · "}Líneas: {lineCountMap.get(req.id) ?? 0} · Costo: ${Number(req.estimated_total_cost).toLocaleString("es-MX", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </p>
                {req.event_catering_plans?.event_id ? (
                  <p className="text-xs text-muted">
                    Evento:{" "}
                    <Link
                      href={`/${uiTenantSlug}/kitchen/events/${req.event_catering_plans.event_id}/catering/${req.plan_id}`}
                      className="underline underline-offset-2"
                    >
                      {req.event_catering_plans.event_id.slice(0, 8)}
                    </Link>
                  </p>
                ) : null}
              </div>
              <Link href={`/${uiTenantSlug}/kitchen/events/requisitions/${req.id}`} className="text-xs underline underline-offset-2">
                Ver detalle
              </Link>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
