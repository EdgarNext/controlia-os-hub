import { randomUUID } from "node:crypto";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import type {
  KitchenTicketBatchRecord,
  SalesAccountAssignment,
  SalesAccountPaymentRecord,
  SalesAccountRecord,
  SalesPosCatalogV2Response,
  SalesPosCategory,
  SalesPosComboSlot,
  SalesPosComboSlotOption,
  SalesPosModifierGroup,
  SalesPosModifierOption,
  SalesPosPaymentMethod,
  SalesPosProduct,
  SalesPosProductModifierGroupAssignment,
  SalesPosSellableVariant,
  SalesPosServiceContext,
} from "@/types/sales-pos-accounts";

type PosTableRow = {
  id: string;
  tenant_id: string;
  name: string;
  sort_order: number;
  is_active: boolean;
  deleted_at: string | null;
};

type PosUserRow = {
  id: string;
  tenant_id: string;
  role: string;
  is_active: boolean;
  name: string;
};

type KioskRow = {
  id: string;
  tenant_id: string;
  number: number;
  name: string | null;
  is_active: boolean;
};

type CashShiftRow = {
  id: string;
  tenant_id: string;
  kiosk_id: string;
  status: string;
};

type SalesAccountLineRow = {
  id: string;
  tenant_id: string;
  sales_account_id: string;
  line_kind: "simple" | "configurable" | "combo";
  line_status: "active" | "voided";
  product_id: string;
  selected_variant_id: string | null;
  quantity: number;
  kitchen_sent_quantity: number;
  unit_base_price_cents: number;
  unit_combo_slots_total_cents: number;
  unit_modifiers_total_cents: number;
  unit_final_price_cents: number;
  line_total_cents: number;
  line_note: string | null;
  product_name_snapshot: string;
  variant_name_snapshot: string | null;
  category_id_snapshot: string | null;
  category_name_snapshot: string | null;
  selected_modifiers_snapshot: Record<string, unknown>[];
  selected_combo_slots_snapshot: Record<string, unknown>[];
  pricing_snapshot: Record<string, unknown>;
  display_snapshot: Record<string, unknown>;
  kitchen_snapshot: Record<string, unknown>;
  reporting_snapshot: Record<string, unknown>;
  line_version: number;
  last_mutation_id: string | null;
  created_at: string;
  updated_at: string;
  voided_at: string | null;
};

type SalesAccountLineEventRow = {
  id: string;
  tenant_id: string;
  sales_account_id: string;
  sales_account_line_id: string;
  mutation_id: string | null;
  event_type:
    | "line_added"
    | "qty_increased"
    | "qty_decreased"
    | "line_voided"
    | "line_note_updated";
  quantity_delta: number;
  previous_quantity: number | null;
  next_quantity: number | null;
  reason: string | null;
  meta: Record<string, unknown>;
  created_at: string;
  created_by_pos_user_id: string;
};

type KitchenTicketLineRow = {
  id: string;
  tenant_id: string;
  kitchen_ticket_batch_id: string;
  sales_account_id: string;
  sales_account_line_id: string;
  sales_account_line_event_id: string | null;
  ticket_action: "add" | "adjust" | "void";
  quantity_delta: number;
  line_sort_order: number;
  kitchen_snapshot: Record<string, unknown>;
  product_name_snapshot: string;
  variant_name_snapshot: string | null;
  line_note_snapshot: string | null;
  created_at: string;
};

type SalesAccountEventRow = {
  id: string;
  tenant_id: string;
  sales_account_id: string;
  mutation_id: string | null;
  event_type:
    | "account_opened"
    | "assignment_set"
    | "assignment_released"
    | "line_added"
    | "line_updated"
    | "line_voided"
    | "kitchen_batch_requested"
    | "payment_captured"
    | "account_closed"
    | "account_canceled";
  actor_pos_user_id: string | null;
  meta: Record<string, unknown>;
  created_at: string;
};

type SyncAccountPayload = {
  id: string;
  kioskId: string;
  serviceContext: SalesPosServiceContext;
  status: "OPEN" | "PAID" | "CANCELED";
  folioNumber: number;
  folioText: string;
  subtotalCents: number;
  discountCents: number;
  totalCents: number;
  paymentsTotalCents: number;
  balanceDueCents: number;
  accountVersion: number;
  kitchenTicketSequence: number;
  openedAt: string;
  closedAt: string | null;
  canceledAt: string | null;
};

type SyncAssignmentPayload = {
  id: string;
  accountId: string;
  assignmentType: "walk_in" | "table" | "whatsapp";
  posTableId: string | null;
  tableLabel: string | null;
  customerName: string | null;
  customerPhone: string | null;
  customerExternalId: string | null;
  isCurrent: boolean;
  assignedAt: string;
  releasedAt: string | null;
};

type SyncSelectedVariantPayload = {
  variantId: string;
  productId: string;
  name: string;
  unitBasePriceCents: number;
};

type SyncSelectedModifierPayload = {
  modifierGroupId: string;
  modifierGroupName: string;
  modifierOptionId: string;
  modifierOptionName: string;
  priceDeltaCents: number;
  quantity: number;
};

type SyncSelectedComboSlotPayload = {
  comboSlotId: string;
  comboSlotKey: string;
  comboSlotName: string;
  comboSlotOptionId: string;
  comboSlotOptionName: string;
  linkedProductId: string | null;
  linkedSellableVariantId: string | null;
  priceDeltaCents: number;
  quantity: number;
  componentProductId: string | null;
  componentProductName: string | null;
  componentVariantId: string | null;
  componentVariantName: string | null;
  selectedComponentModifiers: SyncSelectedModifierPayload[];
  componentNote: string | null;
  componentDisplayName: string | null;
  componentKitchenDisplayName: string | null;
  componentSelectionSignature: string | null;
};

type SyncLinePayload = {
  id: string;
  accountId: string;
  lineKind: "simple" | "configurable" | "combo";
  lineStatus: "active" | "voided";
  productId: string;
  selectedVariant: SyncSelectedVariantPayload | null;
  selectedComboSlots: SyncSelectedComboSlotPayload[];
  selectedModifiers: SyncSelectedModifierPayload[];
  quantity: number;
  kitchenSentQuantity: number;
  unitBasePriceCents: number;
  unitComboSlotsTotalCents: number;
  unitModifiersTotalCents: number;
  unitFinalPriceCents: number;
  lineTotalCents: number;
  lineNote: string | null;
  pricingSnapshot: Record<string, unknown>;
  displaySnapshot: Record<string, unknown>;
  kitchenSnapshot: Record<string, unknown>;
  reportingSnapshot: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
  voidedAt: string | null;
};

type SyncLineEventPayload = {
  id: string;
  salesAccountId: string;
  salesAccountLineId: string;
  mutationId: string | null;
  eventType: "line_added" | "line_updated" | "line_voided";
  actorPosUserId: string | null;
  quantityDelta: number;
  meta: Record<string, unknown>;
  createdAt: string;
};

type SyncPaymentPayload = {
  id: string;
  accountId: string;
  paymentSequence: number;
  paymentMethod: SalesPosPaymentMethod;
  amountPaidCents: number;
  amountReceivedCents: number | null;
  changeCents: number;
  paidAt: string;
};

type SyncKitchenBatchPayload = {
  id: string;
  accountId: string;
  batchNumber: number;
  batchStatus: "pending" | "sent" | "confirmed" | "failed" | "canceled";
  triggerType:
    | "account_opened"
    | "line_added"
    | "line_updated"
    | "line_voided"
    | "manual_reprint";
  accountVersionFrom: number;
  accountVersionTo: number;
  requestedAt: string;
  printedAt: string | null;
};

type SyncKitchenLinePayload = {
  id: string;
  kitchenTicketBatchId: string;
  salesAccountId: string;
  salesAccountLineId: string;
  salesAccountLineEventId: string | null;
  ticketAction: "add" | "adjust" | "void";
  quantityDelta: number;
  productNameSnapshot: string;
  variantNameSnapshot: string | null;
  lineNoteSnapshot: string | null;
  createdAt: string;
};

type SyncAccountEventPayload = {
  id: string;
  salesAccountId: string;
  mutationId: string | null;
  eventType:
    | "account_opened"
    | "assignment_set"
    | "assignment_released"
    | "line_added"
    | "line_updated"
    | "line_voided"
    | "kitchen_batch_requested"
    | "payment_captured"
    | "account_closed"
    | "account_canceled";
  actorPosUserId: string | null;
  meta: Record<string, unknown>;
  createdAt: string;
};

export type SyncSalesAccountMutationInput = {
  tenantId: string;
  tenantSlug: string;
  kioskId: string;
  mutationId: string;
  mutationType:
    | "sales_account.opened"
    | "sales_account.assignment_set"
    | "sales_account.line_added"
    | "sales_account.line_updated"
    | "sales_account.line_voided"
    | "sales_account.kitchen_batch_requested"
    | "sales_account.payment_captured"
    | "sales_account.closed"
    | "sales_account.canceled";
  actorPosUserId: string;
  payload?: unknown;
  account: unknown;
  assignment?: unknown;
  line?: unknown;
  lineEvent?: unknown;
  payment?: unknown;
  kitchenBatch?: unknown;
  kitchenLines?: unknown[];
  accountEvent?: unknown;
};

export type RuntimePosTable = {
  id: string;
  tenant_id: string;
  name: string;
  sort_order: number;
};

export type SalesAccountDetail = {
  account: SalesAccountRecord;
  assignments: SalesAccountAssignment[];
  current_assignment: SalesAccountAssignment | null;
  lines: SalesAccountLineRow[];
  line_events: SalesAccountLineEventRow[];
  payments: SalesAccountPaymentRecord[];
  kitchen_ticket_batches: KitchenTicketBatchRecord[];
  kitchen_ticket_lines: KitchenTicketLineRow[];
  events: SalesAccountEventRow[];
};

export type OpenSalesAccountSummary = {
  account: SalesAccountRecord;
  current_assignment: SalesAccountAssignment | null;
  active_line_count: number;
};

export type ListOpenSalesAccountsResult = {
  accounts: OpenSalesAccountSummary[];
  tables: RuntimePosTable[];
};

export type OpenSalesAccountInput = {
  tenantId: string;
  tenantSlug: string;
  kioskId: string;
  openedByPosUserId: string;
  serviceContext: SalesPosServiceContext;
};

export type AssignSalesAccountInput = {
  tenantId: string;
  tenantSlug: string;
  salesAccountId: string;
  assignedByPosUserId: string;
  assignmentType: "walk_in" | "table" | "whatsapp";
  posTableId?: string | null;
  customerName?: string | null;
  customerPhone?: string | null;
  customerExternalId?: string | null;
};

export type AddSimpleSalesAccountLineInput = {
  tenantId: string;
  tenantSlug: string;
  salesAccountId: string;
  createdByPosUserId: string;
  productId: string;
  quantity: number;
  lineNote?: string | null;
};

export type VoidSalesAccountLineInput = {
  tenantId: string;
  salesAccountId: string;
  salesAccountLineId: string;
  voidedByPosUserId: string;
  reason?: string | null;
};

export type CaptureSalesAccountPaymentInput = {
  tenantId: string;
  salesAccountId: string;
  paidByPosUserId: string;
  paymentMethod: SalesPosPaymentMethod;
  amountPaidCents: number;
  amountReceivedCents?: number | null;
  cashShiftId?: string | null;
  externalReference?: string | null;
};

export type CloseSalesAccountInput = {
  tenantId: string;
  salesAccountId: string;
  closedByPosUserId: string;
};

function getImageBaseUrl(): string | null {
  return process.env.NEXT_PUBLIC_SUPABASE_URL
    ? `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/catalog-images`
    : null;
}

function formatFolioText(kioskNumber: number, folioNumber: number): string {
  return `K${kioskNumber}-${String(folioNumber).padStart(6, "0")}`;
}

async function assertKiosk(tenantId: string, kioskId: string): Promise<KioskRow> {
  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .from("kiosks")
    .select("id, tenant_id, number, name, is_active")
    .eq("tenant_id", tenantId)
    .eq("id", kioskId)
    .eq("is_active", true)
    .maybeSingle<KioskRow>();

  if (error) {
    throw new Error(`Unable to load kiosk: ${error.message}`);
  }
  if (!data) {
    throw new Error("Kiosk is not available for this tenant.");
  }
  return data;
}

async function assertPosUser(tenantId: string, posUserId: string): Promise<PosUserRow> {
  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .from("pos_users")
    .select("id, tenant_id, role, is_active, name")
    .eq("tenant_id", tenantId)
    .eq("id", posUserId)
    .eq("is_active", true)
    .maybeSingle<PosUserRow>();

  if (error) {
    throw new Error(`Unable to load POS user: ${error.message}`);
  }
  if (!data) {
    throw new Error("POS user is not active for this tenant.");
  }
  return data;
}

async function assertCashShift(
  tenantId: string,
  cashShiftId: string,
  kioskId?: string | null,
): Promise<CashShiftRow> {
  const supabase = getSupabaseAdminClient();
  let query = supabase
    .from("cash_shifts")
    .select("id, tenant_id, kiosk_id, status")
    .eq("tenant_id", tenantId)
    .eq("id", cashShiftId);

  if (kioskId) {
    query = query.eq("kiosk_id", kioskId);
  }

  const { data, error } = await query.maybeSingle<CashShiftRow>();

  if (error) {
    throw new Error(`Unable to load cash shift: ${error.message}`);
  }
  if (!data) {
    throw new Error("Cash shift is not available for this tenant.");
  }
  return data;
}

async function resolveOperationalCashShiftId(input: {
  tenantId: string;
  cashShiftId?: string | null;
  kioskId?: string | null;
}): Promise<string | null> {
  if (!input.cashShiftId) {
    return null;
  }

  try {
    const shift = await assertCashShift(input.tenantId, input.cashShiftId, input.kioskId);
    return shift.id;
  } catch {
    return null;
  }
}

async function assertPosTable(tenantId: string, posTableId: string): Promise<RuntimePosTable> {
  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .from("pos_tables")
    .select("id, tenant_id, name, sort_order, is_active, deleted_at")
    .eq("tenant_id", tenantId)
    .eq("id", posTableId)
    .eq("is_active", true)
    .is("deleted_at", null)
    .maybeSingle<PosTableRow>();

  if (error) {
    throw new Error(`Unable to load POS table: ${error.message}`);
  }
  if (!data) {
    throw new Error("POS table is not active for this tenant.");
  }

  return {
    id: data.id,
    tenant_id: data.tenant_id,
    name: data.name,
    sort_order: data.sort_order,
  };
}

async function assertSimpleProduct(tenantId: string, productId: string): Promise<SalesPosProduct> {
  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .from("products")
    .select(
      "id, tenant_id, category_id, product_type, class, name, base_price_cents, requires_variant_selection, default_variant_id, is_active, is_sold_out, is_popular, image_path, deleted_at, updated_at",
    )
    .eq("tenant_id", tenantId)
    .eq("id", productId)
    .eq("product_type", "simple")
    .eq("is_active", true)
    .is("deleted_at", null)
    .maybeSingle<SalesPosProduct>();

  if (error) {
    throw new Error(`Unable to load product: ${error.message}`);
  }
  if (!data) {
    throw new Error("Product is not available for simple-line sales.");
  }
  if (data.is_sold_out) {
    throw new Error("Product is sold out.");
  }
  if (typeof data.base_price_cents !== "number") {
    throw new Error("Simple product must define a base price.");
  }
  return data;
}

async function nextFolioForKiosk(
  tenantId: string,
  kiosk: KioskRow,
): Promise<{ folioNumber: number; folioText: string }> {
  const supabase = getSupabaseAdminClient();

  for (let attempt = 0; attempt < 5; attempt += 1) {
    const { data: existing, error: selectError } = await supabase
      .from("kiosk_folio_counters")
      .select("kiosk_id, tenant_id, last_folio")
      .eq("tenant_id", tenantId)
      .eq("kiosk_id", kiosk.id)
      .maybeSingle<{ kiosk_id: string; tenant_id: string; last_folio: number }>();

    if (selectError) {
      throw new Error(`Unable to read kiosk folio counter: ${selectError.message}`);
    }

    if (!existing) {
      const { error: insertError } = await supabase
        .from("kiosk_folio_counters")
        .insert({
          kiosk_id: kiosk.id,
          tenant_id: tenantId,
          last_folio: 0,
        });

      if (insertError && !insertError.message.toLowerCase().includes("duplicate")) {
        throw new Error(`Unable to initialize kiosk folio counter: ${insertError.message}`);
      }
      continue;
    }

    const nextFolio = existing.last_folio + 1;
    const { data: updatedRows, error: updateError } = await supabase
      .from("kiosk_folio_counters")
      .update({
        last_folio: nextFolio,
        updated_at: new Date().toISOString(),
      })
      .eq("tenant_id", tenantId)
      .eq("kiosk_id", kiosk.id)
      .eq("last_folio", existing.last_folio)
      .select("last_folio");

    if (updateError) {
      throw new Error(`Unable to increment kiosk folio counter: ${updateError.message}`);
    }

    if ((updatedRows || []).length === 1) {
      return {
        folioNumber: nextFolio,
        folioText: formatFolioText(kiosk.number, nextFolio),
      };
    }
  }

  throw new Error("Unable to allocate folio after several attempts.");
}

export async function reserveNextSalesAccountFolio(input: {
  tenantId: string;
  kioskId: string;
}): Promise<{ folioNumber: number; folioText: string }> {
  const kiosk = await assertKiosk(input.tenantId, input.kioskId);
  return nextFolioForKiosk(input.tenantId, kiosk);
}

async function recomputeSalesAccount(input: {
  tenantId: string;
  salesAccountId: string;
  accountVersion?: number;
  kitchenTicketSequence?: number;
}): Promise<SalesAccountRecord> {
  const supabase = getSupabaseAdminClient();

  const [linesResult, paymentsResult, accountResult] = await Promise.all([
    supabase
      .from("sales_account_lines")
      .select("line_total_cents")
      .eq("tenant_id", input.tenantId)
      .eq("sales_account_id", input.salesAccountId)
      .eq("line_status", "active"),
    supabase
      .from("sales_account_payments")
      .select("amount_paid_cents")
      .eq("tenant_id", input.tenantId)
      .eq("sales_account_id", input.salesAccountId)
      .eq("payment_status", "captured"),
    supabase
      .from("sales_accounts")
      .select(
        "id, tenant_id, kiosk_id, service_context, status, folio_number, folio_text, subtotal_cents, discount_cents, total_cents, payments_total_cents, balance_due_cents, account_version, kitchen_ticket_sequence, opened_at, closed_at, canceled_at",
      )
      .eq("tenant_id", input.tenantId)
      .eq("id", input.salesAccountId)
      .maybeSingle<SalesAccountRecord>(),
  ]);

  if (linesResult.error) {
    throw new Error(`Unable to recompute account lines: ${linesResult.error.message}`);
  }
  if (paymentsResult.error) {
    throw new Error(`Unable to recompute account payments: ${paymentsResult.error.message}`);
  }
  if (accountResult.error || !accountResult.data) {
    throw new Error(
      `Unable to load sales account: ${
        accountResult.error?.message || "Sales account not found."
      }`,
    );
  }

  const subtotalCents = (linesResult.data || []).reduce(
    (sum, row) => sum + Number(row.line_total_cents || 0),
    0,
  );
  const paymentsTotalCents = (paymentsResult.data || []).reduce(
    (sum, row) => sum + Number(row.amount_paid_cents || 0),
    0,
  );
  const discountCents = accountResult.data.discount_cents ?? 0;
  const totalCents = subtotalCents - discountCents;
  const balanceDueCents = Math.max(totalCents - paymentsTotalCents, 0);

  const updatePayload = {
    subtotal_cents: subtotalCents,
    total_cents: totalCents,
    payments_total_cents: paymentsTotalCents,
    balance_due_cents: balanceDueCents,
    updated_at: new Date().toISOString(),
    ...(typeof input.accountVersion === "number"
      ? { account_version: input.accountVersion }
      : {}),
    ...(typeof input.kitchenTicketSequence === "number"
      ? { kitchen_ticket_sequence: input.kitchenTicketSequence }
      : {}),
  };

  const { data: updated, error: updateError } = await supabase
    .from("sales_accounts")
    .update(updatePayload)
    .eq("tenant_id", input.tenantId)
    .eq("id", input.salesAccountId)
    .select(
      "id, tenant_id, kiosk_id, service_context, status, folio_number, folio_text, subtotal_cents, discount_cents, total_cents, payments_total_cents, balance_due_cents, account_version, kitchen_ticket_sequence, opened_at, closed_at, canceled_at",
    )
    .single<SalesAccountRecord>();

  if (updateError) {
    throw new Error(`Unable to persist account totals: ${updateError.message}`);
  }

  return updated;
}

async function appendAccountEvent(input: {
  tenantId: string;
  salesAccountId: string;
  actorPosUserId: string | null;
  eventType: SalesAccountEventRow["event_type"];
  mutationId?: string | null;
  meta?: Record<string, unknown>;
}): Promise<void> {
  const supabase = getSupabaseAdminClient();
  const { error } = await supabase.from("sales_account_events").insert({
    tenant_id: input.tenantId,
    sales_account_id: input.salesAccountId,
    mutation_id: input.mutationId ?? null,
    event_type: input.eventType,
    actor_pos_user_id: input.actorPosUserId,
    meta: input.meta ?? {},
  });

  if (error) {
    if (
      input.mutationId &&
      /sales_account_events_mutation_uidx|duplicate key value/i.test(error.message)
    ) {
      const { data: existingEvent, error: existingEventError } = await supabase
        .from("sales_account_events")
        .select("tenant_id, sales_account_id")
        .eq("mutation_id", input.mutationId)
        .maybeSingle<{ tenant_id: string; sales_account_id: string }>();

      if (existingEventError) {
        throw new Error(
          `Unable to verify duplicated sales account event mutation: ${existingEventError.message}`,
        );
      }

      if (
        existingEvent &&
        existingEvent.tenant_id === input.tenantId &&
        existingEvent.sales_account_id === input.salesAccountId
      ) {
        return;
      }
    }

    throw new Error(`Unable to append sales account event: ${error.message}`);
  }
}

async function releaseCurrentAssignments(input: {
  tenantId: string;
  salesAccountId: string;
  releasedByPosUserId: string;
}): Promise<void> {
  const supabase = getSupabaseAdminClient();
  const nowIso = new Date().toISOString();
  const { error } = await supabase
    .from("sales_account_assignments")
    .update({
      is_current: false,
      released_at: nowIso,
      released_by_pos_user_id: input.releasedByPosUserId,
      updated_at: nowIso,
    })
    .eq("tenant_id", input.tenantId)
    .eq("sales_account_id", input.salesAccountId)
    .eq("is_current", true);

  if (error) {
    throw new Error(`Unable to release current assignment: ${error.message}`);
  }
}

async function listAssignmentsForAccounts(
  tenantId: string,
  salesAccountIds: string[],
): Promise<SalesAccountAssignment[]> {
  if (salesAccountIds.length === 0) return [];
  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .from("sales_account_assignments")
    .select(
      "id, sales_account_id, assignment_type, pos_table_id, table_label, customer_name, customer_phone, customer_external_id, is_current, assigned_at, released_at",
    )
    .eq("tenant_id", tenantId)
    .in("sales_account_id", salesAccountIds)
    .order("assigned_at", { ascending: false });

  if (error) {
    throw new Error(`Unable to load account assignments: ${error.message}`);
  }

  return (data || []) as SalesAccountAssignment[];
}

async function getSalesAccountRecord(
  tenantId: string,
  salesAccountId: string,
): Promise<SalesAccountRecord> {
  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .from("sales_accounts")
    .select(
      "id, tenant_id, kiosk_id, service_context, status, folio_number, folio_text, subtotal_cents, discount_cents, total_cents, payments_total_cents, balance_due_cents, account_version, kitchen_ticket_sequence, opened_at, closed_at, canceled_at",
    )
    .eq("tenant_id", tenantId)
    .eq("id", salesAccountId)
    .maybeSingle<SalesAccountRecord>();

  if (error) {
    throw new Error(`Unable to load sales account: ${error.message}`);
  }
  if (!data) {
    throw new Error("Sales account not found.");
  }
  return data;
}

function asObjectRecord(value: unknown, label: string): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`${label} is invalid.`);
  }
  return value as Record<string, unknown>;
}

function asOptionalObjectRecord(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }
  return value as Record<string, unknown>;
}

function asString(value: unknown, label: string): string {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(`${label} is required.`);
  }
  return value.trim();
}

function asOptionalString(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}

function asIntegerStrict(value: unknown, label: string): number {
  if (typeof value === "number" && Number.isFinite(value)) {
    return Math.trunc(value);
  }
  if (typeof value === "string" && value.trim().length > 0) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) {
      return Math.trunc(parsed);
    }
  }
  throw new Error(`${label} is invalid.`);
}

function asBoolean(value: unknown, label: string): boolean {
  if (typeof value !== "boolean") {
    throw new Error(`${label} is invalid.`);
  }
  return value;
}

function asOptionalArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function parseSyncAccountPayload(value: unknown): SyncAccountPayload {
  const record = asObjectRecord(value, "account");
  const status = asString(record.status, "account.status");
  const serviceContext = asString(record.serviceContext, "account.serviceContext");
  if (status !== "OPEN" && status !== "PAID" && status !== "CANCELED") {
    throw new Error("account.status is invalid.");
  }
  if (
    serviceContext !== "walk_in" &&
    serviceContext !== "table_service" &&
    serviceContext !== "whatsapp_pickup"
  ) {
    throw new Error("account.serviceContext is invalid.");
  }

  return {
    id: asString(record.id, "account.id"),
    kioskId: asString(record.kioskId, "account.kioskId"),
    serviceContext,
    status,
    folioNumber: asIntegerStrict(record.folioNumber, "account.folioNumber"),
    folioText: asString(record.folioText, "account.folioText"),
    subtotalCents: asIntegerStrict(record.subtotalCents, "account.subtotalCents"),
    discountCents: asIntegerStrict(record.discountCents, "account.discountCents"),
    totalCents: asIntegerStrict(record.totalCents, "account.totalCents"),
    paymentsTotalCents: asIntegerStrict(
      record.paymentsTotalCents,
      "account.paymentsTotalCents",
    ),
    balanceDueCents: asIntegerStrict(record.balanceDueCents, "account.balanceDueCents"),
    accountVersion: asIntegerStrict(record.accountVersion, "account.accountVersion"),
    kitchenTicketSequence: asIntegerStrict(
      record.kitchenTicketSequence,
      "account.kitchenTicketSequence",
    ),
    openedAt: asString(record.openedAt, "account.openedAt"),
    closedAt: asOptionalString(record.closedAt),
    canceledAt: asOptionalString(record.canceledAt),
  };
}

function parseSyncAssignmentPayload(value: unknown): SyncAssignmentPayload {
  const record = asObjectRecord(value, "assignment");
  const assignmentType = asString(record.assignmentType, "assignment.assignmentType");
  if (
    assignmentType !== "walk_in" &&
    assignmentType !== "table" &&
    assignmentType !== "whatsapp"
  ) {
    throw new Error("assignment.assignmentType is invalid.");
  }

  return {
    id: asString(record.id, "assignment.id"),
    accountId: asString(record.accountId, "assignment.accountId"),
    assignmentType,
    posTableId: asOptionalString(record.posTableId),
    tableLabel: asOptionalString(record.tableLabel),
    customerName: asOptionalString(record.customerName),
    customerPhone: asOptionalString(record.customerPhone),
    customerExternalId: asOptionalString(record.customerExternalId),
    isCurrent: asBoolean(record.isCurrent, "assignment.isCurrent"),
    assignedAt: asString(record.assignedAt, "assignment.assignedAt"),
    releasedAt: asOptionalString(record.releasedAt),
  };
}

function parseSyncSelectedVariantPayload(value: unknown): SyncSelectedVariantPayload {
  const record = asObjectRecord(value, "line.selectedVariant");
  return {
    variantId: asString(record.variantId, "line.selectedVariant.variantId"),
    productId: asString(record.productId, "line.selectedVariant.productId"),
    name: asString(record.name, "line.selectedVariant.name"),
    unitBasePriceCents: asIntegerStrict(
      record.unitBasePriceCents,
      "line.selectedVariant.unitBasePriceCents",
    ),
  };
}

function parseSyncSelectedModifierPayload(value: unknown): SyncSelectedModifierPayload {
  const record = asObjectRecord(value, "line.selectedModifiers[]");
  return {
    modifierGroupId: asString(record.modifierGroupId, "modifier.modifierGroupId"),
    modifierGroupName: asString(record.modifierGroupName, "modifier.modifierGroupName"),
    modifierOptionId: asString(record.modifierOptionId, "modifier.modifierOptionId"),
    modifierOptionName: asString(record.modifierOptionName, "modifier.modifierOptionName"),
    priceDeltaCents: asIntegerStrict(record.priceDeltaCents, "modifier.priceDeltaCents"),
    quantity: asIntegerStrict(record.quantity, "modifier.quantity"),
  };
}

function parseSyncSelectedComboSlotPayload(value: unknown): SyncSelectedComboSlotPayload {
  const record = asObjectRecord(value, "line.selectedComboSlots[]");
  return {
    comboSlotId: asString(record.comboSlotId, "comboSlot.comboSlotId"),
    comboSlotKey: asString(record.comboSlotKey, "comboSlot.comboSlotKey"),
    comboSlotName: asString(record.comboSlotName, "comboSlot.comboSlotName"),
    comboSlotOptionId: asString(record.comboSlotOptionId, "comboSlot.comboSlotOptionId"),
    comboSlotOptionName: asString(record.comboSlotOptionName, "comboSlot.comboSlotOptionName"),
    linkedProductId: asOptionalString(record.linkedProductId),
    linkedSellableVariantId: asOptionalString(record.linkedSellableVariantId),
    priceDeltaCents: asIntegerStrict(record.priceDeltaCents, "comboSlot.priceDeltaCents"),
    quantity: asIntegerStrict(record.quantity, "comboSlot.quantity"),
    componentProductId: asOptionalString(record.componentProductId),
    componentProductName: asOptionalString(record.componentProductName),
    componentVariantId: asOptionalString(record.componentVariantId),
    componentVariantName: asOptionalString(record.componentVariantName),
    selectedComponentModifiers: asOptionalArray(record.selectedComponentModifiers).map(
      parseSyncSelectedModifierPayload,
    ),
    componentNote: asOptionalString(record.componentNote),
    componentDisplayName: asOptionalString(record.componentDisplayName),
    componentKitchenDisplayName: asOptionalString(record.componentKitchenDisplayName),
    componentSelectionSignature: asOptionalString(record.componentSelectionSignature),
  };
}

function parseSyncLinePayload(value: unknown): SyncLinePayload {
  const record = asObjectRecord(value, "line");
  const lineKind = asString(record.lineKind, "line.lineKind");
  const lineStatus = asString(record.lineStatus, "line.lineStatus");
  if (lineKind !== "simple" && lineKind !== "configurable" && lineKind !== "combo") {
    throw new Error("line.lineKind is invalid.");
  }
  if (lineStatus !== "active" && lineStatus !== "voided") {
    throw new Error("line.lineStatus is invalid.");
  }
  return {
    id: asString(record.id, "line.id"),
    accountId: asString(record.accountId, "line.accountId"),
    lineKind,
    lineStatus,
    productId: asString(record.productId, "line.productId"),
    selectedVariant: record.selectedVariant
      ? parseSyncSelectedVariantPayload(record.selectedVariant)
      : null,
    selectedComboSlots: asOptionalArray(record.selectedComboSlots).map(
      parseSyncSelectedComboSlotPayload,
    ),
    selectedModifiers: asOptionalArray(record.selectedModifiers).map(
      parseSyncSelectedModifierPayload,
    ),
    quantity: asIntegerStrict(record.quantity, "line.quantity"),
    kitchenSentQuantity: asIntegerStrict(
      record.kitchenSentQuantity,
      "line.kitchenSentQuantity",
    ),
    unitBasePriceCents: asIntegerStrict(record.unitBasePriceCents, "line.unitBasePriceCents"),
    unitComboSlotsTotalCents: asIntegerStrict(
      record.unitComboSlotsTotalCents,
      "line.unitComboSlotsTotalCents",
    ),
    unitModifiersTotalCents: asIntegerStrict(
      record.unitModifiersTotalCents,
      "line.unitModifiersTotalCents",
    ),
    unitFinalPriceCents: asIntegerStrict(
      record.unitFinalPriceCents,
      "line.unitFinalPriceCents",
    ),
    lineTotalCents: asIntegerStrict(record.lineTotalCents, "line.lineTotalCents"),
    lineNote: asOptionalString(record.lineNote),
    pricingSnapshot: asOptionalObjectRecord(record.pricingSnapshot),
    displaySnapshot: asOptionalObjectRecord(record.displaySnapshot),
    kitchenSnapshot: asOptionalObjectRecord(record.kitchenSnapshot),
    reportingSnapshot: asOptionalObjectRecord(record.reportingSnapshot),
    createdAt: asString(record.createdAt, "line.createdAt"),
    updatedAt: asString(record.updatedAt, "line.updatedAt"),
    voidedAt: asOptionalString(record.voidedAt),
  };
}

function parseSyncLineEventPayload(value: unknown): SyncLineEventPayload {
  const record = asObjectRecord(value, "lineEvent");
  const eventType = asString(record.eventType, "lineEvent.eventType");
  if (
    eventType !== "line_added" &&
    eventType !== "line_updated" &&
    eventType !== "line_voided"
  ) {
    throw new Error("lineEvent.eventType is invalid.");
  }
  return {
    id: asString(record.id, "lineEvent.id"),
    salesAccountId: asString(record.salesAccountId, "lineEvent.salesAccountId"),
    salesAccountLineId: asString(record.salesAccountLineId, "lineEvent.salesAccountLineId"),
    mutationId: asOptionalString(record.mutationId),
    eventType,
    actorPosUserId: asOptionalString(record.actorPosUserId),
    quantityDelta: asIntegerStrict(record.quantityDelta, "lineEvent.quantityDelta"),
    meta: asOptionalObjectRecord(record.meta),
    createdAt: asString(record.createdAt, "lineEvent.createdAt"),
  };
}

function parseSyncPaymentPayload(value: unknown): SyncPaymentPayload {
  const record = asObjectRecord(value, "payment");
  const paymentMethod = asString(record.paymentMethod, "payment.paymentMethod");
  if (paymentMethod !== "cash" && paymentMethod !== "card" && paymentMethod !== "transfer") {
    throw new Error("payment.paymentMethod is invalid.");
  }
  return {
    id: asString(record.id, "payment.id"),
    accountId: asString(record.accountId, "payment.accountId"),
    paymentSequence: asIntegerStrict(record.paymentSequence, "payment.paymentSequence"),
    paymentMethod,
    amountPaidCents: asIntegerStrict(record.amountPaidCents, "payment.amountPaidCents"),
    amountReceivedCents:
      record.amountReceivedCents == null
        ? null
        : asIntegerStrict(record.amountReceivedCents, "payment.amountReceivedCents"),
    changeCents: asIntegerStrict(record.changeCents, "payment.changeCents"),
    paidAt: asString(record.paidAt, "payment.paidAt"),
  };
}

function parseSyncKitchenBatchPayload(value: unknown): SyncKitchenBatchPayload {
  const record = asObjectRecord(value, "kitchenBatch");
  const triggerType = asString(record.triggerType, "kitchenBatch.triggerType");
  const batchStatus = asString(record.batchStatus, "kitchenBatch.batchStatus");
  if (
    triggerType !== "account_opened" &&
    triggerType !== "line_added" &&
    triggerType !== "line_updated" &&
    triggerType !== "line_voided" &&
    triggerType !== "manual_reprint"
  ) {
    throw new Error("kitchenBatch.triggerType is invalid.");
  }
  if (
    batchStatus !== "pending" &&
    batchStatus !== "sent" &&
    batchStatus !== "confirmed" &&
    batchStatus !== "failed" &&
    batchStatus !== "canceled"
  ) {
    throw new Error("kitchenBatch.batchStatus is invalid.");
  }
  return {
    id: asString(record.id, "kitchenBatch.id"),
    accountId: asString(record.accountId, "kitchenBatch.accountId"),
    batchNumber: asIntegerStrict(record.batchNumber, "kitchenBatch.batchNumber"),
    batchStatus,
    triggerType,
    accountVersionFrom: asIntegerStrict(
      record.accountVersionFrom,
      "kitchenBatch.accountVersionFrom",
    ),
    accountVersionTo: asIntegerStrict(
      record.accountVersionTo,
      "kitchenBatch.accountVersionTo",
    ),
    requestedAt: asString(record.requestedAt, "kitchenBatch.requestedAt"),
    printedAt: asOptionalString(record.printedAt),
  };
}

function parseSyncKitchenLinePayload(value: unknown): SyncKitchenLinePayload {
  const record = asObjectRecord(value, "kitchenLines[]");
  const ticketAction = asString(record.ticketAction, "kitchenLine.ticketAction");
  if (ticketAction !== "add" && ticketAction !== "adjust" && ticketAction !== "void") {
    throw new Error("kitchenLine.ticketAction is invalid.");
  }
  return {
    id: asString(record.id, "kitchenLine.id"),
    kitchenTicketBatchId: asString(
      record.kitchenTicketBatchId,
      "kitchenLine.kitchenTicketBatchId",
    ),
    salesAccountId: asString(record.salesAccountId, "kitchenLine.salesAccountId"),
    salesAccountLineId: asString(record.salesAccountLineId, "kitchenLine.salesAccountLineId"),
    salesAccountLineEventId: asOptionalString(record.salesAccountLineEventId),
    ticketAction,
    quantityDelta: asIntegerStrict(record.quantityDelta, "kitchenLine.quantityDelta"),
    productNameSnapshot: asString(record.productNameSnapshot, "kitchenLine.productNameSnapshot"),
    variantNameSnapshot: asOptionalString(record.variantNameSnapshot),
    lineNoteSnapshot: asOptionalString(record.lineNoteSnapshot),
    createdAt: asString(record.createdAt, "kitchenLine.createdAt"),
  };
}

function parseSyncAccountEventPayload(value: unknown): SyncAccountEventPayload {
  const record = asObjectRecord(value, "accountEvent");
  const eventType = asString(record.eventType, "accountEvent.eventType");
  const validEventTypes = new Set([
    "account_opened",
    "assignment_set",
    "assignment_released",
    "line_added",
    "line_updated",
    "line_voided",
    "kitchen_batch_requested",
    "payment_captured",
    "account_closed",
    "account_canceled",
  ]);
  if (!validEventTypes.has(eventType)) {
    throw new Error("accountEvent.eventType is invalid.");
  }
  return {
    id: asString(record.id, "accountEvent.id"),
    salesAccountId: asString(record.salesAccountId, "accountEvent.salesAccountId"),
    mutationId: asOptionalString(record.mutationId),
    eventType: eventType as SyncAccountEventPayload["eventType"],
    actorPosUserId: asOptionalString(record.actorPosUserId),
    meta: asOptionalObjectRecord(record.meta),
    createdAt: asString(record.createdAt, "accountEvent.createdAt"),
  };
}

function readPayloadValue(
  payload: unknown,
  key: string,
): unknown {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return undefined;
  }
  return (payload as Record<string, unknown>)[key];
}

async function hasExistingMutation(
  tenantId: string,
  mutationType: SyncSalesAccountMutationInput["mutationType"],
  mutationId: string,
): Promise<boolean> {
  const supabase = getSupabaseAdminClient();
  const tableName =
    mutationType === "sales_account.kitchen_batch_requested"
      ? "kitchen_ticket_batches"
      : mutationType === "sales_account.line_added" ||
          mutationType === "sales_account.line_updated" ||
          mutationType === "sales_account.line_voided"
        ? "sales_account_line_events"
        : mutationType === "sales_account.opened"
          ? "sales_accounts"
          : "sales_account_events";
  const columnName =
    mutationType === "sales_account.opened" ? "last_mutation_id" : "mutation_id";

  const { data, error } = await supabase
    .from(tableName)
    .select("id")
    .eq("tenant_id", tenantId)
    .eq(columnName, mutationId)
    .limit(1);

  if (error) {
    throw new Error(`Unable to verify sync mutation idempotency: ${error.message}`);
  }

  return (data || []).length > 0;
}

async function ensureSalesAccountExistsForSync(
  tenantId: string,
  salesAccountId: string,
): Promise<SalesAccountRecord> {
  return getSalesAccountRecord(tenantId, salesAccountId);
}

function lineEventTypeForSync(input: SyncLineEventPayload): SalesAccountLineEventRow["event_type"] {
  if (input.eventType === "line_added") {
    return "line_added";
  }
  if (input.eventType === "line_voided") {
    return "line_voided";
  }
  if (input.quantityDelta > 0) {
    return "qty_increased";
  }
  if (input.quantityDelta < 0) {
    return "qty_decreased";
  }
  return "line_note_updated";
}

export async function getSalesPosCatalog(input: {
  tenantId: string;
  tenantSlug: string;
}): Promise<SalesPosCatalogV2Response> {
  const supabase = getSupabaseAdminClient();

  const [
    categoriesResult,
    productsResult,
    variantsResult,
    modifierGroupsResult,
    modifierOptionsResult,
    assignmentsResult,
    comboSlotsResult,
    comboSlotOptionsResult,
  ] = await Promise.all([
    supabase
      .from("catalog_categories")
      .select("id, tenant_id, name, sort_order, is_active, image_path, deleted_at, updated_at")
      .eq("tenant_id", input.tenantId)
      .eq("is_active", true)
      .is("deleted_at", null)
      .order("sort_order", { ascending: true })
      .order("name", { ascending: true }),
    supabase
      .from("products")
      .select(
        "id, tenant_id, category_id, product_type, class, name, base_price_cents, requires_variant_selection, default_variant_id, is_active, is_sold_out, is_popular, image_path, deleted_at, updated_at",
      )
      .eq("tenant_id", input.tenantId)
      .eq("is_active", true)
      .is("deleted_at", null)
      .order("name", { ascending: true }),
    supabase
      .from("sellable_variants")
      .select(
        "id, tenant_id, product_id, name, price_cents, is_default, is_active, sort_order, barcode, sku, deleted_at, updated_at",
      )
      .eq("tenant_id", input.tenantId)
      .eq("is_active", true)
      .is("deleted_at", null)
      .order("sort_order", { ascending: true }),
    supabase
      .from("modifier_groups")
      .select(
        "id, tenant_id, name, selection_mode, is_required, min_selected, max_selected, display_scope, is_active, sort_order, updated_at",
      )
      .eq("tenant_id", input.tenantId)
      .eq("is_active", true)
      .order("sort_order", { ascending: true }),
    supabase
      .from("modifier_options")
      .select(
        "id, tenant_id, modifier_group_id, name, price_delta_cents, is_default, is_active, sort_order, reporting_key, updated_at",
      )
      .eq("tenant_id", input.tenantId)
      .eq("is_active", true)
      .order("sort_order", { ascending: true }),
    supabase
      .from("product_modifier_group_assignments")
      .select(
        "id, tenant_id, product_id, modifier_group_id, is_required_override, min_selected_override, max_selected_override, sort_order, is_active, updated_at",
      )
      .eq("tenant_id", input.tenantId)
      .eq("is_active", true)
      .order("sort_order", { ascending: true }),
    supabase
      .from("combo_slots")
      .select(
        "id, tenant_id, product_id, slot_key, name, selection_mode, min_selected, max_selected, sort_order, is_active, updated_at",
      )
      .eq("tenant_id", input.tenantId)
      .eq("is_active", true)
      .order("sort_order", { ascending: true }),
    supabase
      .from("combo_slot_options")
      .select(
        "id, tenant_id, combo_slot_id, name, linked_product_id, linked_sellable_variant_id, price_delta_cents, is_default, is_active, sort_order, reporting_key, updated_at",
      )
      .eq("tenant_id", input.tenantId)
      .eq("is_active", true)
      .order("sort_order", { ascending: true }),
  ]);

  const failures = [
    categoriesResult.error && `categories: ${categoriesResult.error.message}`,
    productsResult.error && `products: ${productsResult.error.message}`,
    variantsResult.error && `sellable_variants: ${variantsResult.error.message}`,
    modifierGroupsResult.error &&
      `modifier_groups: ${modifierGroupsResult.error.message}`,
    modifierOptionsResult.error &&
      `modifier_options: ${modifierOptionsResult.error.message}`,
    assignmentsResult.error &&
      `product_modifier_group_assignments: ${assignmentsResult.error.message}`,
    comboSlotsResult.error && `combo_slots: ${comboSlotsResult.error.message}`,
    comboSlotOptionsResult.error &&
      `combo_slot_options: ${comboSlotOptionsResult.error.message}`,
  ].filter(Boolean);

  if (failures.length > 0) {
    throw new Error(`Unable to load canonical POS catalog: ${failures.join("; ")}`);
  }

  return {
    tenantId: input.tenantId,
    tenantSlug: input.tenantSlug,
    syncedAt: new Date().toISOString(),
    incremental: false,
    catalogVersion: `products:${(productsResult.data || []).length}`,
    imageBaseUrl: getImageBaseUrl(),
    categories: (categoriesResult.data || []) as SalesPosCategory[],
    products: (productsResult.data || []) as SalesPosProduct[],
    sellable_variants: (variantsResult.data || []) as SalesPosSellableVariant[],
    modifier_groups: (modifierGroupsResult.data || []) as SalesPosModifierGroup[],
    modifier_options: (modifierOptionsResult.data || []) as SalesPosModifierOption[],
    product_modifier_group_assignments:
      (assignmentsResult.data || []) as SalesPosProductModifierGroupAssignment[],
    combo_slots: (comboSlotsResult.data || []) as SalesPosComboSlot[],
    combo_slot_options:
      (comboSlotOptionsResult.data || []) as SalesPosComboSlotOption[],
  };
}

export async function listRuntimePosTables(input: {
  tenantId: string;
}): Promise<RuntimePosTable[]> {
  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .from("pos_tables")
    .select("id, tenant_id, name, sort_order, is_active, deleted_at")
    .eq("tenant_id", input.tenantId)
    .eq("is_active", true)
    .is("deleted_at", null)
    .order("sort_order", { ascending: true })
    .order("name", { ascending: true });

  if (error) {
    throw new Error(`Unable to load POS tables: ${error.message}`);
  }

  return ((data || []) as PosTableRow[]).map((table) => ({
    id: table.id,
    tenant_id: table.tenant_id,
    name: table.name,
    sort_order: table.sort_order,
  }));
}

export async function listOpenSalesAccounts(input: {
  tenantId: string;
}): Promise<ListOpenSalesAccountsResult> {
  const supabase = getSupabaseAdminClient();
  const [{ data: accountsData, error: accountsError }, tables] = await Promise.all([
    supabase
      .from("sales_accounts")
      .select(
        "id, tenant_id, kiosk_id, service_context, status, folio_number, folio_text, subtotal_cents, discount_cents, total_cents, payments_total_cents, balance_due_cents, account_version, kitchen_ticket_sequence, opened_at, closed_at, canceled_at",
      )
      .eq("tenant_id", input.tenantId)
      .eq("status", "OPEN")
      .order("opened_at", { ascending: false }),
    listRuntimePosTables({ tenantId: input.tenantId }),
  ]);

  if (accountsError) {
    throw new Error(`Unable to load open sales accounts: ${accountsError.message}`);
  }

  const accounts = (accountsData || []) as SalesAccountRecord[];
  const accountIds = accounts.map((account) => account.id);
  const [assignments, lineRowsResult] = await Promise.all([
    listAssignmentsForAccounts(input.tenantId, accountIds),
    accountIds.length > 0
      ? supabase
          .from("sales_account_lines")
          .select("sales_account_id, id")
          .eq("tenant_id", input.tenantId)
          .eq("line_status", "active")
          .in("sales_account_id", accountIds)
      : Promise.resolve({ data: [], error: null }),
  ]);

  if (lineRowsResult.error) {
    throw new Error(`Unable to count active account lines: ${lineRowsResult.error.message}`);
  }

  const lineCountByAccountId = (lineRowsResult.data || []).reduce<Record<string, number>>(
    (acc, row) => {
      const accountId = String((row as { sales_account_id: string }).sales_account_id);
      acc[accountId] = (acc[accountId] || 0) + 1;
      return acc;
    },
    {},
  );

  const currentAssignmentByAccountId = new Map<string, SalesAccountAssignment>();
  assignments
    .filter((assignment) => assignment.is_current)
    .forEach((assignment) => {
      if (!currentAssignmentByAccountId.has(assignment.sales_account_id)) {
        currentAssignmentByAccountId.set(assignment.sales_account_id, assignment);
      }
    });

  return {
    accounts: accounts.map((account) => ({
      account,
      current_assignment: currentAssignmentByAccountId.get(account.id) || null,
      active_line_count: lineCountByAccountId[account.id] || 0,
    })),
    tables,
  };
}

export async function openSalesAccount(
  input: OpenSalesAccountInput,
): Promise<SalesAccountDetail> {
  const supabase = getSupabaseAdminClient();
  const [kiosk] = await Promise.all([
    assertKiosk(input.tenantId, input.kioskId),
    assertPosUser(input.tenantId, input.openedByPosUserId),
  ]);
  const folio = await nextFolioForKiosk(input.tenantId, kiosk);

  const { data, error } = await supabase
    .from("sales_accounts")
    .insert({
      tenant_id: input.tenantId,
      kiosk_id: input.kioskId,
      service_context: input.serviceContext,
      status: "OPEN",
      folio_number: folio.folioNumber,
      folio_text: folio.folioText,
      subtotal_cents: 0,
      discount_cents: 0,
      total_cents: 0,
      payments_total_cents: 0,
      balance_due_cents: 0,
      account_version: 0,
      kitchen_ticket_sequence: 0,
      opened_by_pos_user_id: input.openedByPosUserId,
    })
    .select(
      "id, tenant_id, kiosk_id, service_context, status, folio_number, folio_text, subtotal_cents, discount_cents, total_cents, payments_total_cents, balance_due_cents, account_version, kitchen_ticket_sequence, opened_at, closed_at, canceled_at",
    )
    .single<SalesAccountRecord>();

  if (error) {
    throw new Error(`Unable to open sales account: ${error.message}`);
  }

  await appendAccountEvent({
    tenantId: input.tenantId,
    salesAccountId: data.id,
    actorPosUserId: input.openedByPosUserId,
    eventType: "account_opened",
    meta: {
      kiosk_id: input.kioskId,
      service_context: input.serviceContext,
      folio_text: data.folio_text,
    },
  });

  return getSalesAccountById({
    tenantId: input.tenantId,
    salesAccountId: data.id,
  });
}

export async function assignSalesAccount(
  input: AssignSalesAccountInput,
): Promise<SalesAccountDetail> {
  const supabase = getSupabaseAdminClient();
  const account = await getSalesAccountRecord(input.tenantId, input.salesAccountId);
  if (account.status !== "OPEN") {
    throw new Error("Only open sales accounts can be reassigned.");
  }

  await assertPosUser(input.tenantId, input.assignedByPosUserId);

  let tableLabel: string | null = null;
  if (input.assignmentType === "table") {
    if (!input.posTableId) {
      throw new Error("Table assignment requires posTableId.");
    }
    const table = await assertPosTable(input.tenantId, input.posTableId);
    tableLabel = table.name;
  }

  await releaseCurrentAssignments({
    tenantId: input.tenantId,
    salesAccountId: input.salesAccountId,
    releasedByPosUserId: input.assignedByPosUserId,
  });

  const { error } = await supabase.from("sales_account_assignments").insert({
    tenant_id: input.tenantId,
    sales_account_id: input.salesAccountId,
    assignment_type: input.assignmentType,
    pos_table_id: input.assignmentType === "table" ? input.posTableId || null : null,
    table_label: tableLabel,
    customer_name: input.customerName?.trim() || null,
    customer_phone: input.customerPhone?.trim() || null,
    customer_external_id: input.customerExternalId?.trim() || null,
    is_current: true,
    assigned_by_pos_user_id: input.assignedByPosUserId,
  });

  if (error) {
    throw new Error(`Unable to assign sales account: ${error.message}`);
  }

  await appendAccountEvent({
    tenantId: input.tenantId,
    salesAccountId: input.salesAccountId,
    actorPosUserId: input.assignedByPosUserId,
    eventType: "assignment_set",
    meta: {
      assignment_type: input.assignmentType,
      pos_table_id: input.posTableId || null,
      table_label: tableLabel,
      customer_name: input.customerName?.trim() || null,
      customer_phone: input.customerPhone?.trim() || null,
      customer_external_id: input.customerExternalId?.trim() || null,
    },
  });

  return getSalesAccountById({
    tenantId: input.tenantId,
    salesAccountId: input.salesAccountId,
  });
}

export async function addSimpleSalesAccountLine(
  input: AddSimpleSalesAccountLineInput,
): Promise<SalesAccountDetail> {
  const supabase = getSupabaseAdminClient();
  const [account, product] = await Promise.all([
    getSalesAccountRecord(input.tenantId, input.salesAccountId),
    assertSimpleProduct(input.tenantId, input.productId),
    assertPosUser(input.tenantId, input.createdByPosUserId),
  ]);

  if (account.status !== "OPEN") {
    throw new Error("Only open sales accounts can accept new lines.");
  }

  const quantity = Math.max(1, Math.trunc(input.quantity));
  const lineId = randomUUID();
  const lineTotalCents = (product.base_price_cents || 0) * quantity;
  const lineNote = input.lineNote?.trim() || null;

  const displaySnapshot = {
    product_name: product.name,
    line_kind: "simple",
  };
  const kitchenSnapshot = {
    product_name: product.name,
    quantity,
    line_note: lineNote,
  };
  const reportingSnapshot = {
    product_name: product.name,
    class: product.class,
    product_type: product.product_type,
  };
  const pricingSnapshot = {
    product_name: product.name,
    unit_base_price_cents: product.base_price_cents,
    source: "runtime_accounts_first",
  };

  const { data: insertedLine, error: lineError } = await supabase
    .from("sales_account_lines")
    .insert({
      id: lineId,
      tenant_id: input.tenantId,
      sales_account_id: input.salesAccountId,
      line_kind: "simple",
      line_status: "active",
      product_id: product.id,
      selected_variant_id: null,
      quantity,
      kitchen_sent_quantity: 0,
      unit_base_price_cents: product.base_price_cents,
      unit_combo_slots_total_cents: 0,
      unit_modifiers_total_cents: 0,
      unit_final_price_cents: product.base_price_cents,
      line_total_cents: lineTotalCents,
      line_note: lineNote,
      product_name_snapshot: product.name,
      variant_name_snapshot: null,
      category_id_snapshot: product.category_id,
      category_name_snapshot: null,
      selected_modifiers_snapshot: [],
      selected_combo_slots_snapshot: [],
      pricing_snapshot: pricingSnapshot,
      display_snapshot: displaySnapshot,
      kitchen_snapshot: kitchenSnapshot,
      reporting_snapshot: reportingSnapshot,
      line_version: 1,
      last_mutation_id: randomUUID(),
    })
    .select(
      "id, tenant_id, sales_account_id, line_kind, line_status, product_id, selected_variant_id, quantity, kitchen_sent_quantity, unit_base_price_cents, unit_combo_slots_total_cents, unit_modifiers_total_cents, unit_final_price_cents, line_total_cents, line_note, pricing_snapshot, display_snapshot, kitchen_snapshot, reporting_snapshot, created_at, updated_at, voided_at",
    )
    .single<SalesAccountLineRow>();

  if (lineError) {
    throw new Error(`Unable to add simple sales account line: ${lineError.message}`);
  }

  const { data: lineEvent, error: lineEventError } = await supabase
    .from("sales_account_line_events")
    .insert({
      tenant_id: input.tenantId,
      sales_account_id: input.salesAccountId,
      sales_account_line_id: insertedLine.id,
      event_type: "line_added",
      quantity_delta: quantity,
      previous_quantity: null,
      next_quantity: quantity,
      reason: null,
      meta: {
        source: "runtime_accounts_first",
      },
      created_by_pos_user_id: input.createdByPosUserId,
    })
    .select(
      "id, tenant_id, sales_account_id, sales_account_line_id, event_type, quantity_delta, previous_quantity, next_quantity, reason, meta, created_at, created_by_pos_user_id",
    )
    .single<SalesAccountLineEventRow>();

  if (lineEventError) {
    throw new Error(`Unable to append line event: ${lineEventError.message}`);
  }

  const nextAccountVersion = account.account_version + 1;
  const nextKitchenSequence = account.kitchen_ticket_sequence + 1;
  await recomputeSalesAccount({
    tenantId: input.tenantId,
    salesAccountId: input.salesAccountId,
    accountVersion: nextAccountVersion,
    kitchenTicketSequence: nextKitchenSequence,
  });

  const kitchenBatchMutationId = randomUUID();
  const lineEventMutationId = randomUUID();
  const { data: batch, error: batchError } = await supabase
    .from("kitchen_ticket_batches")
    .insert({
      tenant_id: input.tenantId,
      sales_account_id: input.salesAccountId,
      mutation_id: kitchenBatchMutationId,
      batch_number: nextKitchenSequence,
      batch_status: "pending",
      trigger_type: "line_added",
      account_version_from: account.account_version,
      account_version_to: nextAccountVersion,
    })
    .select(
      "id, sales_account_id, batch_number, batch_status, trigger_type, account_version_from, account_version_to, requested_at, printed_at",
    )
    .single<KitchenTicketBatchRecord>();

  if (batchError) {
    throw new Error(`Unable to create kitchen ticket batch: ${batchError.message}`);
  }

  const { error: kitchenLineError } = await supabase.from("kitchen_ticket_lines").insert({
    tenant_id: input.tenantId,
    kitchen_ticket_batch_id: batch.id,
    sales_account_id: input.salesAccountId,
    sales_account_line_id: insertedLine.id,
    sales_account_line_event_id: lineEvent.id,
    ticket_action: "add",
    quantity_delta: quantity,
    line_sort_order: 0,
    kitchen_snapshot: insertedLine.kitchen_snapshot,
    product_name_snapshot: product.name,
    variant_name_snapshot: null,
    line_note_snapshot: lineNote,
  });

  if (kitchenLineError) {
    throw new Error(`Unable to create kitchen ticket line: ${kitchenLineError.message}`);
  }

  await appendAccountEvent({
    tenantId: input.tenantId,
    salesAccountId: input.salesAccountId,
    actorPosUserId: input.createdByPosUserId,
    eventType: "line_added",
    mutationId: lineEventMutationId,
    meta: {
      sales_account_line_id: insertedLine.id,
      product_id: product.id,
      quantity,
    },
  });
  await appendAccountEvent({
    tenantId: input.tenantId,
    salesAccountId: input.salesAccountId,
    actorPosUserId: input.createdByPosUserId,
    eventType: "kitchen_batch_requested",
    mutationId: kitchenBatchMutationId,
    meta: {
      batch_number: batch.batch_number,
      trigger_type: batch.trigger_type,
      sales_account_line_id: insertedLine.id,
    },
  });

  return getSalesAccountById({
    tenantId: input.tenantId,
    salesAccountId: input.salesAccountId,
  });
}

export async function voidSalesAccountLine(
  input: VoidSalesAccountLineInput,
): Promise<SalesAccountDetail> {
  const supabase = getSupabaseAdminClient();
  const [account] = await Promise.all([
    getSalesAccountRecord(input.tenantId, input.salesAccountId),
    assertPosUser(input.tenantId, input.voidedByPosUserId),
  ]);

  if (account.status !== "OPEN") {
    throw new Error("Only open sales accounts can void lines.");
  }

  const { data: line, error: lineError } = await supabase
    .from("sales_account_lines")
    .select(
      "id, tenant_id, sales_account_id, line_kind, line_status, product_id, selected_variant_id, quantity, kitchen_sent_quantity, unit_base_price_cents, unit_combo_slots_total_cents, unit_modifiers_total_cents, unit_final_price_cents, line_total_cents, line_note, pricing_snapshot, display_snapshot, kitchen_snapshot, reporting_snapshot, created_at, updated_at, voided_at",
    )
    .eq("tenant_id", input.tenantId)
    .eq("sales_account_id", input.salesAccountId)
    .eq("id", input.salesAccountLineId)
    .maybeSingle<SalesAccountLineRow>();

  if (lineError) {
    throw new Error(`Unable to load sales account line: ${lineError.message}`);
  }
  if (!line) {
    throw new Error("Sales account line not found.");
  }
  if (line.line_status === "voided") {
    return getSalesAccountById({
      tenantId: input.tenantId,
      salesAccountId: input.salesAccountId,
    });
  }

  const { error: updateError } = await supabase
    .from("sales_account_lines")
    .update({
      line_status: "voided",
      voided_at: new Date().toISOString(),
      voided_by_pos_user_id: input.voidedByPosUserId,
      void_reason: input.reason?.trim() || null,
      updated_at: new Date().toISOString(),
    })
    .eq("tenant_id", input.tenantId)
    .eq("id", line.id);

  if (updateError) {
    throw new Error(`Unable to void sales account line: ${updateError.message}`);
  }

  const { data: lineEvent, error: lineEventError } = await supabase
    .from("sales_account_line_events")
    .insert({
      tenant_id: input.tenantId,
      sales_account_id: input.salesAccountId,
      sales_account_line_id: line.id,
      event_type: "line_voided",
      quantity_delta: line.quantity,
      previous_quantity: line.quantity,
      next_quantity: 0,
      reason: input.reason?.trim() || null,
      meta: {
        source: "runtime_accounts_first",
      },
      created_by_pos_user_id: input.voidedByPosUserId,
    })
    .select(
      "id, tenant_id, sales_account_id, sales_account_line_id, event_type, quantity_delta, previous_quantity, next_quantity, reason, meta, created_at, created_by_pos_user_id",
    )
    .single<SalesAccountLineEventRow>();

  if (lineEventError) {
    throw new Error(`Unable to append line void event: ${lineEventError.message}`);
  }

  const nextAccountVersion = account.account_version + 1;
  const nextKitchenSequence = account.kitchen_ticket_sequence + 1;
  await recomputeSalesAccount({
    tenantId: input.tenantId,
    salesAccountId: input.salesAccountId,
    accountVersion: nextAccountVersion,
    kitchenTicketSequence: nextKitchenSequence,
  });

  const kitchenBatchMutationId = randomUUID();
  const lineVoidMutationId = randomUUID();
  const { data: batch, error: batchError } = await supabase
    .from("kitchen_ticket_batches")
    .insert({
      tenant_id: input.tenantId,
      sales_account_id: input.salesAccountId,
      mutation_id: kitchenBatchMutationId,
      batch_number: nextKitchenSequence,
      batch_status: "pending",
      trigger_type: "line_voided",
      account_version_from: account.account_version,
      account_version_to: nextAccountVersion,
    })
    .select(
      "id, sales_account_id, batch_number, batch_status, trigger_type, account_version_from, account_version_to, requested_at, printed_at",
    )
    .single<KitchenTicketBatchRecord>();

  if (batchError) {
    throw new Error(`Unable to create void kitchen ticket batch: ${batchError.message}`);
  }

  const { error: kitchenLineError } = await supabase.from("kitchen_ticket_lines").insert({
    tenant_id: input.tenantId,
    kitchen_ticket_batch_id: batch.id,
    sales_account_id: input.salesAccountId,
    sales_account_line_id: line.id,
    sales_account_line_event_id: lineEvent.id,
    ticket_action: "void",
    quantity_delta: line.quantity,
    line_sort_order: 0,
    kitchen_snapshot: line.kitchen_snapshot,
    product_name_snapshot:
      typeof line.display_snapshot?.product_name === "string"
        ? String(line.display_snapshot.product_name)
        : "Producto",
    variant_name_snapshot: null,
    line_note_snapshot: line.line_note,
  });

  if (kitchenLineError) {
    throw new Error(`Unable to create void kitchen ticket line: ${kitchenLineError.message}`);
  }

  await appendAccountEvent({
    tenantId: input.tenantId,
    salesAccountId: input.salesAccountId,
    actorPosUserId: input.voidedByPosUserId,
    eventType: "line_voided",
    mutationId: lineVoidMutationId,
    meta: {
      sales_account_line_id: line.id,
      quantity: line.quantity,
      reason: input.reason?.trim() || null,
    },
  });
  await appendAccountEvent({
    tenantId: input.tenantId,
    salesAccountId: input.salesAccountId,
    actorPosUserId: input.voidedByPosUserId,
    eventType: "kitchen_batch_requested",
    mutationId: kitchenBatchMutationId,
    meta: {
      batch_number: batch.batch_number,
      trigger_type: batch.trigger_type,
      sales_account_line_id: line.id,
    },
  });

  return getSalesAccountById({
    tenantId: input.tenantId,
    salesAccountId: input.salesAccountId,
  });
}

export async function captureSalesAccountPayment(
  input: CaptureSalesAccountPaymentInput,
): Promise<SalesAccountDetail> {
  const supabase = getSupabaseAdminClient();
  const [account, , resolvedCashShiftId] = await Promise.all([
    getSalesAccountRecord(input.tenantId, input.salesAccountId),
    assertPosUser(input.tenantId, input.paidByPosUserId),
    resolveOperationalCashShiftId({
      tenantId: input.tenantId,
      cashShiftId: input.cashShiftId,
      kioskId: null,
    }),
  ]);

  if (account.status !== "OPEN") {
    throw new Error("Only open sales accounts can receive payments.");
  }

  const amountPaidCents = Math.max(0, Math.trunc(input.amountPaidCents));
  if (amountPaidCents <= 0) {
    throw new Error("amountPaidCents must be greater than zero.");
  }

  if (input.paymentMethod === "cash") {
    const amountReceivedCents = Math.max(0, Math.trunc(input.amountReceivedCents || 0));
    if (amountReceivedCents < amountPaidCents) {
      throw new Error("Cash payment requires amountReceivedCents >= amountPaidCents.");
    }
  }

  const { data: existingPayments, error: sequenceError } = await supabase
    .from("sales_account_payments")
    .select("payment_sequence")
    .eq("tenant_id", input.tenantId)
    .eq("sales_account_id", input.salesAccountId)
    .order("payment_sequence", { ascending: false })
    .limit(1);

  if (sequenceError) {
    throw new Error(`Unable to determine payment sequence: ${sequenceError.message}`);
  }

  const paymentSequence =
    ((existingPayments || [])[0] as { payment_sequence?: number } | undefined)?.payment_sequence ||
    0;
  const nextPaymentSequence = paymentSequence + 1;
  const amountReceivedCents =
    input.paymentMethod === "cash" ? Math.trunc(input.amountReceivedCents || 0) : null;
  const changeCents =
    input.paymentMethod === "cash" && amountReceivedCents != null
      ? amountReceivedCents - amountPaidCents
      : 0;

  const { error } = await supabase.from("sales_account_payments").insert({
    tenant_id: input.tenantId,
    sales_account_id: input.salesAccountId,
    payment_sequence: nextPaymentSequence,
    payment_status: "captured",
    payment_method: input.paymentMethod,
    amount_paid_cents: amountPaidCents,
    amount_received_cents: amountReceivedCents,
    change_cents: changeCents,
    external_reference: input.externalReference?.trim() || null,
    paid_by_pos_user_id: input.paidByPosUserId,
    cash_shift_id: resolvedCashShiftId,
    meta: {
      source: "runtime_accounts_first",
    },
  });

  if (error) {
    throw new Error(`Unable to capture sales account payment: ${error.message}`);
  }

  const recomputed = await recomputeSalesAccount({
    tenantId: input.tenantId,
    salesAccountId: input.salesAccountId,
  });

  await appendAccountEvent({
    tenantId: input.tenantId,
    salesAccountId: input.salesAccountId,
    actorPosUserId: input.paidByPosUserId,
    eventType: "payment_captured",
    meta: {
      payment_method: input.paymentMethod,
      amount_paid_cents: amountPaidCents,
      amount_received_cents: amountReceivedCents,
      change_cents: changeCents,
      payment_sequence: nextPaymentSequence,
    },
  });

  return getSalesAccountById({
    tenantId: input.tenantId,
    salesAccountId: recomputed.id,
  });
}

export async function closeSalesAccount(
  input: CloseSalesAccountInput,
): Promise<SalesAccountDetail> {
  const supabase = getSupabaseAdminClient();
  const [account] = await Promise.all([
    recomputeSalesAccount({
      tenantId: input.tenantId,
      salesAccountId: input.salesAccountId,
    }),
    assertPosUser(input.tenantId, input.closedByPosUserId),
  ]);

  if (account.status !== "OPEN") {
    throw new Error("Only open sales accounts can be closed.");
  }
  if (account.balance_due_cents !== 0) {
    throw new Error("Sales account cannot be closed while balance is still due.");
  }

  const nowIso = new Date().toISOString();
  const { error } = await supabase
    .from("sales_accounts")
    .update({
      status: "PAID",
      closed_at: nowIso,
      closed_by_pos_user_id: input.closedByPosUserId,
      updated_at: nowIso,
    })
    .eq("tenant_id", input.tenantId)
    .eq("id", input.salesAccountId);

  if (error) {
    throw new Error(`Unable to close sales account: ${error.message}`);
  }

  await appendAccountEvent({
    tenantId: input.tenantId,
    salesAccountId: input.salesAccountId,
    actorPosUserId: input.closedByPosUserId,
    eventType: "account_closed",
    meta: {
      total_cents: account.total_cents,
      payments_total_cents: account.payments_total_cents,
    },
  });

  return getSalesAccountById({
    tenantId: input.tenantId,
    salesAccountId: input.salesAccountId,
  });
}

export async function syncSalesAccountMutation(
  input: SyncSalesAccountMutationInput,
): Promise<SalesAccountDetail> {
  const supabase = getSupabaseAdminClient();
  await assertPosUser(input.tenantId, input.actorPosUserId);
  const accountEvent = input.accountEvent
    ? parseSyncAccountEventPayload(input.accountEvent)
    : null;
  const mutationPayload = input.payload;

  const account = parseSyncAccountPayload(input.account);
  if (account.kioskId !== input.kioskId) {
    throw new Error("account.kioskId must match the authenticated kiosk.");
  }

  const alreadyApplied = await hasExistingMutation(
    input.tenantId,
    input.mutationType,
    input.mutationId,
  );
  if (alreadyApplied) {
    return getSalesAccountById({
      tenantId: input.tenantId,
      salesAccountId: account.id,
    });
  }

  if (input.mutationType === "sales_account.opened") {
    const { error } = await supabase.from("sales_accounts").upsert(
      {
        id: account.id,
        tenant_id: input.tenantId,
        kiosk_id: account.kioskId,
        service_context: account.serviceContext,
        status: "OPEN",
        folio_number: account.folioNumber,
        folio_text: account.folioText,
        subtotal_cents: account.subtotalCents,
        discount_cents: account.discountCents,
        total_cents: account.totalCents,
        payments_total_cents: account.paymentsTotalCents,
        balance_due_cents: account.balanceDueCents,
        account_version: account.accountVersion,
        kitchen_ticket_sequence: account.kitchenTicketSequence,
        last_mutation_id: input.mutationId,
        opened_at: account.openedAt,
        opened_by_pos_user_id: input.actorPosUserId,
        updated_at: account.openedAt,
      },
      { onConflict: "id" },
    );
    if (error) {
      throw new Error(`Unable to open synced sales account: ${error.message}`);
    }

    await appendAccountEvent({
      tenantId: input.tenantId,
      salesAccountId: account.id,
      actorPosUserId: input.actorPosUserId,
      mutationId: input.mutationId,
      eventType: "account_opened",
      meta: accountEvent?.meta ?? {
        kiosk_id: account.kioskId,
        service_context: account.serviceContext,
        folio_text: account.folioText,
      },
    });
  } else if (input.mutationType === "sales_account.assignment_set") {
    await ensureSalesAccountExistsForSync(input.tenantId, account.id);
    const assignment = parseSyncAssignmentPayload(input.assignment);

    if (assignment.assignmentType === "table" && assignment.posTableId) {
      await assertPosTable(input.tenantId, assignment.posTableId);
    }

    const nowIso = assignment.assignedAt;
    const { error: releaseError } = await supabase
      .from("sales_account_assignments")
      .update({
        is_current: false,
        released_at: nowIso,
        released_by_pos_user_id: input.actorPosUserId,
        updated_at: nowIso,
      })
      .eq("tenant_id", input.tenantId)
      .eq("sales_account_id", account.id)
      .eq("is_current", true)
      .neq("id", assignment.id);

    if (releaseError) {
      throw new Error(`Unable to release current assignment: ${releaseError.message}`);
    }

    const { error } = await supabase.from("sales_account_assignments").upsert(
      {
        id: assignment.id,
        tenant_id: input.tenantId,
        sales_account_id: account.id,
        assignment_type: assignment.assignmentType,
        pos_table_id: assignment.assignmentType === "table" ? assignment.posTableId : null,
        table_label: assignment.assignmentType === "table" ? assignment.tableLabel : null,
        customer_name: assignment.customerName,
        customer_phone: assignment.customerPhone,
        customer_external_id: assignment.customerExternalId,
        is_current: assignment.isCurrent,
        assigned_at: assignment.assignedAt,
        assigned_by_pos_user_id: input.actorPosUserId,
        released_at: assignment.releasedAt,
        released_by_pos_user_id: assignment.releasedAt ? input.actorPosUserId : null,
        updated_at: nowIso,
      },
      { onConflict: "id" },
    );

    if (error) {
      throw new Error(`Unable to upsert assignment sync mutation: ${error.message}`);
    }

    await appendAccountEvent({
      tenantId: input.tenantId,
      salesAccountId: account.id,
      actorPosUserId: input.actorPosUserId,
      mutationId: input.mutationId,
      eventType: "assignment_set",
      meta: accountEvent?.meta ?? {
        assignment_type: assignment.assignmentType,
        pos_table_id: assignment.posTableId,
        table_label: assignment.tableLabel,
        customer_name: assignment.customerName,
        customer_phone: assignment.customerPhone,
        customer_external_id: assignment.customerExternalId,
      },
    });
  } else if (
    input.mutationType === "sales_account.line_added" ||
    input.mutationType === "sales_account.line_updated"
  ) {
    await ensureSalesAccountExistsForSync(input.tenantId, account.id);
    const line = parseSyncLinePayload(input.line);
    const lineEvent = parseSyncLineEventPayload(input.lineEvent);
    const displaySnapshot = line.displaySnapshot;
    const reportingSnapshot = line.reportingSnapshot;

    const { error: lineError } = await supabase.from("sales_account_lines").upsert(
      {
        id: line.id,
        tenant_id: input.tenantId,
        sales_account_id: account.id,
        line_kind: line.lineKind,
        line_status: line.lineStatus,
        product_id: line.productId,
        selected_variant_id: line.selectedVariant?.variantId || null,
        quantity: line.quantity,
        kitchen_sent_quantity: line.kitchenSentQuantity,
        unit_base_price_cents: line.unitBasePriceCents,
        unit_combo_slots_total_cents: line.unitComboSlotsTotalCents,
        unit_modifiers_total_cents: line.unitModifiersTotalCents,
        unit_final_price_cents: line.unitFinalPriceCents,
        line_total_cents: line.lineTotalCents,
        line_note: line.lineNote,
        product_name_snapshot:
          asOptionalString(displaySnapshot.product_name) ||
          asOptionalString(displaySnapshot.display_name) ||
          asOptionalString(reportingSnapshot.product_name) ||
          "Producto",
        variant_name_snapshot:
          line.selectedVariant?.name ||
          asOptionalString(displaySnapshot.variant_name) ||
          asOptionalString(reportingSnapshot.variant_name),
        category_id_snapshot: asOptionalString(reportingSnapshot.category_id),
        category_name_snapshot: asOptionalString(reportingSnapshot.category_name),
        selected_modifiers_snapshot: line.selectedModifiers,
        selected_combo_slots_snapshot: line.selectedComboSlots,
        pricing_snapshot: line.pricingSnapshot,
        display_snapshot: line.displaySnapshot,
        kitchen_snapshot: line.kitchenSnapshot,
        reporting_snapshot: line.reportingSnapshot,
        line_version: account.accountVersion,
        last_mutation_id: input.mutationId,
        voided_at: line.voidedAt,
        voided_by_pos_user_id:
          line.lineStatus === "voided" ? input.actorPosUserId : null,
        void_reason:
          line.lineStatus === "voided"
            ? asOptionalString(lineEvent.meta.reason) || asOptionalString(accountEvent?.meta.reason)
            : null,
        created_at: line.createdAt,
        updated_at: line.updatedAt,
      },
      { onConflict: "id" },
    );

    if (lineError) {
      throw new Error(`Unable to upsert sales account line: ${lineError.message}`);
    }

    const previousQuantity =
      asOptionalString(lineEvent.meta.previous_quantity) != null
        ? Number(lineEvent.meta.previous_quantity)
        : typeof lineEvent.meta.previous_quantity === "number"
          ? Math.trunc(lineEvent.meta.previous_quantity as number)
          : input.mutationType === "sales_account.line_added"
            ? null
            : Math.max(line.quantity - Math.abs(lineEvent.quantityDelta), 0);
    const nextQuantity =
      typeof lineEvent.meta.next_quantity === "number"
        ? Math.trunc(lineEvent.meta.next_quantity as number)
        : line.quantity;

    const { error: lineEventError } = await supabase.from("sales_account_line_events").upsert(
      {
        id: lineEvent.id,
        tenant_id: input.tenantId,
        sales_account_id: account.id,
        sales_account_line_id: line.id,
        mutation_id: input.mutationId,
        event_type: lineEventTypeForSync(lineEvent),
        quantity_delta: Math.abs(lineEvent.quantityDelta),
        previous_quantity:
          typeof previousQuantity === "number" && Number.isFinite(previousQuantity)
            ? previousQuantity
            : null,
        next_quantity:
          typeof nextQuantity === "number" && Number.isFinite(nextQuantity)
            ? nextQuantity
            : null,
        reason:
          asOptionalString(lineEvent.meta.reason) ||
          asOptionalString(accountEvent?.meta.reason),
        meta: lineEvent.meta,
        created_at: lineEvent.createdAt,
        created_by_pos_user_id: lineEvent.actorPosUserId || input.actorPosUserId,
      },
      { onConflict: "id" },
    );

    if (lineEventError) {
      throw new Error(`Unable to upsert sales account line event: ${lineEventError.message}`);
    }

    await appendAccountEvent({
      tenantId: input.tenantId,
      salesAccountId: account.id,
      actorPosUserId: input.actorPosUserId,
      mutationId: input.mutationId,
      eventType:
        input.mutationType === "sales_account.line_added" ? "line_added" : "line_updated",
      meta:
        accountEvent?.meta ?? {
          sales_account_line_id: line.id,
          product_id: line.productId,
          quantity_delta: lineEvent.quantityDelta,
          next_quantity: line.quantity,
        },
    });
  } else if (input.mutationType === "sales_account.line_voided") {
    await ensureSalesAccountExistsForSync(input.tenantId, account.id);
    const line = parseSyncLinePayload(input.line);
    const lineEvent = parseSyncLineEventPayload(input.lineEvent);

    const { error: lineError } = await supabase
      .from("sales_account_lines")
      .update({
        line_status: "voided",
        quantity: line.quantity,
        kitchen_sent_quantity: line.kitchenSentQuantity,
        line_total_cents: line.lineTotalCents,
        line_note: line.lineNote,
        pricing_snapshot: line.pricingSnapshot,
        display_snapshot: line.displaySnapshot,
        kitchen_snapshot: line.kitchenSnapshot,
        reporting_snapshot: line.reportingSnapshot,
        line_version: account.accountVersion,
        last_mutation_id: input.mutationId,
        voided_at: line.voidedAt || lineEvent.createdAt,
        voided_by_pos_user_id: input.actorPosUserId,
        void_reason:
          asOptionalString(lineEvent.meta.reason) ||
          asOptionalString(accountEvent?.meta.reason),
        updated_at: line.updatedAt,
      })
      .eq("tenant_id", input.tenantId)
      .eq("id", line.id);

    if (lineError) {
      throw new Error(`Unable to void synced sales account line: ${lineError.message}`);
    }

    const { error: lineEventError } = await supabase.from("sales_account_line_events").upsert(
      {
        id: lineEvent.id,
        tenant_id: input.tenantId,
        sales_account_id: account.id,
        sales_account_line_id: line.id,
        mutation_id: input.mutationId,
        event_type: "line_voided",
        quantity_delta: Math.abs(line.quantity),
        previous_quantity: line.quantity,
        next_quantity: 0,
        reason:
          asOptionalString(lineEvent.meta.reason) ||
          asOptionalString(accountEvent?.meta.reason),
        meta: lineEvent.meta,
        created_at: lineEvent.createdAt,
        created_by_pos_user_id: lineEvent.actorPosUserId || input.actorPosUserId,
      },
      { onConflict: "id" },
    );

    if (lineEventError) {
      throw new Error(`Unable to upsert void line event: ${lineEventError.message}`);
    }

    await appendAccountEvent({
      tenantId: input.tenantId,
      salesAccountId: account.id,
      actorPosUserId: input.actorPosUserId,
      mutationId: input.mutationId,
      eventType: "line_voided",
      meta:
        accountEvent?.meta ?? {
          sales_account_line_id: line.id,
          reason: asOptionalString(lineEvent.meta.reason),
        },
    });
  } else if (input.mutationType === "sales_account.kitchen_batch_requested") {
    await ensureSalesAccountExistsForSync(input.tenantId, account.id);
    const kitchenBatch = parseSyncKitchenBatchPayload(input.kitchenBatch);
    const kitchenLines = (input.kitchenLines || []).map(parseSyncKitchenLinePayload);

    const { error: batchError } = await supabase.from("kitchen_ticket_batches").upsert(
      {
        id: kitchenBatch.id,
        tenant_id: input.tenantId,
        sales_account_id: account.id,
        mutation_id: input.mutationId,
        batch_number: kitchenBatch.batchNumber,
        batch_status: kitchenBatch.batchStatus,
        trigger_type: kitchenBatch.triggerType,
        account_version_from: kitchenBatch.accountVersionFrom,
        account_version_to: kitchenBatch.accountVersionTo,
        requested_at: kitchenBatch.requestedAt,
        printed_at: kitchenBatch.printedAt,
        updated_at: kitchenBatch.requestedAt,
      },
      { onConflict: "id" },
    );

    if (batchError) {
      throw new Error(`Unable to upsert kitchen batch sync mutation: ${batchError.message}`);
    }

    if (kitchenLines.length > 0) {
      const { error: kitchenLinesError } = await supabase
        .from("kitchen_ticket_lines")
        .upsert(
          kitchenLines.map((line, index) => ({
            id: line.id,
            tenant_id: input.tenantId,
            kitchen_ticket_batch_id: kitchenBatch.id,
            sales_account_id: account.id,
            sales_account_line_id: line.salesAccountLineId,
            sales_account_line_event_id: line.salesAccountLineEventId,
            ticket_action: line.ticketAction,
            quantity_delta: line.quantityDelta,
            line_sort_order: index,
            kitchen_snapshot: {},
            product_name_snapshot: line.productNameSnapshot,
            variant_name_snapshot: line.variantNameSnapshot,
            line_note_snapshot: line.lineNoteSnapshot,
            created_at: line.createdAt,
          })),
          { onConflict: "id" },
        );

      if (kitchenLinesError) {
        throw new Error(`Unable to upsert kitchen batch lines: ${kitchenLinesError.message}`);
      }
    }

    await recomputeSalesAccount({
      tenantId: input.tenantId,
      salesAccountId: account.id,
      accountVersion: account.accountVersion,
      kitchenTicketSequence: account.kitchenTicketSequence,
    });

    await appendAccountEvent({
      tenantId: input.tenantId,
      salesAccountId: account.id,
      actorPosUserId: input.actorPosUserId,
      mutationId: input.mutationId,
      eventType: "kitchen_batch_requested",
      meta:
        accountEvent?.meta ?? {
          batch_number: kitchenBatch.batchNumber,
          trigger_type: kitchenBatch.triggerType,
        },
    });
  } else if (input.mutationType === "sales_account.payment_captured") {
    await ensureSalesAccountExistsForSync(input.tenantId, account.id);
    const payment = parseSyncPaymentPayload(input.payment);
    const resolvedCashShiftId = await resolveOperationalCashShiftId({
      tenantId: input.tenantId,
      cashShiftId: asOptionalString(readPayloadValue(mutationPayload, "cash_shift_id")),
      kioskId: account.kioskId,
    });

    const { error: paymentError } = await supabase.from("sales_account_payments").upsert(
      {
        id: payment.id,
        tenant_id: input.tenantId,
        sales_account_id: account.id,
        payment_sequence: payment.paymentSequence,
        payment_status: "captured",
        payment_method: payment.paymentMethod,
        amount_paid_cents: payment.amountPaidCents,
        amount_received_cents: payment.amountReceivedCents,
        change_cents: payment.changeCents,
        paid_at: payment.paidAt,
        paid_by_pos_user_id: input.actorPosUserId,
        cash_shift_id: resolvedCashShiftId,
        external_reference: asOptionalString(
          readPayloadValue(mutationPayload, "external_reference"),
        ),
        meta: accountEvent?.meta ?? {},
        updated_at: payment.paidAt,
      },
      { onConflict: "id" },
    );

    if (paymentError) {
      throw new Error(`Unable to upsert payment sync mutation: ${paymentError.message}`);
    }

    await recomputeSalesAccount({
      tenantId: input.tenantId,
      salesAccountId: account.id,
    });

    await appendAccountEvent({
      tenantId: input.tenantId,
      salesAccountId: account.id,
      actorPosUserId: input.actorPosUserId,
      mutationId: input.mutationId,
      eventType: "payment_captured",
      meta:
        accountEvent?.meta ?? {
          payment_method: payment.paymentMethod,
          amount_paid_cents: payment.amountPaidCents,
          amount_received_cents: payment.amountReceivedCents,
          change_cents: payment.changeCents,
          payment_sequence: payment.paymentSequence,
        },
    });
  } else if (input.mutationType === "sales_account.closed") {
    const existingAccount = await ensureSalesAccountExistsForSync(input.tenantId, account.id);
    const accountToClose =
      existingAccount.balance_due_cents !== 0 ||
      existingAccount.payments_total_cents !== existingAccount.total_cents
        ? await recomputeSalesAccount({
            tenantId: input.tenantId,
            salesAccountId: account.id,
          })
        : existingAccount;

    if (accountToClose.status !== "OPEN") {
      throw new Error("Only open sales accounts can be closed.");
    }

    if (accountToClose.balance_due_cents !== 0) {
      throw new Error(
        `Synced sales account cannot be closed while balance is still due (balance_due_cents=${accountToClose.balance_due_cents}).`,
      );
    }

    if (accountToClose.payments_total_cents !== accountToClose.total_cents) {
      throw new Error(
        `Synced sales account cannot be closed until captured payments match the account total (payments_total_cents=${accountToClose.payments_total_cents}, total_cents=${accountToClose.total_cents}).`,
      );
    }

    const { error } = await supabase
      .from("sales_accounts")
      .update({
        status: "PAID",
        closed_at: account.closedAt,
        closed_by_pos_user_id: input.actorPosUserId,
        last_mutation_id: input.mutationId,
        updated_at: account.closedAt || new Date().toISOString(),
      })
      .eq("tenant_id", input.tenantId)
      .eq("id", account.id);

    if (error) {
      throw new Error(`Unable to close synced sales account: ${error.message}`);
    }

    await appendAccountEvent({
      tenantId: input.tenantId,
      salesAccountId: account.id,
      actorPosUserId: input.actorPosUserId,
      mutationId: input.mutationId,
      eventType: "account_closed",
      meta:
        accountEvent?.meta ?? {
          closed_at: account.closedAt,
        },
    });
  } else if (input.mutationType === "sales_account.canceled") {
    await ensureSalesAccountExistsForSync(input.tenantId, account.id);

    const { error } = await supabase
      .from("sales_accounts")
      .update({
        status: "CANCELED",
        canceled_at: account.canceledAt,
        canceled_by_pos_user_id: input.actorPosUserId,
        cancel_reason:
          asOptionalString(accountEvent?.meta.reason) || null,
        last_mutation_id: input.mutationId,
        updated_at: account.canceledAt || new Date().toISOString(),
      })
      .eq("tenant_id", input.tenantId)
      .eq("id", account.id);

    if (error) {
      throw new Error(`Unable to cancel synced sales account: ${error.message}`);
    }

    await appendAccountEvent({
      tenantId: input.tenantId,
      salesAccountId: account.id,
      actorPosUserId: input.actorPosUserId,
      mutationId: input.mutationId,
      eventType: "account_canceled",
      meta:
        accountEvent?.meta ?? {
          canceled_at: account.canceledAt,
        },
    });
  }

  return getSalesAccountById({
    tenantId: input.tenantId,
    salesAccountId: account.id,
  });
}

export async function getSalesAccountById(input: {
  tenantId: string;
  salesAccountId: string;
}): Promise<SalesAccountDetail> {
  const supabase = getSupabaseAdminClient();
  const [account, assignments, linesResult, lineEventsResult, paymentsResult, batchesResult, kitchenLinesResult, eventsResult] =
    await Promise.all([
      getSalesAccountRecord(input.tenantId, input.salesAccountId),
      listAssignmentsForAccounts(input.tenantId, [input.salesAccountId]),
      supabase
        .from("sales_account_lines")
      .select(
          "id, tenant_id, sales_account_id, line_kind, line_status, product_id, selected_variant_id, quantity, kitchen_sent_quantity, unit_base_price_cents, unit_combo_slots_total_cents, unit_modifiers_total_cents, unit_final_price_cents, line_total_cents, line_note, product_name_snapshot, variant_name_snapshot, category_id_snapshot, category_name_snapshot, selected_modifiers_snapshot, selected_combo_slots_snapshot, pricing_snapshot, display_snapshot, kitchen_snapshot, reporting_snapshot, line_version, last_mutation_id, created_at, updated_at, voided_at",
        )
        .eq("tenant_id", input.tenantId)
        .eq("sales_account_id", input.salesAccountId)
        .order("created_at", { ascending: true }),
      supabase
        .from("sales_account_line_events")
        .select(
          "id, tenant_id, sales_account_id, sales_account_line_id, mutation_id, event_type, quantity_delta, previous_quantity, next_quantity, reason, meta, created_at, created_by_pos_user_id",
        )
        .eq("tenant_id", input.tenantId)
        .eq("sales_account_id", input.salesAccountId)
        .order("created_at", { ascending: true }),
      supabase
        .from("sales_account_payments")
        .select(
          "id, sales_account_id, payment_sequence, payment_method, amount_paid_cents, amount_received_cents, change_cents, paid_at",
        )
        .eq("tenant_id", input.tenantId)
        .eq("sales_account_id", input.salesAccountId)
        .eq("payment_status", "captured")
        .order("payment_sequence", { ascending: true }),
      supabase
        .from("kitchen_ticket_batches")
        .select(
          "id, sales_account_id, batch_number, batch_status, trigger_type, account_version_from, account_version_to, requested_at, printed_at",
        )
        .eq("tenant_id", input.tenantId)
        .eq("sales_account_id", input.salesAccountId)
        .order("batch_number", { ascending: true }),
      supabase
        .from("kitchen_ticket_lines")
        .select(
          "id, tenant_id, kitchen_ticket_batch_id, sales_account_id, sales_account_line_id, sales_account_line_event_id, ticket_action, quantity_delta, line_sort_order, kitchen_snapshot, product_name_snapshot, variant_name_snapshot, line_note_snapshot, created_at",
        )
        .eq("tenant_id", input.tenantId)
        .eq("sales_account_id", input.salesAccountId)
        .order("created_at", { ascending: true }),
      supabase
        .from("sales_account_events")
        .select(
          "id, tenant_id, sales_account_id, mutation_id, event_type, actor_pos_user_id, meta, created_at",
        )
        .eq("tenant_id", input.tenantId)
        .eq("sales_account_id", input.salesAccountId)
        .order("created_at", { ascending: true }),
    ]);

  const failure = [
    linesResult.error && `lines: ${linesResult.error.message}`,
    lineEventsResult.error && `line_events: ${lineEventsResult.error.message}`,
    paymentsResult.error && `payments: ${paymentsResult.error.message}`,
    batchesResult.error && `kitchen_batches: ${batchesResult.error.message}`,
    kitchenLinesResult.error && `kitchen_lines: ${kitchenLinesResult.error.message}`,
    eventsResult.error && `events: ${eventsResult.error.message}`,
  ].filter(Boolean);

  if (failure.length > 0) {
    throw new Error(`Unable to load sales account detail: ${failure.join("; ")}`);
  }

  return {
    account,
    assignments,
    current_assignment: assignments.find((assignment) => assignment.is_current) || null,
    lines: (linesResult.data || []) as SalesAccountLineRow[],
    line_events: (lineEventsResult.data || []) as SalesAccountLineEventRow[],
    payments: (paymentsResult.data || []) as SalesAccountPaymentRecord[],
    kitchen_ticket_batches: (batchesResult.data || []) as KitchenTicketBatchRecord[],
    kitchen_ticket_lines: (kitchenLinesResult.data || []) as KitchenTicketLineRow[],
    events: (eventsResult.data || []) as SalesAccountEventRow[],
  };
}
