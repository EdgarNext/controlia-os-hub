import {
  createCatalogCategory,
  createCatalogProduct,
  updateCatalogCategory,
  updateCatalogProduct,
} from "@/lib/pos/catalog/commands";
import { listCatalogCategories, listCatalogProducts } from "@/lib/pos/catalog/queries";
import type {
  PosCatalogCategoryListItem,
  PosCatalogProductListItem,
} from "@/types/pos-catalog";
import {
  assertCsvHeaders,
  buildCsv,
  parseCsv,
  parseCsvBoolean,
  parseCsvInteger,
  parseCsvPriceToCents,
} from "./csv";

const CATEGORY_HEADERS = ["name", "sort_order", "is_active"] as const;
const PRODUCT_HEADERS = ["name", "category_name", "class", "price", "is_active"] as const;

type ImportCsvSummary = {
  created: number;
  updated: number;
  ignored: number;
  errors: string[];
};

type CatalogImportContext = {
  tenantId: string;
  actorUserId: string;
};

function normalizeKey(value: string): string {
  return value.trim().toLowerCase();
}

function formatCategoryExportRows(categories: PosCatalogCategoryListItem[]) {
  return categories
    .filter((category) => category.deleted_at == null)
    .map((category) => [category.name, category.sort_order, category.is_active]);
}

function formatProductExportRows(products: PosCatalogProductListItem[]) {
  return products
    .filter((product) => product.deleted_at == null)
    .map((product) => [
      product.name,
      product.category_name ?? "",
      product.class === "drink" ? "drink" : "food",
      (product.price_cents / 100).toFixed(2),
      product.is_active,
    ]);
}

export async function buildCategoryTemplateCsv(tenantId: string): Promise<string> {
  const categories = await listCatalogCategories({ tenantId });
  return buildCsv([...CATEGORY_HEADERS], formatCategoryExportRows(categories));
}

export async function buildProductTemplateCsv(tenantId: string): Promise<string> {
  const products = await listCatalogProducts({ tenantId });
  return buildCsv([...PRODUCT_HEADERS], formatProductExportRows(products));
}

function createImportSummary(): ImportCsvSummary {
  return {
    created: 0,
    updated: 0,
    ignored: 0,
    errors: [],
  };
}

function assertCsvFile(file: File | null): File {
  if (!file) {
    throw new Error("Selecciona un archivo CSV.");
  }

  if (!file.name.toLowerCase().endsWith(".csv")) {
    throw new Error("El archivo debe tener extensión .csv.");
  }

  return file;
}

function requireName(value: string, rowNumber: number): string {
  const normalized = value.trim();
  if (!normalized) {
    throw new Error(`Fila ${rowNumber}: el nombre es obligatorio.`);
  }
  return normalized;
}

function requireClass(value: string, rowNumber: number): "food" | "drink" {
  const normalized = value.trim().toLowerCase();
  if (normalized === "food" || normalized === "drink") {
    return normalized;
  }
  throw new Error(`Fila ${rowNumber}: el tipo debe ser food o drink.`);
}

export async function importCategoriesFromCsv(
  input: CatalogImportContext & { file: File | null },
): Promise<ImportCsvSummary> {
  const file = assertCsvFile(input.file);
  const rawContent = await file.text();
  const parsed = parseCsv(rawContent);
  assertCsvHeaders(parsed.headers, [...CATEGORY_HEADERS]);

  const existingCategories = (await listCatalogCategories({ tenantId: input.tenantId }))
    .filter((category) => category.deleted_at == null);
  const existingByName = new Map(existingCategories.map((category) => [normalizeKey(category.name), category] as const));
  const seenNames = new Set<string>();
  const summary = createImportSummary();

  for (const [index, row] of parsed.rows.entries()) {
    const rowNumber = index + 2;

    try {
      const [nameValue = "", sortOrderValue = "", isActiveValue = ""] = row;
      const name = requireName(nameValue, rowNumber);
      const normalizedName = normalizeKey(name);

      if (seenNames.has(normalizedName)) {
        throw new Error(`Fila ${rowNumber}: nombre duplicado en el archivo (${name}).`);
      }
      seenNames.add(normalizedName);

      const sortOrder = parseCsvInteger(sortOrderValue, 0);
      const isActive = parseCsvBoolean(isActiveValue, true);
      const existing = existingByName.get(normalizedName);

      if (existing) {
        await updateCatalogCategory({
          tenantId: input.tenantId,
          id: existing.id,
          actorUserId: input.actorUserId,
          input: {
            name,
            sort_order: sortOrder,
            is_active: isActive,
          },
        });
        summary.updated += 1;
        continue;
      }

      await createCatalogCategory({
        tenantId: input.tenantId,
        actorUserId: input.actorUserId,
        input: {
          name,
          sort_order: sortOrder,
          is_active: isActive,
        },
      });
      summary.created += 1;
    } catch (error) {
      summary.ignored += 1;
      summary.errors.push(error instanceof Error ? error.message : `Fila ${rowNumber}: error desconocido.`);
    }
  }

  return summary;
}

export async function importProductsFromCsv(
  input: CatalogImportContext & { file: File | null },
): Promise<ImportCsvSummary> {
  const file = assertCsvFile(input.file);
  const rawContent = await file.text();
  const parsed = parseCsv(rawContent);
  assertCsvHeaders(parsed.headers, [...PRODUCT_HEADERS]);

  const [existingCategories, existingProducts] = await Promise.all([
    listCatalogCategories({ tenantId: input.tenantId }),
    listCatalogProducts({ tenantId: input.tenantId }),
  ]);

  const categoriesByName = new Map(
    existingCategories
      .filter((category) => category.deleted_at == null)
      .map((category) => [normalizeKey(category.name), category] as const),
  );
  const productsByName = new Map(
    existingProducts
      .filter((product) => product.deleted_at == null)
      .map((product) => [normalizeKey(product.name), product] as const),
  );
  const seenNames = new Set<string>();
  const summary = createImportSummary();

  for (const [index, row] of parsed.rows.entries()) {
    const rowNumber = index + 2;

    try {
      const [
        nameValue = "",
        categoryNameValue = "",
        classValue = "",
        priceValue = "",
        isActiveValue = "",
      ] = row;

      const name = requireName(nameValue, rowNumber);
      const normalizedName = normalizeKey(name);

      if (seenNames.has(normalizedName)) {
        throw new Error(`Fila ${rowNumber}: nombre duplicado en el archivo (${name}).`);
      }
      seenNames.add(normalizedName);

      const categoryName = categoryNameValue.trim();
      const resolvedCategory = categoryName ? categoriesByName.get(normalizeKey(categoryName)) ?? null : null;
      if (categoryName && !resolvedCategory) {
        throw new Error(`Fila ${rowNumber}: categoría no encontrada (${categoryName}).`);
      }

      const productClass = requireClass(classValue, rowNumber);
      const priceCents = parseCsvPriceToCents(priceValue);
      const isActive = parseCsvBoolean(isActiveValue, true);
      const existing = productsByName.get(normalizedName);

      if (existing) {
        await updateCatalogProduct({
          tenantId: input.tenantId,
          id: existing.id,
          actorUserId: input.actorUserId,
          input: {
            name,
            category_id: resolvedCategory?.id ?? null,
            class: productClass,
            price_cents: priceCents,
            is_active: isActive,
          },
          imageFile: null,
        });
        summary.updated += 1;
        continue;
      }

      await createCatalogProduct({
        tenantId: input.tenantId,
        actorUserId: input.actorUserId,
        input: {
          name,
          category_id: resolvedCategory?.id ?? null,
          class: productClass,
          price_cents: priceCents,
          is_active: isActive,
        },
        imageFile: null,
      });
      summary.created += 1;
    } catch (error) {
      summary.ignored += 1;
      summary.errors.push(error instanceof Error ? error.message : `Fila ${rowNumber}: error desconocido.`);
    }
  }

  return summary;
}

export type CatalogCsvImportSummary = ImportCsvSummary;
