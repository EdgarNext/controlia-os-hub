import type {
  PosProductPerformanceRow,
  PosProductsChartPoint,
  PosProductsHighlights,
  PosProductsReportData,
  PosReportsFilters,
} from "@/types/pos-reports";
import type { NormalizedPosReportsFilters } from "./filters";

type IntegerLike = number | string | null | undefined;

type OrdersSourceRow = {
  id: string;
  payment_method: string | null;
  created_at: string;
  closed_at: string | null;
  is_tab: boolean | null;
};

type ProductCatalogSourceRow = {
  id: string;
  name: string;
  category_id: string | null;
  category_name: string | null;
  type: string | null;
  class: string | null;
  is_active: boolean | null;
  is_sold_out: boolean | null;
  is_popular: boolean | null;
};

type ProductLineSourceRow = {
  order_id: string;
  product_id: string;
  qty: IntegerLike;
  unit_price_cents: IntegerLike;
  gross_cents: IntegerLike;
  product_name_snapshot?: string | null;
  category_name_snapshot?: string | null;
  line_kind?: string | null;
  source: "quick-sale" | "tabs";
};

type CandidateProductAccumulator = {
  product_id: string;
  product_name: string;
  category_name: string | null;
  product_type: string | null;
  product_class: string | null;
  is_active: boolean | null;
  is_sold_out: boolean | null;
  is_popular: boolean | null;
  units_sold: number;
  gross_cents: number;
  average_unit_price_cents: number;
  order_ids: Set<string>;
  quick_sale_units: number;
  quick_sale_gross_cents: number;
  tab_units: number;
  tab_gross_cents: number;
};

const MX_BUSINESS_DATE_FORMATTER = new Intl.DateTimeFormat("en-CA", {
  timeZone: "America/Mexico_City",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

function parseIntegerLike(value: IntegerLike, fieldName: string): number {
  if (typeof value === "number") {
    if (!Number.isFinite(value)) {
      throw new Error(`${fieldName} must be a finite number.`);
    }

    return value;
  }

  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) {
      throw new Error(`${fieldName} must be numeric.`);
    }

    return parsed;
  }

  throw new Error(`${fieldName} is required.`);
}

function normalizePaymentMethod(value: string | null): PosReportsFilters["payment_method"] {
  if (value === "cash" || value === "card" || value === "transfer") {
    return value;
  }

  return "all";
}

function toMxBusinessDate(isoTimestamp: string): string {
  const date = new Date(isoTimestamp);

  if (Number.isNaN(date.getTime())) {
    throw new Error("Order timestamp must be a valid ISO date.");
  }

  const parts = MX_BUSINESS_DATE_FORMATTER.formatToParts(date);
  const year = parts.find((part) => part.type === "year")?.value;
  const month = parts.find((part) => part.type === "month")?.value;
  const day = parts.find((part) => part.type === "day")?.value;

  if (!year || !month || !day) {
    throw new Error("Unable to format business_date_mx.");
  }

  return `${year}-${month}-${day}`;
}

export function mapOrdersToEligibleOrderIds(
  rows: OrdersSourceRow[],
  filters: NormalizedPosReportsFilters,
): {
  quickSaleOrderIds: string[];
  tabOrderIds: string[];
} {
  const quickSaleOrderIds: string[] = [];
  const tabOrderIds: string[] = [];

  for (const row of rows) {
    const businessDate = toMxBusinessDate(row.closed_at ?? row.created_at);
    if (businessDate < filters.date_from || businessDate > filters.date_to) {
      continue;
    }

    const isTab = Boolean(row.is_tab);
    if (!filters.include_tabs && isTab) {
      continue;
    }

    if (!filters.include_quick_sale && !isTab) {
      continue;
    }

    const paymentMethod = normalizePaymentMethod(row.payment_method);
    if (filters.payment_method !== "all" && paymentMethod !== filters.payment_method) {
      continue;
    }

    if (isTab) {
      tabOrderIds.push(row.id);
    } else {
      quickSaleOrderIds.push(row.id);
    }
  }

  return { quickSaleOrderIds, tabOrderIds };
}

function buildDefaultProductAccumulator(productId: string): CandidateProductAccumulator {
  return {
    product_id: productId,
    product_name: "Producto sin catalogo",
    category_name: null,
    product_type: null,
    product_class: null,
    is_active: null,
    is_sold_out: null,
    is_popular: null,
    units_sold: 0,
    gross_cents: 0,
    average_unit_price_cents: 0,
    order_ids: new Set<string>(),
    quick_sale_units: 0,
    quick_sale_gross_cents: 0,
    tab_units: 0,
    tab_gross_cents: 0,
  };
}

export function buildPosProductsReportData(input: {
  filters: NormalizedPosReportsFilters;
  catalogProducts: ProductCatalogSourceRow[];
  lines: ProductLineSourceRow[];
}): PosProductsReportData {
  const productById = new Map(input.catalogProducts.map((row) => [row.id, row]));
  const grouped = new Map<string, CandidateProductAccumulator>();

  for (const line of input.lines) {
    const qty = parseIntegerLike(line.qty, "product_line.qty");
    parseIntegerLike(line.unit_price_cents, "product_line.unit_price_cents");
    const grossCents = parseIntegerLike(line.gross_cents, "product_line.gross_cents");
    const catalogProduct = productById.get(line.product_id);
    const current = grouped.get(line.product_id) ?? buildDefaultProductAccumulator(line.product_id);

    if (catalogProduct) {
      current.product_name = catalogProduct.name;
      current.category_name = catalogProduct.category_name;
      current.product_type = catalogProduct.type;
      current.product_class = catalogProduct.class;
      current.is_active = catalogProduct.is_active;
      current.is_sold_out = catalogProduct.is_sold_out;
      current.is_popular = catalogProduct.is_popular;
    } else {
      current.product_name = line.product_name_snapshot || current.product_name;
      current.category_name = line.category_name_snapshot || current.category_name;
      current.product_type = line.line_kind || current.product_type;
    }

    current.units_sold += qty;
    current.gross_cents += grossCents;
    current.order_ids.add(line.order_id);

    if (line.source === "quick-sale") {
      current.quick_sale_units += qty;
      current.quick_sale_gross_cents += grossCents;
    } else {
      current.tab_units += qty;
      current.tab_gross_cents += grossCents;
    }

    current.average_unit_price_cents =
      current.units_sold > 0 ? Math.round(current.gross_cents / current.units_sold) : 0;

    grouped.set(line.product_id, current);
  }

  const totalGross = [...grouped.values()].reduce((sum, row) => sum + row.gross_cents, 0);
  const rows: PosProductPerformanceRow[] = [...grouped.values()]
    .map((row) => ({
      product_id: row.product_id,
      product_name: row.product_name,
      category_name: row.category_name,
      product_type: row.product_type,
      product_class: row.product_class,
      is_active: row.is_active,
      is_sold_out: row.is_sold_out,
      is_popular: row.is_popular,
      units_sold: row.units_sold,
      gross_cents: row.gross_cents,
      order_count: row.order_ids.size,
      average_unit_price_cents: row.average_unit_price_cents,
      share_percent: totalGross > 0 ? (row.gross_cents / totalGross) * 100 : 0,
      quick_sale_units: row.quick_sale_units,
      quick_sale_gross_cents: row.quick_sale_gross_cents,
      tab_units: row.tab_units,
      tab_gross_cents: row.tab_gross_cents,
    }))
    .sort((left, right) => {
      if (left.gross_cents !== right.gross_cents) {
        return right.gross_cents - left.gross_cents;
      }

      if (left.units_sold !== right.units_sold) {
        return right.units_sold - left.units_sold;
      }

      return left.product_name.localeCompare(right.product_name);
    });

  const topProductsChart: PosProductsChartPoint[] = rows.slice(0, 8).map((row) => ({
    product_id: row.product_id,
    label: row.product_name,
    gross_cents: row.gross_cents,
    units_sold: row.units_sold,
    share_percent: row.share_percent,
  }));

  const lowPerformers = [...rows]
    .filter((row) => row.units_sold > 0)
    .sort((left, right) => {
      if (left.gross_cents !== right.gross_cents) {
        return left.gross_cents - right.gross_cents;
      }

      if (left.units_sold !== right.units_sold) {
        return left.units_sold - right.units_sold;
      }

      return left.product_name.localeCompare(right.product_name);
    })
    .slice(0, 5);

  const topUnitsProduct = [...rows].sort((left, right) => {
    if (left.units_sold !== right.units_sold) {
      return right.units_sold - left.units_sold;
    }

    return right.gross_cents - left.gross_cents;
  })[0];

  const highlights: PosProductsHighlights = {
    top_revenue_product: rows[0]
      ? {
          label: rows[0].product_name,
          gross_cents: rows[0].gross_cents,
          units_sold: rows[0].units_sold,
        }
      : null,
    top_units_product: topUnitsProduct
      ? {
          label: topUnitsProduct.product_name,
          units_sold: topUnitsProduct.units_sold,
          gross_cents: topUnitsProduct.gross_cents,
        }
      : null,
    low_performers: lowPerformers,
  };

  const topFiveSharePercent = rows
    .slice(0, 5)
    .reduce((sum, row) => sum + row.share_percent, 0);

  return {
    filters: {
      date_from: input.filters.date_from,
      date_to: input.filters.date_to,
      sale_channel: input.filters.sale_channel,
      payment_method: input.filters.payment_method,
    },
    totals: {
      gross_cents: totalGross,
      units_sold: rows.reduce((sum, row) => sum + row.units_sold, 0),
      products_sold_count: rows.length,
      average_revenue_per_product_cents:
        rows.length > 0 ? Math.round(totalGross / rows.length) : 0,
      top_five_share_percent: topFiveSharePercent,
    },
    products: rows,
    top_products_chart: topProductsChart,
    highlights,
  };
}
