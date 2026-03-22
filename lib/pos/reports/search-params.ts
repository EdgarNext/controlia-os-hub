import type { PosReportSaleChannel, PosReportsFilters } from "@/types/pos-reports";

export type PosReportsSearchParams = {
  date_from?: string | string[];
  date_to?: string | string[];
  sale_channel?: string | string[];
  payment_method?: string | string[];
};

const DATE_ONLY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const MX_DATE_FORMATTER = new Intl.DateTimeFormat("en-CA", {
  timeZone: "America/Mexico_City",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

export function getSingleSearchParam(value: string | string[] | undefined): string | undefined {
  if (typeof value === "string") {
    return value;
  }

  return Array.isArray(value) ? value[0] : undefined;
}

function formatMxDateOnly(date: Date): string {
  const parts = MX_DATE_FORMATTER.formatToParts(date);
  const year = parts.find((part) => part.type === "year")?.value;
  const month = parts.find((part) => part.type === "month")?.value;
  const day = parts.find((part) => part.type === "day")?.value;

  if (!year || !month || !day) {
    throw new Error("Unable to resolve current MX business date.");
  }

  return `${year}-${month}-${day}`;
}

export function buildDefaultPosReportsFilters(): PosReportsFilters {
  const todayMx = formatMxDateOnly(new Date());
  const fromDate = new Date(`${todayMx}T00:00:00.000Z`);
  fromDate.setUTCDate(fromDate.getUTCDate() - 6);

  return {
    date_from: fromDate.toISOString().slice(0, 10),
    date_to: todayMx,
    sale_channel: "all",
    payment_method: "all",
  };
}

function normalizeDateFilter(value: string | undefined, fallback: string): string {
  if (!value) {
    return fallback;
  }

  const normalized = value.trim();
  return DATE_ONLY_PATTERN.test(normalized) ? normalized : fallback;
}

function normalizeSaleChannelFilter(
  value: string | undefined,
  fallback: PosReportSaleChannel,
): PosReportSaleChannel {
  if (value === "quick-sale" || value === "tabs" || value === "all") {
    return value;
  }

  return fallback;
}

function normalizePaymentMethodFilter(
  value: string | undefined,
  fallback: PosReportsFilters["payment_method"],
): PosReportsFilters["payment_method"] {
  if (value === "cash" || value === "card" || value === "employee" || value === "all") {
    return value;
  }

  return fallback;
}

export function buildPosReportsFiltersFromSearchParams(searchParams: PosReportsSearchParams): {
  defaultFilters: PosReportsFilters;
  filters: PosReportsFilters;
} {
  const defaultFilters = buildDefaultPosReportsFilters();

  return {
    defaultFilters,
    filters: {
      date_from: normalizeDateFilter(
        getSingleSearchParam(searchParams.date_from),
        defaultFilters.date_from,
      ),
      date_to: normalizeDateFilter(
        getSingleSearchParam(searchParams.date_to),
        defaultFilters.date_to,
      ),
      sale_channel: normalizeSaleChannelFilter(
        getSingleSearchParam(searchParams.sale_channel),
        defaultFilters.sale_channel,
      ),
      payment_method: normalizePaymentMethodFilter(
        getSingleSearchParam(searchParams.payment_method),
        defaultFilters.payment_method,
      ),
    },
  };
}

export function buildPosReportsQueryString(filters: PosReportsFilters): string {
  const params = new URLSearchParams();
  params.set("date_from", filters.date_from);
  params.set("date_to", filters.date_to);

  if (filters.sale_channel !== "all") {
    params.set("sale_channel", filters.sale_channel);
  }

  if (filters.payment_method !== "all") {
    params.set("payment_method", filters.payment_method);
  }

  return params.toString();
}

export function buildPosReportsHref(basePath: string, filters: PosReportsFilters): string {
  const query = buildPosReportsQueryString(filters);
  return query ? `${basePath}?${query}` : basePath;
}
