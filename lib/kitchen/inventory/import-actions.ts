"use server";

import fs from "node:fs";
import { revalidatePath } from "next/cache";
import { resolveTenantModulePageActor, resolveTenantModulePageContext } from "@/lib/auth/module-page-access";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { inferUnitTypeFromCode, parseInventoryWorkbook } from "./import-parser";
import { normalizeKitchenCode, normalizeKitchenName } from "./normalizers";
import type { KitchenInventoryImportRow } from "./import-types";

const DEFAULT_IMPORT_PATH = "/home/developer/dev/controlia-os/docs/tmp/kitchen-import-samples/INVENTARIO FEBRERO 2026.xlsx";

export type KitchenImportActionState = {
  ok: boolean;
  message: string;
  batchId?: string;
  sheetName?: string;
  parsedRows?: number;
  ignoredRows?: number;
};

function toTrimmedString(input: FormDataEntryValue | null): string {
  return String(input ?? "").trim();
}

function revalidateImportPaths(tenantSlug: string, batchId?: string) {
  revalidatePath(`/${tenantSlug}/kitchen/inventory`);
  revalidatePath(`/${tenantSlug}/kitchen/inventory/items`);
  revalidatePath(`/${tenantSlug}/kitchen/inventory/imports`);
  if (batchId) revalidatePath(`/${tenantSlug}/kitchen/inventory/imports/${batchId}`);
}

function chunk<T>(items: T[], size: number): T[][] {
  const result: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    result.push(items.slice(i, i + size));
  }
  return result;
}

export async function createInventoryImportBatchFromLocalFileAction(
  _previousState: KitchenImportActionState,
  formData: FormData,
): Promise<KitchenImportActionState> {
  try {
    const tenantSlug = toTrimmedString(formData.get("tenantSlug")).toLowerCase();
    const requestedPath = toTrimmedString(formData.get("localPath"));
    const localPath = requestedPath || DEFAULT_IMPORT_PATH;

    if (!tenantSlug) return { ok: false, message: "Tenant requerido." };

    const { tenant, user } = await resolveTenantModulePageActor(
      tenantSlug,
      "kitchen_inventory",
      "items",
      "manage",
    );

    if (!fs.existsSync(localPath)) {
      return { ok: false, message: `No existe archivo en ruta: ${localPath}` };
    }

    const parsed = parseInventoryWorkbook(localPath);
    const supabase = await getSupabaseServerClient();

    const { data: batch, error: batchError } = await supabase
      .from("kitchen_inventory_import_batches")
      .insert({
        tenant_id: tenant.tenantId,
        original_filename: localPath.split("/").pop() ?? "inventario.xlsx",
        source_type: "excel",
        status: "parsed",
        total_rows: parsed.rows.length,
        notes: `sheet=${parsed.sheetName}; ignored=${parsed.ignoredRows}`,
        created_by: user.id,
      })
      .select("id")
      .single();

    if (batchError || !batch) {
      throw new Error(`No se pudo crear el batch: ${batchError?.message ?? "error desconocido"}`);
    }

    const rowsPayload = parsed.rows.map((row) => ({
      tenant_id: tenant.tenantId,
      batch_id: batch.id,
      row_number: row.rowNumber,
      raw_payload: row.raw,
      normalized_payload: {
        presentation: row.presentation,
      },
      status: "pending",
      severity: "info",
      action: "upsert_item",
      category_name: row.categoryName,
      item_name: row.itemName,
      normalized_item_name: normalizeKitchenName(row.itemName),
      unit_code: row.unitCode,
      supplier_name: row.supplierName,
      location_name: row.locationName,
      quantity: row.quantity,
      unit_cost: row.unitCost,
      min_quantity: row.minQuantity,
      max_quantity: row.maxQuantity,
      validation_errors: [],
      validation_warnings: [],
    }));

    for (const rowsChunk of chunk(rowsPayload, 200)) {
      const { error } = await supabase.from("kitchen_inventory_import_rows").insert(rowsChunk);
      if (error) throw new Error(`No se pudieron guardar filas staging: ${error.message}`);
    }

    revalidateImportPaths(tenant.tenantSlug, batch.id);
    return {
      ok: true,
      message: "Batch parseado y guardado en staging.",
      batchId: batch.id,
      sheetName: parsed.sheetName,
      parsedRows: parsed.rows.length,
      ignoredRows: parsed.ignoredRows,
    };
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : "No se pudo crear el batch." };
  }
}

export async function validateInventoryImportBatchAction(
  _previousState: KitchenImportActionState,
  formData: FormData,
): Promise<KitchenImportActionState> {
  try {
    const tenantSlug = toTrimmedString(formData.get("tenantSlug")).toLowerCase();
    const batchId = toTrimmedString(formData.get("batchId"));

    if (!tenantSlug || !batchId) return { ok: false, message: "Tenant y batch son obligatorios." };

    const { tenant } = await resolveTenantModulePageActor(
      tenantSlug,
      "kitchen_inventory",
      "items",
      "manage",
    );

    const supabase = await getSupabaseServerClient();

    const [categories, units, suppliers, locations, items, rowsResult] = await Promise.all([
      supabase.from("kitchen_inventory_categories").select("id, normalized_name").eq("tenant_id", tenant.tenantId),
      supabase.from("kitchen_inventory_units").select("id, code").eq("tenant_id", tenant.tenantId),
      supabase.from("kitchen_inventory_suppliers").select("id, normalized_name").eq("tenant_id", tenant.tenantId),
      supabase.from("kitchen_inventory_locations").select("id, normalized_name").eq("tenant_id", tenant.tenantId),
      supabase.from("kitchen_inventory_items").select("id, normalized_name").eq("tenant_id", tenant.tenantId),
      supabase
        .from("kitchen_inventory_import_rows")
        .select("id, row_number, item_name, category_name, supplier_name, location_name, unit_code, quantity, unit_cost, min_quantity, max_quantity")
        .eq("tenant_id", tenant.tenantId)
        .eq("batch_id", batchId)
        .order("row_number", { ascending: true }),
    ]);

    if (categories.error || units.error || suppliers.error || locations.error || items.error || rowsResult.error) {
      throw new Error("No se pudieron cargar entidades para validar batch.");
    }

    const categoryMap = new Map((categories.data ?? []).map((row) => [row.normalized_name, row.id]));
    const unitMap = new Map((units.data ?? []).map((row) => [normalizeKitchenCode(row.code), row.id]));
    const supplierMap = new Map((suppliers.data ?? []).map((row) => [row.normalized_name, row.id]));
    const locationMap = new Map((locations.data ?? []).map((row) => [row.normalized_name, row.id]));
    const itemMap = new Map((items.data ?? []).map((row) => [row.normalized_name, row.id]));

    const updates: Partial<KitchenInventoryImportRow>[] = [];
    let validRows = 0;
    let warningRows = 0;
    let errorRows = 0;

    for (const row of rowsResult.data ?? []) {
      const normalizedItemName = normalizeKitchenName(String(row.item_name ?? ""));
      const normalizedCategoryName = normalizeKitchenName(String(row.category_name ?? ""));
      const normalizedSupplierName = normalizeKitchenName(String(row.supplier_name ?? ""));
      const normalizedLocationName = normalizeKitchenName(String(row.location_name ?? ""));
      const normalizedUnitCode = normalizeKitchenCode(String(row.unit_code ?? ""));

      const errors: string[] = [];
      const warnings: string[] = [];

      if (!normalizedItemName) errors.push("Nombre de insumo vacío");
      if (row.quantity != null && Number(row.quantity) < 0) errors.push("Existencia no puede ser negativa");
      if (row.unit_cost != null && Number(row.unit_cost) < 0) errors.push("Costo unitario inválido");

      if (!normalizedUnitCode) {
        warnings.push("No se detectó unidad clara en presentación");
      }

      if (!normalizedLocationName) {
        warnings.push("Fila sin ubicación");
      }

      const status = errors.length > 0 ? "error" : warnings.length > 0 ? "warning" : "valid";
      const severity = errors.length > 0 ? "error" : warnings.length > 0 ? "warning" : "info";

      if (status === "valid") validRows += 1;
      if (status === "warning") warningRows += 1;
      if (status === "error") errorRows += 1;

      updates.push({
        id: row.id,
        status,
        severity,
        action: row.quantity != null && Number(row.quantity) > 0 ? "create_opening_balance" : "upsert_item",
        normalized_item_name: normalizedItemName,
        category_name: normalizedCategoryName || null,
        supplier_name: normalizedSupplierName || null,
        location_name: normalizedLocationName || null,
        unit_code: normalizedUnitCode || null,
        matched_item_id: itemMap.get(normalizedItemName) ?? null,
        matched_category_id: categoryMap.get(normalizedCategoryName) ?? null,
        matched_supplier_id: supplierMap.get(normalizedSupplierName) ?? null,
        matched_location_id: locationMap.get(normalizedLocationName) ?? null,
        matched_unit_id: unitMap.get(normalizedUnitCode) ?? null,
        validation_errors: errors,
        validation_warnings: warnings,
      });
    }

    for (const updatesChunk of chunk(updates, 200)) {
      for (const entry of updatesChunk) {
        const { id, ...rest } = entry;
        const { error } = await supabase
          .from("kitchen_inventory_import_rows")
          .update(rest)
          .eq("tenant_id", tenant.tenantId)
          .eq("id", id as string);

        if (error) throw new Error(`No se pudo actualizar fila de validación: ${error.message}`);
      }
    }

    const { error: batchUpdateError } = await supabase
      .from("kitchen_inventory_import_batches")
      .update({
        status: "validated",
        valid_rows: validRows,
        warning_rows: warningRows,
        error_rows: errorRows,
      })
      .eq("tenant_id", tenant.tenantId)
      .eq("id", batchId);

    if (batchUpdateError) throw new Error(`No se pudo actualizar resumen del batch: ${batchUpdateError.message}`);

    revalidateImportPaths(tenant.tenantSlug, batchId);
    return {
      ok: true,
      message: `Batch validado. válidas=${validRows}, warning=${warningRows}, error=${errorRows}.`,
      batchId,
    };
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : "No se pudo validar batch." };
  }
}

export async function applyInventoryImportBatchAction(
  _previousState: KitchenImportActionState,
  formData: FormData,
): Promise<KitchenImportActionState> {
  try {
    const tenantSlug = toTrimmedString(formData.get("tenantSlug")).toLowerCase();
    const batchId = toTrimmedString(formData.get("batchId"));

    if (!tenantSlug || !batchId) return { ok: false, message: "Tenant y batch son obligatorios." };

    const { tenant, user } = await resolveTenantModulePageActor(
      tenantSlug,
      "kitchen_inventory",
      "items",
      "manage",
    );

    const supabase = await getSupabaseServerClient();

    const { data: rows, error: rowsError } = await supabase
      .from("kitchen_inventory_import_rows")
      .select("id, row_number, item_name, normalized_item_name, category_name, supplier_name, location_name, unit_code, quantity, unit_cost, min_quantity, max_quantity, status, matched_item_id, matched_category_id, matched_unit_id, matched_supplier_id, matched_location_id, applied_movement_id")
      .eq("tenant_id", tenant.tenantId)
      .eq("batch_id", batchId)
      .in("status", ["valid", "warning", "applied"])
      .order("row_number", { ascending: true });

    if (rowsError) throw new Error(`No se pudo cargar filas para aplicar: ${rowsError.message}`);

    let skippedRows = 0;
    let anyApplyError = false;

    for (const row of rows ?? []) {
      const normalizedItemName = normalizeKitchenName(String(row.normalized_item_name ?? row.item_name ?? ""));
      if (!normalizedItemName) {
        skippedRows += 1;
        continue;
      }

      const categoryName = normalizeKitchenName(String(row.category_name ?? ""));
      const supplierName = normalizeKitchenName(String(row.supplier_name ?? ""));
      const locationName = normalizeKitchenName(String(row.location_name ?? ""));
      const unitCode = normalizeKitchenCode(String(row.unit_code ?? ""));

      const categoryId = await (async () => {
        if (!categoryName) return null;
        const { data: existing } = await supabase
          .from("kitchen_inventory_categories")
          .select("id")
          .eq("tenant_id", tenant.tenantId)
          .eq("normalized_name", categoryName)
          .maybeSingle();
        if (existing?.id) return existing.id as string;
        const { data: inserted, error } = await supabase
          .from("kitchen_inventory_categories")
          .insert({ tenant_id: tenant.tenantId, name: row.category_name, normalized_name: categoryName, created_by: user.id })
          .select("id")
          .single();
        if (error) throw new Error(`No se pudo crear categoría fila ${row.row_number}: ${error.message}`);
        return inserted.id as string;
      })();

      const supplierId = await (async () => {
        if (!supplierName) return null;
        const { data: existing } = await supabase
          .from("kitchen_inventory_suppliers")
          .select("id")
          .eq("tenant_id", tenant.tenantId)
          .eq("normalized_name", supplierName)
          .maybeSingle();
        if (existing?.id) return existing.id as string;
        const { data: inserted, error } = await supabase
          .from("kitchen_inventory_suppliers")
          .insert({ tenant_id: tenant.tenantId, name: row.supplier_name, normalized_name: supplierName, created_by: user.id })
          .select("id")
          .single();
        if (error) throw new Error(`No se pudo crear proveedor fila ${row.row_number}: ${error.message}`);
        return inserted.id as string;
      })();

      const locationId = await (async () => {
        if (!locationName) return null;
        const { data: existing } = await supabase
          .from("kitchen_inventory_locations")
          .select("id")
          .eq("tenant_id", tenant.tenantId)
          .eq("normalized_name", locationName)
          .maybeSingle();
        if (existing?.id) return existing.id as string;
        const { data: inserted, error } = await supabase
          .from("kitchen_inventory_locations")
          .insert({ tenant_id: tenant.tenantId, name: row.location_name, normalized_name: locationName, created_by: user.id })
          .select("id")
          .single();
        if (error) throw new Error(`No se pudo crear ubicación fila ${row.row_number}: ${error.message}`);
        return inserted.id as string;
      })();

      const finalUnitCode = unitCode || "pza";
      const unitId = await (async () => {
        const { data: existing } = await supabase
          .from("kitchen_inventory_units")
          .select("id")
          .eq("tenant_id", tenant.tenantId)
          .eq("code", finalUnitCode)
          .maybeSingle();
        if (existing?.id) return existing.id as string;

        const unitType = inferUnitTypeFromCode(finalUnitCode);
        const { data: inserted, error } = await supabase
          .from("kitchen_inventory_units")
          .insert({
            tenant_id: tenant.tenantId,
            code: finalUnitCode,
            name: finalUnitCode.toUpperCase(),
            normalized_name: normalizeKitchenName(finalUnitCode),
            unit_type: unitType,
            created_by: user.id,
          })
          .select("id")
          .single();
        if (error) throw new Error(`No se pudo crear unidad fila ${row.row_number}: ${error.message}`);
        return inserted.id as string;
      })();

      const { data: upsertedItem, error: upsertItemError } = await supabase
        .from("kitchen_inventory_items")
        .upsert(
          {
            tenant_id: tenant.tenantId,
            category_id: categoryId,
            default_unit_id: unitId,
            default_supplier_id: supplierId,
            name: row.item_name,
            normalized_name: normalizedItemName,
            current_unit_cost: row.unit_cost ?? 0,
            created_by: user.id,
          },
          { onConflict: "tenant_id,normalized_name" },
        )
        .select("id")
        .single();

      if (upsertItemError || !upsertedItem) {
        anyApplyError = true;
        await supabase
          .from("kitchen_inventory_import_rows")
          .update({ status: "error", severity: "error", validation_errors: [upsertItemError?.message ?? "No se pudo upsert item"] })
          .eq("tenant_id", tenant.tenantId)
          .eq("id", row.id);
        continue;
      }

      let movementId: string | null = row.applied_movement_id;
      const quantity = row.quantity == null ? 0 : Number(row.quantity);

      if (quantity > 0 && !locationId) {
        anyApplyError = true;
        await supabase
          .from("kitchen_inventory_import_rows")
          .update({
            status: "error",
            severity: "error",
            validation_errors: ["La fila tiene existencia > 0 pero no se pudo resolver ubicación."],
          })
          .eq("tenant_id", tenant.tenantId)
          .eq("id", row.id);
        continue;
      }

      if (quantity > 0 && locationId) {
        const idempotencyKey = `inventory-import:${batchId}:${row.id}`;
        const { data: rpcData, error: rpcError } = await supabase.rpc("kitchen_inventory_record_movement", {
          p_tenant_id: tenant.tenantId,
          p_item_id: upsertedItem.id,
          p_location_id: locationId,
          p_unit_id: unitId,
          p_movement_type: "opening_balance",
          p_quantity: quantity,
          p_unit_cost: row.unit_cost,
          p_reason: "Importación inicial de inventario desde Excel",
          p_source_type: "import",
          p_source_id: null,
          p_idempotency_key: idempotencyKey,
          p_occurred_at: new Date().toISOString(),
        });

        if (rpcError) {
          anyApplyError = true;
          await supabase
            .from("kitchen_inventory_import_rows")
            .update({ status: "error", severity: "error", validation_errors: [rpcError.message] })
            .eq("tenant_id", tenant.tenantId)
            .eq("id", row.id);
          continue;
        }

        movementId = Array.isArray(rpcData) && rpcData[0]?.movement_id ? String(rpcData[0].movement_id) : movementId;
      }

      if (quantity > 0 && !movementId) {
        anyApplyError = true;
        await supabase
          .from("kitchen_inventory_import_rows")
          .update({
            status: "error",
            severity: "error",
            validation_errors: [
              "La fila tiene existencia > 0 pero no se registró movement_id. Reintenta apply del batch.",
            ],
          })
          .eq("tenant_id", tenant.tenantId)
          .eq("id", row.id);
        continue;
      }

      if (row.min_quantity != null || row.max_quantity != null) {
        await supabase.from("kitchen_inventory_stock_rules").upsert(
          {
            tenant_id: tenant.tenantId,
            item_id: upsertedItem.id,
            location_id: locationId,
            min_quantity: row.min_quantity,
            max_quantity: row.max_quantity,
            created_by: user.id,
          },
          { onConflict: "tenant_id,item_id,location_id" },
        );
      }

      const { error: rowUpdateError } = await supabase
        .from("kitchen_inventory_import_rows")
        .update({
          status: "applied",
          severity: "info",
          matched_item_id: upsertedItem.id,
          matched_category_id: categoryId,
          matched_supplier_id: supplierId,
          matched_location_id: locationId,
          matched_unit_id: unitId,
          applied_movement_id: movementId,
          applied_at: new Date().toISOString(),
          validation_errors: [],
        })
        .eq("tenant_id", tenant.tenantId)
        .eq("id", row.id);

      if (rowUpdateError) {
        anyApplyError = true;
        continue;
      }
    }

    const { data: counters, error: countersError } = await supabase
      .from("kitchen_inventory_import_rows")
      .select("status")
      .eq("tenant_id", tenant.tenantId)
      .eq("batch_id", batchId);

    if (countersError) {
      throw new Error(`No se pudieron calcular contadores finales del batch: ${countersError.message}`);
    }

    const totalAppliedRows = (counters ?? []).filter((entry) => entry.status === "applied").length;
    const totalErrorRows = (counters ?? []).filter((entry) => entry.status === "error").length;
    const totalSkippedRows = (counters ?? []).filter((entry) => entry.status === "skipped").length;

    const status =
      totalAppliedRows === 0
        ? "failed"
        : totalErrorRows > 0 || anyApplyError || totalSkippedRows > 0 || skippedRows > 0
          ? "partially_applied"
          : "applied";

    const { error: batchUpdateError } = await supabase
      .from("kitchen_inventory_import_batches")
      .update({
        status,
        applied_rows: totalAppliedRows,
        skipped_rows: Math.max(totalSkippedRows, skippedRows),
        error_rows: totalErrorRows,
        applied_at: new Date().toISOString(),
        applied_by: user.id,
      })
      .eq("tenant_id", tenant.tenantId)
      .eq("id", batchId);

    if (batchUpdateError) throw new Error(`No se pudo actualizar estado final del batch: ${batchUpdateError.message}`);

    revalidateImportPaths(tenant.tenantSlug, batchId);
    return {
      ok: true,
      message: `Aplicación finalizada. aplicadas=${totalAppliedRows}, errores=${totalErrorRows}, skip=${Math.max(totalSkippedRows, skippedRows)}, status=${status}.`,
      batchId,
    };
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : "No se pudo aplicar batch." };
  }
}

export async function assertKitchenImportReadAccess(tenantSlug: string) {
  return resolveTenantModulePageContext(tenantSlug, "kitchen_inventory", "items", "read");
}
