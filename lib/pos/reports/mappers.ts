import type {
  PosReportPaymentMethod,
  PosReportsDailyAggregateRow,
  PosReportsOverviewViewModel,
} from "@/types/pos-reports";
import type { NormalizedPosReportsFilters } from "./filters";

type IntegerLike = number | string | null | undefined;

type SalesAccountOverviewSourceRow = {
  id: string;
  total_cents: IntegerLike;
  service_context: string;
  created_at: string;
  closed_at: string | null;
};

type SalesAccountPaymentSourceRow = {
  sales_account_id: string;
  payment_method: string | null;
  amount_paid_cents: IntegerLike;
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

function normalizePaymentMethod(value: string | null): PosReportPaymentMethod | null {
  if (value == null) {
    return null;
  }

  if (value === "cash" || value === "card" || value === "transfer") {
    return value;
  }

  return null;
}

function toMxBusinessDate(isoTimestamp: string): string {
  const date = new Date(isoTimestamp);

  if (Number.isNaN(date.getTime())) {
    throw new Error("Sales account timestamp must be a valid ISO date.");
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

export function mapSalesAccountsToOverviewDailyRows(
  rows: SalesAccountOverviewSourceRow[],
  payments: SalesAccountPaymentSourceRow[],
  filters: NormalizedPosReportsFilters,
): PosReportsDailyAggregateRow[] {
  const paymentTotalsByAccountId = payments.reduce<
    Map<string, { cash: number; card: number; transfer: number }>
  >((accumulator, row) => {
    const paymentMethod = normalizePaymentMethod(row.payment_method);
    if (!paymentMethod) {
      return accumulator;
    }

    const current = accumulator.get(row.sales_account_id) ?? {
      cash: 0,
      card: 0,
      transfer: 0,
    };
    current[paymentMethod] += parseIntegerLike(
      row.amount_paid_cents,
      "sales_account_payments.amount_paid_cents",
    );
    accumulator.set(row.sales_account_id, current);
    return accumulator;
  }, new Map());

  const grouped = new Map<string, PosReportsDailyAggregateRow>();

  for (const row of rows) {
    const timestamp = row.closed_at ?? row.created_at;
    const businessDate = toMxBusinessDate(timestamp);
    const totalCents = parseIntegerLike(row.total_cents, "sales_accounts.total_cents");

    if (businessDate < filters.date_from || businessDate > filters.date_to) {
      continue;
    }

    const isTab = row.service_context === "table_service";
    if (!filters.include_tabs && isTab) {
      continue;
    }
    if (!filters.include_quick_sale && !isTab) {
      continue;
    }

    const paymentTotals = paymentTotalsByAccountId.get(row.id) ?? {
      cash: 0,
      card: 0,
      transfer: 0,
    };
    const capturedTotal =
      paymentTotals.cash + paymentTotals.card + paymentTotals.transfer;
    if (capturedTotal !== totalCents) {
      continue;
    }
    const selectedPaymentAmount =
      filters.payment_method === "all" ? 0 : paymentTotals[filters.payment_method];

    if (filters.payment_method !== "all" && selectedPaymentAmount <= 0) {
      continue;
    }

    const grossCents =
      filters.payment_method === "all" ? totalCents : selectedPaymentAmount;

    const groupKey = `${businessDate}:${isTab ? "tab" : "quick-sale"}`;
    const current = grouped.get(groupKey) ?? {
      business_date_mx: businessDate,
      is_tab: isTab,
      orders_count: 0,
      gross_cents: 0,
      cash_cents: 0,
      card_cents: 0,
      transfer_cents: 0,
      updated_at: timestamp,
    };

    current.orders_count += 1;
    current.gross_cents += grossCents;

    if (filters.payment_method === "all") {
      current.cash_cents += paymentTotals.cash;
      current.card_cents += paymentTotals.card;
      current.transfer_cents += paymentTotals.transfer;
    } else if (filters.payment_method === "cash") {
      current.cash_cents += selectedPaymentAmount;
    } else if (filters.payment_method === "card") {
      current.card_cents += selectedPaymentAmount;
    } else {
      current.transfer_cents += selectedPaymentAmount;
    }

    const currentUpdatedAt = new Date(current.updated_at).getTime();
    const rowUpdatedAt = new Date(timestamp).getTime();
    if (Number.isFinite(rowUpdatedAt) && rowUpdatedAt > currentUpdatedAt) {
      current.updated_at = timestamp;
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
      accumulator.transfer_cents += row.transfer_cents;
      return accumulator;
    },
    {
      orders_count: 0,
      gross_cents: 0,
      cash_cents: 0,
      card_cents: 0,
      transfer_cents: 0,
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
