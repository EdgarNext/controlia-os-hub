import { getSupabaseServerClient } from "@/lib/supabase/server";
import type { KitchenInventoryItem, KitchenInventoryUnit } from "@/lib/kitchen/inventory/types";
import type { KitchenRecipe, KitchenRecipeLine, KitchenRecipeVersion } from "./types";

export async function listKitchenRecipes(tenantId: string): Promise<KitchenRecipe[]> {
  const supabase = await getSupabaseServerClient();
  const { data, error } = await supabase
    .from("kitchen_recipe_recipes")
    .select("id, tenant_id, name, normalized_name, description, category, status, default_yield_quantity, default_yield_unit_id, default_servings, is_active, created_at, updated_at")
    .eq("tenant_id", tenantId)
    .eq("is_active", true)
    .order("updated_at", { ascending: false });
  if (error) throw new Error(`No fue posible listar recetas: ${error.message}`);
  return (data ?? []) as KitchenRecipe[];
}

export async function getKitchenRecipe(tenantId: string, recipeId: string): Promise<KitchenRecipe | null> {
  const supabase = await getSupabaseServerClient();
  const { data, error } = await supabase
    .from("kitchen_recipe_recipes")
    .select("id, tenant_id, name, normalized_name, description, category, status, default_yield_quantity, default_yield_unit_id, default_servings, is_active, created_at, updated_at")
    .eq("tenant_id", tenantId)
    .eq("id", recipeId)
    .maybeSingle();
  if (error) throw new Error(`No fue posible obtener receta: ${error.message}`);
  return (data as KitchenRecipe | null) ?? null;
}

export async function listKitchenRecipeVersions(tenantId: string, recipeId: string): Promise<KitchenRecipeVersion[]> {
  const supabase = await getSupabaseServerClient();
  const { data, error } = await supabase
    .from("kitchen_recipe_versions")
    .select("id, tenant_id, recipe_id, version_number, status, yield_quantity, yield_unit_id, servings, instructions, notes, created_at, updated_at, activated_at, kitchen_inventory_units:kitchen_inventory_units!kitchen_recipe_versions_yield_unit_id_fkey(id, code, name)")
    .eq("tenant_id", tenantId)
    .eq("recipe_id", recipeId)
    .order("version_number", { ascending: false });
  if (error) throw new Error(`No fue posible listar versiones: ${error.message}`);
  return ((data ?? []) as Array<Record<string, unknown>>).map((row) => ({
    ...(row as unknown as KitchenRecipeVersion),
    kitchen_inventory_units: Array.isArray(row.kitchen_inventory_units)
      ? ((row.kitchen_inventory_units[0] ?? null) as KitchenRecipeVersion["kitchen_inventory_units"])
      : ((row.kitchen_inventory_units ?? null) as KitchenRecipeVersion["kitchen_inventory_units"]),
  }));
}

export async function getKitchenRecipeVersionById(tenantId: string, versionId: string): Promise<KitchenRecipeVersion | null> {
  const supabase = await getSupabaseServerClient();
  const { data, error } = await supabase
    .from("kitchen_recipe_versions")
    .select("id, tenant_id, recipe_id, version_number, status, yield_quantity, yield_unit_id, servings, instructions, notes, created_at, updated_at, activated_at, kitchen_inventory_units:kitchen_inventory_units!kitchen_recipe_versions_yield_unit_id_fkey(id, code, name)")
    .eq("tenant_id", tenantId)
    .eq("id", versionId)
    .maybeSingle();
  if (error) throw new Error(`No fue posible obtener versión: ${error.message}`);
  if (!data) return null;
  const row = data as Record<string, unknown>;
  return {
    ...(row as unknown as KitchenRecipeVersion),
    kitchen_inventory_units: Array.isArray(row.kitchen_inventory_units)
      ? ((row.kitchen_inventory_units[0] ?? null) as KitchenRecipeVersion["kitchen_inventory_units"])
      : ((row.kitchen_inventory_units ?? null) as KitchenRecipeVersion["kitchen_inventory_units"]),
  };
}

export async function getKitchenRecipeActiveOrDraftVersion(tenantId: string, recipeId: string): Promise<KitchenRecipeVersion | null> {
  const versions = await listKitchenRecipeVersions(tenantId, recipeId);
  return versions.find((version) => version.status === "active") ?? versions.find((version) => version.status === "draft") ?? null;
}

export async function listKitchenRecipeActiveOrDraftVersionsByRecipeIds(
  tenantId: string,
  recipeIds: string[],
): Promise<Map<string, KitchenRecipeVersion | null>> {
  const byRecipe = new Map<string, KitchenRecipeVersion | null>();
  for (const recipeId of recipeIds) byRecipe.set(recipeId, null);
  if (recipeIds.length === 0) return byRecipe;

  const supabase = await getSupabaseServerClient();
  const { data, error } = await supabase
    .from("kitchen_recipe_versions")
    .select(
      "id, tenant_id, recipe_id, version_number, status, yield_quantity, yield_unit_id, servings, instructions, notes, created_at, updated_at, activated_at, kitchen_inventory_units:kitchen_inventory_units!kitchen_recipe_versions_yield_unit_id_fkey(id, code, name)",
    )
    .eq("tenant_id", tenantId)
    .in("recipe_id", recipeIds)
    .in("status", ["active", "draft"])
    .order("version_number", { ascending: false });
  if (error) throw new Error(`No fue posible listar versiones por receta: ${error.message}`);

  const rows = ((data ?? []) as Array<Record<string, unknown>>).map((row) => ({
    ...(row as unknown as KitchenRecipeVersion),
    kitchen_inventory_units: Array.isArray(row.kitchen_inventory_units)
      ? ((row.kitchen_inventory_units[0] ?? null) as KitchenRecipeVersion["kitchen_inventory_units"])
      : ((row.kitchen_inventory_units ?? null) as KitchenRecipeVersion["kitchen_inventory_units"]),
  }));

  const grouped = new Map<string, KitchenRecipeVersion[]>();
  for (const version of rows) {
    const bucket = grouped.get(version.recipe_id) ?? [];
    bucket.push(version);
    grouped.set(version.recipe_id, bucket);
  }

  for (const recipeId of recipeIds) {
    const versions = grouped.get(recipeId) ?? [];
    const selected = versions.find((version) => version.status === "active") ?? versions.find((version) => version.status === "draft") ?? null;
    byRecipe.set(recipeId, selected);
  }

  return byRecipe;
}

export async function listKitchenRecipeLines(tenantId: string, recipeVersionId: string): Promise<KitchenRecipeLine[]> {
  const supabase = await getSupabaseServerClient();
  const { data, error } = await supabase
    .from("kitchen_recipe_lines")
    .select("id, tenant_id, recipe_version_id, line_type, item_id, sub_recipe_version_id, quantity, unit_id, waste_percent, notes, sort_order, kitchen_inventory_items:kitchen_inventory_items!kitchen_recipe_lines_tenant_item_fkey(id, name, current_unit_cost, default_unit_id), kitchen_inventory_units:kitchen_inventory_units!kitchen_recipe_lines_tenant_unit_fkey(id, code, name), sub_recipe_version:kitchen_recipe_versions!kitchen_recipe_lines_sub_recipe_version_id_fkey(id, recipe_id, version_number, yield_quantity, kitchen_recipe_recipes:kitchen_recipe_recipes!kitchen_recipe_versions_tenant_recipe_fkey(id, name))")
    .eq("tenant_id", tenantId)
    .eq("recipe_version_id", recipeVersionId)
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true });
  if (error) throw new Error(`No fue posible listar líneas de receta: ${error.message}`);

  return ((data ?? []) as Array<Record<string, unknown>>).map((row) => ({
    ...(row as unknown as KitchenRecipeLine),
    kitchen_inventory_items: Array.isArray(row.kitchen_inventory_items)
      ? ((row.kitchen_inventory_items[0] ?? null) as KitchenRecipeLine["kitchen_inventory_items"])
      : ((row.kitchen_inventory_items ?? null) as KitchenRecipeLine["kitchen_inventory_items"]),
    kitchen_inventory_units: Array.isArray(row.kitchen_inventory_units)
      ? ((row.kitchen_inventory_units[0] ?? null) as KitchenRecipeLine["kitchen_inventory_units"])
      : ((row.kitchen_inventory_units ?? null) as KitchenRecipeLine["kitchen_inventory_units"]),
    sub_recipe_version: Array.isArray(row.sub_recipe_version)
      ? ((row.sub_recipe_version[0] ?? null) as KitchenRecipeLine["sub_recipe_version"])
      : ((row.sub_recipe_version ?? null) as KitchenRecipeLine["sub_recipe_version"]),
  }));
}

export async function listKitchenRecipeIngredientItems(tenantId: string): Promise<KitchenInventoryItem[]> {
  const supabase = await getSupabaseServerClient();
  const { data, error } = await supabase
    .from("kitchen_inventory_items")
    .select("id, tenant_id, category_id, default_unit_id, default_supplier_id, name, normalized_name, sku, description, current_unit_cost, standard_unit_cost, is_perishable, is_active, created_at")
    .eq("tenant_id", tenantId)
    .eq("is_active", true)
    .order("name", { ascending: true });

  if (error) throw new Error(`No fue posible listar insumos para receta: ${error.message}`);
  return (data ?? []) as KitchenInventoryItem[];
}

export async function listKitchenRecipeUnits(tenantId: string): Promise<KitchenInventoryUnit[]> {
  const supabase = await getSupabaseServerClient();
  const { data, error } = await supabase
    .from("kitchen_inventory_units")
    .select("id, tenant_id, code, name, normalized_name, unit_type, is_base_unit, is_active")
    .eq("tenant_id", tenantId)
    .eq("is_active", true)
    .order("name", { ascending: true });
  if (error) throw new Error(`No fue posible listar unidades para receta: ${error.message}`);
  return (data ?? []) as KitchenInventoryUnit[];
}

export async function listKitchenSubRecipeCandidates(tenantId: string, excludeRecipeId?: string): Promise<KitchenRecipeVersion[]> {
  const supabase = await getSupabaseServerClient();
  let query = supabase
    .from("kitchen_recipe_versions")
    .select("id, tenant_id, recipe_id, version_number, status, yield_quantity, yield_unit_id, servings, instructions, notes, created_at, updated_at, activated_at, kitchen_inventory_units:kitchen_inventory_units!kitchen_recipe_versions_yield_unit_id_fkey(id, code, name)")
    .eq("tenant_id", tenantId)
    .eq("status", "active")
    .order("updated_at", { ascending: false });

  if (excludeRecipeId) query = query.neq("recipe_id", excludeRecipeId);

  const { data, error } = await query;
  if (error) throw new Error(`No fue posible listar sub-recetas: ${error.message}`);
  return ((data ?? []) as Array<Record<string, unknown>>).map((row) => ({
    ...(row as unknown as KitchenRecipeVersion),
    kitchen_inventory_units: Array.isArray(row.kitchen_inventory_units)
      ? ((row.kitchen_inventory_units[0] ?? null) as KitchenRecipeVersion["kitchen_inventory_units"])
      : ((row.kitchen_inventory_units ?? null) as KitchenRecipeVersion["kitchen_inventory_units"]),
  }));
}

export async function listKitchenRecipeLatestSnapshots(tenantId: string) {
  const supabase = await getSupabaseServerClient();
  const { data, error } = await supabase
    .from("kitchen_recipe_cost_snapshots")
    .select("id, tenant_id, recipe_id, recipe_version_id, snapshot_type, total_cost, cost_per_serving, cost_per_yield_unit, currency, warnings, created_at, kitchen_recipe_recipes:kitchen_recipe_recipes!kitchen_recipe_cost_snapshots_tenant_recipe_fkey(id, name)")
    .eq("tenant_id", tenantId)
    .order("created_at", { ascending: false })
    .limit(50);
  if (error) throw new Error(`No fue posible listar snapshots de costo: ${error.message}`);
  return data ?? [];
}

export async function listKitchenRecipeLatestSnapshotsByRecipeIds(
  tenantId: string,
  recipeIds: string[],
) {
  if (recipeIds.length === 0) return [];
  const supabase = await getSupabaseServerClient();
  const { data, error } = await supabase
    .from("kitchen_recipe_cost_snapshots")
    .select("recipe_id,total_cost,warnings,created_at")
    .eq("tenant_id", tenantId)
    .eq("snapshot_type", "current")
    .in("recipe_id", recipeIds)
    .order("created_at", { ascending: false });
  if (error) throw new Error(`No fue posible listar snapshots de costo por receta: ${error.message}`);
  return data ?? [];
}
