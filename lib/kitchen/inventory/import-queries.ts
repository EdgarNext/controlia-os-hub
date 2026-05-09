import { getSupabaseServerClient } from "@/lib/supabase/server";
import type { KitchenInventoryImportBatch, KitchenInventoryImportRow } from "./import-types";

export async function listKitchenInventoryImportBatches(tenantId: string): Promise<KitchenInventoryImportBatch[]> {
  const supabase = await getSupabaseServerClient();
  const { data, error } = await supabase
    .from("kitchen_inventory_import_batches")
    .select("id, tenant_id, original_filename, source_type, status, total_rows, valid_rows, warning_rows, error_rows, applied_rows, skipped_rows, notes, created_at, updated_at, applied_at")
    .eq("tenant_id", tenantId)
    .order("created_at", { ascending: false });

  if (error) throw new Error(`No fue posible listar lotes de importación: ${error.message}`);
  return (data ?? []) as KitchenInventoryImportBatch[];
}

export async function getKitchenInventoryImportBatch(
  tenantId: string,
  batchId: string,
): Promise<KitchenInventoryImportBatch | null> {
  const supabase = await getSupabaseServerClient();
  const { data, error } = await supabase
    .from("kitchen_inventory_import_batches")
    .select("id, tenant_id, original_filename, source_type, status, total_rows, valid_rows, warning_rows, error_rows, applied_rows, skipped_rows, notes, created_at, updated_at, applied_at")
    .eq("tenant_id", tenantId)
    .eq("id", batchId)
    .maybeSingle();

  if (error) throw new Error(`No fue posible cargar el lote: ${error.message}`);
  return (data ?? null) as KitchenInventoryImportBatch | null;
}

export async function listKitchenInventoryImportRows(
  tenantId: string,
  batchId: string,
): Promise<KitchenInventoryImportRow[]> {
  const supabase = await getSupabaseServerClient();
  const { data, error } = await supabase
    .from("kitchen_inventory_import_rows")
    .select("id, tenant_id, batch_id, row_number, raw_payload, normalized_payload, status, severity, action, category_name, item_name, normalized_item_name, unit_code, supplier_name, location_name, quantity, unit_cost, min_quantity, max_quantity, matched_item_id, matched_category_id, matched_unit_id, matched_supplier_id, matched_location_id, validation_errors, validation_warnings, applied_at, applied_movement_id, created_at, updated_at")
    .eq("tenant_id", tenantId)
    .eq("batch_id", batchId)
    .order("row_number", { ascending: true });

  if (error) throw new Error(`No fue posible listar filas del lote: ${error.message}`);
  return (data ?? []) as KitchenInventoryImportRow[];
}
