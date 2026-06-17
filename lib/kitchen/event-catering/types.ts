import type { Event } from "@/types/events";
import type { KitchenRecipeReadiness } from "@/lib/kitchen/recipes/readiness";

export type CateringEventLite = Pick<Event, "id" | "name" | "status" | "starts_at" | "ends_at" | "expected_attendance">;

export type EventCateringPlan = {
  id: string;
  tenant_id: string;
  event_id: string;
  name: string | null;
  status: "draft" | "planned" | "approved" | "canceled";
  planned_guest_count: number | null;
  estimated_total_cost: number;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

export type EventCateringPlanRecipe = {
  id: string;
  tenant_id: string;
  plan_id: string;
  recipe_id: string;
  recipe_version_id: string;
  snapshot_id: string | null;
  planned_servings: number;
  multiplier: number;
  estimated_cost: number;
  notes: string | null;
  sort_order: number;
  created_at: string;
  updated_at: string;
  kitchen_recipe_recipes?: {
    id: string;
    name: string;
    category: string | null;
    status: string;
  } | null;
};

export type EventCateringRequirement = {
  id: string;
  tenant_id: string;
  plan_id: string;
  plan_recipe_id: string | null;
  item_id: string;
  unit_id: string;
  required_quantity: number;
  available_quantity: number;
  shortage_quantity: number;
  estimated_unit_cost: number;
  estimated_total_cost: number;
  source_payload: Record<string, unknown>;
  created_at: string;
  updated_at: string;
  kitchen_inventory_items?: { id: string; name: string } | null;
  kitchen_inventory_units?: { id: string; code: string; name: string } | null;
};

export type EventCateringRequisition = {
  id: string;
  tenant_id: string;
  plan_id: string;
  status: "draft" | "reviewed" | "approved" | "canceled";
  estimated_total_cost: number;
  notes: string | null;
  created_at: string;
  updated_at: string;
  created_by: string | null;
  event_catering_plans?: {
    id: string;
    event_id: string;
    name: string | null;
    events?: { id: string; name: string | null } | null;
  } | null;
};

export type EventCateringRequisitionLine = {
  id: string;
  tenant_id: string;
  requisition_id: string;
  item_id: string;
  unit_id: string;
  requested_quantity: number;
  purchase_option_id: string | null;
  purchase_unit_id: string | null;
  requested_purchase_quantity: number | null;
  expected_inventory_quantity: number | null;
  expected_surplus_quantity: number | null;
  purchase_warning: string | null;
  preliminary_unit_price: number | null;
  quoted_unit_price: number | null;
  approved_unit_price: number | null;
  preliminary_total_cost: number | null;
  quoted_total_cost: number | null;
  approved_total_cost: number | null;
  price_source: string | null;
  supplier_price_id: string | null;
  quoted_at: string | null;
  quoted_by: string | null;
  estimated_unit_cost: number;
  estimated_total_cost: number;
  supplier_id: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  kitchen_inventory_items?: { id: string; name: string } | null;
  kitchen_inventory_units?: { id: string; code: string; name: string } | null;
  purchase_units?: { id: string; code: string; name: string } | null;
  kitchen_inventory_suppliers?: { id: string; name: string } | null;
};

export type RequisitionLinePurchaseOptionAlternative = {
  purchase_option_id: string;
  supplier_id: string | null;
  supplier_name: string;
  purchase_unit: { id: string; code: string; name: string } | null;
  quantity_per_purchase_unit: number;
  current_supplier_price: number | null;
  calculated_purchase_quantity: number | null;
  expected_inventory_quantity: number | null;
  expected_surplus_quantity: number | null;
  estimated_total_cost: number | null;
  is_default: boolean;
  is_current_selection: boolean;
};

export type ReadyRecipeForCatering = KitchenRecipeReadiness & {
  recipe_version_id: string;
  snapshot_id: string | null;
  snapshot_total_cost: number;
};

export type CateringOverviewSummary = {
  total_plans: number;
  plans_by_status: Record<"draft" | "planned" | "approved" | "canceled", number>;
  total_estimated_catering_cost: number;
  total_requirements: number;
  total_shortages: number;
  total_shortage_estimated_cost: number;
  requisitions_by_status: Record<"draft" | "reviewed" | "approved" | "canceled", number>;
  approved_requisition_total: number;
  draft_requisition_total: number;
};

export type CateringPlanSummary = {
  plan_id: string;
  plan_name: string | null;
  plan_status: EventCateringPlan["status"];
  event_id: string;
  event_name: string | null;
  event_starts_at: string | null;
  estimated_plan_cost: number;
  recipe_count: number;
  requirements_count: number;
  shortages_count: number;
  requisition_status: EventCateringRequisition["status"] | null;
  requisition_total: number;
  requisition_id: string | null;
};

export type CateringPlanOperationalIndexRow = {
  plan_id: string;
  plan_name: string | null;
  event_id: string;
  event_name: string | null;
  event_date: string | null;
  expected_attendance: number | null;
  planned_guest_count: number | null;
  plan_status: EventCateringPlan["status"];
  recipes_count: number;
  requirements_count: number;
  shortage_count: number;
  estimated_total_cost: number;
  requisition_count: number;
  latest_requisition_status: EventCateringRequisition["status"] | null;
  receipt_status_summary: "none" | "draft" | "received" | "mixed";
  consumption_status_summary: "none" | "draft" | "confirmed" | "mixed";
  reserved_this_plan_total: number;
  operational_status:
    | "Servicio cerrado"
    | "Sin recetas"
    | "Requerimientos pendientes"
    | "Con faltantes"
    | "Requisición pendiente"
    | "Compra por recibir"
    | "Listo para consumo"
    | "Consumo en borrador"
    | "Consumo confirmado";
};

export type CateringRequisitionOperationalIndexRow = {
  requisition_id: string;
  event_id: string | null;
  event_name: string | null;
  event_date: string | null;
  plan_id: string;
  plan_name: string | null;
  status: EventCateringRequisition["status"];
  preliminary_total: number;
  quoted_total: number;
  approved_total: number;
  estimated_total: number;
  pending_quote_lines: number;
  line_count: number;
  receipt_status_summary: "sin recepción" | "borrador" | "recibida" | "cancelada/historial";
};

export type PurchaseReceiptOperationalOverviewRow = {
  receipt_id: string;
  receipt_status: "draft" | "received" | "canceled";
  requisition_id: string;
  requisition_status: EventCateringRequisition["status"] | null;
  plan_id: string | null;
  plan_name: string | null;
  event_id: string | null;
  event_name: string | null;
  event_date: string | null;
  total_received_cost: number;
  total_expected_cost: number;
  line_count: number;
  received_at: string | null;
  created_at: string;
};

export type ConsumptionOperationalCandidateBucket =
  | "ready_to_prepare"
  | "preparable_with_warnings"
  | "draft"
  | "confirmed"
  | "blocked";

export type ConsumptionOperationalCandidateRow = {
  plan_id: string;
  plan_name: string | null;
  event_id: string;
  event_name: string | null;
  event_date: string | null;
  planned_guest_count: number | null;
  requirements_count: number;
  shortage_count: number;
  requisition_status_summary: EventCateringRequisition["status"] | "none";
  receipt_status_summary: "none" | "draft" | "received" | "mixed";
  has_draft_consumption: boolean;
  has_confirmed_consumption: boolean;
  ready_to_prepare: boolean;
  ready_to_confirm: boolean;
  reserve_sufficient: boolean;
  blocking_reason: string | null;
  operational_bucket: ConsumptionOperationalCandidateBucket;
};

export type CateringShortageSummaryRow = {
  item_id: string;
  item_name: string | null;
  unit_id: string;
  unit_code: string | null;
  total_required: number;
  total_available: number;
  total_shortage: number;
  estimated_shortage_cost: number;
  plans_affected: number;
};

export type CateringRequisitionSupplierSummary = {
  supplier_id: string | null;
  supplier_name: string;
  line_count: number;
  preliminary_total: number;
  quoted_total: number;
  approved_total: number;
  lines_without_quote: number;
  lines_without_purchase_option: number;
  lines_without_supplier: number;
  status_summary: "complete" | "missing_quote" | "missing_supplier" | "missing_purchase_option";
};

export type EventCateringPurchaseReceipt = {
  id: string;
  tenant_id: string;
  requisition_id: string;
  supplier_id: string | null;
  status: "draft" | "received" | "canceled";
  received_at: string | null;
  invoice_ref: string | null;
  supplier_document_ref: string | null;
  total_received_cost: number;
  notes: string | null;
  created_at: string;
  updated_at: string;
  created_by: string | null;
  received_by: string | null;
  kitchen_inventory_suppliers?: { id: string; name: string } | null;
  event_catering_requisitions?: {
    id: string;
    plan_id: string;
    event_catering_plans?: {
      id: string;
      name: string | null;
      event_id: string;
      events?: { id: string; name: string | null } | null;
    } | null;
  } | null;
};

export type EventCateringPurchaseReceiptLine = {
  id: string;
  tenant_id: string;
  receipt_id: string;
  requisition_line_id: string;
  item_id: string;
  location_id: string;
  unit_id: string;
  received_quantity: number;
  received_unit_cost: number;
  received_total_cost: number;
  purchase_unit_id: string | null;
  received_purchase_quantity: number | null;
  expected_inventory_quantity: number | null;
  variance_quantity: number | null;
  inventory_movement_id: string | null;
  notes: string | null;
  created_at: string;
  created_by: string | null;
  kitchen_inventory_items?: { id: string; name: string } | null;
  kitchen_inventory_locations?: { id: string; name: string } | null;
  kitchen_inventory_units?: { id: string; code: string; name: string } | null;
  event_catering_requisition_lines?: {
    id: string;
    requested_quantity: number;
    requested_purchase_quantity: number | null;
    expected_inventory_quantity: number | null;
    approved_unit_price: number | null;
    approved_total_cost: number | null;
    quoted_unit_price: number | null;
    quoted_total_cost: number | null;
    preliminary_unit_price: number | null;
    preliminary_total_cost: number | null;
    estimated_unit_cost: number | null;
    estimated_total_cost: number | null;
    purchase_unit_id: string | null;
    purchase_units?: { id: string; code: string; name: string } | null;
  } | null;
};

export type ConsumptionStatus = "draft" | "confirmed" | "canceled";

export type EventCateringConsumptionRecord = {
  id: string;
  tenant_id: string;
  plan_id: string;
  event_id: string;
  status: ConsumptionStatus;
  consumed_at: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  created_by: string | null;
  confirmed_at: string | null;
  confirmed_by: string | null;
  canceled_at: string | null;
  canceled_by: string | null;
  event_catering_plans?: { id: string; event_id: string; name: string | null } | null;
  events?: { id: string; name: string | null; starts_at: string | null } | null;
};

export type EventCateringConsumptionLine = {
  id: string;
  tenant_id: string;
  consumption_record_id: string;
  requirement_id: string | null;
  item_id: string;
  location_id: string | null;
  unit_id: string;
  planned_quantity: number;
  consumed_quantity: number;
  waste_quantity: number;
  leftover_quantity: number;
  available_quantity: number;
  unit_cost: number;
  total_cost: number;
  consumption_movement_id: string | null;
  waste_movement_id: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  created_by: string | null;
  kitchen_inventory_items?: { id: string; name: string } | null;
  kitchen_inventory_units?: { id: string; code: string; name: string } | null;
  kitchen_inventory_locations?: { id: string; name: string } | null;
};

export type ConsumptionLineLocationAvailability = {
  location_id: string;
  location_name: string;
  available_quantity: number;
  physical_balance: number;
  reserved_other_plans: number;
  reserved_this_plan: number;
};

export type EventCateringConsumptionLineAvailability = {
  line_id: string;
  item_id: string;
  item_name: string;
  unit_id: string;
  unit_code: string;
  location_id: string | null;
  available_quantity: number;
  physical_balance: number;
  reserved_other_plans: number;
  reserved_this_plan: number;
  total_out_quantity: number;
  has_sufficient_balance: boolean;
  missing_location: boolean;
  warning_message: string | null;
  location_options: ConsumptionLineLocationAvailability[];
};

export type EventCateringConsumptionDraftReadiness = {
  ready_to_confirm: boolean;
  reason: "ready" | "pending_location" | "insufficient_stock" | "invalid_quantity" | "no_output";
  missing_location_count: number;
  insufficient_stock_count: number;
  invalid_quantity_count: number;
  positive_output_count: number;
};

export type EventCateringInventoryReversalStatus = "draft" | "applied" | "canceled" | "failed";
export type EventCateringInventoryReversalType = "receipt" | "consumption";
export type EventCateringInventoryReversalTargetType = "receipt_line" | "consumption_line" | "consumption_record" | "receipt";

export type EventCateringInventoryReversal = {
  id: string;
  tenant_id: string;
  reversal_type: EventCateringInventoryReversalType;
  target_type: EventCateringInventoryReversalTargetType;
  target_id: string;
  status: EventCateringInventoryReversalStatus;
  reason: string;
  notes: string | null;
  created_at: string;
  updated_at: string;
  created_by: string | null;
  applied_at: string | null;
  applied_by: string | null;
  canceled_at: string | null;
  canceled_by: string | null;
  line_count?: number;
  compensated_line_count?: number;
  has_compensating_movements?: boolean;
  target_label?: string;
};

export type EventCateringInventoryReversalLine = {
  id: string;
  tenant_id: string;
  reversal_id: string;
  original_movement_id: string;
  compensating_movement_id: string | null;
  item_id: string;
  location_id: string;
  unit_id: string;
  quantity: number;
  unit_cost: number;
  total_cost: number;
  idempotency_key: string | null;
  notes: string | null;
  created_at: string;
  created_by: string | null;
  kitchen_inventory_items?: { id: string; name: string } | null;
  kitchen_inventory_locations?: { id: string; name: string } | null;
  kitchen_inventory_units?: { id: string; code: string; name: string } | null;
  original_movement?: { id: string; movement_type: string; source_type: string; source_id: string | null; quantity?: number; unit_cost?: number } | null;
  compensating_movement?: { id: string; movement_type: string; source_type: string; source_id: string | null; quantity?: number; unit_cost?: number } | null;
};

export type EventCateringReversalTargetSummary = {
  target_type: EventCateringInventoryReversalTargetType;
  target_id: string;
  tenant_id: string;
  source_kind: "receipt_line" | "consumption_line";
  movement_ids: string[];
  movement_count: number;
};

export type CateringPlanOperationalSummary = {
  plan_id: string;
  event_id: string;
  event_name: string | null;
  event_starts_at: string | null;
  plan_status: EventCateringPlan["status"];
  recipe_count: number;
  requirement_count: number;
  shortage_count: number;
  requisition_count: number;
  approved_requisition_count: number;
  receipt_count: number;
  draft_receipt_count: number;
  received_receipt_count: number;
  canceled_receipt_count: number;
  consumption_count: number;
  confirmed_consumption_count: number;
  estimated_plan_cost: number;
  requisition_total: number;
  received_total_cost: number;
  consumed_total_cost: number;
  waste_total_cost: number;
  estimated_shortage_cost: number;
  operational_status_label: string;
  variance_received_vs_required: number;
  variance_consumed_vs_received: number;
};

export type CateringPlanItemFlowRow = {
  item_id: string;
  item_name: string | null;
  unit_id: string;
  unit_code: string | null;
  required_quantity: number;
  shortage_quantity: number;
  requisition_requested_quantity: number;
  requisition_purchase_quantity: number;
  received_quantity: number;
  consumed_quantity: number;
  waste_quantity: number;
  leftover_quantity: number;
  current_balance: number;
  estimated_required_cost: number;
  received_cost: number;
  consumed_cost: number;
  waste_cost: number;
  variance_required_vs_received: number;
  variance_received_vs_consumed: number;
  status: "ok" | "not_received" | "under_received" | "over_received" | "over_consumed" | "pending_consumption" | "waste_detected";
};

export type CateringPlanWarning = {
  code:
    | "requirements_without_requisition"
    | "shortages_without_purchase"
    | "approved_requisition_without_receipt"
    | "receipt_draft_pending"
    | "consumption_draft_pending"
    | "consumption_with_waste"
    | "consumption_without_receipt"
    | "received_vs_consumed_gap";
  severity: "warning" | "info";
  message: string;
};
