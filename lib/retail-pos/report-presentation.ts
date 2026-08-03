export function formatReportOperatorName(name: string | null | undefined) {
  return name?.trim() || "Operador no identificado";
}

export function formatReportStationName(input: {
  stationName?: string | null;
  deviceName?: string | null;
  role?: string | null;
}) {
  const station = input.stationName?.trim() || input.deviceName?.trim();
  if (station) return station;
  if (input.role === "counter_station") return "Terminal de caja";
  if (input.role === "multi_station") return "Terminal multifunción";
  return "Terminal no identificada";
}

export function formatReportRoleLabel(role: string | null | undefined) {
  if (role === "counter_station") return "Terminal de caja";
  if (role === "multi_station") return "Terminal multifunción";
  if (role === "order_station") return "Terminal de pedidos";
  return role?.trim() || "Rol no configurado";
}

export function formatReportShiftName(input: {
  shiftNumber?: string | number | null;
  stationName?: string | null;
  deviceName?: string | null;
  openedAt: string;
}) {
  const number = input.shiftNumber === null || input.shiftNumber === undefined ? null : String(input.shiftNumber).trim();
  if (number) return `Turno ${number}`;
  const date = new Intl.DateTimeFormat("es-MX", { dateStyle: "short" }).format(new Date(input.openedAt));
  return `${formatReportStationName(input)} · ${date}`;
}

export function formatReportDocumentName(originalFolio: string | null | undefined, documentId: string) {
  return originalFolio?.trim() || `Documento ${documentId.slice(0, 8)}`;
}
