import { Suspense } from "react";
import type { Metadata } from "next";
import { StatePanel } from "@/components/ui/state-panel";
import { getCurrentTenantModulePageAccessMap, hasModulePageAccess } from "@/lib/auth/module-page-access";
import {
  listKitchenRecipeActiveOrDraftVersionsByRecipeIds,
  listKitchenRecipeLatestSnapshotsByRecipeIds,
  listKitchenRecipes,
  listKitchenRecipeUnits,
} from "@/lib/kitchen/recipes/queries";
import { listKitchenRecipeReadinessByRecipes } from "@/lib/kitchen/recipes/readiness";
import { KitchenRecipesContentSkeleton } from "../_components/kitchen-loading-skeletons";
import { KitchenPageHeader } from "../_components/kitchen-page-header";
import { resolveKitchenPage } from "../_lib/page-access";
import { CreateKitchenRecipeForm } from "./_components/recipe-forms";
import { RecipesListInteractive } from "./_components/recipes-list-interactive";
import { RecipesSectionNav } from "./_components/recipes-section-nav";

type KitchenRecipesPageProps = {
  params: Promise<{ tenantSlug: string }>;
  searchParams: Promise<{ q?: string; status?: string; category?: string }>;
};

type RecipesListPayload = {
  recipes: Awaited<ReturnType<typeof listKitchenRecipes>>;
  readiness: Awaited<ReturnType<typeof listKitchenRecipeReadinessByRecipes>>;
  snapshots: Awaited<ReturnType<typeof listKitchenRecipeLatestSnapshotsByRecipeIds>>;
  versionByRecipe: Awaited<ReturnType<typeof listKitchenRecipeActiveOrDraftVersionsByRecipeIds>>;
};

export const metadata: Metadata = { title: "Recetas y costeo" };

export default async function KitchenRecipesPage({ params, searchParams }: KitchenRecipesPageProps) {
  const { tenantSlug } = await params;
  const rawSearchParams = await searchParams;

  return (
    <div className="space-y-4">
      <KitchenPageHeader
        eyebrow="Cocina · Recetas"
        title="Recetas y costeo"
        description="Define recetas versionadas con líneas de insumos/sub-recetas y calcula costo operativo actual."
      />
      <RecipesSectionNav tenantSlug={tenantSlug} activeSection="recipes" />
      <Suspense fallback={<KitchenRecipesContentSkeleton />}>
        <RecipesContent tenantSlug={tenantSlug} rawSearchParams={rawSearchParams} />
      </Suspense>
    </div>
  );
}

async function RecipesContent({
  tenantSlug,
  rawSearchParams,
}: {
  tenantSlug: string;
  rawSearchParams: { q?: string; status?: string; category?: string };
}) {
  const result = await resolveKitchenPage(tenantSlug, "kitchen_recipes", "overview");
  if (!result.ok) {
    return <StatePanel kind="permission" title="Sin permisos de recetas" message="Tu usuario no tiene acceso a recetas y costeo en este tenant." />;
  }

  const accessMap = await getCurrentTenantModulePageAccessMap(result.tenant.tenantId, "kitchen_recipes");
  const canManage = hasModulePageAccess(accessMap.recipes ?? "none", "manage");
  const initialFilters = {
    q: rawSearchParams.q?.trim() ?? "",
    status: rawSearchParams.status?.trim() ?? "",
    category: rawSearchParams.category?.trim() ?? "",
  };
  const recipes = await listKitchenRecipes(result.tenant.tenantId);
  const recipeRefs = recipes.map((recipe) => ({ id: recipe.id, name: recipe.name }));
  const [readiness, snapshots, versionByRecipe, units] = await Promise.all([
    listKitchenRecipeReadinessByRecipes(result.tenant.tenantId, recipeRefs),
    listKitchenRecipeLatestSnapshotsByRecipeIds(result.tenant.tenantId, recipes.map((recipe) => recipe.id)),
    listKitchenRecipeActiveOrDraftVersionsByRecipeIds(result.tenant.tenantId, recipes.map((recipe) => recipe.id)),
    canManage ? listKitchenRecipeUnits(result.tenant.tenantId) : Promise.resolve(null),
  ]);

  const data: RecipesListPayload = { recipes, readiness, snapshots, versionByRecipe };
  return (
    <>
      <RecipesListSection tenantSlug={tenantSlug} initialFilters={initialFilters} data={data} />
      {canManage && units ? <CreateKitchenRecipeForm tenantSlug={result.tenant.tenantSlug} units={units} /> : <StatePanel kind="permission" title="Solo lectura" message="Solicita permisos manage para crear o editar recetas." />}
    </>
  );
}

function RecipesListSection({
  tenantSlug,
  initialFilters,
  data,
}: {
  tenantSlug: string;
  initialFilters: { q: string; status: string; category: string };
  data: RecipesListPayload;
}) {
  const { recipes, readiness, snapshots, versionByRecipe } = data;
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

  if (recipes.length === 0) {
    return <StatePanel kind="empty" title="Sin recetas registradas" message="Crea la primera receta para iniciar versionado y costeo." />;
  }

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

  return <RecipesListInteractive tenantSlug={tenantSlug} rows={recipeRows} initialFilters={initialFilters} />;
}
