export type SalesPosCatalogProductType = "simple" | "configurable" | "combo";

export type SalesPosServiceContext =
  | "walk_in"
  | "table_service"
  | "whatsapp_pickup";

export type SalesPosAccountStatus = "OPEN" | "PAID" | "CANCELED";

export type SalesPosPaymentMethod = "cash" | "card" | "transfer";

export type SalesPosCategory = {
  id: string;
  tenant_id: string;
  name: string;
  sort_order: number;
  is_active: boolean;
  image_path: string | null;
  deleted_at: string | null;
  updated_at: string;
};

export type SalesPosProduct = {
  id: string;
  tenant_id: string;
  category_id: string | null;
  product_type: SalesPosCatalogProductType;
  class: "food" | "drink";
  name: string;
  base_price_cents: number | null;
  requires_variant_selection: boolean;
  default_variant_id: string | null;
  is_active: boolean;
  is_sold_out: boolean;
  is_popular: boolean;
  image_path: string | null;
  deleted_at: string | null;
  updated_at: string;
};

export type SalesPosSellableVariant = {
  id: string;
  tenant_id: string;
  product_id: string;
  name: string;
  price_cents: number;
  is_default: boolean;
  is_active: boolean;
  sort_order: number;
  barcode: string | null;
  sku: string | null;
  deleted_at: string | null;
  updated_at: string;
};

export type SalesPosModifierGroup = {
  id: string;
  tenant_id: string;
  name: string;
  selection_mode: "single" | "multiple";
  is_required: boolean;
  min_selected: number;
  max_selected: number;
  display_scope: "cashier" | "kitchen" | "both";
  is_active: boolean;
  sort_order: number;
  deleted_at: string | null;
  updated_at: string;
};

export type SalesPosModifierOption = {
  id: string;
  tenant_id: string;
  modifier_group_id: string;
  name: string;
  price_delta_cents: number;
  is_default: boolean;
  is_active: boolean;
  sort_order: number;
  reporting_key: string | null;
  deleted_at: string | null;
  updated_at: string;
};

export type SalesPosProductModifierGroupAssignment = {
  id: string;
  tenant_id: string;
  product_id: string;
  modifier_group_id: string;
  is_required_override: boolean | null;
  min_selected_override: number | null;
  max_selected_override: number | null;
  sort_order: number;
  is_active: boolean;
  deleted_at: string | null;
  updated_at: string;
};

export type SalesPosComboSlot = {
  id: string;
  tenant_id: string;
  product_id: string;
  slot_key: string;
  name: string;
  selection_mode: "single" | "multiple";
  min_selected: number;
  max_selected: number;
  sort_order: number;
  is_active: boolean;
  deleted_at: string | null;
  updated_at: string;
};

export type SalesPosComboSlotOption = {
  id: string;
  tenant_id: string;
  combo_slot_id: string;
  name: string;
  linked_product_id: string | null;
  linked_sellable_variant_id: string | null;
  price_delta_cents: number;
  is_default: boolean;
  is_active: boolean;
  sort_order: number;
  reporting_key: string | null;
  deleted_at: string | null;
  updated_at: string;
};

export type SalesPosCatalogV2Response = {
  tenantId: string;
  tenantSlug: string;
  syncedAt: string;
  incremental: boolean;
  catalogVersion: string;
  imageBaseUrl: string | null;
  categories: SalesPosCategory[];
  products: SalesPosProduct[];
  sellable_variants: SalesPosSellableVariant[];
  modifier_groups: SalesPosModifierGroup[];
  modifier_options: SalesPosModifierOption[];
  product_modifier_group_assignments: SalesPosProductModifierGroupAssignment[];
  combo_slots: SalesPosComboSlot[];
  combo_slot_options: SalesPosComboSlotOption[];
};

export type SalesAccountAssignment = {
  id: string;
  sales_account_id: string;
  assignment_type: "walk_in" | "table" | "whatsapp";
  pos_table_id: string | null;
  table_label: string | null;
  customer_name: string | null;
  customer_phone: string | null;
  customer_external_id: string | null;
  is_current: boolean;
  assigned_at: string;
  released_at: string | null;
};

export type SalesAccountSelectedVariant = {
  variant_id: string;
  product_id: string;
  name: string;
  unit_base_price_cents: number;
};

export type SalesAccountSelectedModifier = {
  modifier_group_id: string;
  modifier_group_name: string;
  modifier_option_id: string;
  modifier_option_name: string;
  price_delta_cents: number;
  quantity: number;
};

export type SalesAccountSelectedComboSlot = {
  combo_slot_id: string;
  combo_slot_key: string;
  combo_slot_name: string;
  combo_slot_option_id: string;
  combo_slot_option_name: string;
  linked_product_id: string | null;
  linked_sellable_variant_id: string | null;
  price_delta_cents: number;
  quantity: number;
};

export type SalesAccountLineInput = {
  line_id: string;
  product_id: string;
  selected_variant: SalesAccountSelectedVariant | null;
  selected_combo_slots: SalesAccountSelectedComboSlot[];
  selected_modifiers: SalesAccountSelectedModifier[];
  quantity: number;
  line_note: string | null;
  pricing_snapshot: Record<string, unknown>;
  display_snapshot: Record<string, unknown>;
  kitchen_snapshot: Record<string, unknown>;
  reporting_snapshot: Record<string, unknown>;
};

export type SalesAccountRecord = {
  id: string;
  tenant_id: string;
  kiosk_id: string;
  service_context: SalesPosServiceContext;
  status: SalesPosAccountStatus;
  folio_number: number;
  folio_text: string;
  subtotal_cents: number;
  discount_cents: number;
  total_cents: number;
  payments_total_cents: number;
  balance_due_cents: number;
  account_version: number;
  kitchen_ticket_sequence: number;
  opened_at: string;
  closed_at: string | null;
  canceled_at: string | null;
};

export type SalesAccountPaymentRecord = {
  id: string;
  sales_account_id: string;
  payment_sequence: number;
  payment_method: SalesPosPaymentMethod;
  amount_paid_cents: number;
  amount_received_cents: number | null;
  change_cents: number;
  paid_at: string;
};

export type KitchenTicketBatchRecord = {
  id: string;
  sales_account_id: string;
  batch_number: number;
  batch_status: "pending" | "sent" | "confirmed" | "failed" | "canceled";
  trigger_type:
    | "account_opened"
    | "line_added"
    | "line_updated"
    | "line_voided"
    | "manual_reprint";
  account_version_from: number;
  account_version_to: number;
  requested_at: string;
  printed_at: string | null;
};

export type SalesPosMutationEnvelopeV2 = {
  mutation_id: string;
  contract_version: "v2";
  kiosk_id: string;
  created_at?: string | null;
  payload: Record<string, unknown>;
};
