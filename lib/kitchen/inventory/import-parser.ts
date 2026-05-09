import fs from "node:fs";
import path from "node:path";
import * as XLSX from "xlsx";
import { normalizeKitchenCode, normalizeKitchenName } from "./normalizers";
import type { ParsedInventorySheetRow, ParsedInventoryWorkbook } from "./import-types";

const INVENTORY_HEADER_KEYS = [
  "NOMBRE",
  "DESCRIPCION/PRESENTACION",
  "PRECIO UNITARIO",
  "EXISTENCIA",
  "CATEGORÍA",
  "PROVEEDOR",
  "STOCK",
  "UBICACIÓN",
];

function normalizeHeader(value: unknown): string {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toUpperCase();
}

function toNumber(value: unknown): number | null {
  if (value == null) return null;
  const raw = String(value).trim();
  if (!raw) return null;
  const cleaned = raw.replace(/\$/g, "").replace(/,/g, "").replace(/\s+/g, "");
  if (cleaned === "-" || cleaned === "$-" || cleaned === "$-") return null;
  const num = Number(cleaned);
  return Number.isFinite(num) ? num : null;
}

function inferUnitCodeFromPresentation(presentation: string): string | null {
  const upper = presentation.toUpperCase();

  if (/\bKG\b|KILO|KILOGRAM/.test(upper)) return "kg";
  if (/\bGR\b|\bG\b|GRAMO/.test(upper)) return "g";
  if (/\bLT\b|\bL\b|LITRO/.test(upper)) return "l";
  if (/\bML\b/.test(upper)) return "ml";
  if (/\bPZA\b|\bPZ\b|PIEZA/.test(upper)) return "pza";
  if (/PAQ|PAQUETE/.test(upper)) return "paquete";

  return null;
}

function rowLooksEmpty(values: unknown[]): boolean {
  return values.every((value) => String(value ?? "").trim() === "");
}

function isGrandTotalRow(name: string): boolean {
  const normalized = normalizeKitchenName(name);
  return normalized.includes("grand. total") || normalized.includes("grand total") || normalized === "total";
}

export function parseInventoryWorkbook(filePath: string): ParsedInventoryWorkbook {
  if (!fs.existsSync(filePath)) {
    throw new Error(`No existe archivo de importación en: ${filePath}`);
  }

  const workbook = XLSX.readFile(filePath, { cellDates: false });
  if (workbook.SheetNames.length === 0) {
    throw new Error("El archivo Excel no contiene hojas.");
  }

  const sheetName = workbook.SheetNames[0] ?? "";
  const sheet = workbook.Sheets[sheetName];
  if (!sheet) {
    throw new Error("No se pudo leer la hoja principal del archivo.");
  }

  const matrix = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: null, raw: false }) as unknown[][];

  const headerRowIndex = matrix.findIndex((row) => {
    const headers = row.map(normalizeHeader);
    return INVENTORY_HEADER_KEYS.every((key) => headers.includes(key));
  });

  if (headerRowIndex < 0) {
    throw new Error("No se detectaron encabezados esperados en el Excel de inventario.");
  }

  const headerRow = matrix[headerRowIndex] ?? [];
  const headerNames = headerRow.map((value) => String(value ?? "").trim());
  const headerMap = new Map<string, number>();

  headerRow.forEach((headerValue, index) => {
    const normalized = normalizeHeader(headerValue);
    if (normalized) headerMap.set(normalized, index);
  });

  const ignoredReasons: Record<string, number> = {
    empty: 0,
    total: 0,
    invalid_name: 0,
  };

  const rows: ParsedInventorySheetRow[] = [];

  for (let matrixIndex = headerRowIndex + 1; matrixIndex < matrix.length; matrixIndex += 1) {
    const row = matrix[matrixIndex] ?? [];
    if (rowLooksEmpty(row)) {
      ignoredReasons.empty += 1;
      continue;
    }

    const get = (key: string) => row[headerMap.get(key) ?? -1];

    const itemName = String(get("NOMBRE") ?? "").trim();
    if (!itemName) {
      ignoredReasons.invalid_name += 1;
      continue;
    }

    if (isGrandTotalRow(itemName)) {
      ignoredReasons.total += 1;
      continue;
    }

    const presentation = String(get("DESCRIPCION/PRESENTACION") ?? "").trim();
    const categoryName = String(get("CATEGORIA") ?? get("CATEGORÍA") ?? "").trim() || null;
    const supplierName = String(get("PROVEEDOR") ?? "").trim() || null;
    const locationName = String(get("UBICACION") ?? get("UBICACIÓN") ?? "").trim() || null;
    const quantity = toNumber(get("EXISTENCIA"));
    const unitCost = toNumber(get("PRECIO UNITARIO"));
    const stock = toNumber(get("STOCK"));
    const unitCode = inferUnitCodeFromPresentation(presentation);

    rows.push({
      rowNumber: matrixIndex + 1,
      itemName,
      presentation,
      unitCode,
      categoryName,
      supplierName,
      locationName,
      quantity,
      unitCost,
      minQuantity: stock,
      maxQuantity: null,
      raw: {
        row: matrixIndex + 1,
        nombre: itemName,
        descripcion_presentacion: presentation,
        precio_unitario: get("PRECIO UNITARIO"),
        existencia: get("EXISTENCIA"),
        categoria: categoryName,
        proveedor: supplierName,
        stock: get("STOCK"),
        ubicacion: locationName,
      },
    });
  }

  return {
    filePath: path.resolve(filePath),
    sheetName,
    headers: headerNames,
    rows,
    ignoredRows: ignoredReasons.empty + ignoredReasons.total + ignoredReasons.invalid_name,
    ignoredReasons,
  };
}

export function inferUnitTypeFromCode(code: string): "mass" | "volume" | "unit" | "package" | "other" {
  const normalized = normalizeKitchenCode(code);
  if (["kg", "g"].includes(normalized)) return "mass";
  if (["l", "lt", "ml"].includes(normalized)) return "volume";
  if (["pza", "pz", "pieza"].includes(normalized)) return "unit";
  if (["paquete", "paq"].includes(normalized)) return "package";
  return "other";
}
