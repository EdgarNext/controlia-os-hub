const UNIT_CODE_MAP: Record<string, string> = {
  kg: "kg",
  g: "g",
  l: "l",
  ml: "ml",
  pza: "pza",
  caja: "caja",
  paquete: "paquete",
};

export function formatKitchenUnit(code: string | null | undefined): string {
  if (!code) return "—";
  const normalized = code.trim().toLowerCase();
  return UNIT_CODE_MAP[normalized] ?? normalized;
}

export function formatKitchenUnitOptionLabel(unit: { code?: string | null; name?: string | null } | null | undefined): string {
  const code = formatKitchenUnit(unit?.code);
  if (code !== "—") return code;
  const name = String(unit?.name ?? "").trim();
  return name || "ud";
}

export function formatQuantityWithUnit(
  quantity: number | string | null | undefined,
  unitCode: string | null | undefined,
  maxFractionDigits = 2,
): string {
  const value = Number(quantity ?? 0);
  const formatted = value.toLocaleString("es-MX", {
    minimumFractionDigits: 0,
    maximumFractionDigits: maxFractionDigits,
  });
  return `${formatted} ${formatKitchenUnit(unitCode)}`;
}

export function isKitchenUnitSuspicious(code: string | null | undefined): boolean {
  if (!code) return true;
  const normalized = code.trim().toLowerCase();
  return normalized.startsWith("t");
}
