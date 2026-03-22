export type PosSyncCatalogRequest = {
  deviceId: string;
  deviceSecret: string;
  since?: string | null;
};

export type PosCatalogCategory = {
  id: string;
  tenant_id: string;
  name: string;
  sort_order: number;
  is_active: boolean;
  image_path: string | null;
  deleted_at: string | null;
  updated_at: string;
};

export type PosCatalogItem = {
  id: string;
  tenant_id: string;
  category_id: string | null;
  type: string;
  class: string;
  name: string;
  price_cents: number;
  is_active: boolean;
  has_variants: boolean;
  is_sold_out: boolean;
  is_popular: boolean;
  image_path: string | null;
  deleted_at: string | null;
  updated_at: string;
};

export type PosCatalogVariant = {
  id: string;
  tenant_id: string;
  catalog_item_id: string;
  label: string;
  is_active: boolean;
  updated_at: string;
};

export type PosCatalogUser = {
  id: string;
  tenant_id: string;
  name: string;
  pin_hash: string;
  role: string;
  is_active: boolean;
  updated_at: string;
};

export type PosSyncCatalogResponse = {
  tenantId: string;
  tenantSlug: string;
  syncedAt: string;
  incremental: boolean;
  imageBaseUrl?: string | null;
  categories: PosCatalogCategory[];
  items: PosCatalogItem[];
  variants: PosCatalogVariant[];
  users: PosCatalogUser[];
};

export type PosOrderSyncEvent = {
  id: string;
  tenant_id: string | null;
  order_id: string;
  type: string;
  meta?: Record<string, unknown> | null;
  created_at?: string | null;
};

export type PosOrderSyncItem = {
  id: string;
  tenant_id: string | null;
  order_id: string;
  catalog_item_id: string;
  qty: number;
  unit_price_cents: number;
  line_total_cents: number;
  variants?: Record<string, unknown> | null;
};

export type PosOrderSyncOrder = {
  id: string;
  tenant_id: string | null;
  kiosk_id: string | null;
  folio_number: number;
  folio_text: string;
  status: string;
  total_cents: number;
  payment_received_cents?: number | null;
  change_cents?: number | null;
  payment_method?: "cash" | "card" | "employee" | "efectivo" | "tarjeta" | null;
  // Backward compatibility for legacy edge payloads.
  pago_recibido_cents?: number | null;
  cambio_cents?: number | null;
  metodo_pago?: string | null;
  canceled_at?: string | null;
  cancel_reason?: string | null;
  print_status: string;
  print_attempt_count: number;
  last_print_error?: string | null;
  last_print_at?: string | null;
};

export type PosOrderSyncBatchEntry = {
  outboxId: string;
  order: PosOrderSyncOrder;
  items: PosOrderSyncItem[];
  events: PosOrderSyncEvent[];
};

export type PosSyncOrdersLegacyRequest = {
  deviceId: string;
  deviceSecret: string;
  batch: PosOrderSyncBatchEntry[];
};

export type PosSyncMutationType =
  | "OPEN_CASH_SHIFT"
  | "CLOSE_CASH_SHIFT"
  | "OPEN_TAB"
  | "ADD_ITEM"
  | "UPDATE_ITEM_QTY"
  | "REMOVE_ITEM"
  | "KITCHEN_PRINT"
  | "CLOSE_TAB_PAID"
  | "CANCEL_TAB"
  | "SALE_CREATE"
  | "SALE_REPRINT"
  | "SALE_CANCEL";

type PosSyncMutationBase = {
  mutation_id: string;
  type: PosSyncMutationType;
  kiosk_id: string;
  base_tab_version?: number | null;
  created_at?: string | null;
};

type PosSyncOrderMutationBase = PosSyncMutationBase & {
  order_id: string;
};

export type PosSyncMutationOpenCashShift = PosSyncMutationBase & {
  type: "OPEN_CASH_SHIFT";
  cash_shift_id: string;
  opened_by_pos_user_id: string;
  opening_float_cents: number;
  opened_at?: string | null;
};

export type PosSyncMutationCloseCashShift = PosSyncMutationBase & {
  type: "CLOSE_CASH_SHIFT";
  cash_shift_id: string;
  closed_by_pos_user_id: string;
  declared_cash_cents: number;
  closed_at?: string | null;
  status?: "closed" | "canceled";
};

export type PosSyncMutationOpenTab = PosSyncOrderMutationBase & {
  type: "OPEN_TAB";
  folio_number: number;
  folio_text: string;
  total_cents?: number;
  pos_table_id?: string | null;
  pos_table_label?: string | null;
  opened_at?: string | null;
  meta?: Record<string, unknown> | null;
};

export type PosSyncMutationAddItem = PosSyncOrderMutationBase & {
  type: "ADD_ITEM";
  line_id: string;
  product_id: string;
  qty: number;
  unit_price_cents: number;
  notes?: string | null;
  meta?: Record<string, unknown> | null;
};

export type PosSyncMutationUpdateItemQty = PosSyncOrderMutationBase & {
  type: "UPDATE_ITEM_QTY";
  line_id: string;
  qty: number;
  notes?: string | null;
  meta?: Record<string, unknown> | null;
};

export type PosSyncMutationRemoveItem = PosSyncOrderMutationBase & {
  type: "REMOVE_ITEM";
  line_id: string;
  reason?: string | null;
  meta?: Record<string, unknown> | null;
};

export type PosSyncMutationKitchenPrint = PosSyncOrderMutationBase & {
  type: "KITCHEN_PRINT";
  printed_version: number;
  ok?: boolean;
  error?: string | null;
  meta?: Record<string, unknown> | null;
};

export type PosSyncMutationCloseTabPaid = PosSyncOrderMutationBase & {
  type: "CLOSE_TAB_PAID";
  closed_at?: string | null;
  total_cents?: number;
  meta?: Record<string, unknown> | null;
};

export type PosSyncMutationCancelTab = PosSyncOrderMutationBase & {
  type: "CANCEL_TAB";
  canceled_at?: string | null;
  cancel_reason?: string | null;
  meta?: Record<string, unknown> | null;
};

export type PosSyncMutationSaleCreate = PosSyncOrderMutationBase & {
  type: "SALE_CREATE";
  user_id: string;
  folio_number: number;
  folio_text: string;
  total_cents: number;
  payment_received_cents?: number;
  change_cents?: number;
  payment_method?: "cash" | "card" | "employee" | "efectivo" | "tarjeta";
  // Backward compatibility for legacy edge payloads.
  pago_recibido_cents?: number;
  cambio_cents?: number;
  metodo_pago?: "cash" | "card" | "employee" | "efectivo" | "tarjeta";
  print_status?: "SENT" | "FAILED" | "UNKNOWN";
  print_attempt_count?: number;
  last_print_error?: string | null;
  last_print_at?: string | null;
  lines: Array<{
    id: string;
    catalog_item_id: string;
    name?: string;
    qty: number;
    unit_price_cents: number;
    line_total_cents: number;
  }>;
  meta?: Record<string, unknown> | null;
};

export type PosSyncMutationSaleReprint = PosSyncOrderMutationBase & {
  type: "SALE_REPRINT";
  user_id: string;
  print_status?: "SENT" | "FAILED" | "UNKNOWN";
  print_attempt_count?: number;
  last_print_error?: string | null;
  last_print_at?: string | null;
  meta?: Record<string, unknown> | null;
};

export type PosSyncMutationSaleCancel = PosSyncOrderMutationBase & {
  type: "SALE_CANCEL";
  user_id: string;
  canceled_at?: string | null;
  cancel_reason?: string | null;
  meta?: Record<string, unknown> | null;
};

export type PosSyncMutationV2 =
  | PosSyncMutationOpenCashShift
  | PosSyncMutationCloseCashShift
  | PosSyncMutationOpenTab
  | PosSyncMutationAddItem
  | PosSyncMutationUpdateItemQty
  | PosSyncMutationRemoveItem
  | PosSyncMutationKitchenPrint
  | PosSyncMutationCloseTabPaid
  | PosSyncMutationCancelTab
  | PosSyncMutationSaleCreate
  | PosSyncMutationSaleReprint
  | PosSyncMutationSaleCancel;

export type PosSyncOrdersMutationsRequest = {
  deviceId: string;
  deviceSecret: string;
  mutations: PosSyncMutationV2[];
};

export type PosSyncOrdersRequest = {
  deviceId: string;
  deviceSecret: string;
  batch?: PosOrderSyncBatchEntry[];
  mutations?: PosSyncMutationV2[];
};

export type PosSyncOrdersRejected = {
  outboxId: string;
  reason: string;
};

export type PosSyncOrdersResponse = {
  ok: boolean;
  tenantId: string;
  tenantSlug: string;
  syncedAt: string;
  acceptedIds: string[];
  rejected: PosSyncOrdersRejected[];
};

export type PosSyncMutationAckStatus = "APPLIED" | "DUPLICATE" | "CONFLICT" | "ERROR";

export type PosSyncMutationAck = {
  mutation_id: string;
  status: PosSyncMutationAckStatus;
  order_id?: string;
  tab_version?: number;
  message?: string;
};

export type PosSyncMutationConflict = {
  mutation_id: string;
  order_id?: string;
  reason: string;
  expected_tab_version?: number | null;
  current_tab_version?: number | null;
};

export type PosSyncMutationsResponse = {
  ok: boolean;
  tenantId: string;
  tenantSlug: string;
  server_time: string;
  acks: PosSyncMutationAck[];
  conflicts: PosSyncMutationConflict[];
};
