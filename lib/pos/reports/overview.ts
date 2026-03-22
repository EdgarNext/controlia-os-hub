import { getSupabaseServerClient } from "@/lib/supabase/server";
import type { PosReportsDailyAggregateRow, PosReportsFilters, PosReportsOverviewViewModel } from "@/types/pos-reports";
import { normalizePosReportsFilters, type NormalizedPosReportsFilters } from "./filters";
import {
  buildPosReportsOverviewViewModel,
  mapOrdersToOverviewDailyRows,
  mapReportSalesDailyRow,
} from "./mappers";

type GetPosReportsOverviewInput = {
  tenantId: string;
  filters: PosReportsFilters;
};

type ReportSalesDailySourceRow = {
  business_date_mx: string;
  is_tab: boolean;
  orders_count: number | string;
  gross_cents: number | string;
  cash_cents: number | string;
  card_cents: number | string;
  employee_cents: number | string;
  updated_at: string;
};

type OrdersOverviewSourceRow = {
  total_cents: number | string;
  payment_method: string | null;
  created_at: string;
  closed_at: string | null;
  is_tab: boolean | null;
};

/*
Validated real columns in public.report_sales_daily via Supabase schema inspection:
- available:
  tenant_id
  business_date_mx
  is_tab
  orders_count
  gross_cents
  cash_cents
  card_cents
  updated_at
  employee_cents
- used in this file:
  business_date_mx
  is_tab
  orders_count
  gross_cents
  cash_cents
  card_cents
  employee_cents
  updated_at
- discarded:
  tenant_id
    reason: tenant scoping is enforced in the query predicate, not returned in the overview view model.
*/

/*
Validated real columns in public.orders via Supabase schema inspection:
- available:
  id
  tenant_id
  kiosk_id
  folio_number
  folio_text
  status
  total_cents
  canceled_at
  cancel_reason
  canceled_by
  print_status
  print_attempt_count
  last_print_error
  last_print_at
  created_at
  updated_at
  created_by
  updated_by
  is_tab
  pos_table_id
  opened_at
  closed_at
  tab_version
  last_mutation_id
  kitchen_last_printed_version
  kitchen_last_print_at
  pos_table_label
  payment_received_cents
  change_cents
  payment_method
- used in this file:
  status
  total_cents
  payment_method
  created_at
  closed_at
  is_tab
- discarded for overview:
  id, tenant_id, kiosk_id, folio_number, folio_text
    reason: needed for order-level drill-down, not for aggregate overview.
  canceled_at, cancel_reason, canceled_by
    reason: overview phase only counts PAID orders from canonical report sources.
  print_status, print_attempt_count, last_print_error, last_print_at
    reason: print health is a later report, still pending validation.
  updated_at, created_by, updated_by
    reason: not required for overview totals or daily grouping.
  pos_table_id, opened_at, tab_version, last_mutation_id, kitchen_last_printed_version, kitchen_last_print_at, pos_table_label
    reason: tab operational details are not required for the first overview query contract.
  payment_received_cents, change_cents
    reason: overview uses gross sales and payment-method split, not tender/change detail.
*/

function buildPaddedOrdersRange(filters: NormalizedPosReportsFilters) {
  const start = new Date(`${filters.date_from}T00:00:00.000Z`);
  const endExclusive = new Date(`${filters.date_to}T00:00:00.000Z`);

  start.setUTCDate(start.getUTCDate() - 1);
  endExclusive.setUTCDate(endExclusive.getUTCDate() + 2);

  return {
    startIso: start.toISOString(),
    endIso: endExclusive.toISOString(),
  };
}

async function listOverviewDailyRowsFromAggregate(
  tenantId: string,
  filters: NormalizedPosReportsFilters,
): Promise<PosReportsDailyAggregateRow[]> {
  const supabase = await getSupabaseServerClient();
  const baseQuery = supabase
    .from("report_sales_daily")
    .select(
      "business_date_mx, is_tab, orders_count, gross_cents, cash_cents, card_cents, employee_cents, updated_at",
    )
    .eq("tenant_id", tenantId)
    .gte("business_date_mx", filters.date_from)
    .lte("business_date_mx", filters.date_to)
    .order("business_date_mx", { ascending: true })
    .order("is_tab", { ascending: true });

  const query =
    filters.sale_channel === "quick-sale"
      ? baseQuery.eq("is_tab", false)
      : filters.sale_channel === "tabs"
        ? baseQuery.eq("is_tab", true)
        : baseQuery;
  const { data, error } = await query;

  if (error) {
    throw new Error(`Unable to load report_sales_daily overview: ${error.message}`);
  }

  return ((data ?? []) as ReportSalesDailySourceRow[]).map(mapReportSalesDailyRow);
}

async function listOverviewDailyRowsFromOrders(
  tenantId: string,
  filters: NormalizedPosReportsFilters,
): Promise<PosReportsDailyAggregateRow[]> {
  const supabase = await getSupabaseServerClient();
  const { startIso, endIso } = buildPaddedOrdersRange(filters);

  let query = supabase
    .from("orders")
    .select("total_cents, payment_method, created_at, closed_at, is_tab")
    .eq("tenant_id", tenantId)
    .eq("status", "PAID")
    .or(
      `and(created_at.gte.${startIso},created_at.lt.${endIso}),and(closed_at.gte.${startIso},closed_at.lt.${endIso})`,
    );

  if (filters.sale_channel === "quick-sale") {
    query = query.eq("is_tab", false);
  } else if (filters.sale_channel === "tabs") {
    query = query.eq("is_tab", true);
  }

  if (filters.payment_method !== "all") {
    query = query.eq("payment_method", filters.payment_method);
  }

  const { data, error } = await query;

  if (error) {
    throw new Error(`Unable to load orders overview fallback: ${error.message}`);
  }

  return mapOrdersToOverviewDailyRows((data ?? []) as OrdersOverviewSourceRow[], filters);
}

export async function getPosReportsOverview(
  input: GetPosReportsOverviewInput,
): Promise<PosReportsOverviewViewModel> {
  const normalizedFilters = normalizePosReportsFilters(input.filters);
  const daily = normalizedFilters.uses_daily_aggregate_source
    ? await listOverviewDailyRowsFromAggregate(input.tenantId, normalizedFilters)
    : await listOverviewDailyRowsFromOrders(input.tenantId, normalizedFilters);

  return buildPosReportsOverviewViewModel(normalizedFilters, daily);
}
