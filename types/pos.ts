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

export type PosSyncCatalogResponse = {
  tenantId: string;
  tenantSlug: string;
  syncedAt: string;
  incremental: boolean;
  categories: PosCatalogCategory[];
  items: PosCatalogItem[];
  variants: PosCatalogVariant[];
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
  order_id: string;
  kiosk_id: string;
  base_tab_version?: number | null;
  created_at?: string | null;
};

export type PosSyncMutationOpenTab = PosSyncMutationBase & {
  type: "OPEN_TAB";
  folio_number: number;
  folio_text: string;
  total_cents?: number;
  pos_table_id?: string | null;
  pos_table_label?: string | null;
  opened_at?: string | null;
  meta?: Record<string, unknown> | null;
};

export type PosSyncMutationAddItem = PosSyncMutationBase & {
  type: "ADD_ITEM";
  line_id: string;
  product_id: string;
  qty: number;
  unit_price_cents: number;
  notes?: string | null;
  meta?: Record<string, unknown> | null;
};

export type PosSyncMutationUpdateItemQty = PosSyncMutationBase & {
  type: "UPDATE_ITEM_QTY";
  line_id: string;
  qty: number;
  notes?: string | null;
  meta?: Record<string, unknown> | null;
};

export type PosSyncMutationRemoveItem = PosSyncMutationBase & {
  type: "REMOVE_ITEM";
  line_id: string;
  reason?: string | null;
  meta?: Record<string, unknown> | null;
};

export type PosSyncMutationKitchenPrint = PosSyncMutationBase & {
  type: "KITCHEN_PRINT";
  printed_version: number;
  ok?: boolean;
  error?: string | null;
  meta?: Record<string, unknown> | null;
};

export type PosSyncMutationCloseTabPaid = PosSyncMutationBase & {
  type: "CLOSE_TAB_PAID";
  closed_at?: string | null;
  total_cents?: number;
  meta?: Record<string, unknown> | null;
};

export type PosSyncMutationCancelTab = PosSyncMutationBase & {
  type: "CANCEL_TAB";
  canceled_at?: string | null;
  cancel_reason?: string | null;
  meta?: Record<string, unknown> | null;
};

export type PosSyncMutationSaleCreate = PosSyncMutationBase & {
  type: "SALE_CREATE";
  folio_number: number;
  folio_text: string;
  total_cents: number;
  pago_recibido_cents: number;
  cambio_cents: number;
  metodo_pago?: string | null;
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

export type PosSyncMutationSaleReprint = PosSyncMutationBase & {
  type: "SALE_REPRINT";
  print_status?: "SENT" | "FAILED" | "UNKNOWN";
  print_attempt_count?: number;
  last_print_error?: string | null;
  last_print_at?: string | null;
  meta?: Record<string, unknown> | null;
};

export type PosSyncMutationSaleCancel = PosSyncMutationBase & {
  type: "SALE_CANCEL";
  canceled_at?: string | null;
  cancel_reason?: string | null;
  meta?: Record<string, unknown> | null;
};

export type PosSyncMutationV2 =
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
