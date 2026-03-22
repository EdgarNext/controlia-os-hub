import { getSupabaseServerClient } from "@/lib/supabase/server";
import type { PosProductsReportData, PosReportsFilters } from "@/types/pos-reports";
import { normalizePosReportsFilters, type NormalizedPosReportsFilters } from "./filters";
import { buildPosProductsReportData, mapOrdersToEligibleOrderIds } from "./products-mappers";

type GetPosProductsReportInput = {
  tenantId: string;
  filters: PosReportsFilters;
};

type OrdersSourceRow = {
  id: string;
  payment_method: string | null;
  created_at: string;
  closed_at: string | null;
  is_tab: boolean | null;
};

type OrderItemSourceRow = {
  order_id: string;
  catalog_item_id: string;
  qty: number | string;
  unit_price_cents: number | string;
  line_total_cents: number | string;
};

type OrderLineSourceRow = {
  order_id: string;
  product_id: string;
  qty: number | string;
  unit_price_cents: number | string;
};

type CatalogItemSourceRow = {
  id: string;
  category_id: string | null;
  type: string | null;
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

/*
Validated real columns in public.orders via Supabase schema inspection:
- available:
  id, tenant_id, kiosk_id, folio_number, folio_text, status, total_cents, canceled_at,
  cancel_reason, canceled_by, print_status, print_attempt_count, last_print_error,
  last_print_at, created_at, updated_at, created_by, updated_by, is_tab, pos_table_id,
  opened_at, closed_at, tab_version, last_mutation_id, kitchen_last_printed_version,
  kitchen_last_print_at, pos_table_label, payment_received_cents, change_cents, payment_method
- used in this file:
  id, payment_method, created_at, closed_at, is_tab
- discarded for products report:
  status
    reason: query predicate already limits to PAID orders.
  total_cents and print fields
    reason: product performance comes from line-level sources, not order-level print or payment totals.
  folio and tab metadata
    reason: not required for aggregated product performance.
*/

/*
Validated real columns in public.order_items via Supabase schema inspection:
- available:
  id, tenant_id, order_id, catalog_item_id, qty, unit_price_cents, line_total_cents,
  variants, created_at, updated_at, created_by, updated_by
- used in this file:
  order_id, catalog_item_id, qty, unit_price_cents, line_total_cents
- discarded:
  id, tenant_id
    reason: tenant scoping is enforced in the query predicate.
  variants
    reason: this phase reports parent product performance, not variant mix.
  created_at, updated_at, created_by, updated_by
    reason: not required for aggregate product KPIs.
*/

/*
Validated real columns in public.order_lines via Supabase schema inspection:
- available:
  id, mutation_id, tenant_id, order_id, product_id, qty, unit_price_cents, notes,
  deleted_at, created_at, created_by
- used in this file:
  order_id, product_id, qty, unit_price_cents, deleted_at
- discarded:
  id, mutation_id, tenant_id
    reason: tenant scoping and idempotency are handled outside this report.
  notes
    reason: free-text notes are not part of product performance metrics.
  created_at, created_by
    reason: tabs are filtered through canonical orders business-date logic, not line timestamps.
- TODO: mismatch with specs
  order_lines does not expose line_total_cents, so tabs gross is derived as qty * unit_price_cents.
*/

/*
Validated real columns in public.catalog_items via Supabase schema inspection:
- available:
  id, tenant_id, category_id, type, class, name, price_cents, is_active, has_variants,
  is_sold_out, is_popular, image_path, deleted_at, created_at, updated_at, created_by, updated_by
- used in this file:
  id, category_id, type, class, name, is_active, is_sold_out, is_popular
- discarded:
  tenant_id
    reason: tenant scoping is enforced in the query predicate.
  price_cents
    reason: report uses realized line revenue, not current catalog price.
  has_variants, image_path, deleted_at, created_at, updated_at, created_by, updated_by
    reason: not required for phase-1 product performance readout.
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

function chunkValues<T>(values: T[], size: number): T[][] {
  const chunks: T[][] = [];

  for (let index = 0; index < values.length; index += size) {
    chunks.push(values.slice(index, index + size));
  }

  return chunks;
}

async function listPaidOrdersForProducts(
  tenantId: string,
  filters: NormalizedPosReportsFilters,
): Promise<OrdersSourceRow[]> {
  const supabase = await getSupabaseServerClient();
  const { startIso, endIso } = buildPaddedOrdersRange(filters);

  let query = supabase
    .from("orders")
    .select("id, payment_method, created_at, closed_at, is_tab")
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
    throw new Error(`Unable to load paid orders for products report: ${error.message}`);
  }

  return (data ?? []) as OrdersSourceRow[];
}

async function listQuickSaleLines(
  tenantId: string,
  orderIds: string[],
): Promise<
  Array<{
    order_id: string;
    product_id: string;
    qty: number | string;
    unit_price_cents: number | string;
    gross_cents: number | string;
    source: "quick-sale";
  }>
> {
  if (orderIds.length === 0) {
    return [];
  }

  const supabase = await getSupabaseServerClient();
  const chunks = chunkValues(orderIds, 200);
  const rows = await Promise.all(
    chunks.map(async (chunk) => {
      const { data, error } = await supabase
        .from("order_items")
        .select("order_id, catalog_item_id, qty, unit_price_cents, line_total_cents")
        .eq("tenant_id", tenantId)
        .in("order_id", chunk);

      if (error) {
        throw new Error(`Unable to load order_items for products report: ${error.message}`);
      }

      return ((data ?? []) as OrderItemSourceRow[]).map((row) => ({
        order_id: row.order_id,
        product_id: row.catalog_item_id,
        qty: row.qty,
        unit_price_cents: row.unit_price_cents,
        gross_cents: row.line_total_cents,
        source: "quick-sale" as const,
      }));
    }),
  );

  return rows.flat();
}

async function listTabLines(
  tenantId: string,
  orderIds: string[],
): Promise<
  Array<{
    order_id: string;
    product_id: string;
    qty: number | string;
    unit_price_cents: number | string;
    gross_cents: number;
    source: "tabs";
  }>
> {
  if (orderIds.length === 0) {
    return [];
  }

  const supabase = await getSupabaseServerClient();
  const chunks = chunkValues(orderIds, 200);
  const rows = await Promise.all(
    chunks.map(async (chunk) => {
      const { data, error } = await supabase
        .from("order_lines")
        .select("order_id, product_id, qty, unit_price_cents")
        .eq("tenant_id", tenantId)
        .is("deleted_at", null)
        .in("order_id", chunk);

      if (error) {
        throw new Error(`Unable to load order_lines for products report: ${error.message}`);
      }

      return ((data ?? []) as OrderLineSourceRow[]).map((row) => ({
        order_id: row.order_id,
        product_id: row.product_id,
        qty: row.qty,
        unit_price_cents: row.unit_price_cents,
        gross_cents: Number(row.qty) * Number(row.unit_price_cents),
        source: "tabs" as const,
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

  const supabase = await getSupabaseServerClient();
  const productChunks = chunkValues(productIds, 200);
  const productRows = await Promise.all(
    productChunks.map(async (chunk) => {
      const { data, error } = await supabase
        .from("catalog_items")
        .select("id, category_id, type, class, name, is_active, is_sold_out, is_popular")
        .eq("tenant_id", tenantId)
        .in("id", chunk);

      if (error) {
        throw new Error(`Unable to load catalog items for products report: ${error.message}`);
      }

      return (data ?? []) as CatalogItemSourceRow[];
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
    type: row.type,
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
  const paidOrders = await listPaidOrdersForProducts(input.tenantId, normalizedFilters);
  const { quickSaleOrderIds, tabOrderIds } = mapOrdersToEligibleOrderIds(paidOrders, normalizedFilters);

  const [quickSaleLines, tabLines] = await Promise.all([
    listQuickSaleLines(input.tenantId, quickSaleOrderIds),
    listTabLines(input.tenantId, tabOrderIds),
  ]);
  const lines = [...quickSaleLines, ...tabLines];
  const productIds = [...new Set(lines.map((row) => row.product_id))];
  const catalogProducts = await listCatalogProducts(input.tenantId, productIds);

  return buildPosProductsReportData({
    filters: normalizedFilters,
    catalogProducts,
    lines,
  });
}
