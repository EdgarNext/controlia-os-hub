import { StatePanel } from "@/components/ui/state-panel";
import { getCurrentTenantModulePageAccessMap, hasModulePageAccess } from "@/lib/auth/module-page-access";
import { createPurchaseReceiptFromRequisitionAction } from "@/lib/kitchen/event-catering/actions";
import {
  listApprovedRequisitionsPendingReceipt,
  listPurchaseReceiptsOverview,
} from "@/lib/kitchen/event-catering/queries";
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

  const [accessMap, approvedPending, receipts] = await Promise.all([
    getCurrentTenantModulePageAccessMap(result.tenant.tenantId, "event_catering"),
    listApprovedRequisitionsPendingReceipt(result.tenant.tenantSlug),
    listPurchaseReceiptsOverview(result.tenant.tenantSlug),
  ]);
  const canManage = hasModulePageAccess(accessMap.requisitions ?? "none", "manage");
  const draftReceipts = receipts.filter((row) => row.status === "draft");
  const receivedReceipts = receipts.filter((row) => row.status === "received");

  return (
    <div className="space-y-4">
      <section className="rounded-[var(--radius-base)] border border-border bg-surface p-4">
        <h1 className="text-lg font-semibold text-foreground">Recepciones</h1>
        <p className="mt-1 text-xs text-muted">
          Crear recepción en draft no actualiza inventario. Confirmar recepción en detalle sí registra movimientos purchase.
        </p>
      </section>

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
                          <form action={createPurchaseReceiptFromRequisitionAction}>
                            <input type="hidden" name="tenantSlug" value={tenantSlug} />
                            <input type="hidden" name="requisitionId" value={row.requisition_id} />
                            <button type="submit" className="inline-flex rounded border border-border bg-surface px-2 py-1 text-xs">
                              Crear recepción
                            </button>
                          </form>
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
                    <td className="px-2 py-1 text-muted">{row.line_count}</td>
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
    </div>
  );
}
