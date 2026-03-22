import { getSupabaseServerClient } from "@/lib/supabase/server";
import type { PosCashiersReportData, PosReportsFilters } from "@/types/pos-reports";
import { normalizePosReportsFilters } from "./filters";
import { getPosReportsOverview } from "./overview";
import { buildPosCashiersReportData } from "./cashiers-mappers";

type GetPosCashiersReportInput = {
  tenantId: string;
  filters: PosReportsFilters;
};

type PosUserSourceRow = {
  id: string;
  name: string;
  role: string;
  is_active: boolean;
};

/*
Validated real columns in public.orders via Supabase schema inspection:
- available:
  id, tenant_id, kiosk_id, folio_number, folio_text, status, total_cents, canceled_at,
  cancel_reason, canceled_by, print_status, print_attempt_count, last_print_error,
  last_print_at, created_at, updated_at, created_by, updated_by, is_tab, pos_table_id,
  opened_at, closed_at, tab_version, last_mutation_id, kitchen_last_printed_version,
  kitchen_last_print_at, pos_table_label, payment_received_cents, change_cents, payment_method
- used in this file:
  no direct column-level cashier attribution is consumed because no canonical cashier foreign key exists.
- discarded for cashier attribution:
  created_by
    reason: it references auth.users in schema, not pos_users, and current data has 0 paid orders with created_by populated.
  payment_method, total_cents, created_at, closed_at, is_tab
    reason: these metrics are reused through the canonical overview helper instead of duplicating aggregation here.
- TODO: mismatch with specs
  specs discuss operator attribution as a future direction, but the live orders schema still lacks operator_user_id.
*/

/*
Validated real columns in public.pos_users via Supabase schema inspection:
- available:
  id, tenant_id, name, pin_hash, role, is_active, created_at, updated_at, created_by, updated_by
- used in this file:
  id, name, role, is_active
- discarded:
  tenant_id
    reason: tenant scoping is enforced in the query predicate.
  pin_hash
    reason: never needed for reporting.
  created_at, updated_at, created_by, updated_by
    reason: cashier performance phase only needs roster context.
*/

async function listPosUsersForCashierReport(tenantId: string): Promise<PosUserSourceRow[]> {
  const supabase = await getSupabaseServerClient();
  const { data, error } = await supabase
    .from("pos_users")
    .select("id, name, role, is_active")
    .eq("tenant_id", tenantId)
    .eq("is_active", true)
    .order("name", { ascending: true });

  if (error) {
    throw new Error(`Unable to load pos_users for cashiers report: ${error.message}`);
  }

  return (data ?? []) as PosUserSourceRow[];
}

export async function getPosCashiersReport(
  input: GetPosCashiersReportInput,
): Promise<PosCashiersReportData> {
  const normalizedFilters = normalizePosReportsFilters(input.filters);
  const [overview, posUsers] = await Promise.all([
    getPosReportsOverview({
      tenantId: input.tenantId,
      filters: normalizedFilters,
    }),
    listPosUsersForCashierReport(input.tenantId),
  ]);

  return buildPosCashiersReportData({
    filters: normalizedFilters,
    overview,
    posUsers,
  });
}
