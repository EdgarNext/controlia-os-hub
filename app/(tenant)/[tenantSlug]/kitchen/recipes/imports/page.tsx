import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { StatePanel } from "@/components/ui/state-panel";
import { getCurrentTenantModulePageAccessMap, hasModulePageAccess } from "@/lib/auth/module-page-access";
import { listKitchenRecipeIngredientItems } from "@/lib/kitchen/recipes/queries";
import { listRecipeImportBatches } from "@/lib/kitchen/recipes/import-queries";
import { KitchenActionRowSkeleton, KitchenTableSkeleton } from "../../_components/kitchen-loading-skeletons";
import { KitchenPageHeader } from "../../_components/kitchen-page-header";
import { resolveKitchenPage } from "../../_lib/page-access";
import { CreateRecipeImportBatchForm } from "../_components/import-forms";
import { getRecipeImportStatusLabel } from "../_components/recipe-status-labels";
import { RecipesSectionNav } from "../_components/recipes-section-nav";

type KitchenRecipeImportsPageProps = {
  params: Promise<{ tenantSlug: string }>;
};

export const metadata: Metadata = { title: "Importaciones de recetario" };

export default async function KitchenRecipeImportsPage({ params }: KitchenRecipeImportsPageProps) {
  const { tenantSlug } = await params;
  return (
    <div className="space-y-4">
      <KitchenPageHeader eyebrow="Cocina · Recetas" title="Importaciones de recetario" description="Flujo controlado con staging, validación y alias mapping antes de aplicar." />
      <RecipesSectionNav tenantSlug={tenantSlug} activeSection="imports" />
      <Suspense fallback={<div className="space-y-4" aria-live="polite" aria-busy="true"><KitchenActionRowSkeleton actions={1} /><KitchenTableSkeleton rows={8} columns={9} /></div>}>
        <RecipeImportsContent tenantSlug={tenantSlug} />
      </Suspense>
    </div>
  );
}

async function RecipeImportsContent({ tenantSlug }: { tenantSlug: string }) {
  const result = await resolveKitchenPage(tenantSlug, "kitchen_recipes", "imports");
  if (!result.ok) return <StatePanel kind="permission" title="Sin permisos" message="No tienes acceso a importaciones de recetario." />;
  const accessMap = await getCurrentTenantModulePageAccessMap(result.tenant.tenantId, "kitchen_recipes");
  const canManage = hasModulePageAccess(accessMap.imports ?? "none", "manage") || hasModulePageAccess(accessMap.recipes ?? "none", "manage");
  const [batches, items] = await Promise.all([
    listRecipeImportBatches(result.tenant.tenantId),
    listKitchenRecipeIngredientItems(result.tenant.tenantId),
  ]);
  return <><p className="text-xs text-muted">Insumos de inventario activos detectados: {items.length.toLocaleString("es-MX")}</p>{canManage ? <CreateRecipeImportBatchForm tenantSlug={result.tenant.tenantSlug} /> : null}<RecipeBatchesSection tenantSlug={tenantSlug} batches={batches} /></>;
}

function RecipeBatchesSection({ tenantSlug, batches }: { tenantSlug: string; batches: Awaited<ReturnType<typeof listRecipeImportBatches>> }) {
  if (batches.length === 0) return <StatePanel kind="empty" title="Sin importaciones" message="Crea el primer batch de recetario para iniciar el mapeo de alias." />;
  return <section className="rounded-[var(--radius-base)] border border-border bg-surface p-4"><div className="overflow-x-auto"><table className="w-full min-w-[1080px] text-left text-sm"><thead className="text-xs uppercase tracking-[0.08em] text-muted"><tr><th className="py-2">Fecha</th><th className="py-2">Archivo</th><th className="py-2">Estado</th><th className="py-2 text-right">Filas</th><th className="py-2 text-right">Recetas</th><th className="py-2 text-right">Líneas</th><th className="py-2 text-right">Advertencias</th><th className="py-2 text-right">Errores</th><th className="py-2 text-right">Líneas aplicadas</th></tr></thead><tbody>{batches.map((batch) => <tr key={batch.id} className="border-t border-border"><td className="py-2 text-muted">{new Date(batch.created_at).toLocaleString("es-MX")}</td><td className="py-2"><Link href={`/${tenantSlug}/kitchen/recipes/imports/${batch.id}`} className="font-medium text-foreground underline-offset-2 hover:underline">{batch.original_filename}</Link></td><td className="py-2">{getRecipeImportStatusLabel(batch.status)}</td><td className="py-2 text-right">{batch.total_rows}</td><td className="py-2 text-right">{batch.parsed_recipes}</td><td className="py-2 text-right">{batch.parsed_lines}</td><td className="py-2 text-right">{batch.warning_rows}</td><td className="py-2 text-right">{batch.error_rows}</td><td className="py-2 text-right">{batch.applied_lines}</td></tr>)}</tbody></table></div></section>;
}
