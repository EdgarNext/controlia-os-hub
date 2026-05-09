import { Suspense } from "react";
import { StatePanel } from "@/components/ui/state-panel";
import { getCurrentTenantModulePageAccessMap, hasModulePageAccess } from "@/lib/auth/module-page-access";
import { createPurchaseReceiptFromRequisitionAction } from "@/lib/kitchen/event-catering/actions";
import {
  listApprovedRequisitionsPendingReceipt,
  listPurchaseReceiptsOverview,
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
  const receiptsPromise = listPurchaseReceiptsOverview(result.tenant.tenantSlug);

  return (
    <div className="space-y-4">
      <KitchenPageHeader
        eyebrow="Recepciones"
        title="Recepciones"
        description="Crear recepción en draft no actualiza inventario. Confirmar recepción en detalle sí registra movimientos purchase."
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
      <h2 className="text-sm font-semibold text-foreground">Requisiciones aprobadas pendientes de recibir</h2>
      {approvedPending.length === 0 ? (
        <p className="mt-2 text-xs text-muted">No hay requisiciones approved pendientes de recepción.</p>
      ) : (
        <div className="mt-2 overflow-x-auto">
          <table className="min-w-full text-xs">
            <thead>
              <tr className="text-left text-muted">
                <th className="px-2 py-1">Requisición</th>
                <th className="px-2 py-1">Evento/Plan</th>
                <th className="px-2 py-1">Total</th>
                <th className="px-2 py-1">Líneas</th>
                <th className="px-2 py-1">Acción</th>
              </tr>
            </thead>
            <tbody>
              {approvedPending.map((row) => (
                <tr key={row.requisition_id} className="border-t border-border">
                  <td className="px-2 py-1 text-foreground">{row.requisition_id.slice(0, 8)}</td>
                  <td className="px-2 py-1 text-muted">{row.plan_name ?? row.plan_id?.slice(0, 8) ?? "—"}</td>
                  <td className="px-2 py-1 text-foreground">
                    ${row.estimated_total_cost.toLocaleString("es-MX", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </td>
                  <td className="px-2 py-1 text-muted">{row.line_count}</td>
                  <td className="px-2 py-1">
                    <div className="flex items-center gap-2">
                      <Link
                        href={`/${tenantSlug}/kitchen/events/requisitions/${row.requisition_id}`}
                        className="inline-flex rounded border border-border bg-surface px-2 py-1 text-xs"
                      >
                        Ver requisición
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
  receiptsPromise: ReturnType<typeof listPurchaseReceiptsOverview>;
}) {
  const receipts = await receiptsPromise;
  const draftReceipts = receipts.filter((row) => row.status === "draft");
  const receivedReceipts = receipts.filter((row) => row.status === "received");
  const canceledReceipts = receipts.filter((row) => row.status === "canceled");

  return (
    <>
      <section className="rounded-[var(--radius-base)] border border-border bg-surface p-4">
        <h2 className="text-sm font-semibold text-foreground">Recepciones draft</h2>
        {draftReceipts.length === 0 ? (
          <p className="mt-2 text-xs text-muted">No hay recepciones en draft.</p>
        ) : (
          <div className="mt-2 overflow-x-auto">
            <table className="min-w-full text-xs">
              <thead>
                <tr className="text-left text-muted">
                  <th className="px-2 py-1">Recepción</th>
                  <th className="px-2 py-1">Requisición</th>
                  <th className="px-2 py-1">Total</th>
                  <th className="px-2 py-1">Líneas</th>
                  <th className="px-2 py-1">Acción</th>
                </tr>
              </thead>
              <tbody>
                {draftReceipts.map((row) => (
                  <tr key={row.receipt_id} className="border-t border-border">
                    <td className="px-2 py-1 text-foreground">{row.receipt_id.slice(0, 8)}</td>
                    <td className="px-2 py-1 text-muted">{row.requisition_id.slice(0, 8)}</td>
                    <td className="px-2 py-1 text-foreground">
                      ${row.total_received_cost.toLocaleString("es-MX", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </td>
                    <td className="px-2 py-1 text-muted">
                      <div className="space-y-1">
                        <p>{row.line_count}</p>
                        {row.line_count === 0 ? (
                          <p className="text-[11px] text-warning">Inválida sin líneas</p>
                        ) : null}
                      </div>
                    </td>
                    <td className="px-2 py-1">
                      <Link
                        href={`/${tenantSlug}/kitchen/events/requisitions/${row.requisition_id}/receipts/${row.receipt_id}`}
                        className="inline-flex rounded border border-border bg-surface px-2 py-1 text-xs"
                      >
                        Continuar recepción
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="rounded-[var(--radius-base)] border border-border bg-surface p-4">
        <h2 className="text-sm font-semibold text-foreground">Recepciones recibidas</h2>
        {receivedReceipts.length === 0 ? (
          <p className="mt-2 text-xs text-muted">No hay recepciones confirmadas.</p>
        ) : (
          <div className="mt-2 overflow-x-auto">
            <table className="min-w-full text-xs">
              <thead>
                <tr className="text-left text-muted">
                  <th className="px-2 py-1">Recepción</th>
                  <th className="px-2 py-1">Requisición</th>
                  <th className="px-2 py-1">Recibida</th>
                  <th className="px-2 py-1">Total recibido</th>
                  <th className="px-2 py-1">Acción</th>
                </tr>
              </thead>
              <tbody>
                {receivedReceipts.map((row) => (
                  <tr key={row.receipt_id} className="border-t border-border">
                    <td className="px-2 py-1 text-foreground">{row.receipt_id.slice(0, 8)}</td>
                    <td className="px-2 py-1 text-muted">{row.requisition_id.slice(0, 8)}</td>
                    <td className="px-2 py-1 text-muted">{row.received_at ? new Date(row.received_at).toLocaleString("es-MX") : "—"}</td>
                    <td className="px-2 py-1 text-foreground">
                      ${row.total_received_cost.toLocaleString("es-MX", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </td>
                    <td className="px-2 py-1">
                      <Link
                        href={`/${tenantSlug}/kitchen/events/requisitions/${row.requisition_id}/receipts/${row.receipt_id}`}
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
        )}
      </section>

      <section className="rounded-[var(--radius-base)] border border-primary/20 bg-primary/10 p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="text-sm font-semibold text-foreground">Recepciones canceladas / historial</h2>
            <p className="mt-1 text-xs text-muted">Las recepciones canceladas no afectan inventario ni suman como recibido.</p>
          </div>
          <span className="rounded-full border border-border bg-surface px-2 py-1 text-[11px] text-muted">
            {canceledReceipts.length} canceladas
          </span>
        </div>
        {canceledReceipts.length === 0 ? (
          <p className="mt-2 text-xs text-muted">No hay recepciones canceladas.</p>
        ) : (
          <div className="mt-2 overflow-x-auto">
            <table className="min-w-full text-xs">
              <thead>
                <tr className="text-left text-muted">
                  <th className="px-2 py-1">Recepción</th>
                  <th className="px-2 py-1">Requisición</th>
                  <th className="px-2 py-1">Total histórico</th>
                  <th className="px-2 py-1">Líneas</th>
                  <th className="px-2 py-1">Estado</th>
                  <th className="px-2 py-1">Acción</th>
                </tr>
              </thead>
              <tbody>
                {canceledReceipts.map((row) => (
                  <tr key={row.receipt_id} className="border-t border-border">
                    <td className="px-2 py-1 text-foreground">{row.receipt_id.slice(0, 8)}</td>
                    <td className="px-2 py-1 text-muted">{row.requisition_id.slice(0, 8)}</td>
                    <td className="px-2 py-1 text-muted">
                      ${row.total_received_cost.toLocaleString("es-MX", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </td>
                    <td className="px-2 py-1 text-muted">{row.line_count}</td>
                    <td className="px-2 py-1">
                      <span className="rounded-full border border-border bg-surface px-2 py-1 text-[11px] text-muted">
                        Cancelada · no afecta inventario
                      </span>
                    </td>
                    <td className="px-2 py-1">
                      <Link
                        href={`/${tenantSlug}/kitchen/events/requisitions/${row.requisition_id}/receipts/${row.receipt_id}`}
                        className="inline-flex rounded border border-border bg-surface px-2 py-1 text-xs"
                      >
                        Ver historial
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </>
  );
}
