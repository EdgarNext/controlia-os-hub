import { getSupabaseServerClient } from "@/lib/supabase/server";
import { isKitchenUnitSuspicious } from "@/lib/kitchen/formatters";
import type {
  KitchenInventoryItem,
  KitchenInventoryPurchaseOption,
  KitchenInventorySupplierPrice,
} from "./types";
import type { KitchenCatalogStatus } from "./catalog-status";
export { getKitchenCatalogStatusMeta, KITCHEN_CATALOG_STATUS_META } from "./catalog-status";
export type { KitchenCatalogStatus } from "./catalog-status";

export type KitchenCatalogFilters = {
  itemId?: string;
  query?: string;
  status?: KitchenCatalogStatus | "";
  unitId?: string;
  supplierId?: string;
  scope?: "active" | "retired" | "all";
  sort?: "name" | "cost" | "updated_at";
  order?: "asc" | "desc";
};

export type KitchenCatalogPresentation = {
  id: string;
  supplierName: string | null;
  supplierId: string | null;
  purchaseUnitCode: string | null;
  purchaseUnitName: string | null;
  inventoryUnitCode: string | null;
  quantityPerPurchaseUnit: number;
  pricePerPurchaseUnit: number | null;
  priceUpdatedAt: string | null;
  derivedUnitCost: number | null;
  isDefault: boolean;
  isActive: boolean;
  pricePending: boolean;
  isReference: boolean;
};

export type KitchenCatalogItemRow = {
  item: KitchenInventoryItem;
  unitCode: string | null;
  categoryName: string | null;
  referenceSupplierName: string | null;
  referenceSupplierId: string | null;
  defaultPresentation: KitchenCatalogPresentation | null;
  activePresentationCount: number;
  presentationCount: number;
  currentPrice: KitchenInventorySupplierPrice | null;
  lastPriceUpdatedAt: string | null;
  status: KitchenCatalogStatus;
  reviewReasons: string[];
};

export type KitchenCatalogSummary = {
  activeItems: number;
  readyItems: number;
  pricePendingItems: number;
  reviewItems: number;
};

export type KitchenCatalogListData = {
  rows: KitchenCatalogItemRow[];
  total: number;
  page: number;
  pageSize: number;
  pageCount: number;
  summary: KitchenCatalogSummary;
};

export type KitchenCatalogDetailData = KitchenCatalogItemRow & {
  presentations: KitchenCatalogPresentation[];
  recipeLineCount: number;
  historicalUsageCount: number;
  canChangeUnit: boolean;
};

type CatalogOption = KitchenInventoryPurchaseOption & {
  supplierName: string | null;
};

function toSingle<T>(value: T | T[] | null | undefined): T | null {
  return Array.isArray(value) ? (value[0] ?? null) : (value ?? null);
}

function normalizeScope(scope: KitchenCatalogFilters["scope"]): "active" | "retired" | "all" {
  return scope === "retired" || scope === "all" ? scope : "active";
}

function isAllowedZeroCost(item: KitchenInventoryItem): boolean {
  return item.normalized_name === "agua";
}

function getPresentationPrice(
  option: CatalogOption,
  prices: KitchenInventorySupplierPrice[],
): KitchenInventorySupplierPrice | null {
  return (
    prices.find((price) => price.is_current && price.purchase_option_id === option.id) ??
    prices.find(
      (price) =>
        price.is_current &&
        price.supplier_id === option.supplier_id &&
        price.purchase_unit_id === option.purchase_unit_id,
    ) ??
    null
  );
}

function getDerivedUnitCost(
  price: KitchenInventorySupplierPrice | null,
  option: CatalogOption | null,
  item: KitchenInventoryItem,
): number | null {
  if (!price || !option || option.quantity_per_purchase_unit <= 0) return null;
  if (option.inventory_unit_id !== item.default_unit_id) return null;
  return Number(price.price_per_purchase_unit) / Number(option.quantity_per_purchase_unit);
}

function buildPresentation(
  option: CatalogOption,
  item: KitchenInventoryItem,
  prices: KitchenInventorySupplierPrice[],
): KitchenCatalogPresentation {
  const price = getPresentationPrice(option, prices);
  return {
    id: option.id,
    supplierName: option.supplierName,
    supplierId: option.supplier_id,
    purchaseUnitCode: option.purchase_unit?.code ?? null,
    purchaseUnitName: option.purchase_unit?.name ?? null,
    inventoryUnitCode: option.inventory_unit?.code ?? null,
    quantityPerPurchaseUnit: Number(option.quantity_per_purchase_unit ?? 0),
    pricePerPurchaseUnit: price ? Number(price.price_per_purchase_unit) : null,
    priceUpdatedAt: price?.updated_at ?? null,
    derivedUnitCost: getDerivedUnitCost(price, option, item),
    isDefault: option.is_default,
    isActive: option.is_active,
    pricePending: !price,
    isReference: option.is_default && option.is_active,
  };
}

function getStatus(input: {
  item: KitchenInventoryItem;
  activeOptions: CatalogOption[];
  defaultOption: CatalogOption | null;
  currentPrice: KitchenInventorySupplierPrice | null;
  reviewReasons: string[];
}): KitchenCatalogStatus {
  if (!input.item.is_active) return "retired";
  if (input.activeOptions.length === 0) return "no_purchase_option";
  if (input.reviewReasons.length > 0) return "requires_review";
  if (!input.currentPrice || Number(input.item.current_unit_cost ?? 0) <= 0) {
    return "price_pending";
  }
  if (isAllowedZeroCost(input.item)) return "zero_cost_configured";
  if (!input.defaultOption) return "requires_review";
  return "ready";
}

function buildRow(
  item: KitchenInventoryItem,
  options: CatalogOption[],
  prices: KitchenInventorySupplierPrice[],
): KitchenCatalogItemRow {
  const activeOptions = options.filter((option) => option.is_active);
  const defaultOption = activeOptions.find((option) => option.is_default) ?? null;
  const referenceSupplier = toSingle(item.kitchen_inventory_suppliers);
  const currentPrice = defaultOption
    ? getPresentationPrice(defaultOption, prices)
    : activeOptions.map((option) => getPresentationPrice(option, prices)).find(Boolean) ?? null;
  const reviewReasons: string[] = [];
  const unitCode = toSingle(item.kitchen_inventory_units)?.code ?? null;

  if (!defaultOption) reviewReasons.push("No tiene una presentación de referencia activa.");
  if (!referenceSupplier && !defaultOption?.supplier_id) reviewReasons.push("No tiene proveedor de referencia.");
  if (isKitchenUnitSuspicious(unitCode) || unitCode === "paquete" || unitCode === "caja") {
    reviewReasons.push("La unidad operativa requiere revisión.");
  }
  if (Number(item.current_unit_cost ?? 0) <= 0 && !isAllowedZeroCost(item)) {
    reviewReasons.push("El costo operativo no es válido para costeo.");
  }

  const defaultPresentation = defaultOption ? buildPresentation(defaultOption, item, prices) : null;
  const presentations = options.map((option) => buildPresentation(option, item, prices));
  const currentPricePresentation = presentations.find((presentation) => presentation.id === defaultOption?.id) ?? null;
  const lastPriceUpdatedAt = prices
    .filter((price) => price.is_current)
    .map((price) => price.updated_at)
    .filter(Boolean)
    .sort()
    .at(-1) ?? null;

  return {
    item,
    unitCode,
    categoryName: toSingle(item.kitchen_inventory_categories)?.name ?? null,
    referenceSupplierName: referenceSupplier?.name ?? defaultPresentation?.supplierName ?? null,
    referenceSupplierId: item.default_supplier_id ?? defaultPresentation?.supplierId ?? null,
    defaultPresentation: currentPricePresentation ?? defaultPresentation,
    activePresentationCount: activeOptions.length,
    presentationCount: options.length,
    currentPrice,
    lastPriceUpdatedAt,
    status: getStatus({ item, activeOptions, defaultOption, currentPrice, reviewReasons }),
    reviewReasons,
  };
}

async function loadCatalogRows(tenantId: string, filters: KitchenCatalogFilters = {}, pagination?: { page: number; pageSize: number }): Promise<{ rows: KitchenCatalogItemRow[]; total: number }> {
  const supabase = await getSupabaseServerClient();
  let itemQuery = supabase
    .from("kitchen_inventory_items")
    .select(
      "id,tenant_id,category_id,default_unit_id,default_supplier_id,name,normalized_name,sku,description,current_unit_cost,standard_unit_cost,is_perishable,is_active,created_at,kitchen_inventory_categories:kitchen_inventory_categories!kitchen_inventory_items_tenant_category_fkey(id,name),kitchen_inventory_units:kitchen_inventory_units!kitchen_inventory_items_tenant_default_unit_fkey(id,code,name),kitchen_inventory_suppliers:kitchen_inventory_suppliers!kitchen_inventory_items_tenant_default_supplier_fkey(id,name)",
      { count: "exact" },
    )
    .eq("tenant_id", tenantId)
    .order(filters.sort === "cost" ? "current_unit_cost" : filters.sort === "updated_at" ? "updated_at" : "name", { ascending: filters.order !== "desc" });

  const scope = normalizeScope(filters.scope);
  if (scope === "active") itemQuery = itemQuery.eq("is_active", true);
  if (scope === "retired") itemQuery = itemQuery.eq("is_active", false);
  if (filters.query?.trim()) itemQuery = itemQuery.ilike("name", `%${filters.query.trim()}%`);
  if (filters.unitId) itemQuery = itemQuery.eq("default_unit_id", filters.unitId);
  if (filters.supplierId) itemQuery = itemQuery.eq("default_supplier_id", filters.supplierId);
  if (filters.itemId) itemQuery = itemQuery.eq("id", filters.itemId);
  if (pagination) {
    const from = (Math.max(pagination.page, 1) - 1) * pagination.pageSize;
    itemQuery = itemQuery.range(from, from + pagination.pageSize - 1);
  }

  const { data: itemRows, error: itemError, count: total } = await itemQuery;
  if (itemError) throw new Error(`No fue posible cargar el catálogo de insumos: ${itemError.message}`);

  const items = ((itemRows ?? []) as Array<Record<string, unknown>>).map((row) => ({
    ...(row as unknown as KitchenInventoryItem),
    kitchen_inventory_categories: toSingle(row.kitchen_inventory_categories as KitchenInventoryItem["kitchen_inventory_categories"]),
    kitchen_inventory_units: toSingle(row.kitchen_inventory_units as KitchenInventoryItem["kitchen_inventory_units"]),
    kitchen_inventory_suppliers: toSingle(row.kitchen_inventory_suppliers as KitchenInventoryItem["kitchen_inventory_suppliers"]),
  }));
  if (items.length === 0) return { rows: [], total: total ?? 0 };

  const itemIds = items.map((item) => item.id);
  const optionQuery = supabase
      .from("kitchen_inventory_purchase_options")
      .select(
        "id,tenant_id,item_id,supplier_id,purchase_unit_id,inventory_unit_id,quantity_per_purchase_unit,min_purchase_quantity,purchase_multiple,is_default,is_active,notes,created_at,updated_at,kitchen_inventory_suppliers:kitchen_inventory_suppliers!kitchen_inventory_purchase_options_tenant_supplier_fkey(id,name),purchase_unit:kitchen_inventory_units!kitchen_inventory_purchase_options_tenant_purchase_unit_fkey(id,code,name),inventory_unit:kitchen_inventory_units!kitchen_inventory_purchase_options_tenant_inventory_unit_fkey(id,code,name)",
      )
      .eq("tenant_id", tenantId);
  const priceQuery = supabase
      .from("kitchen_inventory_supplier_prices")
      .select(
        "id,tenant_id,item_id,supplier_id,purchase_option_id,purchase_unit_id,price_per_purchase_unit,currency,source_type,source_ref,valid_from,valid_until,is_current,notes,created_at,updated_at",
      )
      .eq("tenant_id", tenantId)
      .eq("is_current", true);
  // PostgREST encodes `.in` in the URL. Keep it for a visible page, but
  // avoid oversized URLs when a derived-status query evaluates many items.
  if (itemIds.length <= 100) {
    optionQuery.in("item_id", itemIds);
    priceQuery.in("item_id", itemIds);
  }
  const [{ data: optionRows, error: optionError }, { data: priceRows, error: priceError }] = await Promise.all([optionQuery, priceQuery]);
  if (optionError) throw new Error(`No fue posible cargar presentaciones: ${optionError.message}`);
  if (priceError) throw new Error(`No fue posible cargar precios vigentes: ${priceError.message}`);

  const optionsByItem = new Map<string, CatalogOption[]>();
  for (const raw of (optionRows ?? []) as Array<Record<string, unknown>>) {
    const option = {
      ...(raw as unknown as KitchenInventoryPurchaseOption),
      supplierName: toSingle(raw.kitchen_inventory_suppliers as Array<{ name?: string | null }> | { name?: string | null } | null)?.name ?? null,
      kitchen_inventory_suppliers: toSingle(raw.kitchen_inventory_suppliers as KitchenInventoryPurchaseOption["kitchen_inventory_suppliers"]),
      purchase_unit: toSingle(raw.purchase_unit as KitchenInventoryPurchaseOption["purchase_unit"]),
      inventory_unit: toSingle(raw.inventory_unit as KitchenInventoryPurchaseOption["inventory_unit"]),
    } as CatalogOption;
    const bucket = optionsByItem.get(option.item_id) ?? [];
    bucket.push(option);
    optionsByItem.set(option.item_id, bucket);
  }

  const pricesByItem = new Map<string, KitchenInventorySupplierPrice[]>();
  for (const raw of (priceRows ?? []) as Array<Record<string, unknown>>) {
    const price = raw as unknown as KitchenInventorySupplierPrice;
    const bucket = pricesByItem.get(price.item_id) ?? [];
    bucket.push(price);
    pricesByItem.set(price.item_id, bucket);
  }

  const rows = items.map((item) => buildRow(item, optionsByItem.get(item.id) ?? [], pricesByItem.get(item.id) ?? []));
  return { rows: filters.status ? rows.filter((row) => row.status === filters.status) : rows, total: total ?? 0 };
}

export async function getKitchenCatalogListData(
  tenantId: string,
  filters: KitchenCatalogFilters,
  requestedPage = 1,
  pageSize = 25,
): Promise<KitchenCatalogListData> {
  const safePageSize = [25, 50, 100].includes(pageSize) ? pageSize : 25;
  const requested = Math.max(requestedPage, 1);
  // Statuses are derived from purchase options, prices and unit consistency.
  // Keep this fallback server-only until the derived status has a SQL view/RPC;
  // the default catalog path remains a true range query.
  const loaded = filters.status
    ? await loadCatalogRows(tenantId, filters)
    : await loadCatalogRows(tenantId, filters, { page: requested, pageSize: safePageSize });
  const rows = loaded.rows;
  const pageTotal = filters.status ? rows.length : loaded.total;
  const pageCount = Math.max(1, Math.ceil(pageTotal / safePageSize));
  const page = Math.min(requested, pageCount);
  const summaryRows = (await loadCatalogRows(tenantId, { scope: "active" })).rows;
  return {
    rows: filters.status ? rows.slice((page - 1) * safePageSize, page * safePageSize) : rows,
    total: pageTotal,
    page,
    pageSize: safePageSize,
    pageCount,
    summary: {
      activeItems: summaryRows.length,
      readyItems: summaryRows.filter((row) => row.status === "ready" || row.status === "zero_cost_configured").length,
      pricePendingItems: summaryRows.filter((row) => row.status === "price_pending").length,
      reviewItems: summaryRows.filter((row) => row.status === "requires_review" || row.status === "no_purchase_option").length,
    },
  };
}

export async function getKitchenCatalogItemDetail(tenantId: string, itemId: string): Promise<KitchenCatalogDetailData | null> {
  const loaded = await loadCatalogRows(tenantId, { scope: "all", itemId });
  const row = loaded.rows.find((candidate) => candidate.item.id === itemId);
  if (!row) return null;

  const supabase = await getSupabaseServerClient();
  const [{ count: recipeLineCount }, { count: movementCount }, { count: balanceCount }, { count: optionCount }, { count: priceCount }, { count: priceHistoryCount }, { count: requirementCount }] = await Promise.all([
    supabase.from("kitchen_recipe_lines").select("id", { count: "exact", head: true }).eq("tenant_id", tenantId).eq("item_id", itemId),
    supabase
      .from("kitchen_inventory_movements")
      .select("id", { count: "exact", head: true })
      .eq("tenant_id", tenantId)
      .eq("item_id", itemId),
    supabase.from("kitchen_inventory_balances").select("item_id", { count: "exact", head: true }).eq("tenant_id", tenantId).eq("item_id", itemId),
    supabase.from("kitchen_inventory_purchase_options").select("id", { count: "exact", head: true }).eq("tenant_id", tenantId).eq("item_id", itemId),
    supabase.from("kitchen_inventory_supplier_prices").select("id", { count: "exact", head: true }).eq("tenant_id", tenantId).eq("item_id", itemId),
    supabase.from("kitchen_inventory_price_history").select("id", { count: "exact", head: true }).eq("tenant_id", tenantId).eq("item_id", itemId),
    supabase.from("event_catering_requirements").select("id", { count: "exact", head: true }).eq("tenant_id", tenantId).eq("item_id", itemId),
  ]);
  const historicalUsageCount = (movementCount ?? 0) + (balanceCount ?? 0) + (optionCount ?? 0) + (priceCount ?? 0) + (priceHistoryCount ?? 0) + (requirementCount ?? 0);
  const options = await supabase
    .from("kitchen_inventory_purchase_options")
    .select(
      "id,tenant_id,item_id,supplier_id,purchase_unit_id,inventory_unit_id,quantity_per_purchase_unit,min_purchase_quantity,purchase_multiple,is_default,is_active,notes,created_at,updated_at,kitchen_inventory_suppliers:kitchen_inventory_suppliers!kitchen_inventory_purchase_options_tenant_supplier_fkey(id,name),purchase_unit:kitchen_inventory_units!kitchen_inventory_purchase_options_tenant_purchase_unit_fkey(id,code,name),inventory_unit:kitchen_inventory_units!kitchen_inventory_purchase_options_tenant_inventory_unit_fkey(id,code,name)",
    )
    .eq("tenant_id", tenantId)
    .eq("item_id", itemId);
  if (options.error) throw new Error(`No fue posible cargar presentaciones del insumo: ${options.error.message}`);
  const prices = await supabase
    .from("kitchen_inventory_supplier_prices")
    .select("id,tenant_id,item_id,supplier_id,purchase_option_id,purchase_unit_id,price_per_purchase_unit,currency,source_type,source_ref,valid_from,valid_until,is_current,notes,created_at,updated_at")
    .eq("tenant_id", tenantId)
    .eq("item_id", itemId)
    .eq("is_current", true);
  if (prices.error) throw new Error(`No fue posible cargar precios del insumo: ${prices.error.message}`);

  const optionRows = ((options.data ?? []) as Array<Record<string, unknown>>).map((raw) => ({
    ...(raw as unknown as KitchenInventoryPurchaseOption),
    supplierName: toSingle(raw.kitchen_inventory_suppliers as Array<{ name?: string | null }> | { name?: string | null } | null)?.name ?? null,
    kitchen_inventory_suppliers: toSingle(raw.kitchen_inventory_suppliers as KitchenInventoryPurchaseOption["kitchen_inventory_suppliers"]),
    purchase_unit: toSingle(raw.purchase_unit as KitchenInventoryPurchaseOption["purchase_unit"]),
    inventory_unit: toSingle(raw.inventory_unit as KitchenInventoryPurchaseOption["inventory_unit"]),
  })) as CatalogOption[];
  const presentationPrices = prices.data as KitchenInventorySupplierPrice[];
  return {
    ...row,
    presentations: optionRows.map((option) => buildPresentation(option, row.item, presentationPrices)),
    recipeLineCount: recipeLineCount ?? 0,
    historicalUsageCount: historicalUsageCount ?? 0,
    canChangeUnit: (recipeLineCount ?? 0) === 0 && (historicalUsageCount ?? 0) === 0 && row.presentationCount === 0,
  };
}
