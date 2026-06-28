import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { getSingleSearchParam, type PosReportsSearchParams } from "@/lib/pos/reports/search-params";
import type {
  SimplePosIncomeReport,
  SimplePosOrderDetail,
  SimplePosOrderDetailItem,
  SimplePosOrderListItem,
  SimplePosOrdersReport,
  SimplePosProductRow,
  SimplePosProductsReport,
  SimplePosReportsFilters,
  SimplePosReportsPreset,
  SimplePosReportsState,
  SimplePosReportsView,
} from "@/types/simple-pos-reports";

const MX_DATE_FORMATTER = new Intl.DateTimeFormat("en-CA", {
  timeZone: "America/Mexico_City",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

const MX_SHORT_DATE_FORMATTER = new Intl.DateTimeFormat("es-MX", {
  timeZone: "America/Mexico_City",
  day: "2-digit",
  month: "short",
});

const MX_DATE_TIME_FORMATTER = new Intl.DateTimeFormat("es-MX", {
  timeZone: "America/Mexico_City",
  dateStyle: "medium",
  timeStyle: "short",
});

const DATE_ONLY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const PAGE_SIZE = 50;
const MAX_RANGE_DAYS = 31;
const MX_UTC_OFFSET_HOURS = 6;
const PRODUCT_FETCH_PAGE_SIZE = 1000;

type SimplePosReportsSearchParams = PosReportsSearchParams & {
  view?: string | string[];
  preset?: string | string[];
  page?: string | string[];
  orderId?: string | string[];
};

type IncomeDailyRow = {
  business_date_mx: string;
  is_tab: boolean;
  orders_count: number;
  gross_cents: number;
};

type RawProductSourceRow = {
  order_id: string;
  catalog_item_id: string;
  qty: number;
  unit_price_cents: number;
  line_total_cents: number;
  orders: {
    id: string;
    created_at: string;
    status: string;
    folio_text: string;
  } | {
    id: string;
    created_at: string;
    status: string;
    folio_text: string;
  }[] | null;
  catalog_items: {
    id: string;
    name: string;
    type: string | null;
    class: string | null;
    is_active: boolean | null;
    is_sold_out: boolean | null;
    is_popular: boolean | null;
    catalog_categories: {
      name: string;
    } | {
      name: string;
    }[] | null;
  } | {
    id: string;
    name: string;
    type: string | null;
    class: string | null;
    is_active: boolean | null;
    is_sold_out: boolean | null;
    is_popular: boolean | null;
    catalog_categories: {
      name: string;
    } | {
      name: string;
    }[] | null;
  }[] | null;
};

type ProductSourceRow = {
  order_id: string;
  catalog_item_id: string;
  qty: number;
  unit_price_cents: number;
  line_total_cents: number;
  orders: {
    id: string;
    created_at: string;
    status: string;
    folio_text: string;
  } | null;
  catalog_items: {
    id: string;
    name: string;
    type: string | null;
    class: string | null;
    is_active: boolean | null;
    is_sold_out: boolean | null;
    is_popular: boolean | null;
    catalog_categories: {
      name: string;
    } | null;
  } | null;
};

type RawOrderDetailSourceRow = {
  id: string;
  catalog_item_id: string;
  qty: number;
  unit_price_cents: number;
  line_total_cents: number;
  catalog_items: {
    name: string;
    catalog_categories: {
      name: string;
    } | {
      name: string;
    }[] | null;
  } | {
    name: string;
    catalog_categories: {
      name: string;
    } | {
      name: string;
    }[] | null;
  }[] | null;
};

function firstEmbedded<T>(value: T | T[] | null | undefined): T | null {
  if (Array.isArray(value)) {
    return value[0] ?? null;
  }

  return value ?? null;
}

function formatMxDateOnly(date: Date): string {
  const parts = MX_DATE_FORMATTER.formatToParts(date);
  const year = parts.find((part) => part.type === "year")?.value;
  const month = parts.find((part) => part.type === "month")?.value;
  const day = parts.find((part) => part.type === "day")?.value;

  if (!year || !month || !day) {
    throw new Error("Unable to resolve MX business date.");
  }

  return `${year}-${month}-${day}`;
}

function shiftDateOnly(dateOnly: string, deltaDays: number): string {
  const date = new Date(`${dateOnly}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + deltaDays);
  return date.toISOString().slice(0, 10);
}

function countRangeDaysInclusive(dateFrom: string, dateTo: string): number {
  const from = new Date(`${dateFrom}T00:00:00.000Z`);
  const to = new Date(`${dateTo}T00:00:00.000Z`);
  return Math.floor((to.getTime() - from.getTime()) / 86400000) + 1;
}

function normalizeDateOnly(value: string | undefined, fallback: string): string {
  if (!value) {
    return fallback;
  }

  const trimmed = value.trim();
  return DATE_ONLY_PATTERN.test(trimmed) ? trimmed : fallback;
}

function normalizeView(value: string | undefined): SimplePosReportsView {
  if (value === "income" || value === "products" || value === "orders") {
    return value;
  }

  return "income";
}

function normalizePreset(value: string | undefined): SimplePosReportsPreset {
  if (
    value === "today" ||
    value === "yesterday" ||
    value === "last7" ||
    value === "last30" ||
    value === "custom"
  ) {
    return value;
  }

  return "last7";
}

function normalizePage(value: string | undefined): number {
  const parsed = Number(value ?? "");
  if (!Number.isInteger(parsed) || parsed <= 0) {
    return 1;
  }
  return parsed;
}

function buildPresetDateRange(preset: SimplePosReportsPreset): {
  date_from: string;
  date_to: string;
} {
  const todayMx = formatMxDateOnly(new Date());

  if (preset === "today") {
    return { date_from: todayMx, date_to: todayMx };
  }

  if (preset === "yesterday") {
    const yesterday = shiftDateOnly(todayMx, -1);
    return { date_from: yesterday, date_to: yesterday };
  }

  if (preset === "last30") {
    return { date_from: shiftDateOnly(todayMx, -29), date_to: todayMx };
  }

  return { date_from: shiftDateOnly(todayMx, -6), date_to: todayMx };
}

function clampFilters(
  filters: SimplePosReportsFilters,
): { filters: SimplePosReportsFilters; warning: string | null } {
  if (filters.date_from > filters.date_to) {
    return {
      filters: {
        ...filters,
        date_from: filters.date_to,
      },
      warning: "El rango tenia fechas invertidas. Se ajusto automaticamente.",
    };
  }

  const days = countRangeDaysInclusive(filters.date_from, filters.date_to);
  if (days <= MAX_RANGE_DAYS) {
    return { filters, warning: null };
  }

  return {
    filters: {
      ...filters,
      date_from: shiftDateOnly(filters.date_to, -(MAX_RANGE_DAYS - 1)),
    },
    warning: `El rango se limito a ${MAX_RANGE_DAYS} dias para mantener tiempos de respuesta consistentes.`,
  };
}

export function buildSimplePosReportsState(
  searchParams: SimplePosReportsSearchParams,
): SimplePosReportsState {
  const preset = normalizePreset(getSingleSearchParam(searchParams.preset));
  const view = normalizeView(getSingleSearchParam(searchParams.view));
  const page = normalizePage(getSingleSearchParam(searchParams.page));
  const orderId = getSingleSearchParam(searchParams.orderId)?.trim() || null;

  const presetRange = buildPresetDateRange(preset);
  const rawFilters: SimplePosReportsFilters =
    preset === "custom"
      ? {
          preset,
          date_from: normalizeDateOnly(getSingleSearchParam(searchParams.date_from), presetRange.date_from),
          date_to: normalizeDateOnly(getSingleSearchParam(searchParams.date_to), presetRange.date_to),
        }
      : {
          preset,
          date_from: presetRange.date_from,
          date_to: presetRange.date_to,
        };

  const { filters, warning } = clampFilters(rawFilters);

  return {
    view,
    filters,
    page,
    orderId,
    warning,
  };
}

export function buildSimplePosReportsHref(
  basePath: string,
  state: {
    view: SimplePosReportsView;
    filters: SimplePosReportsFilters;
    page?: number;
    orderId?: string | null;
  },
): string {
  const params = new URLSearchParams();
  params.set("view", state.view);
  params.set("preset", state.filters.preset);

  if (state.filters.preset === "custom") {
    params.set("date_from", state.filters.date_from);
    params.set("date_to", state.filters.date_to);
  }

  if (state.page && state.page > 1) {
    params.set("page", String(state.page));
  }

  if (state.orderId) {
    params.set("orderId", state.orderId);
  }

  const query = params.toString();
  return query ? `${basePath}?${query}` : basePath;
}

function buildUtcRange(filters: SimplePosReportsFilters) {
  const endExclusive = shiftDateOnly(filters.date_to, 1);

  return {
    startIso: `${filters.date_from}T${String(MX_UTC_OFFSET_HOURS).padStart(2, "0")}:00:00.000Z`,
    endExclusiveIso: `${endExclusive}T${String(MX_UTC_OFFSET_HOURS).padStart(2, "0")}:00:00.000Z`,
  };
}

export function formatSimplePosShortDate(dateOnly: string): string {
  const date = new Date(`${dateOnly}T12:00:00.000Z`);
  return MX_SHORT_DATE_FORMATTER.format(date);
}

export function formatSimplePosDateTime(isoTimestamp: string): string {
  return MX_DATE_TIME_FORMATTER.format(new Date(isoTimestamp));
}

async function countOrdersByPrintState(input: {
  tenantId: string;
  filters: SimplePosReportsFilters;
}) {
  const supabase = getSupabaseAdminClient();
  const { startIso, endExclusiveIso } = buildUtcRange(input.filters);

  const [paidOrders, printedOrders] = await Promise.all([
    supabase
      .from("orders")
      .select("id", { count: "exact", head: true })
      .eq("tenant_id", input.tenantId)
      .eq("status", "PAID")
      .gte("created_at", startIso)
      .lt("created_at", endExclusiveIso),
    supabase
      .from("orders")
      .select("id", { count: "exact", head: true })
      .eq("tenant_id", input.tenantId)
      .eq("status", "PAID")
      .eq("print_status", "SENT")
      .gte("created_at", startIso)
      .lt("created_at", endExclusiveIso),
  ]);

  if (paidOrders.error) {
    throw new Error(`Unable to count paid simple POS orders: ${paidOrders.error.message}`);
  }

  if (printedOrders.error) {
    throw new Error(`Unable to count printed simple POS orders: ${printedOrders.error.message}`);
  }

  return {
    paidOrdersCount: paidOrders.count ?? 0,
    printedOrdersCount: printedOrders.count ?? 0,
  };
}

export async function getSimplePosIncomeReport(input: {
  tenantId: string;
  filters: SimplePosReportsFilters;
}): Promise<SimplePosIncomeReport> {
  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .from("report_sales_daily")
    .select("business_date_mx, is_tab, orders_count, gross_cents")
    .eq("tenant_id", input.tenantId)
    .gte("business_date_mx", input.filters.date_from)
    .lte("business_date_mx", input.filters.date_to)
    .order("business_date_mx", { ascending: true });

  if (error) {
    throw new Error(`Unable to load simple POS daily income: ${error.message}`);
  }

  const grouped = new Map<string, { gross_cents: number; orders_count: number }>();
  for (const row of (data ?? []) as IncomeDailyRow[]) {
    const current = grouped.get(row.business_date_mx) ?? { gross_cents: 0, orders_count: 0 };
    current.gross_cents += Number(row.gross_cents ?? 0);
    current.orders_count += Number(row.orders_count ?? 0);
    grouped.set(row.business_date_mx, current);
  }

  const daily = [...grouped.entries()].map(([date, row]) => ({
    date,
    label: formatSimplePosShortDate(date),
    gross_cents: row.gross_cents,
    orders_count: row.orders_count,
  }));

  const totals = daily.reduce(
    (accumulator, row) => {
      accumulator.gross_cents += row.gross_cents;
      accumulator.orders_count += row.orders_count;
      return accumulator;
    },
    {
      gross_cents: 0,
      orders_count: 0,
    },
  );

  const printCounts = await countOrdersByPrintState(input);

  return {
    filters: input.filters,
    totals: {
      gross_cents: totals.gross_cents,
      orders_count: totals.orders_count,
      average_ticket_cents:
        totals.orders_count > 0 ? Math.round(totals.gross_cents / totals.orders_count) : 0,
      paid_orders_count: printCounts.paidOrdersCount,
      printed_orders_count: printCounts.printedOrdersCount,
    },
    daily,
  };
}

async function listSimpleProductRows(input: {
  tenantId: string;
  filters: SimplePosReportsFilters;
}): Promise<ProductSourceRow[]> {
  const supabase = getSupabaseAdminClient();
  const { startIso, endExclusiveIso } = buildUtcRange(input.filters);
  const rows: ProductSourceRow[] = [];
  let from = 0;

  while (true) {
    const to = from + PRODUCT_FETCH_PAGE_SIZE - 1;
    const { data, error } = await supabase
      .from("order_items")
      .select(
        `
          order_id,
          catalog_item_id,
          qty,
          unit_price_cents,
          line_total_cents,
          orders!order_items_tenant_order_fkey(id, created_at, status, folio_text),
          catalog_items!order_items_catalog_item_id_fkey(
            id,
            name,
            type,
            class,
            is_active,
            is_sold_out,
            is_popular,
            catalog_categories!catalog_items_tenant_category_fkey(name)
          )
        `,
      )
      .eq("tenant_id", input.tenantId)
      .eq("orders.status", "PAID")
      .gte("orders.created_at", startIso)
      .lt("orders.created_at", endExclusiveIso)
      .range(from, to);

    if (error) {
      throw new Error(`Unable to load simple POS product rows: ${error.message}`);
    }

    const page: ProductSourceRow[] = ((data ?? []) as RawProductSourceRow[]).map((row) => ({
      ...row,
      orders: firstEmbedded(row.orders),
      catalog_items: (() => {
        const catalogItem = firstEmbedded(row.catalog_items);
        if (!catalogItem) {
          return null;
        }

        return {
          ...catalogItem,
          catalog_categories: firstEmbedded(catalogItem.catalog_categories),
        };
      })(),
    }));
    rows.push(...page);

    if (page.length < PRODUCT_FETCH_PAGE_SIZE) {
      break;
    }

    from += PRODUCT_FETCH_PAGE_SIZE;
  }

  return rows;
}

export async function getSimplePosProductsReport(input: {
  tenantId: string;
  filters: SimplePosReportsFilters;
}): Promise<SimplePosProductsReport> {
  const rows = await listSimpleProductRows(input);
  const grouped = new Map<
    string,
    SimplePosProductRow & {
      orderIds: Set<string>;
    }
  >();

  for (const row of rows) {
    const current = grouped.get(row.catalog_item_id) ?? {
      catalog_item_id: row.catalog_item_id,
      product_name: row.catalog_items?.name ?? "Producto sin catalogo",
      category_name: row.catalog_items?.catalog_categories?.name ?? null,
      product_type: row.catalog_items?.type ?? null,
      product_class: row.catalog_items?.class ?? null,
      is_active: row.catalog_items?.is_active ?? null,
      is_sold_out: row.catalog_items?.is_sold_out ?? null,
      is_popular: row.catalog_items?.is_popular ?? null,
      units_sold: 0,
      revenue_cents: 0,
      order_count: 0,
      average_unit_price_cents: 0,
      orderIds: new Set<string>(),
    };

    current.units_sold += Number(row.qty ?? 0);
    current.revenue_cents += Number(row.line_total_cents ?? 0);
    current.orderIds.add(row.order_id);
    current.average_unit_price_cents =
      current.units_sold > 0 ? Math.round(current.revenue_cents / current.units_sold) : 0;
    current.order_count = current.orderIds.size;

    grouped.set(row.catalog_item_id, current);
  }

  const products = [...grouped.values()]
    .map((row) => ({
      catalog_item_id: row.catalog_item_id,
      product_name: row.product_name,
      category_name: row.category_name,
      product_type: row.product_type,
      product_class: row.product_class,
      is_active: row.is_active,
      is_sold_out: row.is_sold_out,
      is_popular: row.is_popular,
      units_sold: row.units_sold,
      revenue_cents: row.revenue_cents,
      order_count: row.order_count,
      average_unit_price_cents: row.average_unit_price_cents,
    }))
    .sort((left, right) => {
      if (left.revenue_cents !== right.revenue_cents) {
        return right.revenue_cents - left.revenue_cents;
      }

      if (left.units_sold !== right.units_sold) {
        return right.units_sold - left.units_sold;
      }

      return left.product_name.localeCompare(right.product_name);
    });

  return {
    filters: input.filters,
    totals: {
      revenue_cents: products.reduce((sum, row) => sum + row.revenue_cents, 0),
      units_sold: products.reduce((sum, row) => sum + row.units_sold, 0),
      distinct_products_count: products.length,
    },
    top_by_units: [...products]
      .sort((left, right) => right.units_sold - left.units_sold || right.revenue_cents - left.revenue_cents)
      .slice(0, 10),
    top_by_revenue: products.slice(0, 10),
    rows: products.slice(0, 100),
  };
}

function mapOrderRow(row: Record<string, unknown>): SimplePosOrderListItem {
  return {
    id: String(row.id),
    folio_number: Number(row.folio_number ?? 0),
    folio_text: String(row.folio_text ?? ""),
    status: String(row.status ?? ""),
    total_cents: Number(row.total_cents ?? 0),
    payment_received_cents:
      row.payment_received_cents === null ? null : Number(row.payment_received_cents ?? 0),
    change_cents: row.change_cents === null ? null : Number(row.change_cents ?? 0),
    payment_method: row.payment_method === null ? null : String(row.payment_method ?? ""),
    print_status: String(row.print_status ?? ""),
    created_at: String(row.created_at ?? ""),
    is_tab: row.is_tab === null ? null : Boolean(row.is_tab),
  };
}

async function getSimplePosOrderDetail(input: {
  tenantId: string;
  filters: SimplePosReportsFilters;
  orderId: string;
}): Promise<SimplePosOrderDetail | null> {
  const supabase = getSupabaseAdminClient();
  const { startIso, endExclusiveIso } = buildUtcRange(input.filters);

  const { data: orderData, error: orderError } = await supabase
    .from("orders")
    .select(
      "id, folio_number, folio_text, status, total_cents, payment_received_cents, change_cents, payment_method, print_status, created_at, is_tab",
    )
    .eq("tenant_id", input.tenantId)
    .eq("id", input.orderId)
    .eq("status", "PAID")
    .gte("created_at", startIso)
    .lt("created_at", endExclusiveIso)
    .maybeSingle();

  if (orderError) {
    throw new Error(`Unable to load simple POS order detail: ${orderError.message}`);
  }

  if (!orderData) {
    return null;
  }

  const { data: itemsData, error: itemsError } = await supabase
    .from("order_items")
    .select(
      `
        id,
        catalog_item_id,
        qty,
        unit_price_cents,
        line_total_cents,
        catalog_items!order_items_catalog_item_id_fkey(
          name,
          catalog_categories!catalog_items_tenant_category_fkey(name)
        )
      `,
    )
    .eq("tenant_id", input.tenantId)
    .eq("order_id", input.orderId)
    .order("created_at", { ascending: true });

  if (itemsError) {
    throw new Error(`Unable to load simple POS order detail items: ${itemsError.message}`);
  }

  const items: SimplePosOrderDetailItem[] = ((itemsData ?? []) as RawOrderDetailSourceRow[]).map((row) => {
    const catalogItem = firstEmbedded(row.catalog_items);
    const category = firstEmbedded(catalogItem?.catalog_categories);

    return {
      id: row.id,
      catalog_item_id: row.catalog_item_id,
      product_name: catalogItem?.name ?? "Producto sin catalogo",
      category_name: category?.name ?? null,
      qty: Number(row.qty ?? 0),
      unit_price_cents: Number(row.unit_price_cents ?? 0),
      line_total_cents: Number(row.line_total_cents ?? 0),
    };
  });

  return {
    order: mapOrderRow(orderData as Record<string, unknown>),
    items,
  };
}

export async function getSimplePosOrdersReport(input: {
  tenantId: string;
  filters: SimplePosReportsFilters;
  page: number;
  orderId: string | null;
}): Promise<SimplePosOrdersReport> {
  const supabase = getSupabaseAdminClient();
  const { startIso, endExclusiveIso } = buildUtcRange(input.filters);
  const from = (input.page - 1) * PAGE_SIZE;
  const to = from + PAGE_SIZE - 1;

  const { data, error, count } = await supabase
    .from("orders")
    .select(
      "id, folio_number, folio_text, status, total_cents, payment_received_cents, change_cents, payment_method, print_status, created_at, is_tab",
      { count: "exact" },
    )
    .eq("tenant_id", input.tenantId)
    .eq("status", "PAID")
    .gte("created_at", startIso)
    .lt("created_at", endExclusiveIso)
    .order("created_at", { ascending: false })
    .range(from, to);

  if (error) {
    throw new Error(`Unable to load simple POS orders: ${error.message}`);
  }

  const rows = (data ?? []).map((row) => mapOrderRow(row as Record<string, unknown>));
  const totalCount = count ?? 0;
  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));
  const safePage = Math.min(input.page, totalPages);

  return {
    filters: input.filters,
    page: safePage,
    page_size: PAGE_SIZE,
    total_count: totalCount,
    total_pages: totalPages,
    rows,
    selected_order: input.orderId
      ? await getSimplePosOrderDetail({
          tenantId: input.tenantId,
          filters: input.filters,
          orderId: input.orderId,
        })
      : null,
  };
}
