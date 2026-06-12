import { createHash } from "node:crypto";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import type {
  RetailPosAssignBarcodeRequest,
  RetailPosAssignBarcodeResponse,
  RetailPosCatalogCategory,
  RetailPosCatalogDeviceSettings,
  RetailPosCatalogItem,
  RetailPosCatalogPayload,
  RetailPosCategory,
  RetailPosProduct,
  RetailPosQuickCreateProductRequest,
  RetailPosQuickCreateProductResponse,
} from "@/shared/types/retail-pos";
import { RetailPosRuntimeError } from "./errors";
import {
  assertRetailPosDeviceRole,
  resolveRetailPosRuntimeActor,
} from "./auth";
import type { RuntimePerfTrace } from "./runtime-perf";
import { runSupabaseReadWithRetry } from "./runtime-supabase-retry";

type RetailPosCategoryRow = RetailPosCatalogCategory & {
  deleted_at?: string | null;
};

type RetailPosProductRow = {
  id: string;
  tenant_id: string;
  category_id: string | null;
  name: string;
  brand: string | null;
  sku: string | null;
  barcode: string | null;
  unit_price_cents: number;
  sales_unit_code: string;
  sales_unit_label: string;
  allow_decimal_quantity: boolean;
  has_variants: boolean;
  is_active: boolean;
  deleted_at: string | null;
  updated_at: string;
  created_at?: string;
  created_by?: string | null;
  updated_by?: string | null;
};

type RetailPosVariantRow = {
  id: string;
  tenant_id: string;
  product_id: string;
  name: string;
  sku: string | null;
  barcode: string | null;
  unit_price_cents: number | null;
  is_default: boolean;
  is_active: boolean;
  sort_order: number;
  deleted_at: string | null;
  updated_at: string;
};

type RetailPosDeviceSettingsRow = RetailPosCatalogDeviceSettings;

type RetailPosCategoryEntityRow = RetailPosCategory;

const RETAIL_POS_FAKE_BARCODE_VALUES = new Set([
  "nan",
  "n/a",
  "na",
  "null",
  "undefined",
  "sin_codigo",
  "sin-codigo",
  "sin codigo",
  "none",
]);

const RETAIL_POS_RUNTIME_PAGE_SIZE = 1000;

export { RetailPosRuntimeError as RetailPosCatalogError } from "./errors";

function normalizeOptionalValue(value: string | null | undefined) {
  const normalized = value?.trim();
  return normalized ? normalized : null;
}

function normalizeRequiredString(value: unknown, field: string) {
  if (typeof value !== "string") {
    throw new RetailPosRuntimeError(400, `${field} must be a string.`);
  }

  const normalized = value.trim();
  if (!normalized) {
    throw new RetailPosRuntimeError(400, `${field} is required.`);
  }

  return normalized;
}

function ensureNonNegativeInteger(value: unknown, field: string) {
  if (typeof value !== "number" || !Number.isInteger(value) || value < 0) {
    throw new RetailPosRuntimeError(400, `${field} must be a non-negative integer.`);
  }

  return value;
}

function ensureBoolean(value: unknown, field: string) {
  if (typeof value !== "boolean") {
    throw new RetailPosRuntimeError(400, `${field} must be a boolean.`);
  }

  return value;
}

function normalizeBarcode(value: unknown, { required }: { required: boolean }) {
  const normalized = typeof value === "string" ? value.trim() : null;

  if (!normalized) {
    if (required) {
      throw new RetailPosRuntimeError(400, "barcode is required.");
    }

    return null;
  }

  const lowered = normalized.toLowerCase();
  if (RETAIL_POS_FAKE_BARCODE_VALUES.has(lowered)) {
    throw new RetailPosRuntimeError(400, "barcode is invalid.");
  }

  return normalized;
}

function normalizeClientEventId(value: unknown) {
  return normalizeRequiredString(value, "client_event_id");
}

function normalizeSku(value: unknown) {
  const normalized = typeof value === "string" ? value.trim() : "";
  return normalized ? normalized : null;
}

function makeCatalogItemFromProduct(input: {
  product: RetailPosProductRow;
  category: RetailPosCategoryRow | RetailPosCategoryEntityRow | null;
}): RetailPosCatalogItem {
  return {
    product_id: input.product.id,
    tenant_id: input.product.tenant_id,
    category_id: input.product.category_id,
    category_name: input.category?.name ?? null,
    variant_id: null,
    name: input.product.name,
    variant_name: null,
    brand: input.product.brand,
    sku: input.product.sku,
    barcode: input.product.barcode,
    unit_price_cents: input.product.unit_price_cents,
    sales_unit_code: input.product.sales_unit_code,
    sales_unit_label: input.product.sales_unit_label,
    allow_decimal_quantity: input.product.allow_decimal_quantity,
    has_variants: input.product.has_variants,
    is_active: input.product.is_active,
    product_updated_at: input.product.updated_at,
    variant_updated_at: null,
  };
}

function mapCategoryRowToEntity(row: RetailPosCategoryEntityRow): RetailPosCategory {
  return row;
}

function mapProductRowToEntity(row: RetailPosProductRow): RetailPosProduct {
  return {
    id: row.id,
    tenant_id: row.tenant_id,
    category_id: row.category_id,
    name: row.name,
    brand: row.brand,
    sku: row.sku,
    barcode: row.barcode,
    unit_price_cents: row.unit_price_cents,
    sales_unit_code: row.sales_unit_code,
    sales_unit_label: row.sales_unit_label,
    allow_decimal_quantity: row.allow_decimal_quantity,
    has_variants: row.has_variants,
    is_active: row.is_active,
    deleted_at: row.deleted_at,
    created_at: row.created_at ?? row.updated_at,
    updated_at: row.updated_at,
    created_by: row.created_by ?? null,
    updated_by: row.updated_by ?? null,
  };
}

async function loadActiveProductForTenant(input: {
  tenantId: string;
  productId: string;
}) {
  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .from("retail_pos_products")
    .select(
      "id, tenant_id, category_id, name, brand, sku, barcode, unit_price_cents, sales_unit_code, sales_unit_label, allow_decimal_quantity, has_variants, is_active, deleted_at, created_at, updated_at, created_by, updated_by",
    )
    .eq("tenant_id", input.tenantId)
    .eq("id", input.productId)
    .eq("is_active", true)
    .is("deleted_at", null)
    .limit(1)
    .maybeSingle<RetailPosProductRow>();

  if (error) {
    throw new RetailPosRuntimeError(500, `Unable to load retail_pos product: ${error.message}`);
  }

  if (!data) {
    throw new RetailPosRuntimeError(404, "retail_pos product not found.");
  }

  return data;
}

async function loadCategoryById(input: {
  tenantId: string;
  categoryId: string | null;
}): Promise<RetailPosCategory | null> {
  if (!input.categoryId) {
    return null;
  }

  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .from("retail_pos_categories")
    .select("id, tenant_id, name, sort_order, is_active, deleted_at, created_at, updated_at, created_by, updated_by")
    .eq("tenant_id", input.tenantId)
    .eq("id", input.categoryId)
    .is("deleted_at", null)
    .limit(1)
    .maybeSingle<RetailPosCategoryEntityRow>();

  if (error) {
    throw new RetailPosRuntimeError(500, `Unable to load retail_pos category: ${error.message}`);
  }

  return data ? mapCategoryRowToEntity(data) : null;
}

async function assertBarcodeAvailable(input: {
  tenantId: string;
  barcode: string;
  currentProductId?: string | null;
}) {
  const supabase = getSupabaseAdminClient();
  const normalizedBarcode = input.barcode.trim().toLowerCase();

  const [productResult, variantResult] = await Promise.all([
    supabase
      .from("retail_pos_products")
      .select("id, barcode")
      .eq("tenant_id", input.tenantId)
      .is("deleted_at", null)
      .not("barcode", "is", null),
    supabase
      .from("retail_pos_product_variants")
      .select("id, product_id, barcode")
      .eq("tenant_id", input.tenantId)
      .is("deleted_at", null)
      .not("barcode", "is", null),
  ]);

  if (productResult.error) {
    throw new RetailPosRuntimeError(500, `Unable to validate retail_pos barcode uniqueness: ${productResult.error.message}`);
  }

  if (variantResult.error) {
    throw new RetailPosRuntimeError(500, `Unable to validate retail_pos variant barcode uniqueness: ${variantResult.error.message}`);
  }

  const matchingProduct = (productResult.data ?? []).find(
    (row) => String(row.barcode ?? "").trim().toLowerCase() === normalizedBarcode,
  );

  if (matchingProduct) {
    if (input.currentProductId && matchingProduct.id === input.currentProductId) {
      return { idempotent: true as const };
    }

    throw new RetailPosRuntimeError(409, "barcode is already assigned to another retail_pos product.");
  }

  const matchingVariant = (variantResult.data ?? []).find(
    (row) => String(row.barcode ?? "").trim().toLowerCase() === normalizedBarcode,
  );

  if (matchingVariant) {
    throw new RetailPosRuntimeError(409, "barcode is already assigned to another retail_pos variant.");
  }

  return { idempotent: false as const };
}

async function assertSkuAvailable(input: {
  tenantId: string;
  sku: string;
  currentProductId?: string | null;
}) {
  const supabase = getSupabaseAdminClient();
  const normalizedSku = input.sku.trim().toLowerCase();

  const [productResult, variantResult] = await Promise.all([
    supabase
      .from("retail_pos_products")
      .select("id, sku")
      .eq("tenant_id", input.tenantId)
      .is("deleted_at", null)
      .not("sku", "is", null),
    supabase
      .from("retail_pos_product_variants")
      .select("id, product_id, sku")
      .eq("tenant_id", input.tenantId)
      .is("deleted_at", null)
      .not("sku", "is", null),
  ]);

  if (productResult.error) {
    throw new RetailPosRuntimeError(500, `Unable to validate retail_pos SKU uniqueness: ${productResult.error.message}`);
  }

  if (variantResult.error) {
    throw new RetailPosRuntimeError(500, `Unable to validate retail_pos variant SKU uniqueness: ${variantResult.error.message}`);
  }

  const matchingProduct = (productResult.data ?? []).find(
    (row) => String(row.sku ?? "").trim().toLowerCase() === normalizedSku,
  );

  if (matchingProduct) {
    if (input.currentProductId && matchingProduct.id === input.currentProductId) {
      return { idempotent: true as const };
    }

    throw new RetailPosRuntimeError(409, "sku is already assigned to another retail_pos product.");
  }

  const matchingVariant = (variantResult.data ?? []).find(
    (row) => String(row.sku ?? "").trim().toLowerCase() === normalizedSku,
  );

  if (matchingVariant) {
    throw new RetailPosRuntimeError(409, "sku is already assigned to another retail_pos variant.");
  }

  return { idempotent: false as const };
}

async function findExistingProductBySkuOrBarcode(input: {
  tenantId: string;
  sku?: string | null;
  barcode?: string | null;
}) {
  const supabase = getSupabaseAdminClient();
  const matches: RetailPosProductRow[] = [];

  if (input.sku) {
    const skuResult = await supabase
      .from("retail_pos_products")
      .select(
        "id, tenant_id, category_id, name, brand, sku, barcode, unit_price_cents, sales_unit_code, sales_unit_label, allow_decimal_quantity, has_variants, is_active, deleted_at, created_at, updated_at, created_by, updated_by",
      )
      .eq("tenant_id", input.tenantId)
      .eq("sku", input.sku)
      .is("deleted_at", null)
      .limit(1)
      .maybeSingle<RetailPosProductRow>();

    if (skuResult.error) {
      throw new RetailPosRuntimeError(500, `Unable to resolve retail_pos product by sku: ${skuResult.error.message}`);
    }

    if (skuResult.data) {
      matches.push(skuResult.data);
    }
  }

  if (input.barcode) {
    const barcodeResult = await supabase
      .from("retail_pos_products")
      .select(
        "id, tenant_id, category_id, name, brand, sku, barcode, unit_price_cents, sales_unit_code, sales_unit_label, allow_decimal_quantity, has_variants, is_active, deleted_at, created_at, updated_at, created_by, updated_by",
      )
      .eq("tenant_id", input.tenantId)
      .eq("barcode", input.barcode)
      .is("deleted_at", null)
      .limit(1)
      .maybeSingle<RetailPosProductRow>();

    if (barcodeResult.error) {
      throw new RetailPosRuntimeError(500, `Unable to resolve retail_pos product by barcode: ${barcodeResult.error.message}`);
    }

    if (barcodeResult.data && !matches.find((row) => row.id === barcodeResult.data?.id)) {
      matches.push(barcodeResult.data);
    }
  }

  if (matches.length === 0) {
    return null;
  }

  if (matches.length > 1 && matches[0].id !== matches[1].id) {
    throw new RetailPosRuntimeError(409, "sku and barcode resolve to different retail_pos products.");
  }

  return matches[0];
}

async function findOrCreateCategory(input: {
  tenantId: string;
  categoryName: string;
}): Promise<{ category: RetailPosCategory; created: boolean }> {
  const supabase = getSupabaseAdminClient();
  const normalizedName = input.categoryName.trim();
  const loweredName = normalizedName.toLowerCase();

  const { data: existingRows, error: existingError } = await supabase
    .from("retail_pos_categories")
    .select("id, tenant_id, name, sort_order, is_active, deleted_at, created_at, updated_at, created_by, updated_by")
    .eq("tenant_id", input.tenantId)
    .is("deleted_at", null);

  if (existingError) {
    throw new RetailPosRuntimeError(500, `Unable to resolve retail_pos category: ${existingError.message}`);
  }

  const existing = (existingRows ?? []).find((row) => row.name.trim().toLowerCase() === loweredName) as
    | RetailPosCategoryEntityRow
    | undefined;

  if (existing) {
    if (!existing.is_active) {
      const { data: reactivated, error: reactivateError } = await supabase
        .from("retail_pos_categories")
        .update({ is_active: true })
        .eq("tenant_id", input.tenantId)
        .eq("id", existing.id)
        .select("id, tenant_id, name, sort_order, is_active, deleted_at, created_at, updated_at, created_by, updated_by")
        .limit(1)
        .maybeSingle<RetailPosCategoryEntityRow>();

      if (reactivateError) {
        throw new RetailPosRuntimeError(500, `Unable to reactivate retail_pos category: ${reactivateError.message}`);
      }

      if (!reactivated) {
        throw new RetailPosRuntimeError(409, "retail_pos category changed before it could be reactivated.");
      }

      return { category: mapCategoryRowToEntity(reactivated), created: false };
    }

    return { category: mapCategoryRowToEntity(existing), created: false };
  }

  const insertPayload = {
    tenant_id: input.tenantId,
    name: normalizedName,
    sort_order: 0,
    is_active: true,
  };

  const { data: created, error: createError } = await supabase
    .from("retail_pos_categories")
    .insert(insertPayload)
    .select("id, tenant_id, name, sort_order, is_active, deleted_at, created_at, updated_at, created_by, updated_by")
    .limit(1)
    .maybeSingle<RetailPosCategoryEntityRow>();

  if (createError) {
    throw new RetailPosRuntimeError(400, `Unable to create retail_pos category: ${createError.message}`);
  }

  if (!created) {
    throw new RetailPosRuntimeError(500, "retail_pos category insert did not return a record.");
  }

  return { category: mapCategoryRowToEntity(created), created: true };
}

function makeGeneratedSku(clientEventId: string, date = new Date()) {
  const y = String(date.getUTCFullYear());
  const m = String(date.getUTCMonth() + 1).padStart(2, "0");
  const d = String(date.getUTCDate()).padStart(2, "0");
  const hash = createHash("sha256").update(clientEventId).digest("hex").slice(0, 8).toUpperCase();
  return `RETAIL-${y}${m}${d}-${hash}`;
}

function sameQuickCreatePayload(
  product: RetailPosProductRow,
  category: RetailPosCategory | null,
  request: RetailPosQuickCreateProductRequest,
  finalSku: string,
  finalBarcode: string | null,
) {
  return (
    product.name === request.name.trim() &&
    (category?.name ?? "") === request.category_name.trim() &&
    (product.brand ?? null) === (normalizeOptionalValue(request.brand) ?? null) &&
    (product.sku ?? null) === finalSku &&
    (product.barcode ?? null) === finalBarcode &&
    product.unit_price_cents === request.unit_price_cents &&
    product.sales_unit_code === request.sales_unit_code.trim() &&
    product.sales_unit_label === request.sales_unit_label.trim() &&
    product.allow_decimal_quantity === request.allow_decimal_quantity &&
    product.has_variants === false &&
    product.is_active === true
  );
}

function normalizeLimit(value: number | null | undefined) {
  if (!Number.isFinite(value)) {
    return null;
  }

  const normalized = Math.trunc(Number(value));
  if (normalized <= 0) {
    return null;
  }

  return Math.min(normalized, 200);
}

async function fetchAllRetailPosRows<T>(input: {
  trace?: RuntimePerfTrace;
  step: string;
  query: (signal: AbortSignal, from: number, to: number) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>;
}): Promise<T[]> {
  const rows: T[] = [];

  for (let page = 0; ; page += 1) {
    const from = page * RETAIL_POS_RUNTIME_PAGE_SIZE;
    const to = from + RETAIL_POS_RUNTIME_PAGE_SIZE - 1;
    const result = await runSupabaseReadWithRetry<T[]>({
      trace: input.trace,
      step: `${input.step}_page_${page + 1}`,
      query: (signal) => input.query(signal, from, to),
    });

    if (result.error) {
      throw new RetailPosRuntimeError(500, `Unable to fetch retail_pos ${input.step}: ${result.error.message}`);
    }

    const batch = result.data ?? [];
    rows.push(...batch);

    if (batch.length < RETAIL_POS_RUNTIME_PAGE_SIZE) {
      return rows;
    }
  }
}

function buildCatalogItems(input: {
  categories: RetailPosCategoryRow[];
  products: RetailPosProductRow[];
  variants: RetailPosVariantRow[];
}): RetailPosCatalogItem[] {
  const categoryNameById = new Map(input.categories.map((category) => [category.id, category.name]));
  const variantsByProductId = new Map<string, RetailPosVariantRow[]>();

  for (const variant of input.variants) {
    const bucket = variantsByProductId.get(variant.product_id) ?? [];
    bucket.push(variant);
    variantsByProductId.set(variant.product_id, bucket);
  }

  const items: RetailPosCatalogItem[] = [];

  for (const product of input.products) {
    const productVariants = variantsByProductId.get(product.id) ?? [];
    const categoryName = product.category_id ? categoryNameById.get(product.category_id) ?? null : null;

    if (productVariants.length === 0) {
      items.push({
        product_id: product.id,
        tenant_id: product.tenant_id,
        category_id: product.category_id,
        category_name: categoryName,
        variant_id: null,
        name: product.name,
        variant_name: null,
        brand: product.brand,
        sku: product.sku,
        barcode: product.barcode,
        unit_price_cents: product.unit_price_cents,
        sales_unit_code: product.sales_unit_code,
        sales_unit_label: product.sales_unit_label,
        allow_decimal_quantity: product.allow_decimal_quantity,
        has_variants: product.has_variants,
        is_active: product.is_active,
        product_updated_at: product.updated_at,
        variant_updated_at: null,
      });
      continue;
    }

    for (const variant of productVariants) {
      items.push({
        product_id: product.id,
        tenant_id: product.tenant_id,
        category_id: product.category_id,
        category_name: categoryName,
        variant_id: variant.id,
        name: product.name,
        variant_name: variant.name,
        brand: product.brand,
        sku: variant.sku ?? product.sku,
        barcode: variant.barcode ?? product.barcode,
        unit_price_cents: variant.unit_price_cents ?? product.unit_price_cents,
        sales_unit_code: product.sales_unit_code,
        sales_unit_label: product.sales_unit_label,
        allow_decimal_quantity: product.allow_decimal_quantity,
        has_variants: product.has_variants,
        is_active: product.is_active && variant.is_active,
        product_updated_at: product.updated_at,
        variant_updated_at: variant.updated_at,
      });
    }
  }

  return items;
}

function filterCatalogItems(
  items: RetailPosCatalogItem[],
  filters: {
    q?: string | null;
    sku?: string | null;
    barcode?: string | null;
    limit?: number | null;
  },
) {
  const normalizedQuery = normalizeOptionalValue(filters.q)?.toLowerCase() ?? null;
  const normalizedSku = normalizeOptionalValue(filters.sku)?.toLowerCase() ?? null;
  const normalizedBarcode = normalizeOptionalValue(filters.barcode) ?? null;
  const normalizedLimit = normalizeLimit(filters.limit);

  let filtered = items;

  if (normalizedSku) {
    filtered = filtered.filter((item) => (item.sku ?? "").trim().toLowerCase() === normalizedSku);
  }

  if (normalizedBarcode) {
    filtered = filtered.filter((item) => (item.barcode ?? "").trim() === normalizedBarcode);
  }

  if (normalizedQuery) {
    filtered = filtered.filter((item) => {
      const name = item.name.trim().toLowerCase();
      const sku = (item.sku ?? "").trim().toLowerCase();
      return name.includes(normalizedQuery) || sku.includes(normalizedQuery);
    });
  }

  if (normalizedLimit) {
    filtered = filtered.slice(0, normalizedLimit);
  }

  return filtered;
}

export async function getRetailPosCatalogForTenant(input: {
  tenantSlug: string;
  deviceId?: string | null;
  deviceSecret?: string | null;
  q?: string | null;
  sku?: string | null;
  barcode?: string | null;
  limit?: number | null;
  trace?: RuntimePerfTrace;
}): Promise<RetailPosCatalogPayload> {
  const actor = await resolveRetailPosRuntimeActor({
    tenantSlug: input.tenantSlug,
    deviceId: input.deviceId,
    deviceSecret: input.deviceSecret,
    trace: input.trace,
  });

  const supabase = getSupabaseAdminClient({ trace: input.trace });

  const deviceSettingsQuery =
    actor.mode === "device" && actor.deviceRecordId
      ? input.trace
        ? runSupabaseReadWithRetry<RetailPosDeviceSettingsRow>({
            trace: input.trace,
            step: "device_config",
            query: (signal) =>
              supabase
                .from("retail_pos_device_settings")
                .select(
                  "device_id, tenant_id, device_role, printer_name, printer_driver, auto_print_order_ticket, auto_print_payment_ticket, scanner_enabled, is_active, updated_at",
                )
                .abortSignal(signal)
                .eq("tenant_id", actor.tenantId)
                .eq("device_id", actor.deviceRecordId)
                .eq("is_active", true)
                .limit(1)
                .maybeSingle<RetailPosDeviceSettingsRow>(),
          })
        : supabase
            .from("retail_pos_device_settings")
            .select(
              "device_id, tenant_id, device_role, printer_name, printer_driver, auto_print_order_ticket, auto_print_payment_ticket, scanner_enabled, is_active, updated_at",
            )
            .eq("tenant_id", actor.tenantId)
            .eq("device_id", actor.deviceRecordId)
            .eq("is_active", true)
            .limit(1)
            .maybeSingle<RetailPosDeviceSettingsRow>()
      : Promise.resolve({ data: null, error: null });

  const [categoriesResult, products, variants, deviceSettingsResult] = await Promise.all([
    runSupabaseReadWithRetry<RetailPosCategoryRow[]>({
      trace: input.trace,
      step: "categories_query",
      query: (signal) =>
        supabase
          .from("retail_pos_categories")
          .select("id, tenant_id, name, sort_order, is_active, updated_at")
          .abortSignal(signal)
          .eq("tenant_id", actor.tenantId)
          .eq("is_active", true)
          .is("deleted_at", null)
          .order("sort_order", { ascending: true })
          .order("name", { ascending: true }),
    }),
    fetchAllRetailPosRows<RetailPosProductRow>({
      trace: input.trace,
      step: "products_query",
      query: (signal, from, to) =>
        supabase
          .from("retail_pos_products")
          .select(
            "id, tenant_id, category_id, name, brand, sku, barcode, unit_price_cents, sales_unit_code, sales_unit_label, allow_decimal_quantity, has_variants, is_active, deleted_at, updated_at",
          )
          .abortSignal(signal)
          .eq("tenant_id", actor.tenantId)
          .eq("is_active", true)
          .is("deleted_at", null)
          .order("name", { ascending: true })
          .range(from, to),
    }),
    fetchAllRetailPosRows<RetailPosVariantRow>({
      trace: input.trace,
      step: "prices_query",
      query: (signal, from, to) =>
        supabase
          .from("retail_pos_product_variants")
          .select("id, tenant_id, product_id, name, sku, barcode, unit_price_cents, is_default, is_active, sort_order, deleted_at, updated_at")
          .abortSignal(signal)
          .eq("tenant_id", actor.tenantId)
          .eq("is_active", true)
          .is("deleted_at", null)
          .order("sort_order", { ascending: true })
          .order("name", { ascending: true })
          .range(from, to),
    }),
    deviceSettingsQuery,
  ]);

  if (categoriesResult.error) {
    throw new RetailPosRuntimeError(500, `Unable to fetch retail_pos categories: ${categoriesResult.error.message}`);
  }

  if (deviceSettingsResult.error) {
    throw new RetailPosRuntimeError(500, `Unable to fetch retail_pos device settings: ${deviceSettingsResult.error.message}`);
  }

  input.trace?.addDuration(
    "catalog_query",
    (input.trace.getDuration("categories_query") ?? 0) +
      (input.trace.getDuration("products_query_page_1") ?? 0) +
      (input.trace.getDuration("prices_query_page_1") ?? 0),
  );
  const categories = (categoriesResult.data ?? []) as RetailPosCategoryRow[];
  const items = buildCatalogItems({ categories, products, variants });

  return {
    categories,
    items: filterCatalogItems(items, {
      q: input.q,
      sku: input.sku,
      barcode: input.barcode,
      limit: input.limit,
    }),
    device_settings: deviceSettingsResult.data ?? null,
    synced_at: new Date().toISOString(),
  };
}

export async function assignRetailPosProductBarcode(input: {
  tenantSlug: string;
  productId: string;
  request: RetailPosAssignBarcodeRequest;
  deviceId?: string | null;
  deviceSecret?: string | null;
}): Promise<RetailPosAssignBarcodeResponse> {
  const actor = await resolveRetailPosRuntimeActor({
    tenantSlug: input.tenantSlug,
    deviceId: input.deviceId,
    deviceSecret: input.deviceSecret,
  });

  if (actor.mode !== "device") {
    throw new RetailPosRuntimeError(401, "device auth is required for retail_pos catalog maintenance.");
  }

  assertRetailPosDeviceRole(actor, ["order_station", "cashier_station"]);

  const productId = normalizeRequiredString(input.productId, "productId");
  const barcode = normalizeBarcode(input.request.barcode, { required: true }) as string;
  const clientEventId = normalizeClientEventId(input.request.client_event_id);
  const product = await loadActiveProductForTenant({
    tenantId: actor.tenantId,
    productId,
  });

  if ((product.barcode ?? null) === barcode) {
    const category = await loadCategoryById({ tenantId: actor.tenantId, categoryId: product.category_id });
    return {
      product: mapProductRowToEntity(product),
      category,
      catalog_item: makeCatalogItemFromProduct({ product, category }),
      barcode,
      client_event_id: clientEventId,
      idempotent: true,
      synced_at: new Date().toISOString(),
    };
  }

  await assertBarcodeAvailable({
    tenantId: actor.tenantId,
    barcode,
    currentProductId: product.id,
  });

  const supabase = getSupabaseAdminClient();
  const { data: updated, error } = await supabase
    .from("retail_pos_products")
    .update({ barcode })
    .eq("tenant_id", actor.tenantId)
    .eq("id", product.id)
    .eq("is_active", true)
    .is("deleted_at", null)
    .select(
      "id, tenant_id, category_id, name, brand, sku, barcode, unit_price_cents, sales_unit_code, sales_unit_label, allow_decimal_quantity, has_variants, is_active, deleted_at, created_at, updated_at, created_by, updated_by",
    )
    .limit(1)
    .maybeSingle<RetailPosProductRow>();

  if (error) {
    throw new RetailPosRuntimeError(400, `Unable to assign retail_pos product barcode: ${error.message}`);
  }

  if (!updated) {
    throw new RetailPosRuntimeError(409, "retail_pos product changed before barcode could be assigned.");
  }

  const category = await loadCategoryById({ tenantId: actor.tenantId, categoryId: updated.category_id });

  return {
    product: mapProductRowToEntity(updated),
    category,
    catalog_item: makeCatalogItemFromProduct({ product: updated, category }),
    barcode,
    client_event_id: clientEventId,
    idempotent: false,
    synced_at: new Date().toISOString(),
  };
}

export async function quickCreateRetailPosProduct(input: {
  tenantSlug: string;
  request: RetailPosQuickCreateProductRequest;
  deviceId?: string | null;
  deviceSecret?: string | null;
}): Promise<RetailPosQuickCreateProductResponse> {
  const actor = await resolveRetailPosRuntimeActor({
    tenantSlug: input.tenantSlug,
    deviceId: input.deviceId,
    deviceSecret: input.deviceSecret,
  });

  if (actor.mode !== "device") {
    throw new RetailPosRuntimeError(401, "device auth is required for retail_pos catalog maintenance.");
  }

  assertRetailPosDeviceRole(actor, ["order_station", "cashier_station"]);

  const name = normalizeRequiredString(input.request.name, "name");
  const categoryName = normalizeRequiredString(input.request.category_name, "category_name");
  const brand = normalizeOptionalValue(input.request.brand);
  const clientEventId = normalizeClientEventId(input.request.client_event_id);
  const salesUnitCode = normalizeRequiredString(input.request.sales_unit_code, "sales_unit_code");
  const salesUnitLabel = normalizeRequiredString(input.request.sales_unit_label, "sales_unit_label");
  const allowDecimalQuantity = ensureBoolean(input.request.allow_decimal_quantity, "allow_decimal_quantity");
  const unitPriceCents = ensureNonNegativeInteger(input.request.unit_price_cents, "unit_price_cents");
  const barcode = normalizeBarcode(input.request.barcode, { required: false });
  const requestedSku = normalizeSku(input.request.sku);
  const finalSku = requestedSku ?? makeGeneratedSku(clientEventId);
  const existingBeforeInsert = await findExistingProductBySkuOrBarcode({
    tenantId: actor.tenantId,
    sku: finalSku,
    barcode,
  });

  if (existingBeforeInsert) {
    const existingCategory = await loadCategoryById({
      tenantId: actor.tenantId,
      categoryId: existingBeforeInsert.category_id,
    });

    if (sameQuickCreatePayload(existingBeforeInsert, existingCategory, input.request, finalSku, barcode)) {
      return {
        product: mapProductRowToEntity(existingBeforeInsert),
        category: existingCategory,
        catalog_item: makeCatalogItemFromProduct({
          product: existingBeforeInsert,
          category: existingCategory,
        }),
        client_event_id: clientEventId,
        idempotent: true,
        category_created: false,
        sku: finalSku,
        barcode,
        synced_at: new Date().toISOString(),
      };
    }

    throw new RetailPosRuntimeError(409, "retail_pos product already exists with conflicting sku or barcode.");
  }

  await assertSkuAvailable({ tenantId: actor.tenantId, sku: finalSku });
  if (barcode) {
    await assertBarcodeAvailable({ tenantId: actor.tenantId, barcode });
  }

  const categoryResolution = await findOrCreateCategory({
    tenantId: actor.tenantId,
    categoryName,
  });

  const supabase = getSupabaseAdminClient();
  const insertPayload = {
    tenant_id: actor.tenantId,
    category_id: categoryResolution.category.id,
    name,
    brand,
    sku: finalSku,
    barcode,
    unit_price_cents: unitPriceCents,
    sales_unit_code: salesUnitCode,
    sales_unit_label: salesUnitLabel,
    allow_decimal_quantity: allowDecimalQuantity,
    has_variants: false,
    is_active: true,
  };

  const { data: created, error } = await supabase
    .from("retail_pos_products")
    .insert(insertPayload)
    .select(
      "id, tenant_id, category_id, name, brand, sku, barcode, unit_price_cents, sales_unit_code, sales_unit_label, allow_decimal_quantity, has_variants, is_active, deleted_at, created_at, updated_at, created_by, updated_by",
    )
    .limit(1)
    .maybeSingle<RetailPosProductRow>();

  if (error) {
    const existingBySku = await supabase
      .from("retail_pos_products")
      .select(
        "id, tenant_id, category_id, name, brand, sku, barcode, unit_price_cents, sales_unit_code, sales_unit_label, allow_decimal_quantity, has_variants, is_active, deleted_at, created_at, updated_at, created_by, updated_by",
      )
      .eq("tenant_id", actor.tenantId)
      .eq("sku", finalSku)
      .is("deleted_at", null)
      .limit(1)
      .maybeSingle<RetailPosProductRow>();

    if (existingBySku.error) {
      throw new RetailPosRuntimeError(400, `Unable to create retail_pos product: ${error.message}`);
    }

    if (existingBySku.data) {
      const existingCategory = await loadCategoryById({
        tenantId: actor.tenantId,
        categoryId: existingBySku.data.category_id,
      });

      if (sameQuickCreatePayload(existingBySku.data, existingCategory, input.request, finalSku, barcode)) {
        return {
          product: mapProductRowToEntity(existingBySku.data),
          category: existingCategory,
          catalog_item: makeCatalogItemFromProduct({
            product: existingBySku.data,
            category: existingCategory,
          }),
          client_event_id: clientEventId,
          idempotent: true,
          category_created: false,
          sku: finalSku,
          barcode,
          synced_at: new Date().toISOString(),
        };
      }
    }

    throw new RetailPosRuntimeError(400, `Unable to create retail_pos product: ${error.message}`);
  }

  if (!created) {
    throw new RetailPosRuntimeError(500, "retail_pos product insert did not return a record.");
  }

  return {
    product: mapProductRowToEntity(created),
    category: categoryResolution.category,
    catalog_item: makeCatalogItemFromProduct({
      product: created,
      category: categoryResolution.category,
    }),
    client_event_id: clientEventId,
    idempotent: false,
    category_created: categoryResolution.created,
    sku: finalSku,
    barcode,
    synced_at: new Date().toISOString(),
  };
}
