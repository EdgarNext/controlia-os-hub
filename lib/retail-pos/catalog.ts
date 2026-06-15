import { createHash } from "node:crypto";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import type {
  CreateRetailPosBackofficeSupplierResponse,
  RetailPosAssignBarcodeRequest,
  RetailPosAssignBarcodeResponse,
  RetailPosBackofficeCatalogProduct,
  RetailPosBackofficeCatalogProductDetailResponse,
  RetailPosBackofficeCatalogProductsResponse,
  RetailPosBackofficeSupplier,
  RetailPosBackofficeSuppliersResponse,
  RetailPosCatalogChange,
  RetailPosCatalogChangeProduct,
  RetailPosCatalogChangesPayload,
  RetailPosCatalogCategory,
  RetailPosCatalogDeviceSettings,
  RetailPosCatalogItem,
  RetailPosCatalogPayload,
  RetailPosCategory,
  RetailPosProduct,
  RetailPosQuickCreateProductRequest,
  RetailPosQuickCreateProductResponse,
  UpdateRetailPosBackofficeProductRequest,
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

type RetailPosBackofficeProductRow = RetailPosProductRow & {
  cost_cents: number | null;
  supplier_id: string | null;
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

type RetailPosSupplierRow = {
  id: string;
  tenant_id: string;
  name: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

type RetailPosCatalogChangeRow = {
  change_id: number;
  tenant_id: string;
  entity_type: "product";
  entity_id: string;
  operation: "insert" | "update" | "deactivate" | "delete";
  changed_fields: string[] | null;
  product_snapshot: Record<string, unknown> | null;
  changed_at: string;
};

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
const RETAIL_POS_CHANGES_DEFAULT_LIMIT = 500;
const RETAIL_POS_CHANGES_MAX_LIMIT = 1000;

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

function normalizeChangesLimit(value: number | null | undefined) {
  if (!Number.isFinite(value)) {
    return RETAIL_POS_CHANGES_DEFAULT_LIMIT;
  }

  const normalized = Math.trunc(Number(value));
  if (normalized <= 0) {
    return RETAIL_POS_CHANGES_DEFAULT_LIMIT;
  }

  return Math.min(normalized, RETAIL_POS_CHANGES_MAX_LIMIT);
}

function normalizeBackofficeLimit(value: number | null | undefined) {
  if (!Number.isFinite(value)) {
    return 50;
  }

  const normalized = Math.trunc(Number(value));
  if (normalized <= 0) {
    return 50;
  }

  return Math.min(normalized, 100);
}

function normalizeBackofficeCursor(value: string | null | undefined) {
  const normalized = value?.trim();
  if (!normalized) {
    return 0;
  }

  const parsed = Number(normalized);
  if (!Number.isSafeInteger(parsed) || parsed < 0) {
    throw new RetailPosRuntimeError(400, "cursor must be a non-negative integer.");
  }

  return parsed;
}

function normalizeChangeCursor(value: string | null | undefined) {
  const normalized = value?.trim();
  if (!normalized) {
    return { value: 0, invalid: false };
  }

  if (!/^\d+$/.test(normalized)) {
    return { value: 0, invalid: true };
  }

  const parsed = Number(normalized);
  if (!Number.isSafeInteger(parsed) || parsed < 0) {
    return { value: 0, invalid: true };
  }

  return { value: parsed, invalid: false };
}

function mapCatalogChangeProductSnapshot(
  snapshot: Record<string, unknown> | null,
): RetailPosCatalogChangeProduct | null {
  if (!snapshot) {
    return null;
  }

  const id = typeof snapshot.id === "string" ? snapshot.id : null;
  const tenantId = typeof snapshot.tenant_id === "string" ? snapshot.tenant_id : null;
  const name = typeof snapshot.name === "string" ? snapshot.name : null;
  const unitPriceCents =
    typeof snapshot.unit_price_cents === "number" && Number.isInteger(snapshot.unit_price_cents)
      ? snapshot.unit_price_cents
      : null;
  const salesUnitCode = typeof snapshot.sales_unit_code === "string" ? snapshot.sales_unit_code : null;
  const salesUnitLabel = typeof snapshot.sales_unit_label === "string" ? snapshot.sales_unit_label : null;
  const allowDecimalQuantity =
    typeof snapshot.allow_decimal_quantity === "boolean" ? snapshot.allow_decimal_quantity : null;
  const hasVariants = typeof snapshot.has_variants === "boolean" ? snapshot.has_variants : null;
  const isActive = typeof snapshot.is_active === "boolean" ? snapshot.is_active : null;
  const updatedAt = typeof snapshot.updated_at === "string" ? snapshot.updated_at : null;

  if (
    !id ||
    !tenantId ||
    !name ||
    unitPriceCents === null ||
    !salesUnitCode ||
    !salesUnitLabel ||
    allowDecimalQuantity === null ||
    hasVariants === null ||
    isActive === null ||
    !updatedAt
  ) {
    return null;
  }

  return {
    id,
    tenant_id: tenantId,
    category_id: typeof snapshot.category_id === "string" ? snapshot.category_id : null,
    name,
    brand: typeof snapshot.brand === "string" ? snapshot.brand : null,
    sku: typeof snapshot.sku === "string" ? snapshot.sku : null,
    barcode: typeof snapshot.barcode === "string" ? snapshot.barcode : null,
    unit_price_cents: unitPriceCents,
    sales_unit_code: salesUnitCode,
    sales_unit_label: salesUnitLabel,
    allow_decimal_quantity: allowDecimalQuantity,
    has_variants: hasVariants,
    is_active: isActive,
    deleted_at: typeof snapshot.deleted_at === "string" ? snapshot.deleted_at : null,
    updated_at: updatedAt,
    supplier_id: typeof snapshot.supplier_id === "string" ? snapshot.supplier_id : null,
  };
}

function mapCatalogChangeRow(row: RetailPosCatalogChangeRow): RetailPosCatalogChange {
  return {
    change_id: row.change_id,
    entity_type: row.entity_type,
    entity_id: row.entity_id,
    operation: row.operation,
    changed_fields: row.changed_fields ?? [],
    changed_at: row.changed_at,
    product: mapCatalogChangeProductSnapshot(row.product_snapshot),
  };
}

function assertBackofficeCatalogReadAccess(actor: Awaited<ReturnType<typeof resolveRetailPosRuntimeActor>>) {
  if (actor.mode === "session") {
    return;
  }

  assertRetailPosDeviceRole(actor, ["backoffice_station"]);
}

function assertBackofficeCatalogManageAccess(actor: Awaited<ReturnType<typeof resolveRetailPosRuntimeActor>>) {
  if (actor.mode === "session") {
    return;
  }

  assertRetailPosDeviceRole(actor, ["backoffice_station"]);
}

function mapBackofficeProductRow(input: {
  product: RetailPosBackofficeProductRow;
  categoryName?: string | null;
  supplierName?: string | null;
}): RetailPosBackofficeCatalogProduct {
  return {
    product_id: input.product.id,
    variant_id: null,
    name: input.product.name,
    sku: input.product.sku,
    barcode: input.product.barcode,
    brand: input.product.brand,
    category_id: input.product.category_id,
    category_name: input.categoryName ?? null,
    supplier_id: input.product.supplier_id,
    supplier_name: input.supplierName ?? null,
    sales_unit_code: input.product.sales_unit_code,
    sales_unit_label: input.product.sales_unit_label,
    allow_decimal_quantity: input.product.allow_decimal_quantity,
    price_cents: input.product.unit_price_cents,
    cost_cents: input.product.cost_cents,
    is_active: input.product.is_active,
    has_variants: input.product.has_variants,
    created_at: input.product.created_at ?? null,
    updated_at: input.product.updated_at ?? null,
  };
}

function mapSupplierRow(row: RetailPosSupplierRow): RetailPosBackofficeSupplier {
  return {
    id: row.id,
    tenant_id: row.tenant_id,
    name: row.name,
    is_active: row.is_active,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

async function loadSupplierById(input: {
  tenantId: string;
  supplierId: string | null;
}): Promise<RetailPosSupplierRow | null> {
  if (!input.supplierId) {
    return null;
  }

  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .from("retail_pos_suppliers")
    .select("id, tenant_id, name, is_active, created_at, updated_at")
    .eq("tenant_id", input.tenantId)
    .eq("id", input.supplierId)
    .limit(1)
    .maybeSingle<RetailPosSupplierRow>();

  if (error) {
    throw new RetailPosRuntimeError(500, `Unable to load retail_pos supplier: ${error.message}`);
  }

  return data ?? null;
}

async function loadBackofficeProductForTenant(input: {
  tenantId: string;
  productId: string;
}): Promise<RetailPosBackofficeProductRow> {
  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .from("retail_pos_products")
    .select(
      "id, tenant_id, category_id, name, brand, sku, barcode, unit_price_cents, cost_cents, supplier_id, sales_unit_code, sales_unit_label, allow_decimal_quantity, has_variants, is_active, deleted_at, created_at, updated_at",
    )
    .eq("tenant_id", input.tenantId)
    .eq("id", input.productId)
    .is("deleted_at", null)
    .limit(1)
    .maybeSingle<RetailPosBackofficeProductRow>();

  if (error) {
    throw new RetailPosRuntimeError(500, `Unable to load retail_pos product: ${error.message}`);
  }

  if (!data) {
    throw new RetailPosRuntimeError(404, "retail_pos product not found.");
  }

  return data;
}

function normalizePositiveInteger(value: unknown, field: string) {
  if (typeof value !== "number" || !Number.isInteger(value) || value <= 0) {
    throw new RetailPosRuntimeError(400, `${field} must be a positive integer.`);
  }

  return value;
}

function normalizeBackofficeProductPatch(input: UpdateRetailPosBackofficeProductRequest) {
  const entries = Object.entries(input).filter(([, value]) => value !== undefined);
  const allowedKeys = new Set([
    "name",
    "sku",
    "barcode",
    "brand",
    "category_id",
    "sales_unit_code",
    "sales_unit_label",
    "allow_decimal_quantity",
    "price_cents",
    "cost_cents",
    "supplier_id",
    "is_active",
  ]);

  const unknownKeys = entries.map(([key]) => key).filter((key) => !allowedKeys.has(key));
  if (unknownKeys.length > 0) {
    throw new RetailPosRuntimeError(400, `Unknown product fields: ${unknownKeys.join(", ")}.`);
  }

  if (entries.length === 0) {
    throw new RetailPosRuntimeError(400, "At least one editable product field is required.");
  }

  const patch: Partial<RetailPosBackofficeProductRow> = {};

  for (const [key, rawValue] of entries) {
    switch (key) {
      case "name":
        patch.name = normalizeRequiredString(rawValue, "name");
        break;
      case "sku":
        patch.sku = normalizeSku(rawValue);
        break;
      case "barcode":
        patch.barcode = normalizeBarcode(rawValue, { required: false });
        break;
      case "brand":
        patch.brand = normalizeOptionalValue(typeof rawValue === "string" ? rawValue : null);
        break;
      case "category_id":
        patch.category_id = normalizeOptionalValue(typeof rawValue === "string" ? rawValue : null);
        break;
      case "sales_unit_code":
        patch.sales_unit_code = normalizeRequiredString(rawValue, "sales_unit_code");
        break;
      case "sales_unit_label":
        patch.sales_unit_label = normalizeRequiredString(rawValue, "sales_unit_label");
        break;
      case "allow_decimal_quantity":
        patch.allow_decimal_quantity = ensureBoolean(rawValue, "allow_decimal_quantity");
        break;
      case "price_cents":
        patch.unit_price_cents = normalizePositiveInteger(rawValue, "price_cents");
        break;
      case "cost_cents":
        patch.cost_cents = rawValue === null ? null : ensureNonNegativeInteger(rawValue, "cost_cents");
        break;
      case "supplier_id":
        patch.supplier_id = normalizeOptionalValue(typeof rawValue === "string" ? rawValue : null);
        break;
      case "is_active":
        patch.is_active = ensureBoolean(rawValue, "is_active");
        break;
      default:
        break;
    }
  }

  return patch;
}

function groupCatalogItemsByProductId(items: RetailPosCatalogItem[]) {
  const grouped = new Map<string, RetailPosCatalogItem[]>();

  for (const item of items) {
    const bucket = grouped.get(item.product_id) ?? [];
    bucket.push(item);
    grouped.set(item.product_id, bucket);
  }

  return grouped;
}

async function fetchLatestRetailPosCatalogChangeId(input: {
  tenantId: string;
  trace?: RuntimePerfTrace;
}) {
  const supabase = getSupabaseAdminClient({ trace: input.trace });
  const result = await runSupabaseReadWithRetry<Pick<RetailPosCatalogChangeRow, "change_id">>({
    trace: input.trace,
    step: "catalog_changes_latest",
    query: (signal) =>
      supabase
        .from("retail_pos_catalog_change_log")
        .select("change_id")
        .abortSignal(signal)
        .eq("tenant_id", input.tenantId)
        .order("change_id", { ascending: false })
        .limit(1)
        .maybeSingle<Pick<RetailPosCatalogChangeRow, "change_id">>(),
  });

  if (result.error) {
    throw new RetailPosRuntimeError(
      500,
      `Unable to fetch retail_pos latest catalog change id: ${result.error.message}`,
    );
  }

  return result.data?.change_id ?? null;
}

async function hasActiveRetailPosCatalogProducts(input: {
  tenantId: string;
  trace?: RuntimePerfTrace;
}) {
  const supabase = getSupabaseAdminClient({ trace: input.trace });
  const result = await runSupabaseReadWithRetry<Pick<RetailPosProductRow, "id">>({
    trace: input.trace,
    step: "catalog_products_exists",
    query: (signal) =>
      supabase
        .from("retail_pos_products")
        .select("id")
        .abortSignal(signal)
        .eq("tenant_id", input.tenantId)
        .eq("is_active", true)
        .is("deleted_at", null)
        .limit(1)
        .maybeSingle<Pick<RetailPosProductRow, "id">>(),
  });

  if (result.error) {
    throw new RetailPosRuntimeError(
      500,
      `Unable to verify retail_pos catalog bootstrap state: ${result.error.message}`,
    );
  }

  return Boolean(result.data?.id);
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

  const latestChangeIdPromise = fetchLatestRetailPosCatalogChangeId({
    tenantId: actor.tenantId,
    trace: input.trace,
  });

  const [categoriesResult, products, variants, deviceSettingsResult, latestChangeId] = await Promise.all([
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
    latestChangeIdPromise,
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
    catalog_sync: {
      latest_change_id: latestChangeId,
    },
  };
}

export async function getRetailPosCatalogChangesForTenant(input: {
  tenantSlug: string;
  since?: string | null;
  limit?: number | null;
  deviceId?: string | null;
  deviceSecret?: string | null;
  trace?: RuntimePerfTrace;
}): Promise<RetailPosCatalogChangesPayload> {
  const actor = await resolveRetailPosRuntimeActor({
    tenantSlug: input.tenantSlug,
    deviceId: input.deviceId,
    deviceSecret: input.deviceSecret,
    trace: input.trace,
  });

  const limit = normalizeChangesLimit(input.limit);
  const cursor = normalizeChangeCursor(input.since);
  const latestChangeId = await fetchLatestRetailPosCatalogChangeId({
    tenantId: actor.tenantId,
    trace: input.trace,
  });
  const requiresBootstrapSnapshot =
    latestChangeId === null
      ? await hasActiveRetailPosCatalogProducts({
          tenantId: actor.tenantId,
          trace: input.trace,
        })
      : false;

  if (
    cursor.invalid ||
    (latestChangeId !== null && cursor.value > latestChangeId) ||
    (latestChangeId === null && cursor.value > 0) ||
    requiresBootstrapSnapshot
  ) {
    return {
      changes: [],
      from_change_id: cursor.value,
      to_change_id: null,
      latest_change_id: latestChangeId,
      has_more: false,
      full_snapshot_required: true,
      limit,
      synced_at: new Date().toISOString(),
    };
  }

  const supabase = getSupabaseAdminClient({ trace: input.trace });
  const result = await runSupabaseReadWithRetry<RetailPosCatalogChangeRow[]>({
    trace: input.trace,
    step: "catalog_changes_query",
    query: (signal) =>
      supabase
        .from("retail_pos_catalog_change_log")
        .select(
          "change_id, tenant_id, entity_type, entity_id, operation, changed_fields, product_snapshot, changed_at",
        )
        .abortSignal(signal)
        .eq("tenant_id", actor.tenantId)
        .gt("change_id", cursor.value)
        .order("change_id", { ascending: true })
        .range(0, limit),
  });

  if (result.error) {
    throw new RetailPosRuntimeError(500, `Unable to fetch retail_pos catalog changes: ${result.error.message}`);
  }

  const rows = result.data ?? [];
  const hasMore = rows.length > limit;
  const slicedRows = hasMore ? rows.slice(0, limit) : rows;
  const changedProductIds = Array.from(new Set(slicedRows.map((row) => row.entity_id)));
  let catalogItemsByProductId = new Map<string, RetailPosCatalogItem[]>();

  if (changedProductIds.length > 0) {
    const [productsResult, variantsResult, categoriesResult] = await Promise.all([
      supabase
        .from("retail_pos_products")
        .select(
          "id, tenant_id, category_id, name, brand, sku, barcode, unit_price_cents, sales_unit_code, sales_unit_label, allow_decimal_quantity, has_variants, is_active, deleted_at, updated_at",
        )
        .eq("tenant_id", actor.tenantId)
        .in("id", changedProductIds),
      supabase
        .from("retail_pos_product_variants")
        .select(
          "id, tenant_id, product_id, name, sku, barcode, unit_price_cents, is_default, is_active, sort_order, deleted_at, updated_at",
        )
        .eq("tenant_id", actor.tenantId)
        .is("deleted_at", null)
        .eq("is_active", true)
        .in("product_id", changedProductIds),
      supabase
        .from("retail_pos_categories")
        .select("id, tenant_id, name, sort_order, is_active, updated_at, deleted_at")
        .eq("tenant_id", actor.tenantId)
        .is("deleted_at", null),
    ]);

    if (productsResult.error) {
      throw new RetailPosRuntimeError(
        500,
        `Unable to fetch retail_pos products for incremental catalog changes: ${productsResult.error.message}`,
      );
    }

    if (variantsResult.error) {
      throw new RetailPosRuntimeError(
        500,
        `Unable to fetch retail_pos variants for incremental catalog changes: ${variantsResult.error.message}`,
      );
    }

    if (categoriesResult.error) {
      throw new RetailPosRuntimeError(
        500,
        `Unable to fetch retail_pos categories for incremental catalog changes: ${categoriesResult.error.message}`,
      );
    }

    const activeProducts = (productsResult.data ?? []).filter(
      (product) => product.is_active && product.deleted_at === null,
    ) as RetailPosProductRow[];

    catalogItemsByProductId = groupCatalogItemsByProductId(
      buildCatalogItems({
        categories: (categoriesResult.data ?? []) as RetailPosCategoryRow[],
        products: activeProducts,
        variants: (variantsResult.data ?? []) as RetailPosVariantRow[],
      }),
    );
  }

  const changes = slicedRows.map((row) => ({
    ...mapCatalogChangeRow(row),
    catalog_items: catalogItemsByProductId.get(row.entity_id) ?? [],
  }));

  return {
    changes,
    from_change_id: cursor.value,
    to_change_id: changes.length > 0 ? changes[changes.length - 1]?.change_id ?? null : null,
    latest_change_id: latestChangeId,
    has_more: hasMore,
    full_snapshot_required: false,
    limit,
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

export async function searchRetailPosBackofficeCatalogProducts(input: {
  tenantSlug: string;
  q?: string | null;
  limit?: number | null;
  cursor?: string | null;
  deviceId?: string | null;
  deviceSecret?: string | null;
}): Promise<RetailPosBackofficeCatalogProductsResponse> {
  const actor = await resolveRetailPosRuntimeActor({
    tenantSlug: input.tenantSlug,
    deviceId: input.deviceId,
    deviceSecret: input.deviceSecret,
  });

  assertBackofficeCatalogReadAccess(actor);

  const limit = normalizeBackofficeLimit(input.limit);
  const offset = normalizeBackofficeCursor(input.cursor);
  const normalizedQuery = normalizeOptionalValue(input.q)?.toLowerCase() ?? null;
  const supabase = getSupabaseAdminClient();

  let supplierIdsForQuery: string[] = [];
  if (normalizedQuery) {
    const supplierResult = await supabase
      .from("retail_pos_suppliers")
      .select("id")
      .eq("tenant_id", actor.tenantId)
      .ilike("name", `%${normalizedQuery}%`)
      .limit(25);

    if (supplierResult.error) {
      throw new RetailPosRuntimeError(
        500,
        `Unable to search retail_pos suppliers for backoffice catalog: ${supplierResult.error.message}`,
      );
    }

    supplierIdsForQuery = (supplierResult.data ?? []).flatMap((row) =>
      typeof row.id === "string" ? [row.id] : [],
    );
  }

  let query = supabase
    .from("retail_pos_products")
    .select(
      "id, tenant_id, category_id, name, brand, sku, barcode, unit_price_cents, cost_cents, supplier_id, sales_unit_code, sales_unit_label, allow_decimal_quantity, has_variants, is_active, deleted_at, created_at, updated_at",
    )
    .eq("tenant_id", actor.tenantId)
    .is("deleted_at", null)
    .order("updated_at", { ascending: false })
    .order("name", { ascending: true })
    .range(offset, offset + limit);

  if (normalizedQuery) {
    const orFilters = [
      `name.ilike.%${normalizedQuery}%`,
      `sku.ilike.%${normalizedQuery}%`,
      `barcode.ilike.%${normalizedQuery}%`,
      `brand.ilike.%${normalizedQuery}%`,
    ];

    if (supplierIdsForQuery.length > 0) {
      orFilters.push(`supplier_id.in.(${supplierIdsForQuery.join(",")})`);
    }

    query = query.or(orFilters.join(","));
  }

  const { data, error } = await query;

  if (error) {
    throw new RetailPosRuntimeError(
      500,
      `Unable to fetch retail_pos backoffice catalog products: ${error.message}`,
    );
  }

  const products = (data ?? []) as RetailPosBackofficeProductRow[];
  const categoryIds = Array.from(new Set(products.flatMap((row) => (row.category_id ? [row.category_id] : []))));
  const supplierIds = Array.from(new Set(products.flatMap((row) => (row.supplier_id ? [row.supplier_id] : []))));

  const [categoriesResult, suppliersResult] = await Promise.all([
    categoryIds.length > 0
      ? supabase
          .from("retail_pos_categories")
          .select("id, name")
          .eq("tenant_id", actor.tenantId)
          .in("id", categoryIds)
      : Promise.resolve({ data: [] as Array<{ id: string; name: string }>, error: null }),
    supplierIds.length > 0
      ? supabase
          .from("retail_pos_suppliers")
          .select("id, name")
          .eq("tenant_id", actor.tenantId)
          .in("id", supplierIds)
      : Promise.resolve({ data: [] as Array<{ id: string; name: string }>, error: null }),
  ]);

  if (categoriesResult.error) {
    throw new RetailPosRuntimeError(
      500,
      `Unable to fetch retail_pos categories for backoffice catalog: ${categoriesResult.error.message}`,
    );
  }

  if (suppliersResult.error) {
    throw new RetailPosRuntimeError(
      500,
      `Unable to fetch retail_pos suppliers for backoffice catalog: ${suppliersResult.error.message}`,
    );
  }

  const categoryNameById = new Map((categoriesResult.data ?? []).map((row) => [row.id, row.name]));
  const supplierNameById = new Map((suppliersResult.data ?? []).map((row) => [row.id, row.name]));

  const hasExtraRow = products.length > limit;
  const visibleProducts = hasExtraRow ? products.slice(0, limit) : products;

  return {
    ok: true,
    items: visibleProducts.map((product) =>
      mapBackofficeProductRow({
        product,
        categoryName: product.category_id ? categoryNameById.get(product.category_id) ?? null : null,
        supplierName: product.supplier_id ? supplierNameById.get(product.supplier_id) ?? null : null,
      }),
    ),
    next_cursor: hasExtraRow ? String(offset + limit) : null,
  };
}

export async function getRetailPosBackofficeCatalogProduct(input: {
  tenantSlug: string;
  productId: string;
  deviceId?: string | null;
  deviceSecret?: string | null;
}): Promise<RetailPosBackofficeCatalogProductDetailResponse> {
  const actor = await resolveRetailPosRuntimeActor({
    tenantSlug: input.tenantSlug,
    deviceId: input.deviceId,
    deviceSecret: input.deviceSecret,
  });

  assertBackofficeCatalogReadAccess(actor);

  const productId = normalizeRequiredString(input.productId, "productId");
  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .from("retail_pos_products")
    .select(
      "id, tenant_id, category_id, name, brand, sku, barcode, unit_price_cents, cost_cents, supplier_id, sales_unit_code, sales_unit_label, allow_decimal_quantity, has_variants, is_active, deleted_at, created_at, updated_at",
    )
    .eq("tenant_id", actor.tenantId)
    .eq("id", productId)
    .is("deleted_at", null)
    .limit(1)
    .maybeSingle<RetailPosBackofficeProductRow>();

  if (error) {
    throw new RetailPosRuntimeError(
      500,
      `Unable to fetch retail_pos backoffice catalog product: ${error.message}`,
    );
  }

  if (!data) {
    throw new RetailPosRuntimeError(404, "retail_pos product not found.");
  }

  const [categoryResult, supplierResult] = await Promise.all([
    data.category_id
      ? supabase
          .from("retail_pos_categories")
          .select("id, name")
          .eq("tenant_id", actor.tenantId)
          .eq("id", data.category_id)
          .limit(1)
          .maybeSingle<{ id: string; name: string }>()
      : Promise.resolve({ data: null as { id: string; name: string } | null, error: null }),
    data.supplier_id
      ? supabase
          .from("retail_pos_suppliers")
          .select("id, name")
          .eq("tenant_id", actor.tenantId)
          .eq("id", data.supplier_id)
          .limit(1)
          .maybeSingle<{ id: string; name: string }>()
      : Promise.resolve({ data: null as { id: string; name: string } | null, error: null }),
  ]);

  if (categoryResult.error) {
    throw new RetailPosRuntimeError(
      500,
      `Unable to fetch retail_pos category for backoffice detail: ${categoryResult.error.message}`,
    );
  }

  if (supplierResult.error) {
    throw new RetailPosRuntimeError(
      500,
      `Unable to fetch retail_pos supplier for backoffice detail: ${supplierResult.error.message}`,
    );
  }

  return {
    ok: true,
    product: mapBackofficeProductRow({
      product: data,
      categoryName: categoryResult.data?.name ?? null,
      supplierName: supplierResult.data?.name ?? null,
    }),
  };
}

export async function updateRetailPosBackofficeCatalogProduct(input: {
  tenantSlug: string;
  productId: string;
  request: UpdateRetailPosBackofficeProductRequest;
  deviceId?: string | null;
  deviceSecret?: string | null;
}): Promise<RetailPosBackofficeCatalogProductDetailResponse> {
  const actor = await resolveRetailPosRuntimeActor({
    tenantSlug: input.tenantSlug,
    deviceId: input.deviceId,
    deviceSecret: input.deviceSecret,
  });

  assertBackofficeCatalogManageAccess(actor);

  const productId = normalizeRequiredString(input.productId, "productId");
  const currentProduct = await loadBackofficeProductForTenant({
    tenantId: actor.tenantId,
    productId,
  });
  const patch = normalizeBackofficeProductPatch(input.request);

  if (patch.sku) {
    await assertSkuAvailable({
      tenantId: actor.tenantId,
      sku: patch.sku,
      currentProductId: currentProduct.id,
    });
  }

  if (patch.barcode) {
    await assertBarcodeAvailable({
      tenantId: actor.tenantId,
      barcode: patch.barcode,
      currentProductId: currentProduct.id,
    });
  }

  if (patch.category_id !== undefined && patch.category_id !== null) {
    const category = await loadCategoryById({
      tenantId: actor.tenantId,
      categoryId: patch.category_id,
    });

    if (!category) {
      throw new RetailPosRuntimeError(400, "category_id is not available for this tenant.");
    }
  }

  if (patch.supplier_id !== undefined && patch.supplier_id !== null) {
    const supplier = await loadSupplierById({
      tenantId: actor.tenantId,
      supplierId: patch.supplier_id,
    });

    if (!supplier) {
      throw new RetailPosRuntimeError(400, "supplier_id is not available for this tenant.");
    }
  }

  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .from("retail_pos_products")
    .update(patch)
    .eq("tenant_id", actor.tenantId)
    .eq("id", currentProduct.id)
    .is("deleted_at", null)
    .select(
      "id, tenant_id, category_id, name, brand, sku, barcode, unit_price_cents, cost_cents, supplier_id, sales_unit_code, sales_unit_label, allow_decimal_quantity, has_variants, is_active, deleted_at, created_at, updated_at",
    )
    .limit(1)
    .maybeSingle<RetailPosBackofficeProductRow>();

  if (error) {
    throw new RetailPosRuntimeError(400, `Unable to update retail_pos product: ${error.message}`);
  }

  if (!data) {
    throw new RetailPosRuntimeError(409, "retail_pos product changed before it could be updated.");
  }

  const [category, supplier] = await Promise.all([
    loadCategoryById({ tenantId: actor.tenantId, categoryId: data.category_id }),
    loadSupplierById({ tenantId: actor.tenantId, supplierId: data.supplier_id }),
  ]);

  return {
    ok: true,
    product: mapBackofficeProductRow({
      product: data,
      categoryName: category?.name ?? null,
      supplierName: supplier?.name ?? null,
    }),
  };
}

export async function listRetailPosBackofficeSuppliers(input: {
  tenantSlug: string;
  q?: string | null;
  deviceId?: string | null;
  deviceSecret?: string | null;
}): Promise<RetailPosBackofficeSuppliersResponse> {
  const actor = await resolveRetailPosRuntimeActor({
    tenantSlug: input.tenantSlug,
    deviceId: input.deviceId,
    deviceSecret: input.deviceSecret,
  });

  assertBackofficeCatalogReadAccess(actor);

  const supabase = getSupabaseAdminClient();
  let query = supabase
    .from("retail_pos_suppliers")
    .select("id, tenant_id, name, is_active, created_at, updated_at")
    .eq("tenant_id", actor.tenantId)
    .eq("is_active", true)
    .order("name", { ascending: true })
    .limit(100);

  const normalizedQuery = normalizeOptionalValue(input.q);
  if (normalizedQuery) {
    query = query.ilike("name", `%${normalizedQuery}%`);
  }

  const { data, error } = await query;

  if (error) {
    throw new RetailPosRuntimeError(500, `Unable to fetch retail_pos suppliers: ${error.message}`);
  }

  return {
    ok: true,
    items: (data ?? []).map((row) => mapSupplierRow(row as RetailPosSupplierRow)),
  };
}

export async function createRetailPosBackofficeSupplier(input: {
  tenantSlug: string;
  name: string;
  deviceId?: string | null;
  deviceSecret?: string | null;
}): Promise<CreateRetailPosBackofficeSupplierResponse> {
  const actor = await resolveRetailPosRuntimeActor({
    tenantSlug: input.tenantSlug,
    deviceId: input.deviceId,
    deviceSecret: input.deviceSecret,
  });

  assertBackofficeCatalogManageAccess(actor);

  const name = normalizeRequiredString(input.name, "name");
  const loweredName = name.toLowerCase();
  const supabase = getSupabaseAdminClient();
  const { data: existingRows, error: existingError } = await supabase
    .from("retail_pos_suppliers")
    .select("id, tenant_id, name, is_active, created_at, updated_at")
    .eq("tenant_id", actor.tenantId);

  if (existingError) {
    throw new RetailPosRuntimeError(500, `Unable to resolve retail_pos suppliers: ${existingError.message}`);
  }

  const existing = (existingRows ?? []).find(
    (row) => String(row.name ?? "").trim().toLowerCase() === loweredName,
  ) as RetailPosSupplierRow | undefined;

  if (existing) {
    if (!existing.is_active) {
      const { data: reactivated, error: reactivateError } = await supabase
        .from("retail_pos_suppliers")
        .update({ is_active: true, name })
        .eq("tenant_id", actor.tenantId)
        .eq("id", existing.id)
        .select("id, tenant_id, name, is_active, created_at, updated_at")
        .limit(1)
        .maybeSingle<RetailPosSupplierRow>();

      if (reactivateError) {
        throw new RetailPosRuntimeError(400, `Unable to reactivate retail_pos supplier: ${reactivateError.message}`);
      }

      if (!reactivated) {
        throw new RetailPosRuntimeError(409, "retail_pos supplier changed before it could be reactivated.");
      }

      return {
        ok: true,
        supplier: mapSupplierRow(reactivated),
        created: false,
      };
    }

    return {
      ok: true,
      supplier: mapSupplierRow(existing),
      created: false,
    };
  }

  const { data, error } = await supabase
    .from("retail_pos_suppliers")
    .insert({
      tenant_id: actor.tenantId,
      name,
      is_active: true,
    })
    .select("id, tenant_id, name, is_active, created_at, updated_at")
    .limit(1)
    .maybeSingle<RetailPosSupplierRow>();

  if (error) {
    throw new RetailPosRuntimeError(400, `Unable to create retail_pos supplier: ${error.message}`);
  }

  if (!data) {
    throw new RetailPosRuntimeError(500, "retail_pos supplier insert did not return a record.");
  }

  return {
    ok: true,
    supplier: mapSupplierRow(data),
    created: true,
  };
}
