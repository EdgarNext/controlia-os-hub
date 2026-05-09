"use server";

import fs from "node:fs";
import { revalidatePath } from "next/cache";
import { resolveTenantModulePageActor } from "@/lib/auth/module-page-access";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { normalizeRecipeName } from "./normalizers";
import { parseRecipeWorkbook } from "./import-parser";
import { calculateKitchenRecipeVersionCost } from "./costing";

const DEFAULT_RECIPE_IMPORT_PATH = "/home/developer/dev/controlia-os/docs/tmp/kitchen-import-samples/RECETARIO.xlsx";

export type KitchenRecipeImportActionState = {
  ok: boolean;
  message: string;
  batchId?: string;
  parsedRows?: number;
  parsedRecipes?: number;
};

function chunk<T>(items: T[], size: number): T[][] {
  const result: T[][] = [];
  for (let i = 0; i < items.length; i += size) result.push(items.slice(i, i + size));
  return result;
}

function toText(v: FormDataEntryValue | null): string {
  return String(v ?? "").trim();
}

function revalidateRecipeImportPaths(tenantSlug: string, batchId?: string) {
  revalidatePath(`/${tenantSlug}/kitchen/recipes`);
  revalidatePath(`/${tenantSlug}/kitchen/recipes/costing`);
  revalidatePath(`/${tenantSlug}/kitchen/recipes/imports`);
  if (batchId) revalidatePath(`/${tenantSlug}/kitchen/recipes/imports/${batchId}`);
}

function candidateItems(normalizedIngredient: string, items: Array<{ id: string; normalized_name: string }>): string[] {
  if (!normalizedIngredient) return [];
  const scored = items
    .map((item) => {
      const name = item.normalized_name;
      let score = 0;
      if (name === normalizedIngredient) score = 1;
      else if (name.includes(normalizedIngredient) || normalizedIngredient.includes(name)) score = 0.8;
      else {
        const tokens = normalizedIngredient.split(" ");
        const common = tokens.filter((t) => t && name.includes(t)).length;
        score = common / Math.max(tokens.length, 1);
      }
      return { id: item.id, score };
    })
    .filter((x) => x.score >= 0.45)
    .sort((a, b) => b.score - a.score)
    .slice(0, 5);
  return scored.map((s) => s.id);
}

export async function createRecipeImportBatchFromLocalFileAction(
  _prev: KitchenRecipeImportActionState,
  formData: FormData,
): Promise<KitchenRecipeImportActionState> {
  try {
    const tenantSlug = toText(formData.get("tenantSlug")).toLowerCase();
    const localPath = toText(formData.get("localPath")) || DEFAULT_RECIPE_IMPORT_PATH;
    if (!tenantSlug) return { ok: false, message: "Tenant requerido." };

    const { tenant, user } = await resolveTenantModulePageActor(tenantSlug, "kitchen_recipes", "imports", "manage");

    if (!fs.existsSync(localPath)) return { ok: false, message: `No existe archivo en ruta: ${localPath}` };

    const parsed = parseRecipeWorkbook(localPath);
    const supabase = await getSupabaseServerClient();

    const { data: batch, error: batchError } = await supabase
      .from("kitchen_recipe_import_batches")
      .insert({
        tenant_id: tenant.tenantId,
        original_filename: localPath.split("/").pop() ?? "RECETARIO.xlsx",
        source_type: "excel",
        status: "parsed",
        total_rows: parsed.rows.length,
        parsed_recipes: parsed.parsedRecipes,
        parsed_lines: parsed.parsedLines,
        notes: `sheets=${parsed.sheetNames.join(",")}; ignored=${parsed.ignoredRows}`,
        created_by: user.id,
      })
      .select("id")
      .single();

    if (batchError || !batch) throw new Error(`No se pudo crear batch: ${batchError?.message ?? "error"}`);

    const rows = parsed.rows.map((row) => ({
      tenant_id: tenant.tenantId,
      batch_id: batch.id,
      row_number: row.rowNumber,
      recipe_group_key: row.recipeGroupKey,
      recipe_name: row.recipeName,
      normalized_recipe_name: row.normalizedRecipeName,
      recipe_yield_quantity: row.recipeYieldQuantity,
      recipe_yield_unit_code: row.recipeYieldUnitCode,
      recipe_servings: row.recipeServings,
      ingredient_name: row.ingredientName,
      normalized_ingredient_name: row.normalizedIngredientName,
      quantity: row.quantity,
      unit_code: row.unitCode,
      raw_payload: row.raw,
      normalized_payload: {},
      status: "pending",
      severity: "info",
      action: "upsert_recipe_line",
      validation_errors: [],
      validation_warnings: [],
    }));

    for (const c of chunk(rows, 200)) {
      const { error } = await supabase.from("kitchen_recipe_import_rows").insert(c);
      if (error) throw new Error(`No se pudieron guardar filas staging: ${error.message}`);
    }

    revalidateRecipeImportPaths(tenant.tenantSlug, batch.id);
    return {
      ok: true,
      message: `Batch parseado. recetas=${parsed.parsedRecipes}, líneas=${parsed.parsedLines}, ignoradas=${parsed.ignoredRows}.`,
      batchId: batch.id,
      parsedRows: parsed.parsedLines,
      parsedRecipes: parsed.parsedRecipes,
    };
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : "No se pudo crear batch de recetario." };
  }
}

export async function validateRecipeImportBatchAction(
  _prev: KitchenRecipeImportActionState,
  formData: FormData,
): Promise<KitchenRecipeImportActionState> {
  try {
    const tenantSlug = toText(formData.get("tenantSlug")).toLowerCase();
    const batchId = toText(formData.get("batchId"));
    if (!tenantSlug || !batchId) return { ok: false, message: "Tenant y batch requeridos." };

    const { tenant } = await resolveTenantModulePageActor(tenantSlug, "kitchen_recipes", "imports", "manage");
    const supabase = await getSupabaseServerClient();

    const [rowsRes, itemsRes, aliasesRes, unitsRes, recipesRes] = await Promise.all([
      supabase
        .from("kitchen_recipe_import_rows")
        .select("id,row_number,recipe_name,normalized_recipe_name,recipe_servings,recipe_yield_quantity,ingredient_name,normalized_ingredient_name,quantity,unit_code")
        .eq("tenant_id", tenant.tenantId)
        .eq("batch_id", batchId)
        .order("row_number", { ascending: true }),
      supabase.from("kitchen_inventory_items").select("id, normalized_name").eq("tenant_id", tenant.tenantId),
      supabase.from("kitchen_recipe_item_aliases").select("id, normalized_alias, item_id").eq("tenant_id", tenant.tenantId),
      supabase.from("kitchen_inventory_units").select("id, code").eq("tenant_id", tenant.tenantId),
      supabase.from("kitchen_recipe_recipes").select("id, normalized_name").eq("tenant_id", tenant.tenantId),
    ]);

    if (rowsRes.error || itemsRes.error || aliasesRes.error || unitsRes.error || recipesRes.error) {
      throw new Error("No se pudieron cargar datos para validar batch.");
    }

    const items = itemsRes.data ?? [];
    const aliasMap = new Map((aliasesRes.data ?? []).map((x) => [x.normalized_alias, x]));
    const itemMap = new Map(items.map((x) => [x.normalized_name, x.id]));
    const unitMap = new Map((unitsRes.data ?? []).map((x) => [String(x.code).trim().toLowerCase(), x.id]));
    const recipeMap = new Map((recipesRes.data ?? []).map((x) => [x.normalized_name, x.id]));

    let validRows = 0;
    let warningRows = 0;
    let errorRows = 0;

    for (const row of rowsRes.data ?? []) {
      const errs: string[] = [];
      const warns: string[] = [];

      const recipeNorm = normalizeRecipeName(String(row.normalized_recipe_name ?? row.recipe_name ?? ""));
      const ingredientNorm = normalizeRecipeName(String(row.normalized_ingredient_name ?? row.ingredient_name ?? ""));
      const unitCode = String(row.unit_code ?? "").trim().toLowerCase();
      const qty = row.quantity == null ? null : Number(row.quantity);

      if (!recipeNorm) errs.push("Receta inválida o vacía");
      if (!ingredientNorm) errs.push("Ingrediente inválido o vacío");
      if (qty == null || !Number.isFinite(qty) || qty <= 0) errs.push("Cantidad inválida");

      const matchedRecipeId = recipeMap.get(recipeNorm) ?? null;

      let matchedItemId: string | null = itemMap.get(ingredientNorm) ?? null;
      let matchedAliasId: string | null = null;
      if (!matchedItemId) {
        const alias = aliasMap.get(ingredientNorm);
        if (alias) {
          matchedItemId = alias.item_id;
          matchedAliasId = alias.id;
        }
      }

      const candidates = !matchedItemId ? candidateItems(ingredientNorm, items) : [];

      const matchedUnitId = unitMap.get(unitCode) ?? null;
      if (!matchedUnitId) warns.push("Unidad no mapeada en catálogo");

      let action: "upsert_recipe" | "upsert_recipe_line" | "alias_required" | "skip" = "upsert_recipe_line";
      if (!matchedItemId) {
        action = "alias_required";
        warns.push("Ingrediente requiere alias hacia inventario");
      }

      const status = errs.length > 0 ? "error" : warns.length > 0 ? "warning" : "valid";
      const severity = errs.length > 0 ? "error" : warns.length > 0 ? "warning" : "info";

      if (status === "valid") validRows += 1;
      if (status === "warning") warningRows += 1;
      if (status === "error") errorRows += 1;

      const { error } = await supabase
        .from("kitchen_recipe_import_rows")
        .update({
          normalized_recipe_name: recipeNorm,
          normalized_ingredient_name: ingredientNorm,
          matched_recipe_id: matchedRecipeId,
          matched_item_id: matchedItemId,
          matched_alias_id: matchedAliasId,
          matched_unit_id: matchedUnitId,
          candidate_item_ids: candidates,
          action,
          status,
          severity,
          validation_errors: errs,
          validation_warnings: warns,
        })
        .eq("tenant_id", tenant.tenantId)
        .eq("id", row.id);

      if (error) throw new Error(`No se pudo actualizar fila ${row.row_number}: ${error.message}`);
    }

    const { error: batchError } = await supabase
      .from("kitchen_recipe_import_batches")
      .update({ status: "validated", valid_rows: validRows, warning_rows: warningRows, error_rows: errorRows })
      .eq("tenant_id", tenant.tenantId)
      .eq("id", batchId);

    if (batchError) throw new Error(`No se pudo actualizar batch: ${batchError.message}`);

    revalidateRecipeImportPaths(tenant.tenantSlug, batchId);
    return { ok: true, message: `Batch validado. valid=${validRows}, warning=${warningRows}, error=${errorRows}`, batchId };
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : "No se pudo validar recetario." };
  }
}

export async function createRecipeIngredientAliasAction(
  _prev: KitchenRecipeImportActionState,
  formData: FormData,
): Promise<KitchenRecipeImportActionState> {
  try {
    const tenantSlug = toText(formData.get("tenantSlug")).toLowerCase();
    const batchId = toText(formData.get("batchId"));
    const rowId = toText(formData.get("rowId"));
    const itemId = toText(formData.get("itemId"));
    const aliasRaw = toText(formData.get("alias"));
    if (!tenantSlug || !batchId || !rowId || !itemId || !aliasRaw) return { ok: false, message: "Campos incompletos para alias." };

    const { tenant, user } = await resolveTenantModulePageActor(tenantSlug, "kitchen_recipes", "imports", "manage");
    const supabase = await getSupabaseServerClient();

    const normalizedAlias = normalizeRecipeName(aliasRaw);

    const { error: aliasError } = await supabase.from("kitchen_recipe_item_aliases").upsert(
      {
        tenant_id: tenant.tenantId,
        alias: aliasRaw,
        normalized_alias: normalizedAlias,
        item_id: itemId,
        confidence: 1,
        source: "manual",
        created_by: user.id,
      },
      { onConflict: "tenant_id,normalized_alias" },
    );

    if (aliasError) throw new Error(`No se pudo guardar alias: ${aliasError.message}`);

    const { error: rowError } = await supabase
      .from("kitchen_recipe_import_rows")
      .update({ matched_item_id: itemId, status: "pending", severity: "info", action: "upsert_recipe_line" })
      .eq("tenant_id", tenant.tenantId)
      .eq("id", rowId);

    if (rowError) throw new Error(`No se pudo actualizar fila de alias: ${rowError.message}`);

    revalidateRecipeImportPaths(tenant.tenantSlug, batchId);
    return { ok: true, message: "Alias guardado. Revalida el batch para aplicar cambios.", batchId };
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : "No se pudo guardar alias." };
  }
}

export async function revalidateRecipeImportBatchAction(
  prev: KitchenRecipeImportActionState,
  formData: FormData,
): Promise<KitchenRecipeImportActionState> {
  return validateRecipeImportBatchAction(prev, formData);
}

export async function applyRecipeImportBatchAction(
  _prev: KitchenRecipeImportActionState,
  formData: FormData,
): Promise<KitchenRecipeImportActionState> {
  try {
    const tenantSlug = toText(formData.get("tenantSlug")).toLowerCase();
    const batchId = toText(formData.get("batchId"));
    if (!tenantSlug || !batchId) return { ok: false, message: "Tenant y batch requeridos." };

    const { tenant, user } = await resolveTenantModulePageActor(tenantSlug, "kitchen_recipes", "imports", "manage");
    const supabase = await getSupabaseServerClient();

    const { data: rows, error: rowsError } = await supabase
      .from("kitchen_recipe_import_rows")
      .select("id,row_number,recipe_group_key,recipe_name,normalized_recipe_name,recipe_servings,recipe_yield_quantity,recipe_yield_unit_code,ingredient_name,normalized_ingredient_name,quantity,unit_code,status,action,matched_item_id,matched_unit_id,applied_line_id")
      .eq("tenant_id", tenant.tenantId)
      .eq("batch_id", batchId)
      .in("status", ["valid", "warning", "applied"])
      .order("row_number", { ascending: true });

    if (rowsError) throw new Error(`No se pudieron cargar filas para aplicar: ${rowsError.message}`);

    const unitRows = await supabase.from("kitchen_inventory_units").select("id, code").eq("tenant_id", tenant.tenantId);
    if (unitRows.error) throw new Error(`No se pudieron cargar unidades: ${unitRows.error.message}`);
    const unitMap = new Map((unitRows.data ?? []).map((u) => [String(u.code).trim().toLowerCase(), u.id]));

    const recipeVersionByNorm = new Map<string, { recipeId: string; versionId: string }>();
    let appliedRecipes = 0;
    let appliedLines = 0;
    let skippedRows = 0;
    let pendingRows = 0;
    let technicalErrors = 0;

    for (const row of rows ?? []) {
      const recipeNorm = normalizeRecipeName(String(row.normalized_recipe_name ?? row.recipe_name ?? ""));
      const ingredientName = String(row.ingredient_name ?? "").trim();
      const quantity = row.quantity == null ? null : Number(row.quantity);

      if (!recipeNorm || !ingredientName || !quantity || quantity <= 0) {
        skippedRows += 1;
        continue;
      }

      let recipeContext = recipeVersionByNorm.get(recipeNorm);
      let recipeWasCreated = false;
      if (!recipeContext) {
        const { data: existingRecipe } = await supabase
          .from("kitchen_recipe_recipes")
          .select("id")
          .eq("tenant_id", tenant.tenantId)
          .eq("normalized_name", recipeNorm)
          .maybeSingle();

        let recipeId = existingRecipe?.id as string | undefined;
        if (!recipeId) {
          const { data: insertedRecipe, error: recipeInsertErr } = await supabase
            .from("kitchen_recipe_recipes")
            .insert({
              tenant_id: tenant.tenantId,
              name: row.recipe_name,
              normalized_name: recipeNorm,
              default_yield_quantity: Number(row.recipe_yield_quantity ?? 1) || 1,
              default_servings: row.recipe_servings,
              status: "draft",
              created_by: user.id,
            })
            .select("id")
            .single();
          if (recipeInsertErr || !insertedRecipe) throw new Error(`No se pudo crear receta ${row.recipe_name}: ${recipeInsertErr?.message}`);
          recipeId = insertedRecipe.id;
          recipeWasCreated = true;
        }

        const { data: draftVersion } = await supabase
          .from("kitchen_recipe_versions")
          .select("id")
          .eq("tenant_id", tenant.tenantId)
          .eq("recipe_id", recipeId)
          .eq("status", "draft")
          .order("version_number", { ascending: false })
          .limit(1)
          .maybeSingle();

        let versionId = draftVersion?.id as string | undefined;
        if (!versionId) {
          const { data: lastVersion } = await supabase
            .from("kitchen_recipe_versions")
            .select("version_number")
            .eq("tenant_id", tenant.tenantId)
            .eq("recipe_id", recipeId)
            .order("version_number", { ascending: false })
            .limit(1)
            .maybeSingle();
          const nextVersion = Number(lastVersion?.version_number ?? 0) + 1;

          const { data: insertedVersion, error: versionInsertErr } = await supabase
            .from("kitchen_recipe_versions")
            .insert({
              tenant_id: tenant.tenantId,
              recipe_id: recipeId,
              version_number: nextVersion,
              status: "draft",
              yield_quantity: Number(row.recipe_yield_quantity ?? 1) || 1,
              servings: row.recipe_servings,
              created_by: user.id,
            })
            .select("id")
            .single();

          if (versionInsertErr || !insertedVersion) throw new Error(`No se pudo crear versión de receta ${row.recipe_name}: ${versionInsertErr?.message}`);
          versionId = insertedVersion.id;
        }

        if (!recipeId || !versionId) {
          technicalErrors += 1;
          skippedRows += 1;
          continue;
        }

        recipeContext = { recipeId, versionId };
        recipeVersionByNorm.set(recipeNorm, recipeContext);
        if (recipeWasCreated) appliedRecipes += 1;
      }

      if (!recipeContext) {
        technicalErrors += 1;
        skippedRows += 1;
        continue;
      }

      if (!row.matched_item_id) {
        pendingRows += 1;
        const { error: pendingRowError } = await supabase
          .from("kitchen_recipe_import_rows")
          .update({
            status: "warning",
            severity: "warning",
            action: "alias_required",
            applied_recipe_id: recipeContext.recipeId,
            applied_version_id: recipeContext.versionId,
            validation_warnings: ["No se encontró insumo en inventario. Completar manualmente en receta."],
          })
          .eq("tenant_id", tenant.tenantId)
          .eq("id", row.id);

        if (pendingRowError) technicalErrors += 1;
        continue;
      }

      const unitId = row.matched_unit_id ?? unitMap.get(String(row.unit_code ?? "").trim().toLowerCase()) ?? null;
      if (!unitId) {
        pendingRows += 1;
        const { error: unresolvedUnitError } = await supabase
          .from("kitchen_recipe_import_rows")
          .update({
            status: "warning",
            severity: "warning",
            action: "alias_required",
            applied_recipe_id: recipeContext.recipeId,
            applied_version_id: recipeContext.versionId,
            validation_warnings: ["Unidad no mapeada. Completar manualmente en receta."],
          })
          .eq("tenant_id", tenant.tenantId)
          .eq("id", row.id);

        if (unresolvedUnitError) technicalErrors += 1;
        continue;
      }

      const importNote = `import-row:${row.id}`;
      const { data: existingLine } = await supabase
        .from("kitchen_recipe_lines")
        .select("id")
        .eq("tenant_id", tenant.tenantId)
        .eq("recipe_version_id", recipeContext.versionId)
        .eq("notes", importNote)
        .maybeSingle();

      let lineId = existingLine?.id as string | undefined;
      if (!lineId) {
        const { data: insertedLine, error: lineError } = await supabase
          .from("kitchen_recipe_lines")
          .insert({
            tenant_id: tenant.tenantId,
            recipe_version_id: recipeContext.versionId,
            line_type: "inventory_item",
            item_id: row.matched_item_id,
            quantity,
            unit_id: unitId,
            waste_percent: 0,
            notes: importNote,
            created_by: user.id,
          })
          .select("id")
          .single();

        if (lineError || !insertedLine) {
          technicalErrors += 1;
          continue;
        }
        lineId = insertedLine.id;
        appliedLines += 1;
      }

      const { error: rowUpdateError } = await supabase
        .from("kitchen_recipe_import_rows")
        .update({
          status: "applied",
          severity: "info",
          applied_at: new Date().toISOString(),
          applied_recipe_id: recipeContext.recipeId,
          applied_version_id: recipeContext.versionId,
          applied_line_id: lineId,
        })
        .eq("tenant_id", tenant.tenantId)
        .eq("id", row.id);

      if (rowUpdateError) {
        technicalErrors += 1;
      }
    }

    for (const ctx of recipeVersionByNorm.values()) {
      const cost = await calculateKitchenRecipeVersionCost(tenant.tenantId, ctx.versionId);
      const hasBlockingWarnings = cost.warnings.some((w) => w.type === "missing_cost" || w.type === "missing_conversion");
      if (hasBlockingWarnings) continue;

      await supabase.from("kitchen_recipe_cost_snapshots").insert({
        tenant_id: tenant.tenantId,
        recipe_id: ctx.recipeId,
        recipe_version_id: ctx.versionId,
        snapshot_type: "current",
        total_cost: cost.totalCost,
        cost_per_serving: cost.costPerServing,
        cost_per_yield_unit: cost.costPerYieldUnit,
        currency: "MXN",
        costing_payload: { lines: cost.lines, source: `recipe-import:${batchId}` },
        warnings: cost.warnings,
        created_by: user.id,
      });
    }

    const status =
      technicalErrors > 0
        ? appliedLines > 0
          ? "partially_applied"
        : "failed"
      : pendingRows > 0
          ? "partially_applied"
          : "applied";

    const { data: refreshedRows, error: refreshedRowsError } = await supabase
      .from("kitchen_recipe_import_rows")
      .select("status,action,severity,applied_line_id")
      .eq("tenant_id", tenant.tenantId)
      .eq("batch_id", batchId);
    if (refreshedRowsError) throw new Error(`No se pudo refrescar estado de filas: ${refreshedRowsError.message}`);

    const rowTotals = (refreshedRows ?? []).reduce(
      (acc, row) => {
        if (row.status === "valid") acc.valid += 1;
        if (row.status === "warning") acc.warning += 1;
        if (row.status === "error") acc.error += 1;
        if (row.status === "applied") acc.applied += 1;
        if (row.status === "skipped") acc.skipped += 1;
        if (!row.applied_line_id && (row.action === "alias_required" || row.status === "warning")) acc.pending += 1;
        return acc;
      },
      { valid: 0, warning: 0, error: 0, applied: 0, skipped: 0, pending: 0 },
    );

    const appliedRecipeCount = recipeVersionByNorm.size;
    const { error: batchError } = await supabase
      .from("kitchen_recipe_import_batches")
      .update({
        status,
        valid_rows: rowTotals.valid,
        warning_rows: rowTotals.warning,
        error_rows: rowTotals.error,
        applied_recipes: appliedRecipeCount,
        applied_lines: rowTotals.applied,
        skipped_rows: rowTotals.skipped + rowTotals.pending,
        applied_at: new Date().toISOString(),
        applied_by: user.id,
      })
      .eq("tenant_id", tenant.tenantId)
      .eq("id", batchId);

    if (batchError) throw new Error(`No se pudo actualizar batch: ${batchError.message}`);

    revalidateRecipeImportPaths(tenant.tenantSlug, batchId);
    return {
      ok: true,
      message: `Aplicación completa. recetas=${appliedRecipes}, líneas=${appliedLines}, pendientes=${pendingRows}, skipped=${skippedRows}, status=${status}`,
      batchId,
    };
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : "No se pudo aplicar batch de recetario." };
  }
}
