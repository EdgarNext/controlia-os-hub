import type { RetailPosCatalogImportProductInput } from "../../../shared/types/retail-pos";

export const RETAIL_POS_CATALOG_IMPORT_CANONICAL_PRODUCT_HEADERS = [
  "name",
  "category_name",
  "brand",
  "sku",
  "barcode",
  "unit_price",
  "cost",
  "sales_unit_code",
  "sales_unit_label",
  "allow_decimal_quantity",
  "is_active",
] as const;

const COST_HEADER_ALIASES = ["cost", "costo", "cost_cents", "costo_unitario", "precio_costo"] as const;
const UNIT_PRICE_HEADER_ALIASES = ["unit_price", "precio_publico", "precio", "price"] as const;

export type RetailPosCatalogImportWarning = {
  field: "cost" | "unit_price";
  message: string;
};

export type RetailPosCatalogImportNormalizationResult = {
  row: RetailPosCatalogImportProductInput;
  warnings: RetailPosCatalogImportWarning[];
  source: {
    unit_price: string | null;
    cost: string | null;
  };
};

function findHeaderValue(
  record: Record<string, string | null | undefined>,
  aliases: readonly string[],
): string | null {
  for (const alias of aliases) {
    const value = record[alias];
    if (typeof value === "string") {
      return value;
    }
  }

  return null;
}

function normalizeOptionalString(value: string | null | undefined): string | null {
  const normalized = value?.trim();
  return normalized ? normalized : null;
}

function normalizeRequiredString(value: string | null | undefined, field: string): string {
  const normalized = normalizeOptionalString(value);
  if (!normalized) {
    throw new Error(`${field} es obligatorio.`);
  }

  return normalized;
}

function normalizeBoolean(value: string | null | undefined, fallback: boolean): boolean {
  const normalized = value?.trim().toLowerCase();
  if (!normalized) {
    return fallback;
  }

  if (["true", "1", "yes", "si", "sí", "active", "activo"].includes(normalized)) {
    return true;
  }

  if (["false", "0", "no", "inactive", "inactivo"].includes(normalized)) {
    return false;
  }

  throw new Error(`Valor booleano inválido: ${value}`);
}

export function parseRetailPosMoneyToCents(
  rawValue: string | null | undefined,
  options: {
    field: "cost" | "unit_price";
    allowEmpty: boolean;
  },
): number | null {
  const trimmed = rawValue?.trim() ?? "";
  if (!trimmed) {
    if (options.allowEmpty) {
      return null;
    }

    throw new Error(`${options.field} es obligatorio.`);
  }

  const noSpaces = trimmed.replace(/\s+/g, "");
  const currencyStripped = noSpaces.replace(/[$€£¥]/g, "");
  let normalized = currencyStripped;

  const hasComma = normalized.includes(",");
  const hasDot = normalized.includes(".");

  if (hasComma && hasDot) {
    normalized = normalized.replace(/,/g, "");
  } else if (hasComma) {
    const lastCommaIndex = normalized.lastIndexOf(",");
    const decimals = normalized.length - lastCommaIndex - 1;
    normalized =
      decimals > 0 && decimals <= 2
        ? `${normalized.slice(0, lastCommaIndex).replace(/,/g, "")}.${normalized.slice(lastCommaIndex + 1)}`
        : normalized.replace(/,/g, "");
  }

  if (!/^-?\d+(\.\d+)?$/.test(normalized)) {
    throw new Error(`${options.field} inválido: ${trimmed}`);
  }

  const parsed = Number(normalized);
  if (!Number.isFinite(parsed)) {
    throw new Error(`${options.field} inválido: ${trimmed}`);
  }

  if (parsed < 0) {
    throw new Error(`${options.field} no puede ser negativo.`);
  }

  return Math.round(parsed * 100);
}

export function normalizeRetailPosCatalogImportProductRow(
  record: Record<string, string | null | undefined>,
): RetailPosCatalogImportNormalizationResult {
  const rawUnitPrice = findHeaderValue(record, UNIT_PRICE_HEADER_ALIASES);
  const rawCost = findHeaderValue(record, COST_HEADER_ALIASES);
  const unitPriceCents = parseRetailPosMoneyToCents(rawUnitPrice, {
    field: "unit_price",
    allowEmpty: false,
  });
  if (unitPriceCents === null) {
    throw new Error("unit_price es obligatorio.");
  }
  const costCents = parseRetailPosMoneyToCents(rawCost, {
    field: "cost",
    allowEmpty: true,
  });
  const warnings: RetailPosCatalogImportWarning[] = [];

  if (costCents !== null && costCents > unitPriceCents) {
    warnings.push({
      field: "cost",
      message: "El costo es mayor al precio público; revisar antes de aplicar la carga.",
    });
  }

  return {
    row: {
      name: normalizeRequiredString(record.name, "name"),
      category_name: normalizeRequiredString(record.category_name ?? record.category, "category_name"),
      brand: normalizeOptionalString(record.brand),
      sku: normalizeOptionalString(record.sku),
      barcode: normalizeOptionalString(record.barcode),
      unit_price_cents: unitPriceCents,
      cost_cents: costCents,
      sales_unit_code: normalizeRequiredString(record.sales_unit_code, "sales_unit_code"),
      sales_unit_label: normalizeRequiredString(record.sales_unit_label, "sales_unit_label"),
      allow_decimal_quantity: normalizeBoolean(record.allow_decimal_quantity, false),
      is_active: normalizeBoolean(record.is_active, true),
    },
    warnings,
    source: {
      unit_price: rawUnitPrice,
      cost: rawCost,
    },
  };
}
