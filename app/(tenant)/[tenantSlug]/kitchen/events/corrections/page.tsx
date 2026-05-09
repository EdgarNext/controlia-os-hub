import { Suspense } from "react";
import Link from "next/link";
import { StatePanel } from "@/components/ui/state-panel";
import { cancelInventoryReversalDraftAction, createInventoryReversalDraftAction } from "@/lib/kitchen/event-catering/actions";
import { listInventoryReversals } from "@/lib/kitchen/event-catering/queries";
import {
  KitchenTableSkeleton,
} from "../../_components/kitchen-loading-skeletons";
import { KitchenPageHeader } from "../../_components/kitchen-page-header";
import { KitchenSubmitButton } from "../../_components/kitchen-submit-button";
import { resolveKitchenPage } from "../../_lib/page-access";

type KitchenEventsCorrectionsPageProps = {
  params: Promise<{ tenantSlug: string }>;
};

export default async function KitchenEventsCorrectionsPage({ params }: KitchenEventsCorrectionsPageProps) {
  const { tenantSlug } = await params;
  const result = await resolveKitchenPage(tenantSlug, "event_catering", "requisitions");

  if (!result.ok) {
    return (
      <StatePanel
        kind="permission"
        title="Sin permisos para correcciones"
        message="No tienes acceso al tablero de correcciones de catering."
      />
    );
  }

  const reversalsPromise = listInventoryReversals(result.tenant.tenantSlug);

  return (
    <div className="space-y-4">
      <KitchenPageHeader
        eyebrow="Correcciones"
        title="Correcciones de inventario"
        description="Las correcciones no borran movimientos históricos. Una corrección aplicada crea movimientos compensatorios y conserva trazabilidad completa."
      />

      <CreateReversalSection tenantSlug={tenantSlug} />

      <Suspense fallback={<KitchenTableSkeleton rows={8} columns={10} />}>
        <ReversalsListSection tenantSlug={tenantSlug} reversalsPromise={reversalsPromise} />
      </Suspense>
    </div>
  );
}

function CreateReversalSection({ tenantSlug }: { tenantSlug: string }) {
  return (
    <section className="rounded-[var(--radius-base)] border border-border bg-surface p-4">
      <h2 className="text-sm font-semibold text-foreground">Crear draft de reversa</h2>
      <form action={createInventoryReversalDraftAction} className="mt-3 grid gap-3 sm:grid-cols-2">
        <input type="hidden" name="tenantSlug" value={tenantSlug} />
        <label className="grid gap-1 text-xs text-muted">
          Tipo
          <select name="reversalType" className="rounded border border-border bg-surface px-2 py-1 text-sm text-foreground" defaultValue="consumption">
            <option value="consumption">Consumo</option>
            <option value="receipt">Recepción</option>
          </select>
        </label>
        <label className="grid gap-1 text-xs text-muted">
          Target
          <select name="targetType" className="rounded border border-border bg-surface px-2 py-1 text-sm text-foreground" defaultValue="consumption_line">
            <option value="consumption_line">Línea de consumo</option>
            <option value="receipt_line">Línea de recepción</option>
          </select>
        </label>
        <label className="grid gap-1 text-xs text-muted sm:col-span-2">
          Target ID
          <input name="targetId" required className="rounded border border-border bg-surface px-2 py-1 text-sm text-foreground" />
        </label>
        <label className="grid gap-1 text-xs text-muted sm:col-span-2">
          Motivo (mínimo 8 caracteres)
          <input name="reason" required minLength={8} className="rounded border border-border bg-surface px-2 py-1 text-sm text-foreground" />
        </label>
        <label className="grid gap-1 text-xs text-muted sm:col-span-2">
          Notas
          <textarea name="notes" rows={2} className="rounded border border-border bg-surface px-2 py-1 text-sm text-foreground" />
        </label>
        <div className="sm:col-span-2">
          <KitchenSubmitButton pendingLabel="Guardando..." className="px-3 py-1.5 text-sm">
            Crear draft
          </KitchenSubmitButton>
        </div>
      </form>
    </section>
  );
}

async function ReversalsListSection({
  tenantSlug,
  reversalsPromise,
}: {
  tenantSlug: string;
  reversalsPromise: ReturnType<typeof listInventoryReversals>;
}) {
  const reversals = await reversalsPromise;
  const statusTone = (status: string) => {
    if (status === "applied") return "bg-emerald-500/10 text-emerald-700";
    if (status === "canceled") return "bg-primary/10 text-foreground";
    return "bg-amber-500/10 text-amber-700";
  };

  return (
    <section className="rounded-[var(--radius-base)] border border-border bg-surface p-4">
      <h2 className="text-sm font-semibold text-foreground">Reversas registradas</h2>
      {reversals.length === 0 ? (
        <p className="mt-2 text-xs text-muted">Sin reversas registradas.</p>
      ) : (
        <div className="mt-2 overflow-x-auto">
          <table className="min-w-full text-xs">
            <thead>
              <tr className="text-left text-muted">
                <th className="px-2 py-1">ID</th>
                <th className="px-2 py-1">Tipo</th>
                <th className="px-2 py-1">Target</th>
                <th className="px-2 py-1">Status</th>
                <th className="px-2 py-1">Líneas</th>
                <th className="px-2 py-1">Compensación</th>
                <th className="px-2 py-1">Motivo</th>
                <th className="px-2 py-1">Creada</th>
                <th className="px-2 py-1">Aplicada</th>
                <th className="px-2 py-1">Acción</th>
              </tr>
            </thead>
            <tbody>
              {reversals.map((row) => (
                <tr key={row.id} className="border-t border-border">
                  <td className="px-2 py-1 text-foreground">{row.id.slice(0, 8)}</td>
                  <td className="px-2 py-1 text-muted">{row.reversal_type}</td>
                  <td className="px-2 py-1 text-muted">
                    {row.target_type}:{" "}
                    <span className="text-foreground">{row.target_id.slice(0, 8)}</span>
                  </td>
                  <td className="px-2 py-1">
                    <span className={`inline-flex rounded px-2 py-0.5 text-[11px] font-medium ${statusTone(row.status)}`}>
                      {row.status === "draft" ? "Pendiente de aplicar" : row.status === "applied" ? "Aplicada" : "Cancelada"}
                    </span>
                  </td>
                  <td className="px-2 py-1 text-muted">{row.line_count ?? 0}</td>
                  <td className="px-2 py-1 text-muted">
                    {(row.compensated_line_count ?? 0) > 0 ? `${row.compensated_line_count}/${row.line_count ?? 0}` : "—"}
                  </td>
                  <td className="px-2 py-1 text-foreground">{row.reason}</td>
                  <td className="px-2 py-1 text-muted">{new Date(row.created_at).toLocaleString("es-MX")}</td>
                  <td className="px-2 py-1 text-muted">{row.applied_at ? new Date(row.applied_at).toLocaleString("es-MX") : "—"}</td>
                  <td className="px-2 py-1">
                    <div className="flex items-center gap-2">
                      <Link href={`/${tenantSlug}/kitchen/events/corrections/${row.id}`} className="underline underline-offset-2">
                        Ver
                      </Link>
                      {row.status === "draft" ? (
                        <form action={cancelInventoryReversalDraftAction}>
                          <input type="hidden" name="tenantSlug" value={tenantSlug} />
                          <input type="hidden" name="reversalId" value={row.id} />
                          <KitchenSubmitButton pendingLabel="Cancelando..." className="px-2 py-1 text-xs">
                            Cancelar
                          </KitchenSubmitButton>
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
  );
}
