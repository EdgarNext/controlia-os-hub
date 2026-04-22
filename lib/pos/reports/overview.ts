import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import type {
  PosReportsDailyAggregateRow,
  PosReportsFilters,
  PosReportsOverviewViewModel,
} from "@/types/pos-reports";
import { normalizePosReportsFilters, type NormalizedPosReportsFilters } from "./filters";
import { buildPosReportsOverviewViewModel, mapSalesAccountsToOverviewDailyRows } from "./mappers";

type GetPosReportsOverviewInput = {
  tenantId: string;
  filters: PosReportsFilters;
};

type SalesAccountOverviewSourceRow = {
  id: string;
  total_cents: number | string;
  service_context: string;
  opened_at: string;
  closed_at: string | null;
};

type SalesAccountPaymentSourceRow = {
  sales_account_id: string;
  payment_method: string | null;
  amount_paid_cents: number | string;
};

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

function chunkValues<T>(values: T[], size: number): T[][] {
  const chunks: T[][] = [];

  for (let index = 0; index < values.length; index += size) {
    chunks.push(values.slice(index, index + size));
  }

  return chunks;
}

async function listPaidSalesAccountsForOverview(
  tenantId: string,
  filters: NormalizedPosReportsFilters,
): Promise<SalesAccountOverviewSourceRow[]> {
  const supabase = getSupabaseAdminClient();
  const { startIso, endIso } = buildPaddedOrdersRange(filters);

  let query = supabase
    .from("sales_accounts")
    .select("id, total_cents, service_context, opened_at, closed_at")
    .eq("tenant_id", tenantId)
    .eq("status", "PAID")
    .gte("closed_at", startIso)
    .lt("closed_at", endIso)
    .order("closed_at", { ascending: true });

  if (filters.sale_channel === "quick-sale") {
    query = query.neq("service_context", "table_service");
  } else if (filters.sale_channel === "tabs") {
    query = query.eq("service_context", "table_service");
  }

  const { data, error } = await query;

  if (error) {
    throw new Error(`Unable to load paid sales_accounts overview: ${error.message}`);
  }

  return (data ?? []) as SalesAccountOverviewSourceRow[];
}

async function listCapturedPaymentsForAccounts(
  tenantId: string,
  salesAccountIds: string[],
): Promise<SalesAccountPaymentSourceRow[]> {
  if (salesAccountIds.length === 0) {
    return [];
  }

  const supabase = getSupabaseAdminClient();
  const chunks = chunkValues(salesAccountIds, 200);
  const rows = await Promise.all(
    chunks.map(async (chunk) => {
      const { data, error } = await supabase
        .from("sales_account_payments")
        .select("sales_account_id, payment_method, amount_paid_cents")
        .eq("tenant_id", tenantId)
        .eq("payment_status", "captured")
        .in("sales_account_id", chunk);

      if (error) {
        throw new Error(`Unable to load sales_account_payments overview: ${error.message}`);
      }

      return (data ?? []) as SalesAccountPaymentSourceRow[];
    }),
  );

  return rows.flat();
}

export async function getPosReportsOverview(
  input: GetPosReportsOverviewInput,
): Promise<PosReportsOverviewViewModel> {
  const normalizedFilters = normalizePosReportsFilters(input.filters);
  const accounts = await listPaidSalesAccountsForOverview(input.tenantId, normalizedFilters);
  const payments = await listCapturedPaymentsForAccounts(
    input.tenantId,
    accounts.map((account) => account.id),
  );
  const daily: PosReportsDailyAggregateRow[] = mapSalesAccountsToOverviewDailyRows(
    accounts.map((account) => ({
      id: account.id,
      total_cents: account.total_cents,
      service_context: account.service_context,
      created_at: account.opened_at,
      closed_at: account.closed_at,
    })),
    payments,
    normalizedFilters,
  );

  return buildPosReportsOverviewViewModel(normalizedFilters, daily);
}
