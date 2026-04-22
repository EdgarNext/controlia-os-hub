import type { PosReportSaleChannel, PosReportsFilters } from "@/types/pos-reports";

export type NormalizedPosReportsFilters = PosReportsFilters & {
  include_quick_sale: boolean;
  include_tabs: boolean;
  uses_daily_aggregate_source: boolean;
};

const DATE_ONLY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const SALE_CHANNEL_VALUES = new Set<PosReportSaleChannel>(["all", "quick-sale", "tabs"]);
const PAYMENT_METHOD_VALUES = new Set<PosReportsFilters["payment_method"]>([
  "all",
  "cash",
  "card",
  "transfer",
]);

function normalizeDateOnly(value: string, fieldName: "date_from" | "date_to"): string {
  const normalized = value.trim();

  if (!DATE_ONLY_PATTERN.test(normalized)) {
    throw new Error(`${fieldName} must use YYYY-MM-DD format.`);
  }

  const [yearPart, monthPart, dayPart] = normalized.split("-");
  const year = Number(yearPart);
  const month = Number(monthPart);
  const day = Number(dayPart);
  const candidate = new Date(Date.UTC(year, month - 1, day));

  if (
    Number.isNaN(candidate.getTime()) ||
    candidate.getUTCFullYear() !== year ||
    candidate.getUTCMonth() !== month - 1 ||
    candidate.getUTCDate() !== day
  ) {
    throw new Error(`${fieldName} must be a valid calendar date.`);
  }

  return normalized;
}

function normalizeSaleChannel(value: PosReportsFilters["sale_channel"]): PosReportSaleChannel {
  if (!SALE_CHANNEL_VALUES.has(value)) {
    throw new Error("sale_channel must be one of: all, quick-sale, tabs.");
  }

  return value;
}

function normalizePaymentMethod(
  value: PosReportsFilters["payment_method"],
): PosReportsFilters["payment_method"] {
  if (!PAYMENT_METHOD_VALUES.has(value)) {
    throw new Error("payment_method must be one of: all, cash, card, transfer.");
  }

  return value;
}

export function normalizePosReportsFilters(input: PosReportsFilters): NormalizedPosReportsFilters {
  const dateFrom = normalizeDateOnly(input.date_from, "date_from");
  const dateTo = normalizeDateOnly(input.date_to, "date_to");
  const saleChannel = normalizeSaleChannel(input.sale_channel);
  const paymentMethod = normalizePaymentMethod(input.payment_method);

  if (dateFrom > dateTo) {
    throw new Error("date_from must be less than or equal to date_to.");
  }

  return {
    date_from: dateFrom,
    date_to: dateTo,
    sale_channel: saleChannel,
    payment_method: paymentMethod,
    include_quick_sale: saleChannel !== "tabs",
    include_tabs: saleChannel !== "quick-sale",
    uses_daily_aggregate_source: paymentMethod === "all",
  };
}
