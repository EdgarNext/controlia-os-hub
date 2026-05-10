import { Suspense } from "react";
import { StatePanel } from "@/components/ui/state-panel";
import { getCurrentTenantModulePageAccessMap, hasModulePageAccess } from "@/lib/auth/module-page-access";
import { createPurchaseReceiptFromRequisitionAction } from "@/lib/kitchen/event-catering/actions";
import {
  listApprovedRequisitionsPendingReceipt,
  listPurchaseReceiptsOperationalOverview,
} from "@/lib/kitchen/event-catering/queries";
import {
  KitchenActionRowSkeleton,
  KitchenTableSkeleton,
} from "../../_components/kitchen-loading-skeletons";
import { KitchenPageHeader } from "../../_components/kitchen-page-header";
import { KitchenSubmitButton } from "../../_components/kitchen-submit-button";
import Link from "next/link";
import { resolveKitchenPage } from "../../_lib/page-access";

type KitchenEventReceiptsPageProps = {
  params: Promise<{ tenantSlug: string }>;
};

const requisitionStatusCopy: Record<string, string> = {
  draft: "Borrador",
  reviewed: "Revisada",
  approved: "Autorizada",
  canceled: "Cancelada",
};

const receiptStatusCopy: Record<string, string> = {
  draft: "Borrador",
  received: "Recibida",
  canceled: "Cancelada",
};

export default async function KitchenEventReceiptsPage({ params }: KitchenEventReceiptsPageProps) {
  const { tenantSlug } = await params;
  const result = await resolveKitchenPage(tenantSlug, "event_catering", "requisitions");
  if (!result.ok) {
    return (
      <StatePanel
        kind="permission"
        title="Sin permisos para recepciones"
        message="No tienes acceso al módulo de recepciones de catering."
      />
    );
  }

  const accessMap = await getCurrentTenantModulePageAccessMap(result.tenant.tenantId, "event_catering");
  const canManage = hasModulePageAccess(accessMap.requisitions ?? "none", "manage");
  const approvedPendingPromise = listApprovedRequisitionsPendingReceipt(result.tenant.tenantSlug);
  const receiptsPromise = listPurchaseReceiptsOperationalOverview(result.tenant.tenantSlug);

  return (
    <div className="space-y-4">
      <KitchenPageHeader
        eyebrow="Recepciones"
        title="Recepciones"
        description="Recepción recibida actualiza inventario. Recepción cancelada queda como historial y no afecta inventario."
      />

      <Suspense fallback={<KitchenTableSkeleton rows={6} columns={5} />}>
        <ApprovedPendingSection
          tenantSlug={tenantSlug}
          canManage={canManage}
          approvedPendingPromise={approvedPendingPromise}
        />
      </Suspense>

      <Suspense fallback={<KitchenActionRowSkeleton actions={2} />}>
        <ReceiptsOverviewSection tenantSlug={tenantSlug} receiptsPromise={receiptsPromise} />
      </Suspense>
    </div>
  );
}

async function ApprovedPendingSection({
  tenantSlug,
  canManage,
  approvedPendingPromise,
}: {
  tenantSlug: string;
  canManage: boolean;
  approvedPendingPromise: ReturnType<typeof listApprovedRequisitionsPendingReceipt>;
}) {
  const approvedPending = await approvedPendingPromise;

  return (
    <section className="rounded-[var(--radius-base)] border border-border bg-surface p-4">
      <h2 className="text-sm font-semibold text-foreground">Requisiciones autorizadas pendientes de recibir</h2>
      {approvedPending.length === 0 ? (
        <p className="mt-2 text-xs text-muted">No hay requisiciones autorizadas pendientes de recepción.</p>
      ) : (
        <div className="mt-2 overflow-x-auto">
          <table className="min-w-full text-xs">
            <thead>
              <tr className="text-left text-muted">
                <th className="px-2 py-1">Servicio</th>
                <th className="px-2 py-1">Evento</th>
                <th className="px-2 py-1">Total esperado</th>
                <th className="px-2 py-1">Líneas</th>
                <th className="px-2 py-1">Acción</th>
              </tr>
            </thead>
            <tbody>
              {approvedPending.map((row) => (
                <tr key={row.requisition_id} className="border-t border-border">
                  <td className="px-2 py-1 text-foreground">{row.plan_name ?? row.plan_id?.slice(0, 8) ?? "—"}</td>
                  <td className="px-2 py-1 text-muted">{row.event_id ? row.event_id.slice(0, 8) : "—"}</td>
                  <td className="px-2 py-1 text-foreground">
                    ${row.expected_receipt_total.toLocaleString("es-MX", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </td>
                  <td className="px-2 py-1 text-muted">{row.line_count}</td>
                  <td className="px-2 py-1">
                    <div className="flex items-center gap-2">
                      <Link
                        href={`/${tenantSlug}/kitchen/events/requisitions/${row.requisition_id}`}
                        className="inline-flex rounded border border-border bg-surface px-2 py-1 text-xs"
                      >
                        Abrir requisición
                      </Link>
                      {canManage ? (
                        row.can_create_receipt ? (
                          <form action={createPurchaseReceiptFromRequisitionAction}>
                            <input type="hidden" name="tenantSlug" value={tenantSlug} />
                            <input type="hidden" name="requisitionId" value={row.requisition_id} />
                            <KitchenSubmitButton pendingLabel="Creando recepción..." className="px-2 py-1 text-xs">
                              Crear recepción
                            </KitchenSubmitButton>
                          </form>
                        ) : (
                          <span className="rounded-full border border-warning/30 bg-warning/10 px-2 py-1 text-[11px] text-warning">
                            {row.receipt_block_reason ?? "No recibible"}
                          </span>
                        )
                      ) : null}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

async function ReceiptsOverviewSection({
  tenantSlug,
  receiptsPromise,
}: {
  tenantSlug: string;
  receiptsPromise: ReturnType<typeof listPurchaseReceiptsOperationalOverview>;
}) {
  const receipts = await receiptsPromise;
  const draftReceipts = receipts.filter((row) => row.receipt_status === "draft");
  const receivedReceipts = receipts.filter((row) => row.receipt_status === "received");
  const canceledReceipts = receipts.filter((row) => row.receipt_status === "canceled");

  const renderTable = (
    rows: typeof receipts,
    title: string,
    emptyLabel: string,
    muted = false,
  ) => (
    <section className={muted ? "rounded-[var(--radius-base)] border border-primary/20 bg-primary/10 p-4" : "rounded-[var(--radius-base)] border border-border bg-surface p-4"}>
      <h2 className="text-sm font-semibold text-foreground">{title}</h2>
      {rows.length === 0 ? (
        <p className="mt-2 text-xs text-muted">{emptyLabel}</p>
      ) : (
        <div className="mt-2 overflow-x-auto">
          <table className="min-w-full text-xs">
            <thead>
              <tr className="text-left text-muted">
                <th className="px-2 py-1">Evento</th>
                <th className="px-2 py-1">Servicio</th>
                <th className="px-2 py-1">Requisición</th>
                <th className="px-2 py-1">Estado req.</th>
                <th className="px-2 py-1">Estado recepción</th>
                <th className="px-2 py-1">Total esperado</th>
                <th className="px-2 py-1">Total recibido</th>
                <th className="px-2 py-1">Fecha recepción</th>
                <th className="px-2 py-1">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.receipt_id} className="border-t border-border">
                  <td className="px-2 py-1 text-foreground">
                    <p>{row.event_name ?? "Evento"}</p>
                    <p className="text-[11px] text-muted">{row.event_date ? new Date(row.event_date).toLocaleString("es-MX") : "—"}</p>
                  </td>
                  <td className="px-2 py-1 text-foreground">{row.plan_name ?? row.plan_id?.slice(0, 8) ?? "—"}</td>
                  <td className="px-2 py-1 text-muted">{row.requisition_id.slice(0, 8)}</td>
                  <td className="px-2 py-1 text-muted">{row.requisition_status ? requisitionStatusCopy[row.requisition_status] ?? row.requisition_status : "—"}</td>
                  <td className="px-2 py-1 text-foreground">{receiptStatusCopy[row.receipt_status] ?? row.receipt_status}</td>
                  <td className="px-2 py-1 text-foreground">${row.total_expected_cost.toLocaleString("es-MX", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                  <td className="px-2 py-1 text-foreground">${row.total_received_cost.toLocaleString("es-MX", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                  <td className="px-2 py-1 text-muted">{row.received_at ? new Date(row.received_at).toLocaleString("es-MX") : "—"}</td>
                  <td className="px-2 py-1">
                    <div className="flex flex-col gap-1">
                      <Link href={`/${tenantSlug}/kitchen/events/requisitions/${row.requisition_id}/receipts/${row.receipt_id}`} className="underline underline-offset-2">Abrir recepción</Link>
                      {row.plan_id && row.event_id ? (
                        <Link href={`/${tenantSlug}/kitchen/events/${row.event_id}/catering/${row.plan_id}`} className="underline underline-offset-2">Abrir plan</Link>
                      ) : null}
                      <Link href={`/${tenantSlug}/kitchen/events/requisitions/${row.requisition_id}`} className="underline underline-offset-2">Abrir requisición</Link>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );

  return (
    <>
      {renderTable(draftReceipts, "Recepciones en borrador", "No hay recepciones en borrador.")}
      {renderTable(receivedReceipts, "Recepciones recibidas", "No hay recepciones recibidas.")}
      {renderTable(canceledReceipts, "Recepciones canceladas / historial", "No hay recepciones canceladas.", true)}
    </>
  );
}
