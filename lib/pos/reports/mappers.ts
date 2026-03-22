import type {
  PosReportOrderListItem,
  PosReportPaymentMethod,
  PosReportsDailyAggregateRow,
  PosReportsOverviewViewModel,
} from "@/types/pos-reports";
import type { NormalizedPosReportsFilters } from "./filters";

type IntegerLike = number | string | null | undefined;

type ReportSalesDailyRow = {
  business_date_mx: string;
  is_tab: boolean;
  orders_count: IntegerLike;
  gross_cents: IntegerLike;
  cash_cents: IntegerLike;
  card_cents: IntegerLike;
  employee_cents: IntegerLike;
  updated_at: string;
};

type OrdersOverviewSourceRow = {
  total_cents: IntegerLike;
  payment_method: string | null;
  created_at: string;
  closed_at: string | null;
  is_tab: boolean | null;
};

type OrderListSourceRow = {
  id: string;
  tenant_id: string;
  kiosk_id: string;
  folio_number: IntegerLike;
  folio_text: string;
  status: string;
  total_cents: IntegerLike;
  payment_received_cents: IntegerLike;
  change_cents: IntegerLike;
  payment_method: string | null;
  print_status: string;
  print_attempt_count: IntegerLike;
  last_print_error: string | null;
  last_print_at: string | null;
  created_at: string;
  closed_at?: string | null;
  is_tab?: boolean | null;
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

function parseNullableIntegerLike(value: IntegerLike, fieldName: string): number | null {
  if (value == null) {
    return null;
  }

  return parseIntegerLike(value, fieldName);
}

function normalizeOrderPaymentMethod(value: string | null): PosReportPaymentMethod | null {
  if (value == null) {
    return null;
  }

  if (value === "cash" || value === "card" || value === "employee") {
    return value;
  }

  return null;
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

export function mapReportSalesDailyRow(row: ReportSalesDailyRow): PosReportsDailyAggregateRow {
  return {
    business_date_mx: row.business_date_mx,
    is_tab: row.is_tab,
    orders_count: parseIntegerLike(row.orders_count, "report_sales_daily.orders_count"),
    gross_cents: parseIntegerLike(row.gross_cents, "report_sales_daily.gross_cents"),
    cash_cents: parseIntegerLike(row.cash_cents, "report_sales_daily.cash_cents"),
    card_cents: parseIntegerLike(row.card_cents, "report_sales_daily.card_cents"),
    employee_cents: parseIntegerLike(row.employee_cents, "report_sales_daily.employee_cents"),
    updated_at: row.updated_at,
  };
}

export function mapOrderRowToListItem(row: OrderListSourceRow): PosReportOrderListItem {
  return {
    id: row.id,
    tenant_id: row.tenant_id,
    kiosk_id: row.kiosk_id,
    folio_number: parseIntegerLike(row.folio_number, "orders.folio_number"),
    folio_text: row.folio_text,
    status: row.status,
    total_cents: parseIntegerLike(row.total_cents, "orders.total_cents"),
    payment_received_cents: parseNullableIntegerLike(
      row.payment_received_cents,
      "orders.payment_received_cents",
    ),
    change_cents: parseNullableIntegerLike(row.change_cents, "orders.change_cents"),
    payment_method: normalizeOrderPaymentMethod(row.payment_method),
    print_status: row.print_status,
    print_attempt_count: parseIntegerLike(
      row.print_attempt_count,
      "orders.print_attempt_count",
    ),
    last_print_error: row.last_print_error,
    last_print_at: row.last_print_at,
    created_at: row.created_at,
    closed_at: row.closed_at ?? null,
    is_tab: row.is_tab ?? false,
  };
}

export function mapOrdersToOverviewDailyRows(
  rows: OrdersOverviewSourceRow[],
  filters: NormalizedPosReportsFilters,
): PosReportsDailyAggregateRow[] {
  const grouped = new Map<string, PosReportsDailyAggregateRow>();

  for (const row of rows) {
    const paymentMethod = normalizeOrderPaymentMethod(row.payment_method);
    const timestamp = row.closed_at ?? row.created_at;
    const businessDate = toMxBusinessDate(timestamp);

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

    if (filters.payment_method !== "all" && paymentMethod !== filters.payment_method) {
      continue;
    }

    const groupKey = `${businessDate}:${isTab ? "tab" : "quick-sale"}`;
    const totalCents = parseIntegerLike(row.total_cents, "orders.total_cents");
    const current = grouped.get(groupKey) ?? {
      business_date_mx: businessDate,
      is_tab: isTab,
      orders_count: 0,
      gross_cents: 0,
      cash_cents: 0,
      card_cents: 0,
      employee_cents: 0,
      updated_at: row.closed_at ?? row.created_at,
    };

    current.orders_count += 1;
    current.gross_cents += totalCents;

    if (paymentMethod === "cash") {
      current.cash_cents += totalCents;
    } else if (paymentMethod === "card") {
      current.card_cents += totalCents;
    } else if (paymentMethod === "employee") {
      current.employee_cents += totalCents;
    }

    const currentUpdatedAt = new Date(current.updated_at).getTime();
    const rowUpdatedAt = new Date(row.closed_at ?? row.created_at).getTime();
    if (Number.isFinite(rowUpdatedAt) && rowUpdatedAt > currentUpdatedAt) {
      current.updated_at = row.closed_at ?? row.created_at;
    }

    grouped.set(groupKey, current);
  }

  return [...grouped.values()].sort((left, right) => {
    if (left.business_date_mx !== right.business_date_mx) {
      return left.business_date_mx.localeCompare(right.business_date_mx);
    }

    return Number(left.is_tab) - Number(right.is_tab);
  });
}

export function buildPosReportsOverviewViewModel(
  filters: NormalizedPosReportsFilters,
  daily: PosReportsDailyAggregateRow[],
): PosReportsOverviewViewModel {
  const totals = daily.reduce(
    (accumulator, row) => {
      accumulator.orders_count += row.orders_count;
      accumulator.gross_cents += row.gross_cents;
      accumulator.cash_cents += row.cash_cents;
      accumulator.card_cents += row.card_cents;
      accumulator.employee_cents += row.employee_cents;
      return accumulator;
    },
    {
      orders_count: 0,
      gross_cents: 0,
      cash_cents: 0,
      card_cents: 0,
      employee_cents: 0,
      average_ticket_cents: 0,
    },
  );

  totals.average_ticket_cents =
    totals.orders_count > 0 ? Math.round(totals.gross_cents / totals.orders_count) : 0;

  return {
    filters: {
      date_from: filters.date_from,
      date_to: filters.date_to,
      sale_channel: filters.sale_channel,
      payment_method: filters.payment_method,
    },
    totals,
    daily,
  };
}
