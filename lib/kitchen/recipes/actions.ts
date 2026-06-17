"use server";

import { revalidatePath } from "next/cache";
import { resolveTenantModulePageActor } from "@/lib/auth/module-page-access";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { normalizeRecipeName, toRecipeNumber } from "./normalizers";
import { calculateKitchenRecipeVersionCost } from "./costing";

export type KitchenRecipeActionState = {
  ok: boolean;
  message: string;
};

function toText(v: FormDataEntryValue | null): string {
  return String(v ?? "").trim();
}

function revalidateKitchenRecipes(tenantSlug: string, recipeId?: string) {
  revalidatePath(`/${tenantSlug}/kitchen/recipes`);
  revalidatePath(`/${tenantSlug}/kitchen/recipes/costing`);
  if (recipeId) {
    revalidatePath(`/${tenantSlug}/kitchen/recipes/${recipeId}`);
  }
}

export async function createKitchenRecipeAction(
  _prev: KitchenRecipeActionState,
  formData: FormData,
): Promise<KitchenRecipeActionState> {
  try {
    const tenantSlug = toText(formData.get("tenantSlug")).toLowerCase();
    const name = toText(formData.get("name"));
    const description = toText(formData.get("description"));
    const category = toText(formData.get("category"));
    const yieldQuantity = toRecipeNumber(toText(formData.get("yieldQuantity")), "Rendimiento");
    const yieldUnitId = toText(formData.get("yieldUnitId"));
    const servingsRaw = toText(formData.get("servings"));
    const servings = servingsRaw ? toRecipeNumber(servingsRaw, "Porciones") : null;

    if (!tenantSlug || !name) return { ok: false, message: "Tenant y nombre son obligatorios." };

    const { tenant, user } = await resolveTenantModulePageActor(tenantSlug, "kitchen_recipes", "recipes", "manage");
    const supabase = await getSupabaseServerClient();

    const { data: recipe, error: recipeError } = await supabase
      .from("kitchen_recipe_recipes")
      .insert({
        tenant_id: tenant.tenantId,
        name,
        normalized_name: normalizeRecipeName(name),
        description: description || null,
        category: category || null,
        default_yield_quantity: yieldQuantity,
        default_yield_unit_id: yieldUnitId || null,
        default_servings: servings,
        created_by: user.id,
      })
      .select("id")
      .single();

    if (recipeError) throw new Error(`No se pudo crear la receta: ${recipeError.message}`);

    const { error: versionError } = await supabase.from("kitchen_recipe_versions").insert({
      tenant_id: tenant.tenantId,
      recipe_id: recipe.id,
      version_number: 1,
      status: "draft",
      yield_quantity: yieldQuantity,
      yield_unit_id: yieldUnitId || null,
      servings,
      created_by: user.id,
    });

    if (versionError) throw new Error(`No se pudo crear la versión inicial: ${versionError.message}`);

    revalidateKitchenRecipes(tenant.tenantSlug, recipe.id);
    return { ok: true, message: "Receta creada con versión inicial." };
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : "No se pudo crear la receta." };
  }
}

export async function addKitchenRecipeLineAction(
  _prev: KitchenRecipeActionState,
  formData: FormData,
): Promise<KitchenRecipeActionState> {
  try {
    const tenantSlug = toText(formData.get("tenantSlug")).toLowerCase();
    const recipeId = toText(formData.get("recipeId"));
    const recipeVersionId = toText(formData.get("recipeVersionId"));
    const lineType = toText(formData.get("lineType"));
    const itemId = toText(formData.get("itemId"));
    const subRecipeVersionId = toText(formData.get("subRecipeVersionId"));
    const unitId = toText(formData.get("unitId"));
    const quantity = toRecipeNumber(toText(formData.get("quantity")), "Cantidad");
    const wasteRaw = toText(formData.get("wastePercent"));
    const wastePercent = wasteRaw ? Number(wasteRaw) : 0;

    if (!tenantSlug || !recipeId || !recipeVersionId || !lineType || !unitId) {
      return { ok: false, message: "Faltan campos obligatorios." };
    }
    if (!["inventory_item", "sub_recipe"].includes(lineType)) {
      return { ok: false, message: "Tipo de línea inválido." };
    }
    if (!Number.isFinite(wastePercent) || wastePercent < 0 || wastePercent >= 100) {
      return { ok: false, message: "Merma inválida." };
    }

    const { tenant, user } = await resolveTenantModulePageActor(tenantSlug, "kitchen_recipes", "recipes", "manage");
    const supabase = await getSupabaseServerClient();

    const payload = {
      tenant_id: tenant.tenantId,
      recipe_version_id: recipeVersionId,
      line_type: lineType,
      item_id: lineType === "inventory_item" ? itemId : null,
      sub_recipe_version_id: lineType === "sub_recipe" ? subRecipeVersionId : null,
      quantity,
      unit_id: unitId,
      waste_percent: wastePercent,
      created_by: user.id,
    };

    const { error } = await supabase.from("kitchen_recipe_lines").insert(payload);
    if (error) throw new Error(`No se pudo agregar línea: ${error.message}`);

    revalidateKitchenRecipes(tenant.tenantSlug, recipeId);
    return { ok: true, message: "Línea agregada." };
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : "No se pudo agregar la línea." };
  }
}

export async function removeKitchenRecipeLineAction(
  _prev: KitchenRecipeActionState,
  formData: FormData,
): Promise<KitchenRecipeActionState> {
  try {
    const tenantSlug = toText(formData.get("tenantSlug")).toLowerCase();
    const recipeId = toText(formData.get("recipeId"));
    const lineId = toText(formData.get("lineId"));
    if (!tenantSlug || !recipeId || !lineId) return { ok: false, message: "Datos incompletos." };

    const { tenant } = await resolveTenantModulePageActor(tenantSlug, "kitchen_recipes", "recipes", "manage");
    const supabase = await getSupabaseServerClient();
    const { error } = await supabase
      .from("kitchen_recipe_lines")
      .delete()
      .eq("tenant_id", tenant.tenantId)
      .eq("id", lineId);

    if (error) throw new Error(`No se pudo eliminar línea: ${error.message}`);

    revalidateKitchenRecipes(tenant.tenantSlug, recipeId);
    return { ok: true, message: "Línea eliminada." };
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : "No se pudo eliminar la línea." };
  }
}

export async function updateKitchenRecipeLineAction(
  _prev: KitchenRecipeActionState,
  formData: FormData,
): Promise<KitchenRecipeActionState> {
  try {
    const tenantSlug = toText(formData.get("tenantSlug")).toLowerCase();
    const recipeId = toText(formData.get("recipeId"));
    const lineId = toText(formData.get("lineId"));
    const unitId = toText(formData.get("unitId"));
    const perUnitQuantity = toRecipeNumber(toText(formData.get("quantityPerYieldUnit")), "Cantidad por unidad de rendimiento");
    const wasteRaw = toText(formData.get("wastePercent"));
    const wastePercent = wasteRaw ? Number(wasteRaw) : 0;
    const notes = toText(formData.get("notes"));
    const technicalNotes = toText(formData.get("technicalNotes"));
    if (!tenantSlug || !recipeId || !lineId || !unitId) return { ok: false, message: "Datos incompletos." };
    if (!Number.isFinite(wastePercent) || wastePercent < 0 || wastePercent >= 100) {
      return { ok: false, message: "Merma inválida." };
    }

    const { tenant } = await resolveTenantModulePageActor(tenantSlug, "kitchen_recipes", "recipes", "manage");
    const supabase = await getSupabaseServerClient();

    const { data: line, error: lineError } = await supabase
      .from("kitchen_recipe_lines")
      .select("id,recipe_version_id")
      .eq("tenant_id", tenant.tenantId)
      .eq("id", lineId)
      .maybeSingle();
    if (lineError) throw new Error(`No se pudo cargar línea: ${lineError.message}`);
    if (!line) return { ok: false, message: "La línea no existe." };

    const { data: version, error: versionError } = await supabase
      .from("kitchen_recipe_versions")
      .select("id,status,yield_quantity")
      .eq("tenant_id", tenant.tenantId)
      .eq("id", line.recipe_version_id)
      .maybeSingle();
    if (versionError) throw new Error(`No se pudo cargar versión: ${versionError.message}`);
    if (!version) return { ok: false, message: "La versión de receta no existe." };
    if (version.status !== "draft") {
      return { ok: false, message: "Solo se pueden editar líneas en versión draft." };
    }

    const baseYieldQuantity = Number(version.yield_quantity ?? 0);
    if (!Number.isFinite(baseYieldQuantity) || baseYieldQuantity <= 0) {
      return { ok: false, message: "La versión no tiene base de rendimiento válida (yield_quantity)." };
    }

    const storedQuantity = perUnitQuantity * baseYieldQuantity;
    if (!Number.isFinite(storedQuantity) || storedQuantity < 0) {
      return { ok: false, message: "Cantidad total inválida." };
    }

    const combinedNotes = [notes.trim(), technicalNotes.trim()].filter(Boolean).join("\n");

    const { error: updateError } = await supabase
      .from("kitchen_recipe_lines")
      .update({
        unit_id: unitId,
        quantity: storedQuantity,
        waste_percent: wastePercent,
        notes: combinedNotes || null,
      })
      .eq("tenant_id", tenant.tenantId)
      .eq("id", lineId);

    if (updateError) throw new Error(`No se pudo actualizar línea: ${updateError.message}`);

    revalidateKitchenRecipes(tenant.tenantSlug, recipeId);
    return { ok: true, message: "Línea actualizada." };
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : "No se pudo actualizar la línea." };
  }
}

export async function activateKitchenRecipeVersionAction(
  _prev: KitchenRecipeActionState,
  formData: FormData,
): Promise<KitchenRecipeActionState> {
  try {
    const tenantSlug = toText(formData.get("tenantSlug")).toLowerCase();
    const recipeId = toText(formData.get("recipeId"));
    const recipeVersionId = toText(formData.get("recipeVersionId"));
    if (!tenantSlug || !recipeId || !recipeVersionId) return { ok: false, message: "Datos incompletos." };

    const { tenant, user } = await resolveTenantModulePageActor(tenantSlug, "kitchen_recipes", "recipes", "manage");
    const supabase = await getSupabaseServerClient();

    const { error: clearError } = await supabase
      .from("kitchen_recipe_versions")
      .update({ status: "archived" })
      .eq("tenant_id", tenant.tenantId)
      .eq("recipe_id", recipeId)
      .eq("status", "active");
    if (clearError) throw new Error(clearError.message);

    const { error: activateError } = await supabase
      .from("kitchen_recipe_versions")
      .update({ status: "active", activated_at: new Date().toISOString(), activated_by: user.id })
      .eq("tenant_id", tenant.tenantId)
      .eq("id", recipeVersionId);

    if (activateError) throw new Error(`No se pudo activar versión: ${activateError.message}`);

    const { error: recipeError } = await supabase
      .from("kitchen_recipe_recipes")
      .update({ status: "active" })
      .eq("tenant_id", tenant.tenantId)
      .eq("id", recipeId);

    if (recipeError) throw new Error(`No se pudo actualizar estado de receta: ${recipeError.message}`);

    revalidateKitchenRecipes(tenant.tenantSlug, recipeId);
    return { ok: true, message: "Versión activada." };
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : "No se pudo activar versión." };
  }
}

export async function createDraftFromActiveKitchenRecipeVersionAction(
  _prev: KitchenRecipeActionState,
  formData: FormData,
): Promise<KitchenRecipeActionState> {
  try {
    const tenantSlug = toText(formData.get("tenantSlug")).toLowerCase();
    const recipeId = toText(formData.get("recipeId"));
    const sourceVersionId = toText(formData.get("sourceVersionId"));
    if (!tenantSlug || !recipeId || !sourceVersionId) return { ok: false, message: "Datos incompletos." };

    const { tenant, user } = await resolveTenantModulePageActor(tenantSlug, "kitchen_recipes", "recipes", "manage");
    const supabase = await getSupabaseServerClient();

    const { data: existingDraft, error: existingDraftError } = await supabase
      .from("kitchen_recipe_versions")
      .select("id,version_number")
      .eq("tenant_id", tenant.tenantId)
      .eq("recipe_id", recipeId)
      .eq("status", "draft")
      .order("version_number", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (existingDraftError) throw new Error(`No se pudo validar draft existente: ${existingDraftError.message}`);
    if (existingDraft) {
      return { ok: true, message: `Ya existe un borrador: v${existingDraft.version_number}.` };
    }

    const { data: sourceVersion, error: sourceVersionError } = await supabase
      .from("kitchen_recipe_versions")
      .select("id,recipe_id,status,version_number,yield_quantity,yield_unit_id,servings,instructions,notes")
      .eq("tenant_id", tenant.tenantId)
      .eq("id", sourceVersionId)
      .eq("recipe_id", recipeId)
      .maybeSingle();
    if (sourceVersionError) throw new Error(`No se pudo cargar versión origen: ${sourceVersionError.message}`);
    if (!sourceVersion) return { ok: false, message: "La versión origen no existe." };
    if (sourceVersion.status !== "active") {
      return { ok: false, message: "Solo se puede crear borrador desde una versión activa." };
    }

    const { data: lastVersion, error: lastVersionError } = await supabase
      .from("kitchen_recipe_versions")
      .select("version_number")
      .eq("tenant_id", tenant.tenantId)
      .eq("recipe_id", recipeId)
      .order("version_number", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (lastVersionError) throw new Error(`No se pudo cargar última versión: ${lastVersionError.message}`);
    const nextVersionNumber = Number(lastVersion?.version_number ?? 0) + 1;

    const { data: insertedDraft, error: insertDraftError } = await supabase
      .from("kitchen_recipe_versions")
      .insert({
        tenant_id: tenant.tenantId,
        recipe_id: recipeId,
        version_number: nextVersionNumber,
        status: "draft",
        yield_quantity: sourceVersion.yield_quantity,
        yield_unit_id: sourceVersion.yield_unit_id,
        servings: sourceVersion.servings,
        instructions: sourceVersion.instructions,
        notes: sourceVersion.notes,
        created_by: user.id,
      })
      .select("id,version_number")
      .single();
    if (insertDraftError || !insertedDraft) throw new Error(`No se pudo crear borrador: ${insertDraftError?.message}`);

    const { data: sourceLines, error: sourceLinesError } = await supabase
      .from("kitchen_recipe_lines")
      .select("line_type,item_id,sub_recipe_version_id,quantity,unit_id,waste_percent,notes,sort_order")
      .eq("tenant_id", tenant.tenantId)
      .eq("recipe_version_id", sourceVersionId);
    if (sourceLinesError) throw new Error(`No se pudieron cargar líneas origen: ${sourceLinesError.message}`);

    if ((sourceLines ?? []).length > 0) {
      const clonedLines = (sourceLines ?? []).map((line) => ({
        tenant_id: tenant.tenantId,
        recipe_version_id: insertedDraft.id,
        line_type: line.line_type,
        item_id: line.item_id,
        sub_recipe_version_id: line.sub_recipe_version_id,
        quantity: line.quantity,
        unit_id: line.unit_id,
        waste_percent: line.waste_percent,
        notes: line.notes,
        sort_order: line.sort_order,
        created_by: user.id,
      }));
      const { error: cloneLinesError } = await supabase.from("kitchen_recipe_lines").insert(clonedLines);
      if (cloneLinesError) throw new Error(`No se pudieron clonar líneas: ${cloneLinesError.message}`);
    }

    revalidateKitchenRecipes(tenant.tenantSlug, recipeId);
    return { ok: true, message: `Borrador v${insertedDraft.version_number} creado desde versión activa.` };
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : "No se pudo crear el borrador." };
  }
}

export async function saveKitchenRecipeCostSnapshotAction(
  _prev: KitchenRecipeActionState,
  formData: FormData,
): Promise<KitchenRecipeActionState> {
  try {
    const tenantSlug = toText(formData.get("tenantSlug")).toLowerCase();
    const recipeId = toText(formData.get("recipeId"));
    const recipeVersionId = toText(formData.get("recipeVersionId"));
    const snapshotType = toText(formData.get("snapshotType")) || "current";

    if (!tenantSlug || !recipeId || !recipeVersionId) {
      return { ok: false, message: "Datos incompletos para snapshot." };
    }

    const { tenant, user } = await resolveTenantModulePageActor(tenantSlug, "kitchen_recipes", "costing", "manage");
    const cost = await calculateKitchenRecipeVersionCost(tenant.tenantId, recipeVersionId);

    const supabase = await getSupabaseServerClient();
    const { error } = await supabase.from("kitchen_recipe_cost_snapshots").insert({
      tenant_id: tenant.tenantId,
      recipe_id: recipeId,
      recipe_version_id: recipeVersionId,
      snapshot_type: snapshotType,
      total_cost: cost.totalCost,
      cost_per_serving: cost.costPerServing,
      cost_per_yield_unit: cost.costPerYieldUnit,
      currency: "MXN",
      costing_payload: { lines: cost.lines },
      warnings: cost.warnings,
      created_by: user.id,
    });

    if (error) throw new Error(`No se pudo guardar snapshot: ${error.message}`);

    revalidateKitchenRecipes(tenant.tenantSlug, recipeId);
    return { ok: true, message: "Snapshot guardado." };
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : "No se pudo guardar snapshot." };
  }
}

export async function calculateKitchenRecipeCostAction(tenantSlug: string, recipeVersionId: string) {
  const { tenant } = await resolveTenantModulePageActor(tenantSlug, "kitchen_recipes", "costing", "read");
  return calculateKitchenRecipeVersionCost(tenant.tenantId, recipeVersionId);
}

export async function resolvePendingRecipeIngredientAction(
  _prev: KitchenRecipeActionState,
  formData: FormData,
): Promise<KitchenRecipeActionState> {
  try {
    const tenantSlug = toText(formData.get("tenantSlug")).toLowerCase();
    const recipeId = toText(formData.get("recipeId"));
    const importRowId = toText(formData.get("importRowId"));
    const itemId = toText(formData.get("itemId"));
    const unitId = toText(formData.get("unitId"));
    const quantity = toRecipeNumber(toText(formData.get("quantity")), "Cantidad");
    const wasteRaw = toText(formData.get("wastePercent"));
    const wastePercent = wasteRaw ? Number(wasteRaw) : 0;

    if (!tenantSlug || !recipeId || !importRowId || !itemId || !unitId) {
      return { ok: false, message: "Faltan campos para resolver ingrediente pendiente." };
    }
    if (!Number.isFinite(wastePercent) || wastePercent < 0 || wastePercent >= 100) {
      return { ok: false, message: "Merma inválida." };
    }

    const { tenant, user } = await resolveTenantModulePageActor(tenantSlug, "kitchen_recipes", "recipes", "manage");
    const supabase = await getSupabaseServerClient();

    const { data: row, error: rowError } = await supabase
      .from("kitchen_recipe_import_rows")
      .select("id, action, status, applied_recipe_id, applied_version_id")
      .eq("tenant_id", tenant.tenantId)
      .eq("id", importRowId)
      .maybeSingle();
    if (rowError) throw new Error(`No se pudo cargar fila pendiente: ${rowError.message}`);
    if (!row) return { ok: false, message: "La fila pendiente no existe." };
    if (row.applied_recipe_id !== recipeId) return { ok: false, message: "La fila pendiente no pertenece a esta receta." };
    if (!row.applied_version_id) return { ok: false, message: "La fila pendiente no tiene versión asociada." };

    const [{ data: item, error: itemError }, { data: unit, error: unitError }] = await Promise.all([
      supabase
        .from("kitchen_inventory_items")
        .select("id")
        .eq("tenant_id", tenant.tenantId)
        .eq("id", itemId)
        .maybeSingle(),
      supabase
        .from("kitchen_inventory_units")
        .select("id")
        .eq("tenant_id", tenant.tenantId)
        .eq("id", unitId)
        .maybeSingle(),
    ]);
    if (itemError || !item) return { ok: false, message: "Insumo inválido para el tenant." };
    if (unitError || !unit) return { ok: false, message: "Unidad inválida para el tenant." };

    const importNote = `import-row:${importRowId}`;
    const { data: existingLine, error: existingLineError } = await supabase
      .from("kitchen_recipe_lines")
      .select("id")
      .eq("tenant_id", tenant.tenantId)
      .eq("recipe_version_id", row.applied_version_id)
      .eq("notes", importNote)
      .maybeSingle();
    if (existingLineError) throw new Error(`No se pudo validar duplicado de línea: ${existingLineError.message}`);

    let lineId = existingLine?.id as string | undefined;
    if (!lineId) {
      const { data: insertedLine, error: lineError } = await supabase
        .from("kitchen_recipe_lines")
        .insert({
          tenant_id: tenant.tenantId,
          recipe_version_id: row.applied_version_id,
          line_type: "inventory_item",
          item_id: itemId,
          quantity,
          unit_id: unitId,
          waste_percent: wastePercent,
          notes: importNote,
          created_by: user.id,
        })
        .select("id")
        .single();
      if (lineError || !insertedLine) throw new Error(`No se pudo crear línea para pendiente: ${lineError?.message ?? "error"}`);
      lineId = insertedLine.id;
    }

    const { error: updateError } = await supabase
      .from("kitchen_recipe_import_rows")
      .update({
        status: "applied",
        severity: "info",
        action: "upsert_recipe_line",
        matched_item_id: itemId,
        matched_unit_id: unitId,
        applied_line_id: lineId,
        applied_at: new Date().toISOString(),
        validation_errors: [],
        validation_warnings: [],
      })
      .eq("tenant_id", tenant.tenantId)
      .eq("id", importRowId);
    if (updateError) throw new Error(`No se pudo actualizar fila pendiente: ${updateError.message}`);

    revalidateKitchenRecipes(tenant.tenantSlug, recipeId);
    return { ok: true, message: "Ingrediente pendiente resuelto y agregado a receta." };
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : "No se pudo resolver pendiente." };
  }
}

export async function skipPendingRecipeIngredientAction(
  _prev: KitchenRecipeActionState,
  formData: FormData,
): Promise<KitchenRecipeActionState> {
  try {
    const tenantSlug = toText(formData.get("tenantSlug")).toLowerCase();
    const recipeId = toText(formData.get("recipeId"));
    const importRowId = toText(formData.get("importRowId"));
    const skipReason = toText(formData.get("skipReason")) || "Omitido manualmente";
    if (!tenantSlug || !recipeId || !importRowId) return { ok: false, message: "Datos incompletos para omitir pendiente." };

    const { tenant } = await resolveTenantModulePageActor(tenantSlug, "kitchen_recipes", "recipes", "manage");
    const supabase = await getSupabaseServerClient();
    const { data: row, error: rowError } = await supabase
      .from("kitchen_recipe_import_rows")
      .select("id, applied_recipe_id, normalized_payload")
      .eq("tenant_id", tenant.tenantId)
      .eq("id", importRowId)
      .maybeSingle();
    if (rowError) throw new Error(`No se pudo cargar fila para omitir: ${rowError.message}`);
    if (!row) return { ok: false, message: "La fila pendiente no existe." };
    if (row.applied_recipe_id !== recipeId) return { ok: false, message: "La fila no pertenece a esta receta." };

    const normalizedPayload = {
      ...(row.normalized_payload && typeof row.normalized_payload === "object" ? row.normalized_payload : {}),
      skipped_reason: skipReason,
    };

    const { error: updateError } = await supabase
      .from("kitchen_recipe_import_rows")
      .update({
        status: "skipped",
        severity: "info",
        action: "skip",
        normalized_payload: normalizedPayload,
        validation_warnings: [skipReason],
      })
      .eq("tenant_id", tenant.tenantId)
      .eq("id", importRowId);
    if (updateError) throw new Error(`No se pudo omitir fila pendiente: ${updateError.message}`);

    revalidateKitchenRecipes(tenant.tenantSlug, recipeId);
    return { ok: true, message: "Ingrediente pendiente omitido." };
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : "No se pudo omitir pendiente." };
  }
}
