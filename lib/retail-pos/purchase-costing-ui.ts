export function formatBpsPercent(bps: number) {
  const whole = Math.trunc(bps / 100);
  const remainder = Math.abs(bps % 100);
  return remainder === 0 ? String(whole) : `${whole}.${String(remainder).padStart(2, "0")}`.replace(/0+$/, "");
}

export function parsePercentToBps(value: string, maximumBps: number) {
  const normalized = value.trim().replace(",", ".");
  if (!/^\d+(?:\.\d{1,2})?$/.test(normalized)) return null;
  const [whole, fraction = ""] = normalized.split(".");
  const bps = Number(whole) * 100 + Number(fraction.padEnd(2, "0"));
  return Number.isSafeInteger(bps) && bps >= 0 && bps <= maximumBps ? bps : null;
}

export function centsToInput(cents: number | null | undefined) {
  if (cents === null || cents === undefined || cents === 0) return "";
  return (cents / 100).toFixed(2);
}

export function inputToCents(value: string) {
  const normalized = value.trim().replace(",", ".");
  if (!/^\d+(?:\.\d{1,2})?$/.test(normalized)) return null;
  const [whole, fraction = ""] = normalized.split(".");
  const cents = Number(whole) * 100 + Number(fraction.padEnd(2, "0"));
  return Number.isSafeInteger(cents) ? cents : null;
}

export function roundCentsUpToPeso(cents: number) {
  return Math.ceil(cents / 100) * 100;
}

export type PurchaseCostingPriceMode = "suggested" | "rounded" | "manual";

export function resolvePurchaseCostingFinalPrice(mode: PurchaseCostingPriceMode, suggestedCents: number | null, manualCents: number | null) {
  if (mode === "manual") return manualCents ?? suggestedCents;
  if (suggestedCents === null) return null;
  return mode === "rounded" ? roundCentsUpToPeso(suggestedCents) : suggestedCents;
}

export function formatMoney(cents: number | null | undefined) {
  if (cents === null || cents === undefined) return "—";
  return (cents / 100).toLocaleString("es-MX", { style: "currency", currency: "MXN" });
}

export function formatQuantity(value: string | null | undefined) {
  if (!value) return "—";
  return value.replace(/\.0+$/, "").replace(/(\.\d*?)0+$/, "$1");
}

const RETAIL_POS_UNIT_PLURALS: Record<string, string> = {
  pieza: "piezas", kilogramo: "kilogramos", kilo: "kilos", metro: "metros", litro: "litros",
  caja: "cajas", bulto: "bultos", paquete: "paquetes", rollo: "rollos", saco: "sacos", tubo: "tubos", garrafa: "garrafas",
};

export function pluralizeRetailPosUnit(label: string) {
  const value = label.trim();
  if (!value) return "unidades";
  const lower = value.toLocaleLowerCase("es-MX");
  const plural = RETAIL_POS_UNIT_PLURALS[lower] ?? (lower.endsWith("z") ? `${lower.slice(0, -1)}ces` : lower.endsWith("s") ? lower : `${lower}s`);
  return /^[A-ZÁÉÍÓÚÜÑ]/.test(value) ? `${plural.charAt(0).toLocaleUpperCase("es-MX")}${plural.slice(1)}` : plural;
}

export function singularizeRetailPosPresentation(label: string) {
  const value = label.trim();
  if (!value) return "presentación";
  const parts = value.split(/(\s+)/);
  const wordIndex = parts.length - 1 - [...parts].reverse().findIndex((part) => part.trim() !== "");
  const word = parts[wordIndex] ?? value;
  const lower = word.toLocaleLowerCase("es-MX");
  const singular = lower.endsWith("ces") ? lower.slice(0, -3) + "z" : lower.endsWith("s") ? lower.slice(0, -1) : lower;
  parts[wordIndex] = /^[A-ZÁÉÍÓÚÜÑ]/.test(word) ? `${singular.charAt(0).toLocaleUpperCase("es-MX")}${singular.slice(1)}` : singular;
  return parts.join("");
}
