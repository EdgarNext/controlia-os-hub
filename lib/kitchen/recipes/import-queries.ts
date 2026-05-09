import { getSupabaseServerClient } from "@/lib/supabase/server";
import type { KitchenRecipeImportBatch, KitchenRecipeImportRow } from "./import-types";

export async function listRecipeImportBatches(tenantId: string): Promise<KitchenRecipeImportBatch[]> {
  const supabase = await getSupabaseServerClient();
  const { data, error } = await supabase
    .from("kitchen_recipe_import_batches")
    .select("id, tenant_id, original_filename, source_type, status, total_rows, parsed_recipes, parsed_lines, valid_rows, warning_rows, error_rows, applied_recipes, applied_lines, skipped_rows, notes, created_at, updated_at, applied_at")
    .eq("tenant_id", tenantId)
    .order("created_at", { ascending: false });
  if (error) throw new Error(`No fue posible listar lotes de recetario: ${error.message}`);
  return (data ?? []) as KitchenRecipeImportBatch[];
}

export async function getRecipeImportBatch(tenantId: string, batchId: string): Promise<KitchenRecipeImportBatch | null> {
  const supabase = await getSupabaseServerClient();
  const { data, error } = await supabase
    .from("kitchen_recipe_import_batches")
    .select("id, tenant_id, original_filename, source_type, status, total_rows, parsed_recipes, parsed_lines, valid_rows, warning_rows, error_rows, applied_recipes, applied_lines, skipped_rows, notes, created_at, updated_at, applied_at")
    .eq("tenant_id", tenantId)
    .eq("id", batchId)
    .maybeSingle();
  if (error) throw new Error(`No fue posible cargar batch de recetario: ${error.message}`);
  return (data as KitchenRecipeImportBatch | null) ?? null;
}

export async function listRecipeImportRows(tenantId: string, batchId: string): Promise<KitchenRecipeImportRow[]> {
  const supabase = await getSupabaseServerClient();
  const { data, error } = await supabase
    .from("kitchen_recipe_import_rows")
    .select("id, tenant_id, batch_id, row_number, recipe_group_key, recipe_name, normalized_recipe_name, recipe_yield_quantity, recipe_yield_unit_code, recipe_servings, ingredient_name, normalized_ingredient_name, quantity, unit_code, raw_payload, normalized_payload, status, severity, action, matched_recipe_id, matched_recipe_version_id, matched_item_id, matched_alias_id, matched_unit_id, candidate_item_ids, validation_errors, validation_warnings, applied_at, applied_recipe_id, applied_version_id, applied_line_id, created_at, updated_at")
    .eq("tenant_id", tenantId)
    .eq("batch_id", batchId)
    .order("row_number", { ascending: true });
  if (error) throw new Error(`No fue posible listar filas staging de recetario: ${error.message}`);
  return (data ?? []) as KitchenRecipeImportRow[];
}

export async function listAliasRequiredRows(tenantId: string, batchId: string): Promise<KitchenRecipeImportRow[]> {
  const supabase = await getSupabaseServerClient();
  const { data, error } = await supabase
    .from("kitchen_recipe_import_rows")
    .select("id, tenant_id, batch_id, row_number, recipe_name, ingredient_name, normalized_ingredient_name, quantity, unit_code, status, severity, action, candidate_item_ids, validation_errors, validation_warnings")
    .eq("tenant_id", tenantId)
    .eq("batch_id", batchId)
    .eq("action", "alias_required")
    .in("status", ["warning", "error"])
    .order("row_number", { ascending: true });
  if (error) throw new Error(`No fue posible listar filas con alias requerido: ${error.message}`);
  return (data ?? []) as KitchenRecipeImportRow[];
}

export async function listPendingImportRowsByRecipe(
  tenantId: string,
  batchId: string,
): Promise<KitchenRecipeImportRow[]> {
  const supabase = await getSupabaseServerClient();
  const { data, error } = await supabase
    .from("kitchen_recipe_import_rows")
    .select(
      "id, tenant_id, batch_id, row_number, recipe_group_key, recipe_name, ingredient_name, quantity, unit_code, raw_payload, status, action, validation_warnings, validation_errors, applied_recipe_id, applied_version_id",
    )
    .eq("tenant_id", tenantId)
    .eq("batch_id", batchId)
    .eq("action", "alias_required")
    .in("status", ["warning", "error", "pending"])
    .order("recipe_name", { ascending: true })
    .order("row_number", { ascending: true });

  if (error) throw new Error(`No fue posible listar ingredientes pendientes: ${error.message}`);
  return (data ?? []) as KitchenRecipeImportRow[];
}

export async function listPendingImportRowsForRecipe(
  tenantId: string,
  recipeId: string,
): Promise<KitchenRecipeImportRow[]> {
  const supabase = await getSupabaseServerClient();
  const { data, error } = await supabase
    .from("kitchen_recipe_import_rows")
    .select(
      "id, tenant_id, batch_id, row_number, recipe_name, ingredient_name, quantity, unit_code, raw_payload, status, action, validation_warnings, validation_errors, applied_recipe_id, applied_version_id, normalized_payload",
    )
    .eq("tenant_id", tenantId)
    .eq("applied_recipe_id", recipeId)
    .eq("action", "alias_required")
    .in("status", ["warning", "error", "pending"])
    .order("row_number", { ascending: true });

  if (error) throw new Error(`No fue posible listar pendientes de receta: ${error.message}`);
  return (data ?? []) as KitchenRecipeImportRow[];
}
