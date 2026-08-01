import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { RetailPosRuntimeError } from "@/lib/retail-pos/errors";
import { toPurchaseCostingRpcPayload } from "@/lib/retail-pos/purchase-costing-contract";
import type {
  AddPurchaseCostingLineInput,
  CalculatePurchaseCostingInput,
  CreatePurchaseCostingInput,
  RetailPosPurchaseCostingDetail,
  RetailPosPurchaseCostingApplyResult,
  RetailPosPurchaseCostingAppliedProduct,
  RetailPosPurchaseCostingLine,
  RetailPosPurchaseCostingStatus,
  RetailPosPurchaseCostingSummary,
  UpdatePurchaseCostingHeaderInput,
  UpdatePurchaseCostingLineInput,
} from "@/shared/types/retail-pos";

type ServiceContext = { tenantId: string; actorPosUserId?: string | null };
type CostingRow = Record<string, unknown>;
type LineRow = Record<string, unknown>;

function numberValue(value: unknown, fallback = 0) {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function stringValue(value: unknown) {
  return value === null || value === undefined ? null : String(value);
}

function errorFromSupabase(error: { code?: string; message?: string }, fallback = "No fue posible modificar el costeo."): never {
  const message = error.message ?? "";
  if (message.includes("REVISION_CONFLICT")) throw new RetailPosRuntimeError(409, "El documento cambió. Recarga la información antes de continuar.", "REVISION_CONFLICT");
  if (message.includes("STATUS_IMMUTABLE")) throw new RetailPosRuntimeError(409, "El documento no puede modificarse en su estado actual.", "COSTING_IMMUTABLE");
  if (message.includes("LINE_DUPLICATE")) throw new RetailPosRuntimeError(409, "El producto ya existe en este documento.", "LINE_DUPLICATE");
  if (message.includes("NOT_FOUND")) throw new RetailPosRuntimeError(404, "El costeo o línea no fue encontrado.", "COSTING_NOT_FOUND");
  if (message.includes("SUPPLIER_INVALID")) throw new RetailPosRuntimeError(404, "El proveedor no pertenece al tenant o está inactivo.", "SUPPLIER_NOT_FOUND");
  if (message.includes("PRODUCT_INVALID")) throw new RetailPosRuntimeError(404, "El producto no pertenece al tenant o está inactivo.", "PRODUCT_NOT_FOUND");
  if (message.includes("LINE_RESULTS_REQUIRED")) throw new RetailPosRuntimeError(422, "Calcula el documento antes de aplicarlo.", "COSTING_NOT_CALCULATED");
  if (message.includes("LINES_REQUIRED")) throw new RetailPosRuntimeError(422, "Agrega al menos un producto antes de calcular.", "LINES_REQUIRED");
  if (message.includes("SUPPLIER_REQUIRED")) throw new RetailPosRuntimeError(422, "El proveedor es obligatorio para calcular.", "SUPPLIER_REQUIRED");
  if (message.includes("STATUS_INVALID")) throw new RetailPosRuntimeError(409, "El documento no puede calcularse en su estado actual.", "COSTING_IMMUTABLE");
  if (message.includes("INPUT_INVALID") || error.code === "22P02" || error.code === "22003" || error.code === "23514") throw new RetailPosRuntimeError(400, "Los datos del costeo no son válidos.", "INVALID_COSTING_INPUT");
  console.error("[retail-pos][purchase-costing]", { code: error.code ?? null, message });
  throw new RetailPosRuntimeError(500, fallback, "COSTING_OPERATION_FAILED");
}

function mapLine(row: LineRow): RetailPosPurchaseCostingLine {
  return {
    id: String(row.id), productId: String(row.product_id), lineNumber: numberValue(row.line_number),
    productNameSnapshot: String(row.product_name_snapshot), productSkuSnapshot: stringValue(row.product_sku_snapshot),
    productSupplierNameSnapshot: stringValue(row.product_supplier_name_snapshot), purchasedQuantity: String(row.purchased_quantity),
    purchaseUnitLabel: String(row.purchase_unit_label), unitsPerPurchaseUnit: String(row.units_per_purchase_unit),
    salesUnitCodeSnapshot: String(row.sales_unit_code_snapshot), salesUnitLabelSnapshot: String(row.sales_unit_label_snapshot),
    invoiceUnitCostCents: numberValue(row.invoice_unit_cost_cents), effectivePublicMarkupBps: numberValue(row.effective_public_markup_bps),
    effectiveWholesaleMarkupBps: numberValue(row.effective_wholesale_markup_bps), publicMarkupOverrideBps: row.public_markup_override_bps === null ? null : numberValue(row.public_markup_override_bps),
    wholesaleMarkupOverrideBps: row.wholesale_markup_override_bps === null ? null : numberValue(row.wholesale_markup_override_bps),
    subtotalCents: row.subtotal_cents === null ? null : numberValue(row.subtotal_cents), taxCents: row.tax_cents === null ? null : numberValue(row.tax_cents),
    grossTotalCents: row.gross_total_cents === null ? null : numberValue(row.gross_total_cents), discountCents: row.discount_cents === null ? null : numberValue(row.discount_cents),
    netTotalCents: row.net_total_cents === null ? null : numberValue(row.net_total_cents), saleUnitsQuantity: stringValue(row.sale_units_quantity),
    baseUnitCostCents: row.base_unit_cost_cents === null ? null : numberValue(row.base_unit_cost_cents), suggestedPublicPriceCents: row.suggested_public_price_cents === null ? null : numberValue(row.suggested_public_price_cents),
    suggestedWholesalePriceCents: row.suggested_wholesale_price_cents === null ? null : numberValue(row.suggested_wholesale_price_cents), finalPublicPriceCents: row.final_public_price_cents === null ? null : numberValue(row.final_public_price_cents),
    finalWholesalePriceCents: row.final_wholesale_price_cents === null ? null : numberValue(row.final_wholesale_price_cents), previousCostCents: row.previous_cost_cents === null ? null : numberValue(row.previous_cost_cents),
    previousPublicPriceCents: numberValue(row.previous_public_price_cents), previousWholesalePriceCents: numberValue(row.previous_wholesale_price_cents),
    publicPriceMode: (row.public_price_mode === "rounded" || row.public_price_mode === "manual" ? row.public_price_mode : "suggested"),
    wholesalePriceMode: (row.wholesale_price_mode === "rounded" || row.wholesale_price_mode === "manual" ? row.wholesale_price_mode : "suggested"),
    warnings: Array.isArray(row.warnings) ? row.warnings.filter((item): item is RetailPosPurchaseCostingLine["warnings"][number] => typeof item === "string") : [],
    createdAt: String(row.created_at), updatedAt: String(row.updated_at),
  };
}

async function mapDetail(context: ServiceContext, costing: CostingRow, lines?: LineRow[]): Promise<RetailPosPurchaseCostingDetail> {
  const supabase = getSupabaseAdminClient();
  const actorIds = [costing.created_by_pos_user_id, costing.calculated_by_pos_user_id, costing.applied_by_pos_user_id].filter((id): id is string => typeof id === "string");
  const supplierId = stringValue(costing.supplier_id);
  const [supplierResult, actorsResult] = await Promise.all([
    supplierId ? supabase.from("retail_pos_suppliers").select("id,name").eq("tenant_id", context.tenantId).eq("id", supplierId).maybeSingle<{ id: string; name: string }>() : Promise.resolve({ data: null, error: null }),
    actorIds.length ? supabase.from("pos_users").select("id,name").eq("tenant_id", context.tenantId).in("id", actorIds) : Promise.resolve({ data: [], error: null }),
  ]);
  if (supplierResult.error || actorsResult.error) throw new RetailPosRuntimeError(500, "No fue posible cargar la auditoría del costeo.", "COSTING_DETAIL_FAILED");
  const actorById = new Map((actorsResult.data ?? []).map((actor) => [actor.id, actor.name]));
  const detail: RetailPosPurchaseCostingDetail = {
    id: String(costing.id), tenantId: String(costing.tenant_id), supplierId, supplierName: supplierResult.data?.name ?? null,
    invoiceReference: stringValue(costing.invoice_reference), invoiceDate: stringValue(costing.invoice_date), status: costing.status as RetailPosPurchaseCostingStatus,
    taxRateBps: numberValue(costing.tax_rate_bps), discountRateBps: numberValue(costing.discount_rate_bps), defaultPublicMarkupBps: numberValue(costing.default_public_markup_bps), defaultWholesaleMarkupBps: numberValue(costing.default_wholesale_markup_bps),
    defaultPublicPriceMode: costing.default_public_price_mode === "rounded" || costing.default_public_price_mode === "manual" ? costing.default_public_price_mode : "suggested",
    defaultWholesalePriceMode: costing.default_wholesale_price_mode === "rounded" || costing.default_wholesale_price_mode === "manual" ? costing.default_wholesale_price_mode : "suggested",
    subtotalCents: numberValue(costing.subtotal_cents), taxCents: numberValue(costing.tax_cents), grossTotalCents: numberValue(costing.gross_total_cents), discountCents: numberValue(costing.discount_cents), netTotalCents: numberValue(costing.net_total_cents), totalSaleUnits: String(costing.total_sale_units), revision: numberValue(costing.revision),
    createdByPosUserId: stringValue(costing.created_by_pos_user_id), createdByPosUserName: actorById.get(String(costing.created_by_pos_user_id)) ?? null, calculatedByPosUserId: stringValue(costing.calculated_by_pos_user_id), calculatedByPosUserName: actorById.get(String(costing.calculated_by_pos_user_id)) ?? null, appliedByPosUserId: stringValue(costing.applied_by_pos_user_id), appliedByPosUserName: actorById.get(String(costing.applied_by_pos_user_id)) ?? null,
    createdAt: String(costing.created_at), updatedAt: String(costing.updated_at), calculatedAt: stringValue(costing.calculated_at), appliedAt: stringValue(costing.applied_at), lines: (lines ?? []).map(mapLine),
  };
  return detail;
}

async function mutate(context: ServiceContext, operation: string, costingId: string | null, expectedRevision: number | null, input: Record<string, unknown>) {
  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase.rpc("retail_pos_mutate_purchase_costing_v1", {
    p_tenant_id: context.tenantId, p_operation: operation, p_costing_id: costingId, p_expected_revision: expectedRevision, p_actor_pos_user_id: context.actorPosUserId ?? null, p_payload: toPurchaseCostingRpcPayload(input),
  });
  if (error) errorFromSupabase(error);
  if (!data || typeof data !== "object") throw new RetailPosRuntimeError(500, "El servicio devolvió una respuesta inválida.", "COSTING_INVALID_RESPONSE");
  const response = data as { costing?: CostingRow; lines?: LineRow[] };
  if (!response.costing) throw new RetailPosRuntimeError(500, "El servicio devolvió un documento incompleto.", "COSTING_INVALID_RESPONSE");
  return mapDetail(context, response.costing, response.lines ?? []);
}

export async function createPurchaseCosting(context: ServiceContext, input: CreatePurchaseCostingInput) {
  return mutate(context, "create", null, null, input as unknown as Record<string, unknown>);
}

export async function updatePurchaseCostingHeader(context: ServiceContext, costingId: string, input: UpdatePurchaseCostingHeaderInput) {
  const { expectedRevision, ...header } = input;
  return mutate(context, "update_header", costingId, expectedRevision, header as Record<string, unknown>);
}

export async function addPurchaseCostingLine(context: ServiceContext, costingId: string, input: AddPurchaseCostingLineInput) {
  const { expectedRevision, ...line } = input;
  return mutate(context, "add_line", costingId, expectedRevision, line as Record<string, unknown>);
}

export async function updatePurchaseCostingLine(context: ServiceContext, costingId: string, lineId: string, input: UpdatePurchaseCostingLineInput) {
  const { expectedRevision, ...line } = input;
  return mutate(context, "update_line", costingId, expectedRevision, { ...line, line_id: lineId });
}

export async function deletePurchaseCostingLine(context: ServiceContext, costingId: string, lineId: string, expectedRevision: number) {
  return mutate(context, "delete_line", costingId, expectedRevision, { line_id: lineId });
}

export async function calculatePurchaseCosting(context: ServiceContext, costingId: string, input: CalculatePurchaseCostingInput) {
  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase.rpc("retail_pos_calculate_purchase_costing_v2", { p_tenant_id: context.tenantId, p_costing_id: costingId, p_expected_revision: input.expectedRevision, p_actor_pos_user_id: context.actorPosUserId ?? null });
  if (error) errorFromSupabase(error, "No fue posible calcular el costeo.");
  const result = data as { costing?: CostingRow; lines?: LineRow[] } | null;
  if (!result?.costing) throw new RetailPosRuntimeError(500, "El cálculo devolvió un documento incompleto.", "COSTING_INVALID_RESPONSE");
  return mapDetail(context, result.costing, result.lines ?? []);
}

export async function applyPurchaseCosting(context: ServiceContext, costingId: string, expectedRevision: number): Promise<RetailPosPurchaseCostingApplyResult> {
  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase.rpc("retail_pos_apply_purchase_costing_v1", {
    p_tenant_id: context.tenantId,
    p_costing_id: costingId,
    p_expected_revision: expectedRevision,
    p_actor_pos_user_id: context.actorPosUserId ?? null,
  });
  if (error) errorFromSupabase(error, "No fue posible aplicar el costeo al catálogo.");
  const result = data as { costing?: CostingRow; lines?: LineRow[]; updated_products?: Record<string, unknown>[] } | null;
  if (!result?.costing) throw new RetailPosRuntimeError(500, "La aplicación devolvió un documento incompleto.", "COSTING_INVALID_RESPONSE");
  const updatedProducts: RetailPosPurchaseCostingAppliedProduct[] = (result.updated_products ?? []).map((row) => ({
    id: String(row.id), name: String(row.name), previousCostCents: row.previous_cost_cents === null ? null : numberValue(row.previous_cost_cents), appliedCostCents: numberValue(row.applied_cost_cents), previousPublicPriceCents: numberValue(row.previous_public_price_cents), appliedPublicPriceCents: numberValue(row.applied_public_price_cents), previousWholesalePriceCents: numberValue(row.previous_wholesale_price_cents), appliedWholesalePriceCents: numberValue(row.applied_wholesale_price_cents),
  }));
  return { document: await mapDetail(context, result.costing, result.lines ?? []), updatedProducts };
}

export async function getPurchaseCosting(context: ServiceContext, costingId: string) {
  const supabase = getSupabaseAdminClient();
  const [costingResult, linesResult] = await Promise.all([
    supabase.from("retail_pos_purchase_costings").select("*").eq("tenant_id", context.tenantId).eq("id", costingId).maybeSingle<CostingRow>(),
    supabase.from("retail_pos_purchase_costing_lines").select("*").eq("tenant_id", context.tenantId).eq("costing_id", costingId).order("line_number", { ascending: true }).order("id", { ascending: true }),
  ]);
  if (costingResult.error || linesResult.error) throw new RetailPosRuntimeError(500, "No fue posible consultar el costeo.", "COSTING_READ_FAILED");
  if (!costingResult.data) throw new RetailPosRuntimeError(404, "El costeo no fue encontrado.", "COSTING_NOT_FOUND");
  return mapDetail(context, costingResult.data, (linesResult.data ?? []) as LineRow[]);
}

export async function listPurchaseCostings(context: ServiceContext, filters: { status?: RetailPosPurchaseCostingStatus; supplierId?: string; invoiceReference?: string; dateFrom?: string; dateTo?: string; page?: number; pageSize?: number } = {}) {
  const supabase = getSupabaseAdminClient();
  const pageSize = Math.min(Math.max(filters.pageSize ?? 25, 1), 100);
  const page = Math.max(filters.page ?? 1, 1);
  let query = supabase.from("retail_pos_purchase_costings").select("*", { count: "exact" }).eq("tenant_id", context.tenantId).order("updated_at", { ascending: false }).range((page - 1) * pageSize, page * pageSize - 1);
  if (filters.status) query = query.eq("status", filters.status);
  if (filters.supplierId) query = query.eq("supplier_id", filters.supplierId);
  if (filters.invoiceReference) query = query.ilike("invoice_reference", `%${filters.invoiceReference}%`);
  if (filters.dateFrom) query = query.gte("invoice_date", filters.dateFrom);
  if (filters.dateTo) query = query.lte("invoice_date", filters.dateTo);
  const { data, error, count } = await query;
  if (error) throw new RetailPosRuntimeError(500, "No fue posible listar los costeos.", "COSTING_LIST_FAILED");
  const rows = (data ?? []) as CostingRow[];
  const ids = rows.map((row) => String(row.id));
  const [linesResult, suppliersResult] = await Promise.all([
    ids.length ? supabase.from("retail_pos_purchase_costing_lines").select("costing_id").eq("tenant_id", context.tenantId).in("costing_id", ids) : Promise.resolve({ data: [], error: null }),
    rows.some((row) => row.supplier_id) ? supabase.from("retail_pos_suppliers").select("id,name").eq("tenant_id", context.tenantId).in("id", rows.map((row) => row.supplier_id).filter((id): id is string => typeof id === "string")) : Promise.resolve({ data: [], error: null }),
  ]);
  if (linesResult.error || suppliersResult.error) throw new RetailPosRuntimeError(500, "No fue posible completar el listado de costeos.", "COSTING_LIST_FAILED");
  const counts = new Map<string, number>();
  for (const line of linesResult.data ?? []) counts.set(String((line as { costing_id: string }).costing_id), (counts.get(String((line as { costing_id: string }).costing_id)) ?? 0) + 1);
  const supplierNames = new Map((suppliersResult.data ?? []).map((supplier) => [supplier.id, supplier.name]));
  const summaries: RetailPosPurchaseCostingSummary[] = rows.map((row) => ({ id: String(row.id), supplierId: stringValue(row.supplier_id), supplierName: supplierNames.get(String(row.supplier_id)) ?? null, invoiceReference: stringValue(row.invoice_reference), invoiceDate: stringValue(row.invoice_date), status: row.status as RetailPosPurchaseCostingStatus, lineCount: counts.get(String(row.id)) ?? 0, subtotalCents: numberValue(row.subtotal_cents), taxCents: numberValue(row.tax_cents), discountCents: numberValue(row.discount_cents), netTotalCents: numberValue(row.net_total_cents), revision: numberValue(row.revision), createdAt: String(row.created_at), updatedAt: String(row.updated_at) }));
  return { results: summaries, meta: { page, pageSize, total: count ?? 0, pageCount: Math.ceil((count ?? 0) / pageSize) } };
}
