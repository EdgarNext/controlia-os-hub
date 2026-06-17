import { getSupabaseServerClient } from "@/lib/supabase/server";

export type KitchenRecipeReadinessStatus =
  | "ready"
  | "incomplete"
  | "pending_ingredients"
  | "missing_cost"
  | "costing_warnings"
  | "draft_only";

export type KitchenRecipeReadiness = {
  recipe_id: string;
  recipe_name: string;
  active_version_id: string | null;
  line_count: number;
  pending_ingredient_count: number;
  latest_snapshot_total_cost: number | null;
  warning_count: number;
  readiness_status: KitchenRecipeReadinessStatus;
  readiness_reason: string;
};

function classifyReadiness(input: {
  hasActive: boolean;
  lineCount: number;
  pendingCount: number;
  totalCost: number | null;
  warningCount: number;
}): Pick<KitchenRecipeReadiness, "readiness_status" | "readiness_reason"> {
  if (!input.hasActive) return { readiness_status: "draft_only", readiness_reason: "Sin versión activa" };
  if (input.lineCount <= 0) return { readiness_status: "incomplete", readiness_reason: "Sin líneas de ingredientes" };
  if (input.pendingCount > 0) {
    return { readiness_status: "pending_ingredients", readiness_reason: "Tiene ingredientes pendientes de capturar" };
  }
  if (input.totalCost == null || Number.isNaN(Number(input.totalCost))) {
    return { readiness_status: "missing_cost", readiness_reason: "Sin costo calculable" };
  }
  if (input.warningCount > 0) return { readiness_status: "costing_warnings", readiness_reason: "Tiene warnings de costeo" };
  return { readiness_status: "ready", readiness_reason: "Lista para eventos" };
}

export async function listKitchenRecipeReadiness(tenantId: string): Promise<KitchenRecipeReadiness[]> {
  const supabase = await getSupabaseServerClient();
  const recipesRes = await supabase
    .from("kitchen_recipe_recipes")
    .select("id,name")
    .eq("tenant_id", tenantId)
    .eq("is_active", true);
  if (recipesRes.error) throw new Error(`No fue posible cargar recetas para readiness: ${recipesRes.error.message}`);
  return listKitchenRecipeReadinessByRecipes(
    tenantId,
    (recipesRes.data ?? []).map((recipe) => ({ id: recipe.id, name: recipe.name })),
  );
}

export async function listKitchenRecipeReadinessByRecipes(
  tenantId: string,
  recipes: Array<{ id: string; name: string }>,
): Promise<KitchenRecipeReadiness[]> {
  if (recipes.length === 0) return [];

  const recipeIds = recipes.map((recipe) => recipe.id);
  const supabase = await getSupabaseServerClient();
  const [versionsRes, pendingRes, snapshotsRes] = await Promise.all([
    supabase.from("kitchen_recipe_versions").select("id,recipe_id,status").eq("tenant_id", tenantId),
    supabase
      .from("kitchen_recipe_import_rows")
      .select("id,applied_recipe_id")
      .eq("tenant_id", tenantId)
      .eq("action", "alias_required")
      .in("applied_recipe_id", recipeIds)
      .in("status", ["warning", "error", "pending"]),
    supabase
      .from("kitchen_recipe_cost_snapshots")
      .select("id,recipe_id,total_cost,warnings,created_at,snapshot_type")
      .eq("tenant_id", tenantId)
      .eq("snapshot_type", "current"),
  ]);
  if (versionsRes.error) throw new Error(`No fue posible cargar versiones para readiness: ${versionsRes.error.message}`);
  if (pendingRes.error) throw new Error(`No fue posible cargar pendientes para readiness: ${pendingRes.error.message}`);
  if (snapshotsRes.error) throw new Error(`No fue posible cargar snapshots para readiness: ${snapshotsRes.error.message}`);

  const versions = versionsRes.data ?? [];
  const pendingRows = pendingRes.data ?? [];
  const snapshots = (snapshotsRes.data ?? []).filter((snapshot) => recipeIds.includes(snapshot.recipe_id));

  const versionIds = versions.map((version) => version.id);
  const linesRes = versionIds.length
    ? await supabase
        .from("kitchen_recipe_lines")
        .select("id,recipe_version_id")
        .eq("tenant_id", tenantId)
        .in("recipe_version_id", versionIds)
    : { data: [], error: null };
  if (linesRes.error) throw new Error(`No fue posible cargar líneas para readiness: ${linesRes.error.message}`);
  const lines = linesRes.data ?? [];

  const versionToRecipe = new Map(versions.map((version) => [version.id, version.recipe_id]));
  const activeVersionByRecipe = new Map<string, string>();
  for (const version of versions) {
    if (version.status === "active") activeVersionByRecipe.set(version.recipe_id, version.id);
  }

  const lineCountByRecipe = new Map<string, number>();
  for (const line of lines) {
    const recipeId = versionToRecipe.get(line.recipe_version_id);
    if (!recipeId) continue;
    lineCountByRecipe.set(recipeId, (lineCountByRecipe.get(recipeId) ?? 0) + 1);
  }

  const pendingCountByRecipe = new Map<string, number>();
  for (const row of pendingRows) {
    const recipeId = row.applied_recipe_id;
    if (!recipeId) continue;
    pendingCountByRecipe.set(recipeId, (pendingCountByRecipe.get(recipeId) ?? 0) + 1);
  }

  const latestSnapshotByRecipe = new Map<
    string,
    { totalCost: number | null; warningCount: number; createdAt: string }
  >();
  for (const snapshot of snapshots) {
    const recipeId = snapshot.recipe_id;
    const prev = latestSnapshotByRecipe.get(recipeId);
    if (!prev || new Date(snapshot.created_at).getTime() > new Date(prev.createdAt).getTime()) {
      latestSnapshotByRecipe.set(recipeId, {
        totalCost: snapshot.total_cost == null ? null : Number(snapshot.total_cost),
        warningCount: Array.isArray(snapshot.warnings) ? snapshot.warnings.length : 0,
        createdAt: snapshot.created_at,
      });
    }
  }

  return recipes.map((recipe) => {
    const activeVersionId = activeVersionByRecipe.get(recipe.id) ?? null;
    const lineCount = lineCountByRecipe.get(recipe.id) ?? 0;
    const pendingCount = pendingCountByRecipe.get(recipe.id) ?? 0;
    const latest = latestSnapshotByRecipe.get(recipe.id);
    const readiness = classifyReadiness({
      hasActive: Boolean(activeVersionId),
      lineCount,
      pendingCount,
      totalCost: latest?.totalCost ?? null,
      warningCount: latest?.warningCount ?? 0,
    });
    return {
      recipe_id: recipe.id,
      recipe_name: recipe.name,
      active_version_id: activeVersionId,
      line_count: lineCount,
      pending_ingredient_count: pendingCount,
      latest_snapshot_total_cost: latest?.totalCost ?? null,
      warning_count: latest?.warningCount ?? 0,
      readiness_status: readiness.readiness_status,
      readiness_reason: readiness.readiness_reason,
    };
  });
}

export async function getKitchenRecipeReadiness(tenantId: string, recipeId: string): Promise<KitchenRecipeReadiness | null> {
  const readiness = await listKitchenRecipeReadiness(tenantId);
  return readiness.find((row) => row.recipe_id === recipeId) ?? null;
}
