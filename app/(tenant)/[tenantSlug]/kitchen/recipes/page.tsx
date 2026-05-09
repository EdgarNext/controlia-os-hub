import Link from "next/link";
import { StatePanel } from "@/components/ui/state-panel";
import { getCurrentTenantModulePageAccessMap, hasModulePageAccess } from "@/lib/auth/module-page-access";
import { listKitchenRecipes } from "@/lib/kitchen/recipes/queries";
import {
  listKitchenRecipeActiveOrDraftVersionsByRecipeIds,
  listKitchenRecipeLatestSnapshots,
  listKitchenRecipeUnits,
} from "@/lib/kitchen/recipes/queries";
import { listKitchenRecipeReadiness } from "@/lib/kitchen/recipes/readiness";
import { CreateKitchenRecipeForm } from "./_components/recipe-forms";
import { RecipesListInteractive } from "./_components/recipes-list-interactive";
import { resolveKitchenPage } from "../_lib/page-access";

type KitchenRecipesPageProps = {
  params: Promise<{ tenantSlug: string }>;
  searchParams: Promise<{ q?: string; status?: string; category?: string }>;
};

export default async function KitchenRecipesPage({ params, searchParams }: KitchenRecipesPageProps) {
  const { tenantSlug } = await params;
  const rawSearchParams = await searchParams;
  const result = await resolveKitchenPage(tenantSlug, "kitchen_recipes", "overview");

  if (!result.ok) {
    return (
      <StatePanel
        kind="permission"
        title="Sin permisos de recetas"
        message="Tu usuario no tiene acceso a recetas y costeo en este tenant."
      />
    );
  }

  const [recipes, units, readiness, snapshots, accessMap] = await Promise.all([
    listKitchenRecipes(result.tenant.tenantId),
    listKitchenRecipeUnits(result.tenant.tenantId),
    listKitchenRecipeReadiness(result.tenant.tenantId),
    listKitchenRecipeLatestSnapshots(result.tenant.tenantId),
    getCurrentTenantModulePageAccessMap(result.tenant.tenantId, "kitchen_recipes"),
  ]);
  const readinessByRecipe = new Map(readiness.map((row) => [row.recipe_id, row]));
  const snapshotByRecipe = new Map<string, { created_at: string; total_cost: number; warnings: unknown[] }>();
  for (const raw of snapshots) {
    const recipeId = String(raw.recipe_id ?? "");
    if (!recipeId || snapshotByRecipe.has(recipeId)) continue;
    snapshotByRecipe.set(recipeId, {
      created_at: String(raw.created_at),
      total_cost: Number(raw.total_cost ?? 0),
      warnings: Array.isArray(raw.warnings) ? raw.warnings : [],
    });
  }

  const versionByRecipe = await listKitchenRecipeActiveOrDraftVersionsByRecipeIds(
    result.tenant.tenantId,
    recipes.map((recipe) => recipe.id),
  );

  const canManage = hasModulePageAccess(accessMap.recipes ?? "none", "manage");
  const initialFilters = {
    q: rawSearchParams.q?.trim() ?? "",
    status: rawSearchParams.status?.trim() ?? "",
    category: rawSearchParams.category?.trim() ?? "",
  };

  const recipeRows = recipes.map((recipe) => {
    const row = readinessByRecipe.get(recipe.id);
    const snapshot = snapshotByRecipe.get(recipe.id);
    const version = versionByRecipe.get(recipe.id);
    const denominator = Math.max(Number(version?.yield_quantity ?? recipe.default_yield_quantity ?? 1), 0.0001);
    return {
      id: recipe.id,
      name: recipe.name,
      normalizedName: recipe.normalized_name,
      category: recipe.category ?? null,
      recipeStatus: recipe.status,
      readinessStatus: row?.readiness_status ?? null,
      readinessReason: row?.readiness_reason ?? null,
      pendingIngredientCount: row?.pending_ingredient_count ?? 0,
      hasSnapshot: snapshot != null,
      hasWarnings: (snapshot?.warnings.length ?? 0) > 0,
      isTest: recipe.normalized_name.includes("test"),
      versionNumber: version?.version_number ?? null,
      versionStatus: version?.status ?? null,
      yieldQuantity: Number(recipe.default_yield_quantity),
      yieldUnitCode: version?.kitchen_inventory_units?.code ?? null,
      costPerYieldUnit: snapshot ? Number(snapshot.total_cost / denominator) : null,
      snapshotCreatedAt: snapshot?.created_at ?? null,
    };
  });

  return (
    <div className="space-y-4">
      <section className="rounded-[var(--radius-base)] border border-border bg-surface p-4">
        <h1 className="text-lg font-semibold text-foreground">Recetas y Costeo</h1>
        <p className="mt-2 text-sm text-muted">
          Define recetas versionadas con líneas de insumos/sub-recetas y calcula costo operativo actual.
        </p>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <Link href={`/${tenantSlug}/kitchen/recipes/costing`} className="inline-flex rounded-[var(--radius-base)] border border-border bg-surface-2 px-3 py-2 text-sm">
            Tablero de costeo
          </Link>
          <Link href={`/${tenantSlug}/kitchen/recipes/imports`} className="inline-flex rounded-[var(--radius-base)] border border-border bg-surface-2 px-3 py-2 text-sm">
            Importaciones Recetario
          </Link>
        </div>
      </section>

      {recipes.length === 0 ? (
        <StatePanel
          kind="empty"
          title="Sin recetas registradas"
          message="Crea la primera receta para iniciar versionado y costeo."
        />
      ) : (
        <RecipesListInteractive tenantSlug={tenantSlug} rows={recipeRows} initialFilters={initialFilters} />
      )}

      {canManage ? (
        <CreateKitchenRecipeForm tenantSlug={result.tenant.tenantSlug} units={units} />
      ) : (
        <StatePanel kind="permission" title="Solo lectura" message="Solicita permisos manage para crear o editar recetas." />
      )}
    </div>
  );
}
