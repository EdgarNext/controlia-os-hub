export type KitchenInventoryImportBatch = {
  id: string;
  tenant_id: string;
  original_filename: string;
  source_type: "excel";
  status: "draft" | "parsed" | "validated" | "partially_applied" | "applied" | "failed" | "canceled";
  total_rows: number;
  valid_rows: number;
  warning_rows: number;
  error_rows: number;
  applied_rows: number;
  skipped_rows: number;
  notes: string | null;
  created_at: string;
  updated_at: string;
  applied_at: string | null;
};

export type KitchenInventoryImportRow = {
  id: string;
  tenant_id: string;
  batch_id: string;
  row_number: number;
  raw_payload: Record<string, unknown>;
  normalized_payload: Record<string, unknown>;
  status: "pending" | "valid" | "warning" | "error" | "skipped" | "applied";
  severity: "info" | "warning" | "error";
  action: "upsert_item" | "update_item" | "create_opening_balance" | "skip";
  category_name: string | null;
  item_name: string | null;
  normalized_item_name: string | null;
  unit_code: string | null;
  supplier_name: string | null;
  location_name: string | null;
  quantity: number | null;
  unit_cost: number | null;
  min_quantity: number | null;
  max_quantity: number | null;
  matched_item_id: string | null;
  matched_category_id: string | null;
  matched_unit_id: string | null;
  matched_supplier_id: string | null;
  matched_location_id: string | null;
  validation_errors: string[];
  validation_warnings: string[];
  applied_at: string | null;
  applied_movement_id: string | null;
  created_at: string;
  updated_at: string;
};

export type ParsedInventorySheetRow = {
  rowNumber: number;
  itemName: string;
  presentation: string;
  unitCode: string | null;
  categoryName: string | null;
  supplierName: string | null;
  locationName: string | null;
  quantity: number | null;
  unitCost: number | null;
  minQuantity: number | null;
  maxQuantity: number | null;
  raw: Record<string, unknown>;
};

export type ParsedInventoryWorkbook = {
  filePath: string;
  sheetName: string;
  headers: string[];
  rows: ParsedInventorySheetRow[];
  ignoredRows: number;
  ignoredReasons: Record<string, number>;
};
