export const RETAIL_POS_ORDER_STATUSES = [
  "pending_payment",
  "paid",
  "cancelled",
] as const;

export const RETAIL_POS_PAYMENT_METHODS = ["cash", "card"] as const;

export const RETAIL_POS_DEVICE_ROLES = [
  "order_station",
  "cashier_station",
  "backoffice_station",
] as const;

export const RETAIL_POS_CASH_SHIFT_STATUSES = [
  "open",
  "closed",
  "canceled",
] as const;

export const RETAIL_POS_TICKET_TYPES = ["order", "payment"] as const;

export const RETAIL_POS_TICKET_EVENT_TYPES = [
  "printed",
  "reprinted",
  "print_failed",
] as const;

export const RETAIL_POS_TICKET_EVENT_REQUEST_TYPES = [
  "order_ticket",
  "payment_ticket",
] as const;

export const RETAIL_POS_RUNTIME_COMMAND_TYPES = [
  "open_shift",
  "close_shift",
  "pay",
] as const;

export const RETAIL_POS_COMMAND_RESULT_STATUSES = [
  "accepted",
  "completed",
  "replayed",
  "rejected",
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
export type RetailPosCommandResultStatus =
  (typeof RETAIL_POS_COMMAND_RESULT_STATUSES)[number];

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
  status: RetailPosOrderStatus;
  origin_device_id: string;
  created_by_pos_user_id: string;
  cashier_pos_user_id: string | null;
  paid_by_device_id: string | null;
  subtotal_cents: number;
  discount_cents: number;
  total_cents: number;
  paid_at: string | null;
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
  origin_device_id: string;
  created_by_pos_user_id: string;
  lines: CreateRetailPosOrderLineInput[];
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

export type CancelRetailPosOrderRequest = {
  tenant_id: string;
  order_id: string;
  cancelled_by_pos_user_id: string;
  cancel_reason: string | null;
};

export type GetRetailPosOrderResponse = {
  order: RetailPosOrder;
  lines: RetailPosOrderLine[];
  payment: RetailPosPayment | null;
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
  | "catalog.assign_barcode"
  | "catalog.quick_create"
  | "orders.create"
  | "orders.sync"
  | "orders.lookup"
  | "orders.cancel"
  | "cashier.status.read"
  | "cashier.shift.open"
  | "cashier.shift.close"
  | "payments.collect"
  | "tickets.print.order"
  | "tickets.print.payment";

export type RetailPosBootstrapResponse = {
  tenant: RetailPosRuntimeTenantSummary;
  device: RetailPosRuntimeDeviceSummary;
  device_role: RetailPosDeviceRole;
  station: RetailPosRuntimeStationSummary | null;
  cash_register: RetailPosRuntimeCashRegisterSummary | null;
  current_shift: RetailPosCashShift | null;
  cashier_state: RetailPosCashierState | null;
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

export type RecordRetailPosTicketEventRequest = {
  tenant_id: string;
  order_id: string;
  device_id: string;
  pos_user_id: string | null;
  ticket_type: RetailPosTicketType;
  event_type: RetailPosTicketEventType;
  printer_name: string | null;
  payload: RetailPosOrderTicketPayload | RetailPosPaymentTicketPayload;
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

export function normalizeRetailPosQuantity(
  input: string,
): RetailPosQuantityString | null {
  const normalizedInput = input.trim();
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
