import type {
  EventCateringConsumptionLineStockStatus,
  EventCateringRequisitionLineProcurementStatus,
} from "./types";

type RequisitionLineFinancialShape = {
  item_id?: string | null;
  unit_id?: string | null;
  requested_quantity?: number | null;
  requested_purchase_quantity?: number | null;
  expected_inventory_quantity?: number | null;
  approved_total_cost?: number | null;
  quoted_total_cost?: number | null;
  preliminary_total_cost?: number | null;
  estimated_total_cost?: number | null;
  approved_unit_price?: number | null;
  quoted_unit_price?: number | null;
  preliminary_unit_price?: number | null;
  estimated_unit_cost?: number | null;
  kitchen_inventory_items?: { name?: string | null } | Array<{ name?: string | null }> | null;
};

function resolveRelatedItemName(
  kitchenInventoryItems: RequisitionLineFinancialShape["kitchen_inventory_items"],
): string | null {
  if (Array.isArray(kitchenInventoryItems)) {
    return kitchenInventoryItems[0]?.name ?? null;
  }
  return kitchenInventoryItems?.name ?? null;
}

const OPERATIONAL_ZERO_COST_WATER_NAMES = new Set([
  "AGUA",
  "AGUA (GRAMOS)",
  "AGUA SIMPLE SIN COSTO",
]);

export function normalizeProcurementItemName(itemName: string | null | undefined): string {
  return String(itemName ?? "")
    .trim()
    .replace(/\s+/g, " ")
    .toUpperCase();
}

export function isOperationalZeroCostWaterItemName(itemName: string | null | undefined): boolean {
  return OPERATIONAL_ZERO_COST_WATER_NAMES.has(normalizeProcurementItemName(itemName));
}

export function classifyConsumptionItemStockBehavior(itemName: string | null | undefined): EventCateringConsumptionLineStockStatus {
  if (isOperationalZeroCostWaterItemName(itemName)) {
    return "operational_zero_cost_non_consumable";
  }
  return "stock_consumable";
}

export function isOperationalZeroCostNonConsumableItemName(itemName: string | null | undefined): boolean {
  return classifyConsumptionItemStockBehavior(itemName) === "operational_zero_cost_non_consumable";
}

export function classifyConsumptionLineStockBehavior(line: RequisitionLineFinancialShape): EventCateringConsumptionLineStockStatus {
  const itemName = resolveRelatedItemName(line.kitchen_inventory_items);
  return classifyConsumptionItemStockBehavior(itemName);
}

export function resolveRequisitionLineEffectiveUnitPrice(line: RequisitionLineFinancialShape): number {
  const approvedUnitPrice = Number(line.approved_unit_price ?? 0);
  if (approvedUnitPrice > 0) return approvedUnitPrice;
  const quotedUnitPrice = Number(line.quoted_unit_price ?? 0);
  if (quotedUnitPrice > 0) return quotedUnitPrice;
  const preliminaryUnitPrice = Number(line.preliminary_unit_price ?? 0);
  if (preliminaryUnitPrice > 0) return preliminaryUnitPrice;
  return Number(line.estimated_unit_cost ?? 0);
}

export function resolveRequisitionLineFinancialTotal(line: RequisitionLineFinancialShape): number {
  const approvedTotal = Number(line.approved_total_cost ?? 0);
  if (approvedTotal > 0) return approvedTotal;
  const quotedTotal = Number(line.quoted_total_cost ?? 0);
  if (quotedTotal > 0) return quotedTotal;
  const preliminaryTotal = Number(line.preliminary_total_cost ?? 0);
  if (preliminaryTotal > 0) return preliminaryTotal;
  const estimatedTotal = Number(line.estimated_total_cost ?? 0);
  if (estimatedTotal > 0) return estimatedTotal;
  const unitPrice = Number(
    line.approved_unit_price ?? line.quoted_unit_price ?? line.preliminary_unit_price ?? line.estimated_unit_cost ?? 0,
  );
  const purchaseQuantity = Number(line.requested_purchase_quantity ?? 0);
  return purchaseQuantity > 0 ? purchaseQuantity * unitPrice : 0;
}

export function isOperationalZeroCostNonReceivableLine(line: RequisitionLineFinancialShape): boolean {
  const itemName = resolveRelatedItemName(line.kitchen_inventory_items);
  if (!isOperationalZeroCostWaterItemName(itemName)) return false;

  const effectiveUnitPrice = Number(
    line.approved_unit_price ?? line.quoted_unit_price ?? line.preliminary_unit_price ?? line.estimated_unit_cost ?? 0,
  );
  const explicitTotal = Number(
    line.approved_total_cost ?? line.quoted_total_cost ?? line.preliminary_total_cost ?? line.estimated_total_cost ?? 0,
  );

  return effectiveUnitPrice <= 0 && explicitTotal <= 0;
}

export function classifyRequisitionLineProcurement(
  line: RequisitionLineFinancialShape,
): EventCateringRequisitionLineProcurementStatus {
  if (isOperationalZeroCostNonReceivableLine(line)) {
    return "operational_zero_cost_non_receivable";
  }

  const requestedQuantity = Number(line.requested_quantity ?? 0);
  const expectedInventoryQuantity = Number(line.expected_inventory_quantity ?? requestedQuantity);
  const hasReceivableShape =
    line.item_id != null &&
    line.unit_id != null &&
    requestedQuantity > 0 &&
    expectedInventoryQuantity > 0;
  const financialTotal = resolveRequisitionLineFinancialTotal(line);

  if (hasReceivableShape && financialTotal > 0) return "receivable_with_price";
  if (hasReceivableShape) return "missing_price";
  return "review_needed";
}
