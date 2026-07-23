const localDateTimeFormatter = new Intl.DateTimeFormat("es-MX", {
  weekday: "short",
  day: "numeric",
  month: "short",
  hour: "numeric",
  minute: "2-digit",
});

export function formatLocalDateTime(value: Date) {
  return localDateTimeFormatter.format(value).replace(/\./g, "");
}
