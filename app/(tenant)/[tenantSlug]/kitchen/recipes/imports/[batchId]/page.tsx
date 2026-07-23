import { notFound } from "next/navigation";
import { Suspense } from "react";
import { StatePanel } from "@/components/ui/state-panel";
import { getCurrentTenantModulePageAccessMap, hasModulePageAccess } from "@/lib/auth/module-page-access";
import { getRecipeImportBatch, listPendingImportRowsByRecipe, listRecipeImportRows } from "@/lib/kitchen/recipes/import-queries";
import { resolveKitchenPage } from "../../../_lib/page-access";
import {
  ApplyRecipeImportBatchForm,
  RevalidateRecipeImportBatchForm,
  ValidateRecipeImportBatchForm,
} from "../../_components/import-forms";
import { KitchenTableSkeleton } from "../../../_components/kitchen-loading-skeletons";
import { KitchenPageHeader } from "../../../_components/kitchen-page-header";
import { getRecipeImportStatusLabel } from "../../_components/recipe-status-labels";
import { RecipesSectionNav } from "../../_components/recipes-section-nav";

type KitchenRecipeImportBatchDetailPageProps = {
  params: Promise<{ tenantSlug: string; batchId: string }>;
};

export default async function KitchenRecipeImportBatchDetailPage({ params }: KitchenRecipeImportBatchDetailPageProps) {
  const { tenantSlug, batchId } = await params;
  return <div className="space-y-4"><KitchenPageHeader eyebrow="Cocina · Recetas" title="Detalle de importación" description="Revisa el resultado del staging, la validación y las líneas aplicadas del recetario." /><RecipesSectionNav tenantSlug={tenantSlug} activeSection="imports" /><Suspense fallback={<div className="space-y-4" aria-live="polite" aria-busy="true"><KitchenTableSkeleton rows={5} columns={7} /><KitchenTableSkeleton rows={8} columns={9} /></div>}><BatchDetailContent tenantSlug={tenantSlug} batchId={batchId} /></Suspense></div>;
}

async function BatchDetailContent({ tenantSlug, batchId }: { tenantSlug: string; batchId: string }) {
  const result = await resolveKitchenPage(tenantSlug, "kitchen_recipes", "imports");

  if (!result.ok) {
    return <StatePanel kind="permission" title="Sin permisos" message="No tienes acceso a este batch de recetario." />;
  }

  const [batch, rows, pendingRows, accessMap] = await Promise.all([
    getRecipeImportBatch(result.tenant.tenantId, batchId),
    listRecipeImportRows(result.tenant.tenantId, batchId),
    listPendingImportRowsByRecipe(result.tenant.tenantId, batchId),
    getCurrentTenantModulePageAccessMap(result.tenant.tenantId, "kitchen_recipes"),
  ]);

  if (!batch) notFound();

  const canManage = hasModulePageAccess(accessMap.imports ?? "none", "manage") || hasModulePageAccess(accessMap.recipes ?? "none", "manage");
  const pendingByRecipe = pendingRows.reduce<Record<string, typeof pendingRows>>((acc, row) => {
    const key = row.recipe_name ?? "Receta sin nombre";
    if (!acc[key]) acc[key] = [];
    acc[key].push(row);
    return acc;
  }, {});

  const importedByRecipe = rows.reduce<Record<string, number>>((acc, row) => {
    if (row.status !== "applied") return acc;
    const key = row.recipe_name ?? "Receta sin nombre";
    acc[key] = (acc[key] ?? 0) + 1;
    return acc;
  }, {});

  return (
    <div className="space-y-4">
      <section className="rounded-[var(--radius-base)] border border-border bg-surface p-4">
        <h2 className="text-sm font-semibold text-foreground">{batch.original_filename}</h2>
        <p className="mt-2 text-sm text-muted">Estado: {getRecipeImportStatusLabel(batch.status)} · Filas: {batch.total_rows} · Recetas: {batch.parsed_recipes} · Líneas: {batch.parsed_lines} · Válidas: {batch.valid_rows} · Advertencias: {batch.warning_rows} · Errores: {batch.error_rows} · Líneas aplicadas: {batch.applied_lines}</p>
      </section>

      {canManage ? (
        <div className="grid gap-3 md:grid-cols-3">
          <ValidateRecipeImportBatchForm tenantSlug={tenantSlug} batchId={batch.id} />
          <RevalidateRecipeImportBatchForm tenantSlug={tenantSlug} batchId={batch.id} />
          <ApplyRecipeImportBatchForm tenantSlug={tenantSlug} batchId={batch.id} />
        </div>
      ) : null}

      {pendingRows.length > 0 ? (
        <section className="rounded-[var(--radius-base)] border border-warning/40 bg-warning/10 p-4">
          <h2 className="text-sm font-semibold text-foreground">Ingredientes pendientes ({pendingRows.length})</h2>
          <p className="mt-1 text-xs text-muted">No se encontró insumo en inventario. Completar manualmente desde la receta.</p>
          <div className="mt-3 space-y-3">
            {Object.entries(pendingByRecipe).map(([recipeName, recipeRows]) => (
              <div key={recipeName} className="rounded-[var(--radius-base)] border border-border bg-surface p-3">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm font-medium text-foreground">{recipeName}</p>
                  <p className="text-xs text-muted">
                    importados: {importedByRecipe[recipeName] ?? 0} · pendientes: {recipeRows.length}
                  </p>
                </div>
                <div className="mt-2 space-y-2">
                  {recipeRows.slice(0, 10).map((row) => (
                    <div key={row.id} className="rounded border border-border bg-surface-2 p-2">
                      <p className="text-xs text-muted">
                        row {row.row_number} · hoja: {String((row.raw_payload?.sheet as string) ?? "N/A")}
                      </p>
                      <p className="text-sm text-foreground">{row.ingredient_name ?? "Ingrediente sin nombre"}</p>
                      <p className="text-xs text-muted">
                        cantidad: {row.quantity ?? "—"} {row.unit_code ?? ""}
                      </p>
                      <p className="text-xs text-warning">Motivo: no se encontró insumo en inventario.</p>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      {rows.length === 0 ? (
        <StatePanel kind="empty" title="Sin filas" message="Este batch no tiene filas parseadas." />
      ) : (
        <section className="rounded-[var(--radius-base)] border border-border bg-surface p-4">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1380px] text-left text-sm">
              <thead className="text-xs uppercase tracking-[0.08em] text-muted">
                <tr>
                  <th className="py-2">Fila</th>
                  <th className="py-2">Receta</th>
                  <th className="py-2">Ingrediente</th>
                  <th className="py-2">Unidad</th>
                  <th className="py-2 text-right">Cantidad</th>
                  <th className="py-2">Acción</th>
                  <th className="py-2">Estado</th>
                  <th className="py-2">Advertencias</th>
                  <th className="py-2">Errores</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.id} className="border-t border-border align-top">
                    <td className="py-2 text-muted">{row.row_number}</td>
                    <td className="py-2">{row.recipe_name ?? "—"}</td>
                    <td className="py-2">{row.ingredient_name ?? "—"}</td>
                    <td className="py-2">{row.unit_code ?? "—"}</td>
                    <td className="py-2 text-right">{row.quantity ?? "—"}</td>
                    <td className="py-2">{row.action === "alias_required" ? "pendiente" : row.action}</td>
                    <td className="py-2">{row.status === "warning" && row.action === "alias_required" ? "Pendiente de revisión" : row.status === "applied" ? "Aplicada" : row.status === "valid" ? "Válida" : row.status === "error" ? "Error" : row.status}</td>
                    <td className="py-2 text-warning">{row.validation_warnings?.join("; ") || "—"}</td>
                    <td className="py-2 text-danger">{row.validation_errors?.join("; ") || "—"}</td>
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
