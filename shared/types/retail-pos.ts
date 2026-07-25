export const RETAIL_POS_ORDER_STATUSES = [
  "pending_payment",
  "paid",
  "voided",
  "cancelled",
] as const;

export const RETAIL_POS_PAYMENT_METHODS = ["cash", "card"] as const;

export const RETAIL_POS_DEVICE_ROLES = [
  "order_station",
  "cashier_station",
  "backoffice_station",
  "counter_station",
] as const;

export const RETAIL_POS_CASH_SHIFT_STATUSES = [
  "open",
  "closed",
  "canceled",
] as const;

export const RETAIL_POS_TICKET_TYPES = ["order", "payment", "post_sale"] as const;

export const RETAIL_POS_TICKET_EVENT_TYPES = [
  "printed",
  "reprinted",
  "print_failed",
] as const;

export const RETAIL_POS_TICKET_EVENT_REQUEST_TYPES = [
  "order_ticket",
  "payment_ticket",
  "post_sale_ticket",
] as const;

export const RETAIL_POS_RUNTIME_COMMAND_TYPES = [
  "open_shift",
  "close_shift",
  "pay",
  "price_tier_decision",
  "discount_checkout",
  "create_paid_counter_sale",
  "post_sale.sale_cancellation.commit",
  "post_sale.return.commit",
  "post_sale.card_refund.confirm",
  "order_void",
] as const;

export const RETAIL_POS_COMMAND_RESULT_STATUSES = [
  "accepted",
  "completed",
  "replayed",
  "rejected",
] as const;

export const RETAIL_POS_DISCOUNT_SCOPES = ["line", "order"] as const;
export const RETAIL_POS_DISCOUNT_CAPTURE_TYPES = [
  "percentage",
  "fixed_amount",
] as const;
export const RETAIL_POS_DISCOUNT_REASON_CODES = [
  "volume",
  "frequent_customer",
  "authorized_wholesale",
  "price_adjustment",
  "damaged_product",
  "manual_promotion",
  "rounding",
  "capture_error",
  "cashier_authorization",
  "other",
] as const;
export const RETAIL_POS_DISCOUNT_AUTHORIZATION_STATUSES = [
  "not_required",
  "pending",
  "approved",
  "rejected",
  "expired",
  "cancelled",
] as const;
export const RETAIL_POS_DISCOUNT_AUTHORIZATION_METHODS = [
  "role_capability",
  "supervisor_pin",
  "remote_approval",
  "system_policy",
] as const;
export const RETAIL_POS_DISCOUNT_COST_EVALUATIONS = [
  "above_or_equal_cost",
  "below_cost",
  "unknown",
] as const;
export const RETAIL_POS_POST_SALE_DOCUMENT_TYPES = [
  "sale_cancellation",
  "return_full",
  "return_partial",
  "payment_method_correction",
  "exchange",
] as const;
export const RETAIL_POS_POST_SALE_DOCUMENT_STATUSES = [
  "draft",
  "pending_confirmation",
  "completed",
  "rejected",
  "cancelled",
  "failed",
] as const;
export const RETAIL_POS_POST_SALE_REFUND_STATUSES = [
  "not_required",
  "pending",
  "completed",
  "failed",
  "cancelled",
] as const;
export const RETAIL_POS_POST_SALE_REFUND_METHODS = [
  "cash",
  "card_external",
  "store_credit_future",
] as const;
export const RETAIL_POS_POST_SALE_REASON_CODES = [
  "duplicate_charge",
  "wrong_order",
  "wrong_payment_method",
  "customer_cancelled_immediately",
  "operator_error",
  "system_error",
  "other",
] as const;
export const RETAIL_POS_POST_SALE_CASH_MOVEMENT_TYPES = [
  "post_sale_cash_refund",
] as const;

export type RetailPosQuantityString = string;
export type RetailPosOrderStatus = (typeof RETAIL_POS_ORDER_STATUSES)[number];
export type RetailPosPaymentMethod = (typeof RETAIL_POS_PAYMENT_METHODS)[number];
export type RetailPosDeviceRole = (typeof RETAIL_POS_DEVICE_ROLES)[number];
export type RetailPosCashShiftStatus =
  (typeof RETAIL_POS_CASH_SHIFT_STATUSES)[number];
export type RetailPosTicketType = (typeof RETAIL_POS_TICKET_TYPES)[number];
export type RetailPosTicketEventType =
  (typeof RETAIL_POS_TICKET_EVENT_TYPES)[number];
export type RetailPosTicketEventRequestType =
  (typeof RETAIL_POS_TICKET_EVENT_REQUEST_TYPES)[number];
export type RetailPosCommandType =
  (typeof RETAIL_POS_RUNTIME_COMMAND_TYPES)[number];
export type RetailPosPriceTier = "public" | "wholesale";
export type RetailPosCommandResultStatus =
  (typeof RETAIL_POS_COMMAND_RESULT_STATUSES)[number];
export type RetailPosDiscountScope =
  (typeof RETAIL_POS_DISCOUNT_SCOPES)[number];
export type RetailPosDiscountCaptureType =
  (typeof RETAIL_POS_DISCOUNT_CAPTURE_TYPES)[number];
export type RetailPosDiscountReasonCode =
  (typeof RETAIL_POS_DISCOUNT_REASON_CODES)[number];
export type RetailPosDiscountAuthorizationStatus =
  (typeof RETAIL_POS_DISCOUNT_AUTHORIZATION_STATUSES)[number];
export type RetailPosDiscountAuthorizationMethod =
  (typeof RETAIL_POS_DISCOUNT_AUTHORIZATION_METHODS)[number];
export type RetailPosDiscountCostEvaluation =
  (typeof RETAIL_POS_DISCOUNT_COST_EVALUATIONS)[number];
export type RetailPosPostSaleDocumentType =
  (typeof RETAIL_POS_POST_SALE_DOCUMENT_TYPES)[number];
export type RetailPosPostSaleDocumentStatus =
  (typeof RETAIL_POS_POST_SALE_DOCUMENT_STATUSES)[number];
export type RetailPosPostSaleRefundStatus =
  (typeof RETAIL_POS_POST_SALE_REFUND_STATUSES)[number];
export type RetailPosPostSaleRefundMethod =
  (typeof RETAIL_POS_POST_SALE_REFUND_METHODS)[number];
export type RetailPosPostSaleReasonCode =
  (typeof RETAIL_POS_POST_SALE_REASON_CODES)[number];
export type RetailPosPostSaleCashMovementType =
  (typeof RETAIL_POS_POST_SALE_CASH_MOVEMENT_TYPES)[number];

export type RetailPosCategory = {
  id: string;
  tenant_id: string;
  name: string;
  sort_order: number;
  is_active: boolean;
  deleted_at: string | null;
  created_at: string;
  updated_at: string;
  created_by: string | null;
  updated_by: string | null;
};

export type RetailPosProduct = {
  id: string;
  tenant_id: string;
  category_id: string | null;
  name: string;
  brand: string | null;
  sku: string | null;
  barcode: string | null;
  unit_price_cents: number;
  wholesale_price_cents: number;
  sales_unit_code: string;
  sales_unit_label: string;
  allow_decimal_quantity: boolean;
  has_variants: boolean;
  is_active: boolean;
  deleted_at: string | null;
  created_at: string;
  updated_at: string;
  created_by: string | null;
  updated_by: string | null;
};

export type RetailPosAdminProduct = RetailPosProduct & {
  cost_cents: number | null;
};

export type RetailPosProductVariant = {
  id: string;
  tenant_id: string;
  product_id: string;
  name: string;
  sku: string | null;
  barcode: string | null;
  unit_price_cents: number | null;
  wholesale_price_cents: number | null;
  is_default: boolean;
  is_active: boolean;
  sort_order: number;
  deleted_at: string | null;
  created_at: string;
  updated_at: string;
  created_by: string | null;
  updated_by: string | null;
};

export type RetailPosOrder = {
  id: string;
  tenant_id: string;
  folio: string;
  origin_client_order_id: string;
  origin_local_folio: string | null;
  status: RetailPosOrderStatus;
  origin_device_id: string;
  created_by_pos_user_id: string;
  cashier_pos_user_id: string | null;
  paid_by_device_id: string | null;
  subtotal_cents: number;
  discount_cents: number;
  total_cents: number;
  revision?: number;
  direct_discount_cents?: number;
  order_discount_cents?: number;
  paid_at: string | null;
  voided_at: string | null;
  voided_by_pos_user_id: string | null;
  void_reason: string | null;
  void_note?: string | null;
  copied_from_order_id?: string | null;
  cancelled_at: string | null;
  cancelled_by_pos_user_id: string | null;
  cancel_reason: string | null;
  created_at: string;
  updated_at: string;
  created_by: string | null;
  updated_by: string | null;
};

export type RetailPosOrderLine = {
  id: string;
  tenant_id: string;
  order_id: string;
  line_number: number;
  product_id: string;
  product_variant_id: string | null;
  product_name: string;
  variant_name: string | null;
  sku: string | null;
  barcode: string | null;
  sales_unit_code: string;
  sales_unit_label: string;
  allow_decimal_quantity: boolean;
  quantity: RetailPosQuantityString;
  unit_price_cents: number;
  line_subtotal_cents: number;
  discount_cents: number;
  line_total_cents: number;
  public_unit_price_snapshot_cents: number;
  wholesale_unit_price_snapshot_cents: number;
  requested_price_tier: "public" | "wholesale";
  price_tier_request_status: "not_requested" | "pending" | "approved" | "rejected";
  requested_unit_price_cents: number;
  requested_by_pos_user_id: string | null;
  requested_at: string | null;
  approved_price_tier: "public" | "wholesale" | null;
  approved_unit_price_cents: number | null;
  approved_price_tier_source: "default_public" | "counter_request" | "cashier_direct" | null;
  approved_by_pos_user_id: string | null;
  approved_at: string | null;
  direct_discount_cents?: number;
  order_discount_allocation_cents?: number;
  total_discount_cents?: number;
  unit_cost_snapshot_cents?: number | null;
  cost_evaluation?: RetailPosDiscountCostEvaluation;
  below_cost_after_discount?: boolean;
  created_at: string;
  updated_at: string;
  created_by: string | null;
  updated_by: string | null;
};

export type RetailPosPayment = {
  id: string;
  tenant_id: string;
  order_id: string;
  cash_shift_id: string;
  device_id: string;
  pos_user_id: string;
  payment_method: RetailPosPaymentMethod;
  amount_cents: number;
  received_amount_cents: number | null;
  change_cents: number;
  card_reference: string | null;
  paid_at: string;
  created_at: string;
  created_by: string | null;
};

export type RetailPosCashShift = {
  id: string;
  tenant_id: string;
  kiosk_id: string;
  device_id: string;
  opened_by_pos_user_id: string;
  closed_by_pos_user_id: string | null;
  status: RetailPosCashShiftStatus;
  opening_float_cents: number;
  expected_cash_cents: number | null;
  declared_cash_cents: number | null;
  difference_cents: number | null;
  closing_note: string | null;
  opened_at: string;
  closed_at: string | null;
  created_at: string;
  updated_at: string;
  created_by: string | null;
  updated_by: string | null;
};

export type RetailPosTicketEvent = {
  id: string;
  tenant_id: string;
  order_id: string;
  device_id: string;
  pos_user_id: string | null;
  ticket_type: RetailPosTicketType;
  event_type: RetailPosTicketEventType;
  printer_name: string | null;
  payload: Record<string, unknown>;
  occurred_at: string;
  created_at: string;
  created_by: string | null;
};

export type RetailPosDeviceSettings = {
  device_id: string;
  tenant_id: string;
  device_role: RetailPosDeviceRole;
  allow_order_entry: boolean;
  can_apply_discounts: boolean;
  can_view_cost: boolean;
  printer_name: string | null;
  printer_driver: string | null;
  auto_print_order_ticket: boolean;
  auto_print_payment_ticket: boolean;
  scanner_enabled: boolean;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  created_by: string | null;
  updated_by: string | null;
};

export type RetailPosCatalogCategory = Pick<
  RetailPosCategory,
  "id" | "tenant_id" | "name" | "sort_order" | "is_active" | "updated_at"
>;

export type RetailPosCatalogDeviceSettings = Pick<
  RetailPosDeviceSettings,
  | "device_id"
  | "tenant_id"
  | "device_role"
  | "allow_order_entry"
  | "can_apply_discounts"
  | "can_view_cost"
  | "printer_name"
  | "printer_driver"
  | "auto_print_order_ticket"
  | "auto_print_payment_ticket"
  | "scanner_enabled"
  | "is_active"
  | "updated_at"
>;

export type RetailPosCatalogItem = {
  product_id: string;
  tenant_id: string;
  category_id: string | null;
  category_name: string | null;
  variant_id: string | null;
  name: string;
  variant_name: string | null;
  brand: string | null;
  sku: string | null;
  barcode: string | null;
  unit_price_cents: number;
  wholesale_price_cents: number;
  sales_unit_code: string;
  sales_unit_label: string;
  allow_decimal_quantity: boolean;
  has_variants: boolean;
  is_active: boolean;
  product_updated_at: string;
  variant_updated_at: string | null;
};

export type RetailPosCatalogSyncMetadata = {
  latest_change_id: number | null;
};

export type RetailPosCatalogChangeOperation =
  | "insert"
  | "update"
  | "deactivate"
  | "delete";

export type RetailPosCatalogChangeProduct = {
  id: string;
  tenant_id: string;
  category_id: string | null;
  name: string;
  brand: string | null;
  sku: string | null;
  barcode: string | null;
  unit_price_cents: number;
  sales_unit_code: string;
  sales_unit_label: string;
  allow_decimal_quantity: boolean;
  has_variants: boolean;
  is_active: boolean;
  deleted_at: string | null;
  updated_at: string;
  supplier_id: string | null;
};

export type RetailPosCatalogChange = {
  change_id: number;
  entity_type: "product";
  entity_id: string;
  operation: RetailPosCatalogChangeOperation;
  changed_fields: string[];
  changed_at: string;
  product: RetailPosCatalogChangeProduct | null;
  catalog_items?: RetailPosCatalogItem[];
};

export type RetailPosCatalogPayload = {
  categories: RetailPosCatalogCategory[];
  items: RetailPosCatalogItem[];
  device_settings: RetailPosCatalogDeviceSettings | null;
  synced_at: string;
  catalog_sync?: RetailPosCatalogSyncMetadata;
};

export type RetailPosCatalogChangesPayload = {
  changes: RetailPosCatalogChange[];
  from_change_id: number;
  to_change_id: number | null;
  latest_change_id: number | null;
  has_more: boolean;
  full_snapshot_required: boolean;
  limit: number;
  synced_at: string;
};

export type RetailPosRuntimeOperator = {
  id: string;
  tenant_id: string;
  name: string;
  role: "cashier" | "supervisor" | "admin";
  is_active: boolean;
};

export type RetailPosAssignedOperator = Pick<RetailPosRuntimeOperator, "id" | "name" | "role">;

export type RetailPosRuntimeProbeDiagnostics = {
  auth_ms: number;
  operators_query_ms: number;
  total_ms: number;
};

export type RetailPosRuntimeOperatorsPayload = {
  tenant_id: string;
  device_id: string | null;
  device_role: RetailPosDeviceRole | null;
  operators: RetailPosRuntimeOperator[];
  synced_at: string;
  diagnostics?: RetailPosRuntimeProbeDiagnostics;
};

export type RetailPosCatalogProductPatch = {
  product: RetailPosProduct;
  category: RetailPosCategory | null;
  catalog_item: RetailPosCatalogItem;
};

export type RetailPosAssignBarcodeRequest = {
  barcode: string;
  client_event_id: string;
};

export type RetailPosAssignBarcodeResponse = RetailPosCatalogProductPatch & {
  barcode: string;
  client_event_id: string;
  idempotent: boolean;
  synced_at: string;
};

export type RetailPosQuickCreateProductRequest = {
  name: string;
  category_name: string;
  brand: string | null;
  sku: string | null;
  barcode: string | null;
  unit_price_cents: number;
  sales_unit_code: string;
  sales_unit_label: string;
  allow_decimal_quantity: boolean;
  client_event_id: string;
};

export type RetailPosQuickCreateProductResponse = RetailPosCatalogProductPatch & {
  client_event_id: string;
  idempotent: boolean;
  category_created: boolean;
  sku: string;
  barcode: string | null;
  synced_at: string;
};

export type RetailPosCatalogImportProductInput = {
  name: string;
  category_name: string;
  brand: string | null;
  sku: string | null;
  barcode: string | null;
  unit_price_cents: number;
  cost_cents: number | null;
  sales_unit_code: string;
  sales_unit_label: string;
  allow_decimal_quantity: boolean;
  is_active: boolean;
};

export type RetailPosBackofficeCatalogProduct = {
  product_id: string;
  variant_id: string | null;
  name: string;
  sku: string | null;
  barcode: string | null;
  brand: string | null;
  category_id: string | null;
  category_name: string | null;
  supplier_id: string | null;
  supplier_name: string | null;
  sales_unit_code: string;
  sales_unit_label: string;
  allow_decimal_quantity: boolean;
  price_cents: number;
  wholesale_price_cents?: number | null;
  cost_cents: number | null;
  is_active: boolean;
  has_variants: boolean;
  created_at: string | null;
  updated_at: string | null;
};

export type RetailPosBackofficeCatalogProductsResponse = {
  ok: true;
  items: RetailPosBackofficeCatalogProduct[];
  next_cursor: string | null;
};

export type RetailPosBackofficeCatalogProductDetailResponse = {
  ok: true;
  product: RetailPosBackofficeCatalogProduct;
};

export type CreateRetailPosBackofficeProductRequest = {
  name: string;
  sku?: string | null;
  barcode?: string | null;
  brand?: string | null;
  sales_unit_code: string;
  sales_unit_label: string;
  allow_decimal_quantity: boolean;
  price_cents: number;
  wholesale_price_cents?: number | null;
  cost_cents?: number | null;
  supplier_id?: string | null;
  is_active?: boolean;
};

export type UpdateRetailPosBackofficeProductRequest = {
  name?: string;
  sku?: string | null;
  barcode?: string | null;
  brand?: string | null;
  category_id?: string | null;
  sales_unit_code?: string;
  sales_unit_label?: string;
  allow_decimal_quantity?: boolean;
  price_cents?: number;
  wholesale_price_cents?: number;
  cost_cents?: number | null;
  supplier_id?: string | null;
  is_active?: boolean;
};

export type RetailPosBackofficeSupplier = {
  id: string;
  tenant_id: string;
  name: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export type RetailPosBackofficeSuppliersResponse = {
  ok: true;
  items: RetailPosBackofficeSupplier[];
};

export type CreateRetailPosBackofficeSupplierRequest = {
  name: string;
};

export type CreateRetailPosBackofficeSupplierResponse = {
  ok: true;
  supplier: RetailPosBackofficeSupplier;
  created: boolean;
};

export type CreateRetailPosOrderLineInput = {
  line_number: number;
  product_id: string;
  product_variant_id: string | null;
  quantity: RetailPosQuantityString;
  unit_price_cents: number;
  public_unit_price_snapshot_cents?: number;
  wholesale_unit_price_snapshot_cents?: number;
  requested_price_tier?: "public" | "wholesale";
  price_tier_request_status?: "not_requested" | "pending" | "approved" | "rejected";
  requested_unit_price_cents?: number;
  requested_by_pos_user_id?: string | null;
  requested_at?: string | null;
  approved_price_tier?: "public" | "wholesale" | null;
  approved_unit_price_cents?: number | null;
  approved_price_tier_source?: "default_public" | "counter_request" | "cashier_direct" | null;
  approved_by_pos_user_id?: string | null;
  approved_at?: string | null;
  discount_cents: number;
  product_name?: string | null;
  variant_name?: string | null;
  sku?: string | null;
  barcode?: string | null;
  sales_unit_code?: string | null;
  sales_unit_label?: string | null;
  allow_decimal_quantity?: boolean | null;
};

export type CreateRetailPosOrderRequest = {
  tenant_id: string;
  origin_client_order_id: string;
  origin_local_folio?: string | null;
  origin_device_id: string;
  created_by_pos_user_id: string;
  lines: CreateRetailPosOrderLineInput[];
  copied_from_order_id?: string | null;
};

export type CreateRetailPosOrderResponse = {
  order: RetailPosOrder;
  lines: RetailPosOrderLine[];
};

export type UpdateRetailPosOrderRequest = {
  tenant_id: string;
  order_id: string;
  lines: CreateRetailPosOrderLineInput[];
};

export type VoidRetailPosOrderRequest = {
  tenant_id: string;
  order_id: string;
  voided_by_pos_user_id: string;
  void_reason: string | null;
  void_note?: string | null;
  expected_revision?: number;
  command_id?: string;
};

export type GetRetailPosOrderResponse = {
  order: RetailPosOrder;
  lines: RetailPosOrderLine[];
  payment: RetailPosPayment | null;
  discounts?: RetailPosPersistedOrderDiscount[];
  discount_overview?: RetailPosOrderDiscountOverview | null;
};

export type PayRetailPosOrderRequest = {
  tenant_id: string;
  order_id: string;
  cash_shift_id?: string | null;
  device_id?: string | null;
  pos_user_id: string;
  payment_method: RetailPosPaymentMethod;
  amount_cents: number;
  received_amount_cents: number | null;
  card_reference: string | null;
};

export type PayRetailPosOrderResponse = {
  order: RetailPosOrder;
  payment: RetailPosPayment;
};

export type RetailPosPayCommandPayload = {
  order_id: string;
  payment_method: RetailPosPaymentMethod;
  amount_cents: number;
  received_amount_cents: number | null;
  card_reference: string | null;
};

export type OpenRetailPosCashShiftRequest = {
  tenant_id: string;
  kiosk_id?: string | null;
  device_id?: string | null;
  opened_by_pos_user_id: string;
  opening_float_cents: number;
  opened_at?: string;
};

export type OpenRetailPosCashShiftResponse = {
  cash_shift: RetailPosCashShift;
};

export type CloseRetailPosCashShiftRequest = {
  tenant_id: string;
  cash_shift_id: string;
  device_id: string;
  closed_by_pos_user_id: string;
  expected_cash_cents: number;
  declared_cash_cents: number;
  closing_note?: string | null;
  closed_at?: string;
  status?: Extract<RetailPosCashShiftStatus, "closed" | "canceled">;
};

export type CloseRetailPosCashShiftResponse = {
  cash_shift: RetailPosCashShift;
};

export type RetailPosCurrentCashShiftResponse = {
  cash_shift: RetailPosCashShift | null;
};

export type RetailPosCashShiftCloseSummary = {
  cash_shift_id: string;
  tenant_id: string;
  kiosk_id: string;
  device_id: string;
  status: RetailPosCashShiftStatus;
  opened_at: string;
  closed_at: string | null;
  opening_cash_cents: number;
  cash_sales_cents: number;
  card_sales_cents: number;
  total_sales_cents: number;
  expected_cash_cents: number;
  declared_cash_cents: number | null;
  difference_cents: number | null;
  payments_count: number;
  closing_note: string | null;
};

export type RetailPosCashShiftCloseSummaryResponse = {
  summary: RetailPosCashShiftCloseSummary;
};

export type RetailPosRuntimeTenantSummary = {
  id: string;
  slug: string;
  name: string;
  status: string;
};

export type RetailPosRuntimeDeviceSummary = {
  device_record_id: string;
  device_id: string;
  name: string;
  status: string;
  kiosk_id: string | null;
};

export type RetailPosRuntimeStationSummary = {
  id: string;
  number: number | null;
  name: string | null;
};

export type RetailPosRuntimeCashRegisterSummary = {
  id: string;
  name: string | null;
  status: string | null;
};

export type RetailPosDeviceProfile = {
  tenant_id: string;
  tenant_slug: string;
  device_record_id: string;
  device_id: string;
  device_name: string;
  device_role: RetailPosDeviceRole;
  station_id: string | null;
  station_number: number | null;
  station_name: string | null;
  cash_register_id: string | null;
  cash_register_name: string | null;
  active_pos_user_id: string | null;
  active_pos_user_name: string | null;
  active_pos_user_role: "cashier" | "supervisor" | "admin" | null;
  updated_at: string;
};

export type RetailPosAuthLease = {
  lease_token: string;
  issued_at: string;
  refresh_after: string;
  expires_at: string;
  config_version: string;
};

export type RetailPosCashierState = {
  device_id: string;
  device_role: RetailPosDeviceRole;
  current_cash_shift_id: string | null;
  current_cash_shift_status: RetailPosCashShiftStatus | null;
  mode: "ready" | "shift_required" | "blocked" | "read_only" | null;
  operator_id: string | null;
  operator_name: string | null;
  can_collect_payments: boolean;
  shift_required: boolean;
  shift_open_required: boolean;
  status_message: string | null;
  warnings: string[];
  updated_at: string;
};

export type RetailPosCapability =
  | "catalog.read"
  | "catalog.manage"
  | "catalog.assign_barcode"
  | "catalog.quick_create"
  | "orders.create"
  | "orders.sync"
  | "orders.lookup"
  | "orders.void"
  | "cashier.status.read"
  | "cashier.shift.open"
  | "cashier.shift.close"
  | "post_sale.view"
  | "post_sale.cancel_sale"
  | "post_sale.return"
  | "post_sale.refund"
  | "post_sale.view_cost"
  | "post_sale.authorize"
  | "discounts.apply"
  | "discounts.view_cost"
  | "discounts.authorize"
  | "payments.collect"
  | "tickets.print.order"
  | "tickets.print.payment"
  | "counter_sale.create_offline"
  | "counter_sale.sync";

export type RetailPosDiscountAuthorizationRecord = {
  required: boolean;
  status: RetailPosDiscountAuthorizationStatus;
  method: RetailPosDiscountAuthorizationMethod | null;
  policy_key: string | null;
  requested_by_pos_user_id: string | null;
  authorized_by_pos_user_id: string | null;
  authorized_at: string | null;
  reference: string | null;
  note: string | null;
  context: Record<string, unknown>;
};

export type RetailPosPostSaleDocument = {
  id: string;
  tenant_id: string;
  original_order_id: string;
  original_payment_id: string;
  document_type: RetailPosPostSaleDocumentType;
  status: RetailPosPostSaleDocumentStatus;
  refund_status: RetailPosPostSaleRefundStatus;
  refund_method: RetailPosPostSaleRefundMethod;
  currency_code: string;
  gross_amount_cents: number;
  discount_amount_cents: number;
  net_amount_cents: number;
  eligible_paid_amount_cents: number;
  refund_amount_cents: number;
  reason_code: RetailPosPostSaleReasonCode;
  comment: string | null;
  created_by_pos_user_id: string;
  created_by_device_id: string;
  cash_shift_id: string | null;
  confirmed_by_pos_user_id: string | null;
  confirmed_at: string | null;
  origin_command_id: string;
  revision: number;
  created_at: string;
  updated_at: string;
};

export type RetailPosPostSaleLine = {
  id: string;
  tenant_id: string;
  post_sale_document_id: string;
  original_order_line_id: string;
  line_number: number;
  quantity_sold: RetailPosQuantityString;
  quantity_previously_returned: RetailPosQuantityString;
  quantity_returned_now: RetailPosQuantityString;
  line_subtotal_cents_historical: number;
  direct_discount_cents_historical: number;
  order_discount_allocated_cents_historical: number;
  line_net_cents_historical: number;
  returned_gross_amount_cents: number;
  returned_direct_discount_cents: number;
  returned_order_discount_cents: number;
  returned_total_discount_cents: number;
  returned_net_amount_cents: number;
  created_at: string;
};

export type RetailPosPostSaleRefund = {
  id: string;
  tenant_id: string;
  post_sale_document_id: string;
  refund_method: RetailPosPostSaleRefundMethod;
  status: RetailPosPostSaleRefundStatus;
  amount_cents: number;
  currency_code: string;
  cash_shift_id: string | null;
  external_reference: string | null;
  processed_by_pos_user_id: string;
  processed_by_device_id: string;
  processed_at: string | null;
  origin_command_id: string;
  created_at: string;
  updated_at: string;
};

export type RetailPosCashMovement = {
  id: string;
  tenant_id: string;
  cash_shift_id: string;
  post_sale_document_id: string | null;
  post_sale_refund_id: string | null;
  movement_type: RetailPosPostSaleCashMovementType;
  amount_cents: number;
  note: string | null;
  created_by_pos_user_id: string;
  created_by_device_id: string;
  occurred_at: string;
  origin_command_id: string;
  created_at: string;
};

export type RetailPosPostSaleWarning = {
  code: string;
  message: string;
};

export type RetailPosPostSaleExistingState = {
  has_any_post_sale: boolean;
  active_sale_cancellation_document_id: string | null;
  active_sale_cancellation_status: RetailPosPostSaleDocumentStatus | null;
  refund_status: RetailPosPostSaleRefundStatus | null;
};

export type RetailPosPostSaleReturnState =
  | "not_returned"
  | "partially_returned"
  | "fully_returned";

export type RetailPosPostSalePreviewLine = {
  original_order_line_id: string;
  line_number: number;
  product_name: string;
  variant_name: string | null;
  quantity_sold: RetailPosQuantityString;
  line_subtotal_cents_historical: number;
  direct_discount_cents_historical: number;
  order_discount_allocated_cents_historical: number;
  line_net_cents_historical: number;
};

export type RetailPosPostSaleReturnSelectionLine = {
  order_line_id: string;
  quantity: RetailPosQuantityString;
};

export type RetailPosPostSaleReturnPreviewLine = {
  original_order_line_id: string;
  line_number: number;
  product_name: string;
  variant_name: string | null;
  quantity_sold: RetailPosQuantityString;
  quantity_previously_returned: RetailPosQuantityString;
  quantity_available: RetailPosQuantityString;
  quantity_selected: RetailPosQuantityString;
  line_subtotal_cents_historical: number;
  direct_discount_cents_historical: number;
  order_discount_allocated_cents_historical: number;
  line_net_cents_historical: number;
  gross_available_cents: number;
  direct_discount_available_cents: number;
  order_discount_available_cents: number;
  total_discount_available_cents: number;
  net_available_cents: number;
  gross_selected_cents: number;
  direct_discount_selected_cents: number;
  order_discount_selected_cents: number;
  total_discount_selected_cents: number;
  net_selected_cents: number;
};

export type RetailPosPostSaleReturnTotals = {
  gross_previously_returned_cents: number;
  direct_discount_previously_returned_cents: number;
  order_discount_previously_returned_cents: number;
  total_discount_previously_returned_cents: number;
  net_previously_returned_cents: number;
  gross_available_cents: number;
  direct_discount_available_cents: number;
  order_discount_available_cents: number;
  total_discount_available_cents: number;
  net_available_cents: number;
  gross_selected_cents: number;
  direct_discount_selected_cents: number;
  order_discount_selected_cents: number;
  total_discount_selected_cents: number;
  net_selected_cents: number;
};

export type RetailPosPostSaleReturnAccumulatedLine = {
  original_order_line_id: string;
  line_number: number;
  quantity_sold: RetailPosQuantityString;
  quantity_returned: RetailPosQuantityString;
  quantity_remaining: RetailPosQuantityString;
  net_cents_sold: number;
  net_cents_returned: number;
  net_cents_remaining: number;
};

export type RetailPosPostSaleCancellationPreviewRequest = {
  order_id: string;
  reason_code: RetailPosPostSaleReasonCode;
  comment: string | null;
};

export type RetailPosPostSaleReturnPreviewRequest = {
  order_id: string;
  lines: RetailPosPostSaleReturnSelectionLine[];
  reason_code: RetailPosPostSaleReasonCode;
  comment: string | null;
  refund_method?: Extract<RetailPosPostSaleRefundMethod, "cash" | "card_external"> | null;
};

export type RetailPosPostSaleCancellationPreviewResponse = {
  original_order: RetailPosOrder;
  original_payment: RetailPosPayment;
  lines: RetailPosPostSalePreviewLine[];
  gross_amount_cents: number;
  discount_amount_cents: number;
  net_amount_cents: number;
  eligible_paid_amount_cents: number;
  expected_order_revision: number | null;
  allowed_refund_methods: Extract<
    RetailPosPostSaleRefundMethod,
    "cash" | "card_external"
  >[];
  existing_post_sale: RetailPosPostSaleExistingState;
  warnings: RetailPosPostSaleWarning[];
};

export type RetailPosPostSaleReturnPreviewResponse = {
  original_order: RetailPosOrder;
  original_payment: RetailPosPayment;
  lines: RetailPosPostSaleReturnPreviewLine[];
  totals: RetailPosPostSaleReturnTotals;
  expected_order_revision: number | null;
  fingerprint: string;
  suggested_document_type: Extract<
    RetailPosPostSaleDocumentType,
    "return_full" | "return_partial"
  >;
  allowed_refund_methods: Extract<
    RetailPosPostSaleRefundMethod,
    "cash" | "card_external"
  >[];
  existing_post_sale: RetailPosPostSaleExistingState;
  return_state: RetailPosPostSaleReturnState;
  warnings: RetailPosPostSaleWarning[];
};

export type RetailPosPostSaleCancellationCommitRequest = {
  order_id: string;
  cash_shift_id: string;
  expected_order_revision: number;
  reason_code: RetailPosPostSaleReasonCode;
  comment: string | null;
  refund_method: Extract<RetailPosPostSaleRefundMethod, "cash" | "card_external">;
};

export type RetailPosPostSaleReturnCommitRequest = {
  order_id: string;
  cash_shift_id: string | null;
  expected_order_revision: number;
  fingerprint: string;
  lines: RetailPosPostSaleReturnSelectionLine[];
  reason_code: RetailPosPostSaleReasonCode;
  comment: string | null;
  refund_method: Extract<RetailPosPostSaleRefundMethod, "cash" | "card_external">;
};

export type RetailPosPostSaleCancellationCommitResponse = {
  document: RetailPosPostSaleDocument;
  lines: RetailPosPostSaleLine[];
  refund: RetailPosPostSaleRefund;
  cash_movement: RetailPosCashMovement | null;
  replayed: boolean;
  gross_amount_cents: number;
  discount_amount_cents: number;
  net_amount_cents: number;
};

export type RetailPosPostSaleReturnCommitResponse = {
  document: RetailPosPostSaleDocument;
  lines: RetailPosPostSaleLine[];
  refund: RetailPosPostSaleRefund;
  cash_movement: RetailPosCashMovement | null;
  replayed: boolean;
  return_state: RetailPosPostSaleReturnState;
  accumulated_lines: RetailPosPostSaleReturnAccumulatedLine[];
  totals: RetailPosPostSaleReturnTotals;
};

export type RetailPosPostSaleCardRefundConfirmRequest = {
  post_sale_document_id: string;
  refund_id: string;
  external_reference: string;
};

export type RetailPosPostSaleCardRefundConfirmResponse = {
  document: RetailPosPostSaleDocument;
  refund: RetailPosPostSaleRefund;
  replayed: boolean;
};

export type RetailPosPostSaleDetailResponse = {
  document: RetailPosPostSaleDocument;
  lines: RetailPosPostSaleLine[];
  refund: RetailPosPostSaleRefund | null;
  original_order: RetailPosOrder;
  original_payment: RetailPosPayment;
  original_order_lines: RetailPosOrderLine[];
  accumulated_lines?: RetailPosPostSaleReturnAccumulatedLine[];
  return_state?: RetailPosPostSaleReturnState;
};

export type RetailPosDiscountIntentDraft = {
  id: string;
  scope: RetailPosDiscountScope;
  order_line_id: string | null;
  capture_type: RetailPosDiscountCaptureType;
  percentage_bps: number | null;
  amount_cents: number | null;
  reason_code: RetailPosDiscountReasonCode;
  comment: string | null;
  source: "manual";
  authorization: RetailPosDiscountAuthorizationRecord | null;
};

export type RetailPosDiscountAllocationSnapshot = {
  order_line_id: string;
  line_number: number;
  allocation_base_cents: number;
  allocated_discount_cents: number;
};

export type RetailPosPersistedOrderDiscount = {
  id: string;
  tenant_id: string;
  order_id: string;
  order_revision: number;
  lifecycle_status: "active" | "cleared" | "superseded";
  scope: RetailPosDiscountScope;
  order_line_id: string | null;
  capture_type: RetailPosDiscountCaptureType;
  percentage_bps: number | null;
  amount_cents: number | null;
  base_amount_cents: number;
  effective_discount_cents: number;
  reason_code: RetailPosDiscountReasonCode;
  comment: string | null;
  source: "manual";
  applied_by_pos_user_id: string | null;
  applied_by_device_id: string | null;
  applied_at: string;
  expected_revision: number;
  authorization: RetailPosDiscountAuthorizationRecord;
  allocations: RetailPosDiscountAllocationSnapshot[];
  created_at: string;
  updated_at: string;
};

export type RetailPosDiscountLineSnapshot = {
  order_line_id: string;
  line_number: number;
  gross_cents: number;
  direct_discount_cents: number;
  order_discount_allocation_cents: number;
  total_discount_cents: number;
  net_cents: number;
  unit_cost_snapshot_cents: number | null;
  total_cost_cents: number | null;
  margin_delta_cents: number | null;
  cost_evaluation: RetailPosDiscountCostEvaluation;
  below_cost_after_discount: boolean;
};

export type RetailPosDiscountWarningSnapshot = {
  code: string;
  message: string;
  order_line_id: string | null;
};

export type RetailPosDiscountCalculationSummary = {
  order_id: string;
  expected_revision: number;
  subtotal_gross_cents: number;
  direct_discount_cents: number;
  order_discount_cents: number;
  total_discount_cents: number;
  total_cents: number;
  lines: RetailPosDiscountLineSnapshot[];
  warnings: RetailPosDiscountWarningSnapshot[];
};

export type RetailPosDiscountPreviewRequest = {
  order_id: string;
  cash_shift_id: string;
  expected_revision: number;
  discount_intents: RetailPosDiscountIntentDraft[];
};

export type RetailPosDiscountPreviewLine = {
  order_line_id: string;
  line_number: number;
  product_id: string;
  product_variant_id: string | null;
  product_name: string;
  variant_name: string | null;
  sku: string | null;
  barcode: string | null;
  sales_unit_code: string;
  sales_unit_label: string;
  allow_decimal_quantity: boolean;
  quantity: RetailPosQuantityString;
  unit_price_cents: number;
  gross_cents: number;
  direct_discount_cents: number;
  order_discount_allocation_cents: number;
  total_discount_cents: number;
  net_cents: number;
  unit_cost_snapshot_cents: number | null;
  total_cost_cents: number | null;
  margin_delta_cents: number | null;
  cost_evaluation: RetailPosDiscountCostEvaluation;
  below_cost_after_discount: boolean;
  warnings: RetailPosDiscountWarningSnapshot[];
};

export type RetailPosDiscountPreviewAuthorization = {
  required: false;
  method: "role_capability";
  future_policy_supported: true;
};

export type RetailPosDiscountPreviewResponse = {
  order_id: string;
  revision: number;
  calculation_fingerprint: string;
  subtotal_cents: number;
  line_discount_cents: number;
  order_discount_cents: number;
  total_discount_cents: number;
  total_cents: number;
  has_below_cost_lines: boolean;
  requires_below_cost_acknowledgement: boolean;
  below_cost_line_ids: string[];
  lines: RetailPosDiscountPreviewLine[];
  warnings: RetailPosDiscountWarningSnapshot[];
  authorization: RetailPosDiscountPreviewAuthorization;
};

export type RetailPosCheckoutWithDiscountsRequest = {
  order_id: string;
  expected_revision: number;
  intents: RetailPosDiscountIntentDraft[];
  payment: {
    payment_method: RetailPosPaymentMethod;
    amount_cents: number;
    received_amount_cents: number | null;
    card_reference: string | null;
  };
};

export type RetailPosBelowCostAcknowledgement = {
  accepted: boolean;
  calculation_fingerprint: string | null;
};

export type RetailPosDiscountCheckoutRequest = {
  order_id: string;
  cash_shift_id: string;
  expected_revision: number;
  payment_method: RetailPosPaymentMethod;
  payment_amount_cents: number;
  cash_received_cents: number | null;
  discount_intents: RetailPosDiscountIntentDraft[];
  below_cost_acknowledgement: RetailPosBelowCostAcknowledgement | null;
  external_payment_reference: string | null;
};

export type RetailPosDiscountCheckoutResponse = {
  order: RetailPosOrder;
  payment: RetailPosPayment;
  previous_revision: number;
  final_revision: number;
  subtotal_cents: number;
  line_discount_cents: number;
  order_discount_cents: number;
  total_discount_cents: number;
  total_cents: number;
  change_cents: number;
  below_cost: boolean;
  below_cost_line_ids: string[];
  discount_snapshot: RetailPosDiscountCalculationSummary;
};

export type RetailPosDiscountCheckoutCommandPayload = {
  order_id: string;
  payment_method: RetailPosPaymentMethod;
  payment_amount_cents: number;
  cash_received_cents: number | null;
  expected_revision: number;
  discount_intents: RetailPosDiscountIntentDraft[];
  below_cost_acknowledgement: RetailPosBelowCostAcknowledgement | null;
  external_payment_reference: string | null;
};

export type RetailPosClearDiscountDraftRequest = {
  order_id: string;
  expected_revision: number;
  scope: RetailPosDiscountScope | "all";
  order_line_id: string | null;
};

export type RetailPosOrderDiscountHistoryRequest = {
  order_id: string;
};

export type RetailPosOrderDiscountOverview = {
  subtotal_gross_cents: number;
  line_discount_cents: number;
  order_discount_cents: number;
  total_discount_cents: number;
  total_cents: number;
  has_below_cost_lines: boolean;
};

export type RetailPosOrderDiscountHistoryResponse = {
  order_id: string;
  revision: number | null;
  discounts: RetailPosPersistedOrderDiscount[];
  summary: RetailPosDiscountCalculationSummary | null;
};

export type RetailPosBootstrapResponse = {
  tenant: RetailPosRuntimeTenantSummary;
  device: RetailPosRuntimeDeviceSummary;
  device_role: RetailPosDeviceRole;
  station: RetailPosRuntimeStationSummary | null;
  cash_register: RetailPosRuntimeCashRegisterSummary | null;
  current_shift: RetailPosCashShift | null;
  cashier_state: RetailPosCashierState | null;
  active_pos_user: RetailPosAssignedOperator | null;
  capabilities: RetailPosCapability[];
  auth_lease: RetailPosAuthLease;
  config_version: string;
  server_time: string;
};

export type RetailPosRuntimeCommand<TPayload = Record<string, unknown>> = {
  command_id: string;
  command_type: RetailPosCommandType;
  device_id: string;
  operator_id: string | null;
  cash_shift_id: string | null;
  payload: TPayload;
};

export type RetailPosCommandResult<TResult = Record<string, unknown>> = {
  command_id: string;
  command_type: RetailPosCommandType;
  status: RetailPosCommandResultStatus;
  idempotent_replay: boolean;
  device_id: string;
  operator_id: string | null;
  cash_shift_id: string | null;
  result: TResult;
  server_time: string;
};

export type RetailPosPayCommand = RetailPosRuntimeCommand<RetailPosPayCommandPayload>;
export type RetailPosPayCommandResult = RetailPosCommandResult<PayRetailPosOrderResponse>;

export type RetailPosPriceTierDecision = { order_line_id: string; approved_price_tier: RetailPosPriceTier };
export type RetailPosPriceTierDecisionCommandPayload = { order_id: string; expected_revision: number; decisions: RetailPosPriceTierDecision[] };
export type RetailPosPriceTierDecisionCommand = RetailPosRuntimeCommand<RetailPosPriceTierDecisionCommandPayload> & { command_type: "price_tier_decision" };
export type RetailPosPriceTierDecisionResponse = { order_id: string; revision: number; resolved_line_ids: string[] };
export type RetailPosPriceTierDecisionCommandResult = RetailPosCommandResult<RetailPosPriceTierDecisionResponse>;

export type RetailPosRecentPendingOrderSummary = {
  order_id: string;
  folio: string;
  created_at: string;
  total_cents: number;
  line_count: number;
  has_pending_wholesale: boolean;
  revision: number;
};

export type RetailPosDiscountCheckoutCommand =
  RetailPosRuntimeCommand<RetailPosDiscountCheckoutCommandPayload> & {
    command_type: "discount_checkout";
  };

export type RetailPosDiscountCheckoutCommandResult =
  RetailPosCommandResult<RetailPosDiscountCheckoutResponse>;

export type RetailPosDaySummaryResponse = {
  tenant_id: string;
  business_date: string;
  device_id: string | null;
  cash_shift_id: string | null;
  orders_count: number;
  pending_payment_orders_count: number;
  paid_orders_count: number;
  cancelled_orders_count: number;
  gross_sales_cents: number;
  discounts_cents: number;
  net_sales_cents: number;
  cash_payments_cents: number;
  card_payments_cents: number;
  current_cash_shift: RetailPosCashShift | null;
};

export type RetailPosTicketLinePayload = {
  line_number: number;
  product_name: string;
  variant_name: string | null;
  quantity: RetailPosQuantityString;
  sales_unit_label: string;
  unit_price_cents: number;
  discount_cents: number;
  line_total_cents: number;
};

export type RetailPosTicketPayload = {
  tenant_id: string;
  order_id: string;
  folio: string;
  printed_at: string;
  lines: RetailPosTicketLinePayload[];
  subtotal_cents: number;
  discount_cents: number;
  total_cents: number;
};

export type RetailPosOrderTicketPayload = RetailPosTicketPayload & {
  ticket_type: "order";
  created_by_pos_user_id: string;
};

export type RetailPosPaymentTicketPayload = RetailPosTicketPayload & {
  ticket_type: "payment";
  payment_method: RetailPosPaymentMethod;
  paid_at: string;
  amount_cents: number;
  received_amount_cents: number | null;
  change_cents: number;
  cashier_pos_user_id: string;
};

export type RetailPosPostSaleTicketPayload = {
  ticket_type: "post_sale";
  tenant_id: string;
  order_id: string;
  folio: string;
  printed_at: string;
  post_sale_document_id: string;
  post_sale_document_status: RetailPosPostSaleDocumentStatus;
  post_sale_document_type: Extract<
    RetailPosPostSaleDocumentType,
    "sale_cancellation" | "return_full" | "return_partial"
  >;
  refund_status: RetailPosPostSaleRefundStatus;
  refund_method: RetailPosPostSaleRefundMethod;
  refund_amount_cents: number;
  reason_code: RetailPosPostSaleReasonCode;
  original_paid_at: string | null;
  refund_processed_at: string | null;
  original_payment_method: RetailPosPaymentMethod;
  original_subtotal_cents: number;
  original_discount_cents: number;
  original_total_cents: number;
  lines: Array<{
    line_number: number;
    product_name: string;
    variant_name: string | null;
    quantity_returned: RetailPosQuantityString;
    returned_net_amount_cents: number;
  }>;
};

export type RecordRetailPosTicketEventRequest = {
  tenant_id: string;
  order_id: string;
  device_id: string;
  pos_user_id: string | null;
  ticket_type: RetailPosTicketType;
  event_type: RetailPosTicketEventType;
  printer_name: string | null;
  payload:
    | RetailPosOrderTicketPayload
    | RetailPosPaymentTicketPayload
    | RetailPosPostSaleTicketPayload;
};

export type RetailPosTicketEventRequest = {
  order_id: string;
  ticket_type: RetailPosTicketEventRequestType | RetailPosTicketType;
  event_type: RetailPosTicketEventType;
  client_event_id: string;
  printed_at?: string | null;
  printer_name?: string | null;
  error_message?: string | null;
  metadata?: Record<string, unknown> | null;
};

export type RetailPosTicketEventResponse = {
  event: RetailPosTicketEvent & {
    payload: Record<string, unknown>;
  };
  idempotent: boolean;
  synced_at: string;
};

export type RetailPosCounterSaleCompletedV1 = {
  schema_version: 1;
  command_id: string;
  local_sale_id: string;
  origin_local_folio: string;
  tenant_id: string;
  device_id: string;
  created_by_pos_user_id: string;
  shift: {
    local_shift_id: string;
    opened_at: string;
    business_date: string;
    opening_cash_cents: number;
    closed_at?: string | null;
  };
  completed_at: string;
  subtotal_cents: number;
  discount_total_cents: 0;
  total_cents: number;
  payment: {
    local_payment_id: string;
    method: RetailPosPaymentMethod;
    amount_cents: number;
    received_amount_cents?: number | null;
    change_cents?: number;
    externally_confirmed: boolean;
    external_reference?: string | null;
  };
  lines: Array<{
    local_line_id: string;
    product_id: string;
    variant_id?: string | null;
    sku?: string | null;
    description_snapshot: string;
    sales_unit_code: string;
    sales_unit_label: string;
    allow_decimal_quantity: boolean;
    quantity: RetailPosQuantityString;
    unit_price_cents: number;
    discount_cents: 0;
    line_total_cents: number;
  }>;
};

export type RetailPosCounterSaleSyncResult = {
  status: "created" | "already_processed";
  command_id: string;
  local_sale_id: string;
  remote_sale_id: string;
  remote_folio: string;
  remote_payment_id: string;
  remote_shift_id: string;
  processed_at: string;
};

export type RetailPosCounterSaleCompletedCommand =
  RetailPosRuntimeCommand<RetailPosCounterSaleCompletedV1> & {
    command_type: "create_paid_counter_sale";
  };

export type RetailPosCounterSaleCompletedCommandResult =
  RetailPosCommandResult<RetailPosCounterSaleSyncResult>;

export type RetailPosZReportWarning = {
  code: string;
  message: string;
};

export type RetailPosZReportV1 = {
  tenantId: string;
  tenantName: string | null;
  cashShiftId: string;
  status: "open" | "closed" | "canceled";
  deviceId: string;
  deviceName: string | null;
  deviceRole:
    | RetailPosDeviceRole
    | null;
  openedAt: string;
  closedAt: string | null;
  generatedAt: string;
  openedByPosUserId: string | null;
  openedByName: string | null;
  closedByPosUserId: string | null;
  closedByName: string | null;
  openingFloatCents: number;
  cashSalesCents: number;
  cardSalesCents: number;
  totalSalesCents: number;
  expectedCashCents: number | null;
  declaredCashCents: number | null;
  differenceCents: number | null;
  paymentsCount: number;
  paidOrdersCount: number;
  averageTicketCents: number;
  closingNote: string | null;
  future: {
    discountsCents: number | null;
    cancellationsCount: number | null;
    cancellationsAmountCents: number | null;
    fullReturnsCount: number | null;
    partialReturnsCount: number | null;
    returnedAmountCents: number | null;
    commercialNetCents: number | null;
    cancellationRefundsCashCents: number | null;
    cancellationRefundsCardCents: number | null;
    returnRefundsCashCents: number | null;
    returnRefundsCardCompletedCents: number | null;
    returnRefundsCardPendingCents: number | null;
    returnsCount: number | null;
    returnsAmountCents: number | null;
    pendingSyncPaymentsCount: number | null;
    pendingSyncAmountCents: number | null;
  };
  printEvidence: {
    status: "not_available" | "no_evidence" | "printed" | "reprinted" | "print_failed" | "mixed";
    printedCount: number | null;
    reprintedCount: number | null;
    failedCount: number | null;
    note: string;
  };
  paymentMethods: Array<{
    method: "cash" | "card";
    paymentsCount: number;
    totalCents: number;
  }>;
  orders: Array<{
    orderId: string;
    folio: string;
    paidAt: string | null;
    totalCents: number;
    paymentMethod: "cash" | "card" | null;
  }>;
  linesSummary: {
    soldLinesCount: number;
    soldUnits: number;
  };
  warnings: RetailPosZReportWarning[];
};

const RETAIL_POS_CANONICAL_QUANTITY_PATTERN = /^(0|[1-9]\d*)\.\d{3}$/;
const RETAIL_POS_NORMALIZABLE_QUANTITY_PATTERN = /^(0|[1-9]\d*)(?:\.(\d{1,3}))?$/;

export function isRetailPosOrderStatus(value: string): value is RetailPosOrderStatus {
  return RETAIL_POS_ORDER_STATUSES.indexOf(value as RetailPosOrderStatus) !== -1;
}

export function isRetailPosPaymentMethod(
  value: string,
): value is RetailPosPaymentMethod {
  return RETAIL_POS_PAYMENT_METHODS.indexOf(value as RetailPosPaymentMethod) !== -1;
}

export function isRetailPosDeviceRole(value: string): value is RetailPosDeviceRole {
  return RETAIL_POS_DEVICE_ROLES.indexOf(value as RetailPosDeviceRole) !== -1;
}

export function isRetailPosDiscountScope(
  value: string,
): value is RetailPosDiscountScope {
  return RETAIL_POS_DISCOUNT_SCOPES.indexOf(value as RetailPosDiscountScope) !== -1;
}

export function isRetailPosDiscountCaptureType(
  value: string,
): value is RetailPosDiscountCaptureType {
  return RETAIL_POS_DISCOUNT_CAPTURE_TYPES.indexOf(value as RetailPosDiscountCaptureType) !== -1;
}

export function isRetailPosDiscountReasonCode(
  value: string,
): value is RetailPosDiscountReasonCode {
  return RETAIL_POS_DISCOUNT_REASON_CODES.indexOf(value as RetailPosDiscountReasonCode) !== -1;
}

export function isRetailPosDiscountAuthorizationStatus(
  value: string,
): value is RetailPosDiscountAuthorizationStatus {
  return RETAIL_POS_DISCOUNT_AUTHORIZATION_STATUSES.indexOf(
    value as RetailPosDiscountAuthorizationStatus,
  ) !== -1;
}

export function isRetailPosDiscountAuthorizationMethod(
  value: string,
): value is RetailPosDiscountAuthorizationMethod {
  return RETAIL_POS_DISCOUNT_AUTHORIZATION_METHODS.indexOf(
    value as RetailPosDiscountAuthorizationMethod,
  ) !== -1;
}

export function isRetailPosDiscountCostEvaluation(
  value: string,
): value is RetailPosDiscountCostEvaluation {
  return RETAIL_POS_DISCOUNT_COST_EVALUATIONS.indexOf(
    value as RetailPosDiscountCostEvaluation,
  ) !== -1;
}

export function isRetailPosCashShiftStatus(
  value: string,
): value is RetailPosCashShiftStatus {
  return RETAIL_POS_CASH_SHIFT_STATUSES.indexOf(value as RetailPosCashShiftStatus) !== -1;
}

export function isRetailPosCanonicalQuantity(
  value: string,
): value is RetailPosQuantityString {
  return RETAIL_POS_CANONICAL_QUANTITY_PATTERN.test(value) && value !== "0.000";
}

export function hasRetailPosCapability(
  capabilities: readonly RetailPosCapability[],
  capability: RetailPosCapability,
): boolean {
  return capabilities.includes(capability);
}

export function canRetailPosApplyDiscounts(
  deviceRole: RetailPosDeviceRole,
  capabilities: readonly RetailPosCapability[],
): boolean {
  return deviceRole === "cashier_station" && hasRetailPosCapability(capabilities, "discounts.apply");
}

export function canRetailPosViewDiscountCosts(
  capabilities: readonly RetailPosCapability[],
): boolean {
  return hasRetailPosCapability(capabilities, "discounts.view_cost");
}

export function validateRetailPosDiscountIntentDraft(
  input: RetailPosDiscountIntentDraft,
): string[] {
  const errors: string[] = [];

  if (!isRetailPosDiscountScope(input.scope)) {
    errors.push("scope must be 'line' or 'order'");
  }

  if (input.scope === "line" && !input.order_line_id) {
    errors.push("line scope requires order_line_id");
  }

  if (input.scope === "order" && input.order_line_id !== null) {
    errors.push("order scope cannot include order_line_id");
  }

  if (!isRetailPosDiscountCaptureType(input.capture_type)) {
    errors.push("capture_type must be 'percentage' or 'fixed_amount'");
  }

  if (!isRetailPosDiscountReasonCode(input.reason_code)) {
    errors.push("reason_code is invalid");
  }

  if (input.capture_type === "percentage") {
    const percentageBps = input.percentage_bps;

    if (
      percentageBps === null ||
      !Number.isInteger(percentageBps) ||
      percentageBps < 0 ||
      percentageBps > 10000
    ) {
      errors.push("percentage_bps must be an integer between 0 and 10000");
    }

    if (input.amount_cents !== null) {
      errors.push("percentage discounts cannot include amount_cents");
    }
  }

  if (input.capture_type === "fixed_amount") {
    const amountCents = input.amount_cents;

    if (amountCents === null || !Number.isInteger(amountCents) || amountCents < 0) {
      errors.push("amount_cents must be a non-negative integer");
    }

    if (input.percentage_bps !== null) {
      errors.push("fixed amount discounts cannot include percentage_bps");
    }
  }

  if (input.authorization) {
    if (!isRetailPosDiscountAuthorizationStatus(input.authorization.status)) {
      errors.push("authorization.status is invalid");
    }

    if (
      input.authorization.method !== null &&
      !isRetailPosDiscountAuthorizationMethod(input.authorization.method)
    ) {
      errors.push("authorization.method is invalid");
    }
  }

  return errors;
}

export function normalizeRetailPosQuantity(
  input: unknown,
): RetailPosQuantityString | null {
  if (typeof input !== "string" && typeof input !== "number") {
    return null;
  }

  const normalizedInput = String(input).trim();
  const match = RETAIL_POS_NORMALIZABLE_QUANTITY_PATTERN.exec(normalizedInput);

  if (!match) {
    return null;
  }

  const integerPart = match[1];
  const decimalPartSource = match[2] ?? "";
  const decimalPart = `${decimalPartSource}000`.slice(0, 3);
  const normalized = `${integerPart}.${decimalPart}`;

  return normalized === "0.000" ? null : normalized;
}
