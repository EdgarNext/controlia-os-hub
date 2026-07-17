const LOCALE_DATE_FORMATTER = new Intl.DateTimeFormat("en-CA", {
  timeZone: "America/Mexico_City",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

const WEEKDAY_FORMATTER = new Intl.DateTimeFormat("es-MX", {
  timeZone: "America/Mexico_City",
  weekday: "long",
});

const DATE_FORMATTER = new Intl.DateTimeFormat("es-MX", {
  timeZone: "America/Mexico_City",
  day: "2-digit",
  month: "short",
  year: "numeric",
});

const DATE_TIME_FORMATTER = new Intl.DateTimeFormat("es-MX", {
  timeZone: "America/Mexico_City",
  day: "2-digit",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

export const KITCHEN_OPS_TIME_ZONE = "America/Mexico_City";

function getFormatterParts(value: Date) {
  const parts = LOCALE_DATE_FORMATTER.formatToParts(value);
  const year = parts.find((part) => part.type === "year")?.value ?? "0000";
  const month = parts.find((part) => part.type === "month")?.value ?? "00";
  const day = parts.find((part) => part.type === "day")?.value ?? "00";

  return { year, month, day };
}

export function getKitchenBusinessDateKey(value: Date | string = new Date()): string {
  const resolved = typeof value === "string" ? new Date(value) : value;
  const { year, month, day } = getFormatterParts(resolved);
  return `${year}-${month}-${day}`;
}

export function kitchenDateKeyToUtcDate(dateKey: string): Date {
  const [year, month, day] = dateKey.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day, 12, 0, 0));
}

export function addKitchenBusinessDays(dateKey: string, days: number): string {
  const date = kitchenDateKeyToUtcDate(dateKey);
  date.setUTCDate(date.getUTCDate() + days);
  return getKitchenBusinessDateKey(date);
}

export function compareKitchenBusinessDateKeys(left: string, right: string): number {
  if (left === right) return 0;
  return left < right ? -1 : 1;
}

export function formatKitchenBusinessDate(value: Date | string | null): string {
  if (!value) return "Sin fecha";
  const resolved = typeof value === "string" ? new Date(value) : value;
  return DATE_FORMATTER.format(resolved).replace(".", "");
}

export function formatKitchenBusinessDateTime(value: Date | string | null): string {
  if (!value) return "—";
  const resolved = typeof value === "string" ? new Date(value) : value;
  return DATE_TIME_FORMATTER.format(resolved).replace(".", "");
}

export function getKitchenBusinessWeekdayLabel(value: Date | string | null): string | null {
  if (!value) return null;
  const resolved = typeof value === "string" ? new Date(value) : value;
  return WEEKDAY_FORMATTER.format(resolved);
}

export function resolveKitchenRelativeDateLabel(
  dateKey: string | null,
  todayKey: string,
): "Hoy" | "Mañana" | "Ayer" | null {
  if (!dateKey) return null;
  if (dateKey === todayKey) return "Hoy";
  if (dateKey === addKitchenBusinessDays(todayKey, 1)) return "Mañana";
  if (dateKey === addKitchenBusinessDays(todayKey, -1)) return "Ayer";
  return null;
}
