import { Suspense } from "react";
import Link from "next/link";
import type { Metadata } from "next";
import { StatePanel } from "@/components/ui/state-panel";
import { KitchenRecipesContentSkeleton, KitchenTableSkeleton } from "@/app/(tenant)/[tenantSlug]/kitchen/_components/kitchen-loading-skeletons";
import { KitchenPageHeader } from "@/app/(tenant)/[tenantSlug]/kitchen/_components/kitchen-page-header";
import { listKitchenRecipes, listKitchenRecipeActiveOrDraftVersionsByRecipeIds, listKitchenRecipeLatestSnapshots } from "@/lib/kitchen/recipes/queries";
import { calculateKitchenRecipeVersionCost } from "@/lib/kitchen/recipes/costing";
import { listKitchenRecipeReadiness } from "@/lib/kitchen/recipes/readiness";
import { getRecipeSnapshotTypeLabel } from "../_components/recipe-status-labels";
import { RecipesSectionNav } from "../_components/recipes-section-nav";
import { resolveKitchenPage } from "../../_lib/page-access";

type KitchenRecipesCostingPageProps = {
  params: Promise<{ tenantSlug: string }>;
};

export const metadata: Metadata = { title: "Tablero de costeo" };

export default async function KitchenRecipesCostingPage({ params }: KitchenRecipesCostingPageProps) {
  const { tenantSlug } = await params;
  return (
    <div className="space-y-4">
      <KitchenPageHeader eyebrow="Cocina · Recetas" title="Tablero de costeo" description="Costo base de receta calculado desde inventario, con problemas de costeo por faltantes de costo o conversiones." />
      <RecipesSectionNav tenantSlug={tenantSlug} activeSection="costing" />
      <Suspense fallback={<KitchenRecipesContentSkeleton />}>
        <CostingContent tenantSlug={tenantSlug} />
      </Suspense>
    </div>
  );
}

async function CostingContent({ tenantSlug }: { tenantSlug: string }) {
  const result = await resolveKitchenPage(tenantSlug, "kitchen_recipes", "costing");
  if (!result.ok) return <StatePanel kind="permission" title="Sin permisos para costeo" message="No tienes acceso a la página de costeo de recetas." />;
  return (
    <>
      <Suspense fallback={<KitchenTableSkeleton rows={8} columns={7} />}>
        <RecipeCostTableSection uiTenantSlug={tenantSlug} tenantId={result.tenant.tenantId} />
      </Suspense>
      <Suspense fallback={<KitchenTableSkeleton rows={6} columns={4} />}>
        <RecipeSnapshotSection tenantId={result.tenant.tenantId} />
      </Suspense>
    </>
  );
}

async function RecipeCostTableSection({ uiTenantSlug, tenantId }: { uiTenantSlug: string; tenantId: string }) {
  const [recipes, readiness] = await Promise.all([listKitchenRecipes(tenantId), listKitchenRecipeReadiness(tenantId)]);
  const readinessByRecipe = new Map(readiness.map((row) => [row.recipe_id, row]));
  if (recipes.length === 0) return <StatePanel kind="empty" title="Sin recetas para costear" message="Crea recetas en la sección Recetas y Costeo para ver su valuación." />;
  const versionByRecipe = await listKitchenRecipeActiveOrDraftVersionsByRecipeIds(tenantId, recipes.map((recipe) => recipe.id));
  const recipeCosts = await Promise.all(recipes.map(async (recipe) => {
    const version = versionByRecipe.get(recipe.id) ?? null;
    if (!version) return { recipe, version: null, cost: null as Awaited<ReturnType<typeof calculateKitchenRecipeVersionCost>> | null };
    const cost = await calculateKitchenRecipeVersionCost(tenantId, version.id);
    return { recipe, version, cost };
  }));
  return <section className="rounded-[var(--radius-base)] border border-border bg-surface p-4"><h2 className="text-sm font-semibold text-foreground">Costo base por receta</h2><div className="mt-3 overflow-x-auto"><table className="w-full min-w-[920px] text-left text-sm"><thead className="text-xs uppercase tracking-[0.08em] text-muted"><tr><th className="py-2">Receta</th><th className="py-2">Estado operativo</th><th className="py-2">Versión</th><th className="py-2">Base de rendimiento</th><th className="py-2 text-right">Costo base del rendimiento</th><th className="py-2 text-right">Costo por unidad de rendimiento</th><th className="py-2">Problemas de costeo</th></tr></thead><tbody>{recipeCosts.map(({ recipe, version, cost }) => { const row = readinessByRecipe.get(recipe.id); const ready = row?.readiness_status === "ready"; return <tr key={recipe.id} className="border-t border-border transition-colors hover:bg-surface-2/50"><td className="py-2"><Link href={`/${uiTenantSlug}/kitchen/recipes/${recipe.id}`} className="underline underline-offset-2">{recipe.name}</Link></td><td className="py-2"><span className={`inline-flex rounded-full px-2 py-0.5 text-xs ${ready ? "bg-success/20 text-success" : "bg-warning/20 text-warning"}`}>{ready ? "Lista para eventos" : "Pendiente"}</span></td><td className="py-2">{version ? `v${version.version_number}` : "—"}</td><td className="py-2">{version ? `${Number(version.yield_quantity).toLocaleString("es-MX", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${version.kitchen_inventory_units?.code?.toLowerCase() ?? "ud"}` : "—"}</td><td className="py-2 text-right">{cost ? `$${cost.totalCost.toLocaleString("es-MX", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : "—"}</td><td className="py-2 text-right">{cost?.costPerYieldUnit != null ? `$${cost.costPerYieldUnit.toLocaleString("es-MX", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : "—"}</td><td className="py-2">{cost ? cost.warnings.length : 0}</td></tr>; })}</tbody></table></div><p className="mt-3 text-xs text-muted">El costo base pertenece a la receta; el costo total del evento se calcula en el plan de catering.</p></section>;
}

async function RecipeSnapshotSection({ tenantId }: { tenantId: string }) {
  const snapshots = await listKitchenRecipeLatestSnapshots(tenantId);
  return <section className="rounded-[var(--radius-base)] border border-border bg-surface p-4"><h2 className="text-sm font-semibold text-foreground">Snapshot actual y últimos cálculos</h2>{snapshots.length === 0 ? <p className="mt-2 text-sm text-muted">No hay snapshots guardados todavía.</p> : <div className="mt-2 overflow-x-auto"><table className="w-full min-w-[860px] text-left text-sm"><thead className="text-xs uppercase tracking-[0.08em] text-muted"><tr><th className="py-2">Fecha</th><th className="py-2">Receta</th><th className="py-2">Tipo</th><th className="py-2 text-right">Costo base del rendimiento</th></tr></thead><tbody>{snapshots.map((snapshot) => <tr key={snapshot.id} className="border-t border-border transition-colors hover:bg-surface-2/50"><td className="py-2 text-muted">{new Date(snapshot.created_at as string).toLocaleString("es-MX")}</td><td className="py-2">{Array.isArray(snapshot.kitchen_recipe_recipes) ? (snapshot.kitchen_recipe_recipes[0] as { name?: string } | undefined)?.name ?? "Receta" : (snapshot.kitchen_recipe_recipes as { name?: string } | null)?.name ?? "Receta"}</td><td className="py-2">{getRecipeSnapshotTypeLabel(String(snapshot.snapshot_type))}</td><td className="py-2 text-right">${Number(snapshot.total_cost).toLocaleString("es-MX", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td></tr>)}</tbody></table></div>}</section>;
}
