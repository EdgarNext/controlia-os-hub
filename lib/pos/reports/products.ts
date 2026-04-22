import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import type { PosProductsReportData, PosReportsFilters } from "@/types/pos-reports";
import { normalizePosReportsFilters, type NormalizedPosReportsFilters } from "./filters";
import { buildPosProductsReportData } from "./products-mappers";

type GetPosProductsReportInput = {
  tenantId: string;
  filters: PosReportsFilters;
};

type SalesAccountSourceRow = {
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

type SalesAccountLineSourceRow = {
  sales_account_id: string;
  product_id: string;
  quantity: number | string;
  unit_final_price_cents: number | string;
  line_total_cents: number | string;
  product_name_snapshot: string;
  category_name_snapshot: string | null;
  line_kind: string;
};

type ProductSourceRow = {
  id: string;
  category_id: string | null;
  product_type: string | null;
  class: string | null;
  name: string;
  is_active: boolean | null;
  is_sold_out: boolean | null;
  is_popular: boolean | null;
};

type CategorySourceRow = {
  id: string;
  name: string;
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

async function listPaidSalesAccountsForProducts(
  tenantId: string,
  filters: NormalizedPosReportsFilters,
): Promise<SalesAccountSourceRow[]> {
  const supabase = getSupabaseAdminClient();
  const { startIso, endIso } = buildPaddedOrdersRange(filters);

  let query = supabase
    .from("sales_accounts")
    .select("id, total_cents, service_context, opened_at, closed_at")
    .eq("tenant_id", tenantId)
    .eq("status", "PAID")
    .gte("closed_at", startIso)
    .lt("closed_at", endIso);

  if (filters.sale_channel === "quick-sale") {
    query = query.neq("service_context", "table_service");
  } else if (filters.sale_channel === "tabs") {
    query = query.eq("service_context", "table_service");
  }

  const { data, error } = await query;

  if (error) {
    throw new Error(`Unable to load paid sales_accounts for products report: ${error.message}`);
  }

  return (data ?? []) as SalesAccountSourceRow[];
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
        throw new Error(`Unable to load sales_account_payments for products report: ${error.message}`);
      }

      return (data ?? []) as SalesAccountPaymentSourceRow[];
    }),
  );

  return rows.flat();
}

function buildEligibleSalesAccountIds(input: {
  accounts: SalesAccountSourceRow[];
  payments: SalesAccountPaymentSourceRow[];
  filters: NormalizedPosReportsFilters;
}): string[] {
  const paymentTotalsByAccountId = input.payments.reduce<Map<string, number>>((accumulator, row) => {
    const current = accumulator.get(row.sales_account_id) ?? 0;
    accumulator.set(row.sales_account_id, current + Number(row.amount_paid_cents || 0));
    return accumulator;
  }, new Map());

  const matchingPaymentTotalsByAccountId =
    input.filters.payment_method === "all"
      ? paymentTotalsByAccountId
      : input.payments.reduce<Map<string, number>>((accumulator, row) => {
          if (row.payment_method !== input.filters.payment_method) {
            return accumulator;
          }

          const current = accumulator.get(row.sales_account_id) ?? 0;
          accumulator.set(row.sales_account_id, current + Number(row.amount_paid_cents || 0));
          return accumulator;
        }, new Map());

  return input.accounts
    .filter((account) => {
      const capturedTotal = paymentTotalsByAccountId.get(account.id) ?? 0;
      if (capturedTotal !== Number(account.total_cents || 0)) {
        return false;
      }

      if (input.filters.payment_method === "all") {
        return true;
      }

      return (matchingPaymentTotalsByAccountId.get(account.id) ?? 0) > 0;
    })
    .map((account) => account.id);
}

async function listSalesAccountLines(
  tenantId: string,
  accounts: SalesAccountSourceRow[],
  salesAccountIds: string[],
): Promise<
  Array<{
    order_id: string;
    product_id: string;
    qty: number | string;
    unit_price_cents: number | string;
    gross_cents: number | string;
    product_name_snapshot: string;
    category_name_snapshot: string | null;
    line_kind: string;
    source: "quick-sale" | "tabs";
  }>
> {
  if (salesAccountIds.length === 0) {
    return [];
  }

  const supabase = getSupabaseAdminClient();
  const serviceContextByAccountId = new Map(
    accounts.map((account) => [account.id, account.service_context]),
  );
  const chunks = chunkValues(salesAccountIds, 200);
  const rows = await Promise.all(
    chunks.map(async (chunk) => {
      const { data, error } = await supabase
        .from("sales_account_lines")
        .select(
          "sales_account_id, product_id, quantity, unit_final_price_cents, line_total_cents, product_name_snapshot, category_name_snapshot, line_kind",
        )
        .eq("tenant_id", tenantId)
        .eq("line_status", "active")
        .in("sales_account_id", chunk);

      if (error) {
        throw new Error(`Unable to load sales_account_lines for products report: ${error.message}`);
      }

      return ((data ?? []) as SalesAccountLineSourceRow[]).map((row) => ({
        order_id: row.sales_account_id,
        product_id: row.product_id,
        qty: row.quantity,
        unit_price_cents: row.unit_final_price_cents,
        gross_cents: row.line_total_cents,
        product_name_snapshot: row.product_name_snapshot,
        category_name_snapshot: row.category_name_snapshot,
        line_kind: row.line_kind,
        source:
          serviceContextByAccountId.get(row.sales_account_id) === "table_service"
            ? ("tabs" as const)
            : ("quick-sale" as const),
      }));
    }),
  );

  return rows.flat();
}

async function listCatalogProducts(
  tenantId: string,
  productIds: string[],
): Promise<
  Array<{
    id: string;
    name: string;
    category_id: string | null;
    category_name: string | null;
    type: string | null;
    class: string | null;
    is_active: boolean | null;
    is_sold_out: boolean | null;
    is_popular: boolean | null;
  }>
> {
  if (productIds.length === 0) {
    return [];
  }

  const supabase = getSupabaseAdminClient();
  const productChunks = chunkValues(productIds, 200);
  const productRows = await Promise.all(
    productChunks.map(async (chunk) => {
      const { data, error } = await supabase
        .from("products")
        .select("id, category_id, product_type, class, name, is_active, is_sold_out, is_popular")
        .eq("tenant_id", tenantId)
        .in("id", chunk);

      if (error) {
        throw new Error(`Unable to load products for products report: ${error.message}`);
      }

      return (data ?? []) as ProductSourceRow[];
    }),
  );

  const flatProducts = productRows.flat();
  const categoryIds = [...new Set(flatProducts.map((row) => row.category_id).filter(Boolean))] as string[];
  const categoryNameById = new Map<string, string>();

  if (categoryIds.length > 0) {
    const categoryChunks = chunkValues(categoryIds, 200);
    const categoryRows = await Promise.all(
      categoryChunks.map(async (chunk) => {
        const { data, error } = await supabase
          .from("catalog_categories")
          .select("id, name")
          .eq("tenant_id", tenantId)
          .in("id", chunk);

        if (error) {
          throw new Error(`Unable to load category names for products report: ${error.message}`);
        }

        return (data ?? []) as CategorySourceRow[];
      }),
    );

    for (const row of categoryRows.flat()) {
      categoryNameById.set(row.id, row.name);
    }
  }

  return flatProducts.map((row) => ({
    id: row.id,
    name: row.name,
    category_id: row.category_id,
    category_name: row.category_id ? categoryNameById.get(row.category_id) ?? null : null,
    type: row.product_type,
    class: row.class,
    is_active: row.is_active,
    is_sold_out: row.is_sold_out,
    is_popular: row.is_popular,
  }));
}

export async function getPosProductsReport(
  input: GetPosProductsReportInput,
): Promise<PosProductsReportData> {
  const normalizedFilters = normalizePosReportsFilters(input.filters);
  const paidAccounts = await listPaidSalesAccountsForProducts(input.tenantId, normalizedFilters);
  const payments = await listCapturedPaymentsForAccounts(
    input.tenantId,
    paidAccounts.map((account) => account.id),
  );
  const eligibleSalesAccountIds = buildEligibleSalesAccountIds({
    accounts: paidAccounts,
    payments,
    filters: normalizedFilters,
  });
  const lines = await listSalesAccountLines(
    input.tenantId,
    paidAccounts,
    eligibleSalesAccountIds,
  );
  const productIds = [...new Set(lines.map((line) => line.product_id))];
  const catalogProducts = await listCatalogProducts(input.tenantId, productIds);

  return buildPosProductsReportData({
    filters: normalizedFilters,
    catalogProducts,
    lines,
  });
}
