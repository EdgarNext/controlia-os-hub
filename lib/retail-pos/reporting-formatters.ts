import { RETAIL_REPORTING_TIME_ZONE } from "./reporting-semantics";

const currencyFormatter = new Intl.NumberFormat("es-MX", {
  style: "currency",
  currency: "MXN",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const countFormatter = new Intl.NumberFormat("es-MX");

const percentFormatter = new Intl.NumberFormat("es-MX", {
  style: "percent",
  minimumFractionDigits: 0,
  maximumFractionDigits: 1,
});

const dateTimeFormatter = new Intl.DateTimeFormat("es-MX", {
  timeZone: RETAIL_REPORTING_TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
});

export function formatRetailReportingCurrency(cents: number): string {
  return currencyFormatter.format(cents / 100);
}

export function formatRetailReportingCount(value: number): string {
  if (Number.isInteger(value)) {
    return countFormatter.format(value);
  }

  return value.toLocaleString("es-MX", { maximumFractionDigits: 2 });
}

export function formatRetailReportingQuantity(value: number): string {
  return value.toLocaleString("es-MX", {
    minimumFractionDigits: Number.isInteger(value) ? 0 : 2,
    maximumFractionDigits: 2,
  });
}

export function formatRetailReportingPercent(value: number): string {
  return percentFormatter.format(value);
}

export function formatRetailReportingDateTime(value: string | null): string {
  if (!value) {
    return "—";
  }

  return dateTimeFormatter.format(new Date(value));
}

export function formatRetailReportingPeriodLabel(dateFrom: string, dateTo: string): string {
  return dateFrom === dateTo ? dateFrom : `${dateFrom} -> ${dateTo}`;
}

export function formatRetailReportingTimeZoneLabel(): string {
  return RETAIL_REPORTING_TIME_ZONE;
}
