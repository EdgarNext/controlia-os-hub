import fs from "node:fs";
import path from "node:path";
import * as XLSX from "xlsx";
import { normalizeRecipeName } from "./normalizers";
import type { ParsedRecipeImportRow, ParsedRecipeWorkbook } from "./import-types";

function toUpper(v: unknown): string {
  return String(v ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toUpperCase();
}

function toNumber(v: unknown): number | null {
  if (v == null) return null;
  const raw = String(v).trim();
  if (!raw) return null;
  const cleaned = raw.replace(/\$/g, "").replace(/,/g, "").replace(/\s+/g, "");
  if (cleaned === "-" || cleaned === "") return null;
  const num = Number(cleaned);
  return Number.isFinite(num) ? num : null;
}

function inferUnitCode(value: string): string | null {
  const u = toUpper(value);
  if (!u) return null;
  if (u.includes("KG")) return "kg";
  if (u.includes("LT") || u === "L") return "l";
  if (u.includes("ML")) return "ml";
  if (u.includes("PZ") || u.includes("PZA") || u.includes("PIEZA") || u.includes("UNIDAD")) return "pza";
  if (u.includes("MAN") || u.includes("MANOJO")) return "manojo";
  return String(value).trim().toLowerCase() || null;
}

function isRecipeHeaderRow(row: unknown[]): boolean {
  const first = String(row[0] ?? "").trim();
  if (!first) return false;
  const upper = toUpper(first);
  if (
    upper.includes("COSTEO POR PLATILLO") ||
    upper.includes("NO DE PERSONAS") ||
    upper.includes("INGREDIENTES DE RECETA") ||
    upper.includes("PRECIO COSTO U")
  ) {
    return false;
  }

  const hasOnlyFirstCell = row.slice(1).every((v) => String(v ?? "").trim() === "");
  return hasOnlyFirstCell;
}

function isIngredientStartRow(row: unknown[]): boolean {
  return toUpper(row[0]).includes("INGREDIENTES DE RECETA");
}

function isCostFooterRow(row: unknown[]): boolean {
  return toUpper(row[0]).includes("PRECIO COSTO U");
}

function isEmptyRow(row: unknown[]): boolean {
  return row.every((v) => String(v ?? "").trim() === "");
}

function isPlaceholderIngredient(name: string, qty: number | null): boolean {
  if (!name.trim()) return true;
  return qty != null && qty <= 0;
}

function extractServings(row: unknown[]): number | null {
  // "No DE PERSONAS", null, "1", ...
  return toNumber(row[2]);
}

export function parseRecipeWorkbook(filePath: string): ParsedRecipeWorkbook {
  if (!fs.existsSync(filePath)) throw new Error(`No existe archivo de importación en: ${filePath}`);

  const workbook = XLSX.readFile(filePath, { cellDates: false });
  if (workbook.SheetNames.length === 0) throw new Error("El archivo Excel no contiene hojas.");

  const rows: ParsedRecipeImportRow[] = [];
  const seenRecipes = new Set<string>();
  let ignoredRows = 0;
  const ignoredReasons: Record<string, number> = {
    empty: 0,
    non_ingredient: 0,
    placeholder: 0,
    missing_context: 0,
  };

  for (let sheetIndex = 0; sheetIndex < workbook.SheetNames.length; sheetIndex += 1) {
    const sheetName = workbook.SheetNames[sheetIndex] ?? "";
    const sheet = workbook.Sheets[sheetName];
    if (!sheet) continue;

    const matrix = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: null, raw: false }) as unknown[][];

    let currentRecipeName: string | null = null;
    let currentRecipeNorm: string | null = null;
    let currentServings: number | null = null;
    let inIngredients = false;

    for (let i = 0; i < matrix.length; i += 1) {
      const row = matrix[i] ?? [];

      if (isEmptyRow(row)) {
        ignoredRows += 1;
        ignoredReasons.empty += 1;
        continue;
      }

      if (isRecipeHeaderRow(row)) {
        currentRecipeName = String(row[0] ?? "").trim();
        currentRecipeNorm = normalizeRecipeName(currentRecipeName);
        currentServings = null;
        inIngredients = false;
        seenRecipes.add(`${sheetName}::${currentRecipeNorm}`);
        continue;
      }

      if (toUpper(row[0]).includes("NO DE PERSONAS") || toUpper(row[0]).includes("NO. DE")) {
        currentServings = extractServings(row);
        continue;
      }

      if (isIngredientStartRow(row)) {
        inIngredients = true;
        continue;
      }

      if (isCostFooterRow(row)) {
        inIngredients = false;
        continue;
      }

      if (!inIngredients) {
        ignoredRows += 1;
        ignoredReasons.non_ingredient += 1;
        continue;
      }

      if (!currentRecipeName || !currentRecipeNorm) {
        ignoredRows += 1;
        ignoredReasons.missing_context += 1;
        continue;
      }

      const ingredientName = String(row[0] ?? "").trim();
      const unitRaw = String(row[3] ?? "").trim();
      const portionQty = toNumber(row[4]);
      const orderQty = toNumber(row[5]);
      // In RECETARIO.xlsx, ORDENAR is the total quantity for the recipe base.
      // PORCIÓN is per-person/unit and must not be persisted as recipe line quantity.
      const quantity = orderQty ?? portionQty;

      if (isPlaceholderIngredient(ingredientName, quantity)) {
        ignoredRows += 1;
        ignoredReasons.placeholder += 1;
        continue;
      }

      const recipeGroupKey = `${sheetName}::${currentRecipeNorm}`;

      const globalRowNumber = (sheetIndex + 1) * 100000 + (i + 1);

      rows.push({
        rowNumber: globalRowNumber,
        recipeGroupKey,
        recipeName: currentRecipeName,
        normalizedRecipeName: currentRecipeNorm,
        recipeServings: currentServings,
        recipeYieldQuantity: 1,
        recipeYieldUnitCode: "pza",
        ingredientName,
        normalizedIngredientName: normalizeRecipeName(ingredientName),
        quantity,
        unitCode: inferUnitCode(unitRaw),
        raw: {
          sheet: sheetName,
          row: i + 1,
          recipe_name: currentRecipeName,
          servings: currentServings,
          ingredient_name: ingredientName,
          unit_raw: unitRaw,
          portion_qty: row[4],
          order_qty: row[5],
          price: row[6],
          cost_total: row[7],
        },
      });
    }
  }

  return {
    filePath: path.resolve(filePath),
    sheetNames: workbook.SheetNames,
    rows,
    parsedRecipes: seenRecipes.size,
    parsedLines: rows.length,
    ignoredRows,
    ignoredReasons,
  };
}
