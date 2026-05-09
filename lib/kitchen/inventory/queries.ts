import { getSupabaseServerClient } from "@/lib/supabase/server";
import type {
  KitchenInventoryBalance,
  KitchenInventoryCategory,
  KitchenInventoryItem,
  KitchenInventoryLocation,
  KitchenInventoryMovement,
  KitchenInventoryPurchaseOption,
  KitchenInventorySupplierPrice,
  KitchenInventorySupplier,
  KitchenInventoryUnit,
  KitchenInventoryItemOperationalRow,
  KitchenInventoryItemOperationalState,
} from "./types";
import { isKitchenUnitSuspicious } from "@/lib/kitchen/formatters";

export type KitchenInventoryItemFilters = {
  q?: string;
  categoryId?: string;
  supplierId?: string;
};

type InventoryOperationalBaseData = {
  items: KitchenInventoryItem[];
  balances: KitchenInventoryBalance[];
  locations: KitchenInventoryLocation[];
  stockRules: Array<{ item_id: string; location_id: string | null; min_quantity: number | null }>;
  currentSupplierPrices: Array<{
    item_id: string;
    price_per_purchase_unit: number;
    purchase_unit_id: string;
    kitchen_inventory_units: { code: string | null } | { code: string | null }[] | null;
  }>;
  defaultPurchaseOptions: Array<{ item_id: string }>;
};

async function loadInventoryOperationalBaseData(
  tenantId: string,
  filters?: KitchenInventoryItemFilters,
): Promise<InventoryOperationalBaseData> {
  const supabase = await getSupabaseServerClient();
  const [items, balances, locations, stockRulesRes, currentPricesRes, defaultOptionsRes] = await Promise.all([
    listKitchenInventoryItems(tenantId, filters),
    listKitchenInventoryBalances(tenantId),
    listKitchenInventoryLocations(tenantId),
    supabase
      .from("kitchen_inventory_stock_rules")
      .select("item_id, location_id, min_quantity")
      .eq("tenant_id", tenantId)
      .eq("is_active", true),
    supabase
      .from("kitchen_inventory_supplier_prices")
      .select(
        "item_id, price_per_purchase_unit, purchase_unit_id, kitchen_inventory_units:kitchen_inventory_units!kitchen_inventory_supplier_prices_tenant_purchase_unit_fkey(code)",
      )
      .eq("tenant_id", tenantId)
      .eq("is_current", true),
    supabase
      .from("kitchen_inventory_purchase_options")
      .select("item_id")
      .eq("tenant_id", tenantId)
      .eq("is_active", true)
      .eq("is_default", true),
  ]);

  if (stockRulesRes.error) throw new Error(`No fue posible listar reglas de stock: ${stockRulesRes.error.message}`);
  if (currentPricesRes.error) {
    throw new Error(`No fue posible listar precios proveedor actuales: ${currentPricesRes.error.message}`);
  }
  if (defaultOptionsRes.error) {
    throw new Error(`No fue posible listar opciones de compra default: ${defaultOptionsRes.error.message}`);
  }

  return {
    items,
    balances,
    locations,
    stockRules: (stockRulesRes.data ?? []) as Array<{ item_id: string; location_id: string | null; min_quantity: number | null }>,
    currentSupplierPrices: (currentPricesRes.data ?? []) as Array<{
      item_id: string;
      price_per_purchase_unit: number;
      purchase_unit_id: string;
      kitchen_inventory_units: { code: string | null } | { code: string | null }[] | null;
    }>,
    defaultPurchaseOptions: (defaultOptionsRes.data ?? []) as Array<{ item_id: string }>,
  };
}

export async function listKitchenInventoryCategories(tenantId: string): Promise<KitchenInventoryCategory[]> {
  const supabase = await getSupabaseServerClient();
  const { data, error } = await supabase
    .from("kitchen_inventory_categories")
    .select("id, tenant_id, name, normalized_name, description, is_active")
    .eq("tenant_id", tenantId)
    .order("name", { ascending: true });

  if (error) throw new Error(`No fue posible listar categorías de inventario: ${error.message}`);
  return (data ?? []) as KitchenInventoryCategory[];
}

export async function listKitchenInventoryUnits(tenantId: string): Promise<KitchenInventoryUnit[]> {
  const supabase = await getSupabaseServerClient();
  const { data, error } = await supabase
    .from("kitchen_inventory_units")
    .select("id, tenant_id, code, name, normalized_name, unit_type, is_base_unit, is_active")
    .eq("tenant_id", tenantId)
    .order("name", { ascending: true });

  if (error) throw new Error(`No fue posible listar unidades de inventario: ${error.message}`);
  return (data ?? []) as KitchenInventoryUnit[];
}

export async function listKitchenInventorySuppliers(tenantId: string): Promise<KitchenInventorySupplier[]> {
  const supabase = await getSupabaseServerClient();
  const { data, error } = await supabase
    .from("kitchen_inventory_suppliers")
    .select("id, tenant_id, name, normalized_name, is_active")
    .eq("tenant_id", tenantId)
    .order("name", { ascending: true });

  if (error) throw new Error(`No fue posible listar proveedores de inventario: ${error.message}`);
  return (data ?? []) as KitchenInventorySupplier[];
}

export async function listKitchenInventoryLocations(tenantId: string): Promise<KitchenInventoryLocation[]> {
  const supabase = await getSupabaseServerClient();
  const { data, error } = await supabase
    .from("kitchen_inventory_locations")
    .select("id, tenant_id, name, normalized_name, is_active")
    .eq("tenant_id", tenantId)
    .order("name", { ascending: true });

  if (error) throw new Error(`No fue posible listar ubicaciones de inventario: ${error.message}`);
  return (data ?? []) as KitchenInventoryLocation[];
}

export async function listKitchenInventoryItems(
  tenantId: string,
  filters?: KitchenInventoryItemFilters,
): Promise<KitchenInventoryItem[]> {
  const supabase = await getSupabaseServerClient();
  let query = supabase
    .from("kitchen_inventory_items")
    .select(
      "id, tenant_id, category_id, default_unit_id, default_supplier_id, name, normalized_name, sku, description, current_unit_cost, standard_unit_cost, is_perishable, is_active, created_at, kitchen_inventory_categories:kitchen_inventory_categories!kitchen_inventory_items_tenant_category_fkey(id, name), kitchen_inventory_units:kitchen_inventory_units!kitchen_inventory_items_tenant_default_unit_fkey(id, code, name), kitchen_inventory_suppliers:kitchen_inventory_suppliers!kitchen_inventory_items_tenant_default_supplier_fkey(id, name)",
    )
    .eq("tenant_id", tenantId)
    .order("created_at", { ascending: false });

  const q = filters?.q?.trim();
  if (q) {
    const escaped = q.replace(/[%_]/g, "\\$&");
    query = query.or(`name.ilike.%${escaped}%,normalized_name.ilike.%${escaped}%,sku.ilike.%${escaped}%`);
  }

  if (filters?.categoryId) {
    query = query.eq("category_id", filters.categoryId);
  }
  if (filters?.supplierId) {
    query = query.eq("default_supplier_id", filters.supplierId);
  }

  const { data, error } = await query;

  if (error) throw new Error(`No fue posible listar insumos de inventario: ${error.message}`);

  return ((data ?? []) as Array<Record<string, unknown>>).map((row) => ({
    ...(row as unknown as KitchenInventoryItem),
    kitchen_inventory_categories: Array.isArray(row.kitchen_inventory_categories)
      ? ((row.kitchen_inventory_categories[0] ?? null) as KitchenInventoryItem["kitchen_inventory_categories"])
      : ((row.kitchen_inventory_categories ?? null) as KitchenInventoryItem["kitchen_inventory_categories"]),
    kitchen_inventory_units: Array.isArray(row.kitchen_inventory_units)
      ? ((row.kitchen_inventory_units[0] ?? null) as KitchenInventoryItem["kitchen_inventory_units"])
      : ((row.kitchen_inventory_units ?? null) as KitchenInventoryItem["kitchen_inventory_units"]),
    kitchen_inventory_suppliers: Array.isArray(row.kitchen_inventory_suppliers)
      ? ((row.kitchen_inventory_suppliers[0] ?? null) as KitchenInventoryItem["kitchen_inventory_suppliers"])
      : ((row.kitchen_inventory_suppliers ?? null) as KitchenInventoryItem["kitchen_inventory_suppliers"]),
  }));
}

export async function listKitchenInventoryBalances(tenantId: string): Promise<KitchenInventoryBalance[]> {
  const supabase = await getSupabaseServerClient();
  const { data, error } = await supabase
    .from("kitchen_inventory_balances")
    .select("tenant_id, item_id, location_id, quantity, updated_at")
    .eq("tenant_id", tenantId);

  if (error) throw new Error(`No fue posible listar balances de inventario: ${error.message}`);
  return (data ?? []) as KitchenInventoryBalance[];
}

export async function listKitchenInventoryRecentMovements(
  tenantId: string,
  limit = 20,
): Promise<KitchenInventoryMovement[]> {
  const supabase = await getSupabaseServerClient();
  const { data, error } = await supabase
    .from("kitchen_inventory_movements")
    .select(
      "id, tenant_id, item_id, location_id, unit_id, movement_type, quantity, quantity_delta, unit_cost, total_cost, reason, source_type, occurred_at, created_at, kitchen_inventory_items:kitchen_inventory_items!kitchen_inventory_movements_tenant_item_fkey(id, name), kitchen_inventory_locations:kitchen_inventory_locations!kitchen_inventory_movements_tenant_location_fkey(id, name), kitchen_inventory_units:kitchen_inventory_units!kitchen_inventory_movements_tenant_unit_fkey(id, code, name)",
    )
    .eq("tenant_id", tenantId)
    .order("occurred_at", { ascending: false })
    .limit(limit);

  if (error) throw new Error(`No fue posible listar movimientos de inventario: ${error.message}`);

  return ((data ?? []) as Array<Record<string, unknown>>).map((row) => ({
    ...(row as unknown as KitchenInventoryMovement),
    kitchen_inventory_items: Array.isArray(row.kitchen_inventory_items)
      ? ((row.kitchen_inventory_items[0] ?? null) as KitchenInventoryMovement["kitchen_inventory_items"])
      : ((row.kitchen_inventory_items ?? null) as KitchenInventoryMovement["kitchen_inventory_items"]),
    kitchen_inventory_locations: Array.isArray(row.kitchen_inventory_locations)
      ? ((row.kitchen_inventory_locations[0] ?? null) as KitchenInventoryMovement["kitchen_inventory_locations"])
      : ((row.kitchen_inventory_locations ?? null) as KitchenInventoryMovement["kitchen_inventory_locations"]),
    kitchen_inventory_units: Array.isArray(row.kitchen_inventory_units)
      ? ((row.kitchen_inventory_units[0] ?? null) as KitchenInventoryMovement["kitchen_inventory_units"])
      : ((row.kitchen_inventory_units ?? null) as KitchenInventoryMovement["kitchen_inventory_units"]),
  }));
}

export async function getKitchenInventoryOverviewStats(tenantId: string) {
  const [{ items, balances, stockRules }, movements] = await Promise.all([
    loadInventoryOperationalBaseData(tenantId),
    listKitchenInventoryRecentMovements(tenantId, 10),
  ]);

  const activeItems = items.filter((item) => item.is_active);
  const itemCostById = new Map(items.map((item) => [item.id, Number(item.current_unit_cost ?? 0)]));
  const totalInventoryValue = balances.reduce((acc, balance) => {
    const cost = itemCostById.get(balance.item_id) ?? 0;
    return acc + Number(balance.quantity) * cost;
  }, 0);

  const lowStockCount = stockRules.reduce((acc, rule) => {
    if (rule.min_quantity == null) return acc;
    const matchingBalance = balances.find(
      (balance) =>
        balance.item_id === rule.item_id &&
        (rule.location_id == null || balance.location_id === rule.location_id),
    );

    if (!matchingBalance) {
      return acc + (rule.min_quantity > 0 ? 1 : 0);
    }

    return Number(matchingBalance.quantity) < Number(rule.min_quantity) ? acc + 1 : acc;
  }, 0);

  return {
    activeItemsCount: activeItems.length,
    totalInventoryValue,
    lowStockCount,
    recentMovements: movements,
  };
}

export async function listKitchenInventoryItemOperationalRows(
  tenantId: string,
  filters?: KitchenInventoryItemFilters,
): Promise<KitchenInventoryItemOperationalRow[]> {
  const { items, balances, locations, defaultPurchaseOptions, currentSupplierPrices } =
    await loadInventoryOperationalBaseData(tenantId, filters);

  const locationById = new Map(locations.map((location) => [location.id, location.name]));
  const balancesByItem = new Map<string, KitchenInventoryBalance[]>();
  for (const balance of balances) {
    const bucket = balancesByItem.get(balance.item_id) ?? [];
    bucket.push(balance);
    balancesByItem.set(balance.item_id, bucket);
  }

  const defaultPoByItem = new Map<string, boolean>();
  for (const option of defaultPurchaseOptions) {
    defaultPoByItem.set(option.item_id, true);
  }

  const currentPriceByItem = new Map<string, boolean>();
  const currentPriceRowByItem = new Map<string, KitchenInventorySupplierPrice>();
  for (const price of currentSupplierPrices) {
    currentPriceByItem.set(price.item_id, true);
    if (!currentPriceRowByItem.has(price.item_id)) {
      const rawUnit = Array.isArray(price.kitchen_inventory_units)
        ? (price.kitchen_inventory_units[0] ?? null)
        : (price.kitchen_inventory_units ?? null);
      currentPriceRowByItem.set(price.item_id, {
        id: "",
        tenant_id: tenantId,
        item_id: price.item_id,
        supplier_id: "",
        purchase_option_id: null,
        purchase_unit_id: price.purchase_unit_id,
        price_per_purchase_unit: Number(price.price_per_purchase_unit ?? 0),
        currency: "MXN",
        source_type: "manual",
        source_ref: null,
        valid_from: null,
        valid_until: null,
        is_current: true,
        notes: null,
        created_at: "",
        updated_at: "",
        purchase_unit: rawUnit?.code ? { id: "", code: rawUnit.code, name: rawUnit.code } : null,
      });
    }
  }

  return items.map((item) => {
    const itemBalances = balancesByItem.get(item.id) ?? [];
    const totalBalance = itemBalances.reduce((sum, row) => sum + Number(row.quantity), 0);
    const locationNames = [...new Set(itemBalances.map((row) => locationById.get(row.location_id)).filter(Boolean))] as string[];
    const unitCode = item.kitchen_inventory_units?.code ?? null;
    const hasDefaultPurchaseOption = defaultPoByItem.get(item.id) === true;
    const hasCurrentSupplierPrice = currentPriceByItem.get(item.id) === true;
    const defaultPurchaseOption = null;
    const currentSupplierPrice = currentPriceRowByItem.get(item.id) ?? null;
    const currentUnitCost = Number(item.current_unit_cost ?? 0);
    const isAllowedZeroCost = item.normalized_name === "agua";

    const stateTags: KitchenInventoryItemOperationalState[] = [];
    if (isKitchenUnitSuspicious(unitCode) || unitCode === "paquete" || unitCode === "caja") {
      stateTags.push(unitCode === "tkg" ? "test_sandbox" : "unidad_dudosa");
    }
    if (!item.default_supplier_id) stateTags.push("sin_proveedor");
    if (!hasDefaultPurchaseOption) stateTags.push("sin_opcion_compra");
    if (!hasCurrentSupplierPrice) stateTags.push("sin_precio_proveedor");
    if (currentUnitCost <= 0 && !isAllowedZeroCost) stateTags.push("costo_0");
    if (stateTags.length === 0) stateTags.push("completo");

    return {
      item,
      totalBalance,
      locationCount: locationNames.length,
      locationNames: locationNames.slice(0, 3),
      estimatedValue: totalBalance * currentUnitCost,
      currentUnitCost,
      isAllowedZeroCost,
      hasDefaultPurchaseOption,
      defaultPurchaseOption,
      hasCurrentSupplierPrice,
      currentSupplierPrice,
      stateTags,
    };
  });
}

export async function getKitchenInventoryItemsInteractiveData(tenantId: string) {
  const [{ items, balances, locations, stockRules, defaultPurchaseOptions, currentSupplierPrices }, categories, suppliers] =
    await Promise.all([
      loadInventoryOperationalBaseData(tenantId),
      listKitchenInventoryCategories(tenantId),
      listKitchenInventorySuppliers(tenantId),
    ]);

  const locationById = new Map(locations.map((location) => [location.id, location.name]));
  const balancesByItem = new Map<string, KitchenInventoryBalance[]>();
  for (const balance of balances) {
    const bucket = balancesByItem.get(balance.item_id) ?? [];
    bucket.push(balance);
    balancesByItem.set(balance.item_id, bucket);
  }

  const hasDefaultPurchaseOptionByItem = new Set(defaultPurchaseOptions.map((row) => row.item_id));
  const currentSupplierPriceByItem = new Map<
    string,
    { price_per_purchase_unit: number; purchase_unit_code: string | null }
  >();
  for (const row of currentSupplierPrices) {
    if (currentSupplierPriceByItem.has(row.item_id)) continue;
    const rawUnit = Array.isArray(row.kitchen_inventory_units)
      ? (row.kitchen_inventory_units[0] ?? null)
      : (row.kitchen_inventory_units ?? null);
    currentSupplierPriceByItem.set(row.item_id, {
      price_per_purchase_unit: Number(row.price_per_purchase_unit ?? 0),
      purchase_unit_code: rawUnit?.code ?? null,
    });
  }

  const rows: KitchenInventoryItemOperationalRow[] = items.map((item) => {
    const itemBalances = balancesByItem.get(item.id) ?? [];
    const totalBalance = itemBalances.reduce((sum, row) => sum + Number(row.quantity), 0);
    const locationNames = [...new Set(itemBalances.map((row) => locationById.get(row.location_id)).filter(Boolean))] as string[];
    const unitCode = item.kitchen_inventory_units?.code ?? null;
    const hasDefaultPurchaseOption = hasDefaultPurchaseOptionByItem.has(item.id);
    const currentPrice = currentSupplierPriceByItem.get(item.id);
    const hasCurrentSupplierPrice = currentPrice != null;
    const currentUnitCost = Number(item.current_unit_cost ?? 0);
    const isAllowedZeroCost = item.normalized_name === "agua";

    const stateTags: KitchenInventoryItemOperationalState[] = [];
    if (isKitchenUnitSuspicious(unitCode) || unitCode === "paquete" || unitCode === "caja") {
      stateTags.push(unitCode === "tkg" ? "test_sandbox" : "unidad_dudosa");
    }
    if (!item.default_supplier_id) stateTags.push("sin_proveedor");
    if (!hasDefaultPurchaseOption) stateTags.push("sin_opcion_compra");
    if (!hasCurrentSupplierPrice) stateTags.push("sin_precio_proveedor");
    if (currentUnitCost <= 0 && !isAllowedZeroCost) stateTags.push("costo_0");
    if (stateTags.length === 0) stateTags.push("completo");

    return {
      item,
      totalBalance,
      locationCount: locationNames.length,
      locationNames: locationNames.slice(0, 3),
      estimatedValue: totalBalance * currentUnitCost,
      currentUnitCost,
      isAllowedZeroCost,
      hasDefaultPurchaseOption,
      defaultPurchaseOption: null,
      hasCurrentSupplierPrice,
      currentSupplierPrice: currentPrice
        ? {
            id: "",
            tenant_id: tenantId,
            item_id: item.id,
            supplier_id: "",
            purchase_option_id: null,
            purchase_unit_id: "",
            price_per_purchase_unit: currentPrice.price_per_purchase_unit,
            currency: "MXN",
            source_type: "manual",
            source_ref: null,
            valid_from: null,
            valid_until: null,
            is_current: true,
            notes: null,
            created_at: "",
            updated_at: "",
            purchase_unit: currentPrice.purchase_unit_code
              ? { id: "", code: currentPrice.purchase_unit_code, name: currentPrice.purchase_unit_code }
              : null,
          }
        : null,
      stateTags,
    };
  });

  const itemCostById = new Map(items.map((item) => [item.id, Number(item.current_unit_cost ?? 0)]));
  const totalInventoryValue = balances.reduce((acc, balance) => {
    const cost = itemCostById.get(balance.item_id) ?? 0;
    return acc + Number(balance.quantity) * cost;
  }, 0);

  const lowStockCount = stockRules.reduce((acc, rule) => {
    if (rule.min_quantity == null) return acc;
    const matchingBalance = balances.find(
      (balance) =>
        balance.item_id === rule.item_id &&
        (rule.location_id == null || balance.location_id === rule.location_id),
    );
    if (!matchingBalance) return acc + (rule.min_quantity > 0 ? 1 : 0);
    return Number(matchingBalance.quantity) < Number(rule.min_quantity) ? acc + 1 : acc;
  }, 0);

  return {
    overview: {
      activeItemsCount: items.filter((item) => item.is_active).length,
      totalInventoryValue,
      lowStockCount,
    },
    rows,
    filterOptions: {
      categories: categories.map((category) => ({ id: category.id, name: category.name })),
      suppliers: suppliers.map((supplier) => ({ id: supplier.id, name: supplier.name })),
    },
  };
}

export async function listPurchaseOptions(tenantId: string): Promise<KitchenInventoryPurchaseOption[]> {
  const supabase = await getSupabaseServerClient();
  const { data, error } = await supabase
    .from("kitchen_inventory_purchase_options")
    .select(
      "id, tenant_id, item_id, supplier_id, purchase_unit_id, inventory_unit_id, quantity_per_purchase_unit, min_purchase_quantity, purchase_multiple, is_default, is_active, notes, created_at, updated_at, kitchen_inventory_items:kitchen_inventory_items!kitchen_inventory_purchase_options_tenant_item_fkey(id,name), kitchen_inventory_suppliers:kitchen_inventory_suppliers!kitchen_inventory_purchase_options_tenant_supplier_fkey(id,name), purchase_unit:kitchen_inventory_units!kitchen_inventory_purchase_options_tenant_purchase_unit_fkey(id,code,name), inventory_unit:kitchen_inventory_units!kitchen_inventory_purchase_options_tenant_inventory_unit_fkey(id,code,name)",
    )
    .eq("tenant_id", tenantId)
    .order("created_at", { ascending: false });

  if (error) throw new Error(`No fue posible listar opciones de compra: ${error.message}`);
  return ((data ?? []) as Array<Record<string, unknown>>).map((row) => ({
    ...(row as unknown as KitchenInventoryPurchaseOption),
    kitchen_inventory_items: Array.isArray(row.kitchen_inventory_items)
      ? ((row.kitchen_inventory_items[0] ?? null) as KitchenInventoryPurchaseOption["kitchen_inventory_items"])
      : ((row.kitchen_inventory_items ?? null) as KitchenInventoryPurchaseOption["kitchen_inventory_items"]),
    kitchen_inventory_suppliers: Array.isArray(row.kitchen_inventory_suppliers)
      ? ((row.kitchen_inventory_suppliers[0] ?? null) as KitchenInventoryPurchaseOption["kitchen_inventory_suppliers"])
      : ((row.kitchen_inventory_suppliers ?? null) as KitchenInventoryPurchaseOption["kitchen_inventory_suppliers"]),
    purchase_unit: Array.isArray(row.purchase_unit)
      ? ((row.purchase_unit[0] ?? null) as KitchenInventoryPurchaseOption["purchase_unit"])
      : ((row.purchase_unit ?? null) as KitchenInventoryPurchaseOption["purchase_unit"]),
    inventory_unit: Array.isArray(row.inventory_unit)
      ? ((row.inventory_unit[0] ?? null) as KitchenInventoryPurchaseOption["inventory_unit"])
      : ((row.inventory_unit ?? null) as KitchenInventoryPurchaseOption["inventory_unit"]),
  }));
}

export async function listPurchaseOptionsForItem(
  tenantId: string,
  itemId: string,
): Promise<KitchenInventoryPurchaseOption[]> {
  const supabase = await getSupabaseServerClient();
  const { data, error } = await supabase
    .from("kitchen_inventory_purchase_options")
    .select(
      "id, tenant_id, item_id, supplier_id, purchase_unit_id, inventory_unit_id, quantity_per_purchase_unit, min_purchase_quantity, purchase_multiple, is_default, is_active, notes, created_at, updated_at, kitchen_inventory_items:kitchen_inventory_items!kitchen_inventory_purchase_options_tenant_item_fkey(id,name), kitchen_inventory_suppliers:kitchen_inventory_suppliers!kitchen_inventory_purchase_options_tenant_supplier_fkey(id,name), purchase_unit:kitchen_inventory_units!kitchen_inventory_purchase_options_tenant_purchase_unit_fkey(id,code,name), inventory_unit:kitchen_inventory_units!kitchen_inventory_purchase_options_tenant_inventory_unit_fkey(id,code,name)",
    )
    .eq("tenant_id", tenantId)
    .eq("item_id", itemId)
    .order("created_at", { ascending: false });

  if (error) throw new Error(`No fue posible listar opciones de compra por insumo: ${error.message}`);
  return ((data ?? []) as Array<Record<string, unknown>>).map((row) => ({
    ...(row as unknown as KitchenInventoryPurchaseOption),
    kitchen_inventory_items: Array.isArray(row.kitchen_inventory_items)
      ? ((row.kitchen_inventory_items[0] ?? null) as KitchenInventoryPurchaseOption["kitchen_inventory_items"])
      : ((row.kitchen_inventory_items ?? null) as KitchenInventoryPurchaseOption["kitchen_inventory_items"]),
    kitchen_inventory_suppliers: Array.isArray(row.kitchen_inventory_suppliers)
      ? ((row.kitchen_inventory_suppliers[0] ?? null) as KitchenInventoryPurchaseOption["kitchen_inventory_suppliers"])
      : ((row.kitchen_inventory_suppliers ?? null) as KitchenInventoryPurchaseOption["kitchen_inventory_suppliers"]),
    purchase_unit: Array.isArray(row.purchase_unit)
      ? ((row.purchase_unit[0] ?? null) as KitchenInventoryPurchaseOption["purchase_unit"])
      : ((row.purchase_unit ?? null) as KitchenInventoryPurchaseOption["purchase_unit"]),
    inventory_unit: Array.isArray(row.inventory_unit)
      ? ((row.inventory_unit[0] ?? null) as KitchenInventoryPurchaseOption["inventory_unit"])
      : ((row.inventory_unit ?? null) as KitchenInventoryPurchaseOption["inventory_unit"]),
  }));
}

export async function getDefaultPurchaseOptionForItem(
  tenantId: string,
  itemId: string,
): Promise<KitchenInventoryPurchaseOption | null> {
  const supabase = await getSupabaseServerClient();
  const { data, error } = await supabase
    .from("kitchen_inventory_purchase_options")
    .select(
      "id, tenant_id, item_id, supplier_id, purchase_unit_id, inventory_unit_id, quantity_per_purchase_unit, min_purchase_quantity, purchase_multiple, is_default, is_active, notes, created_at, updated_at",
    )
    .eq("tenant_id", tenantId)
    .eq("item_id", itemId)
    .eq("is_active", true)
    .eq("is_default", true)
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(`No fue posible cargar opción de compra por defecto: ${error.message}`);
  return (data as KitchenInventoryPurchaseOption | null) ?? null;
}

export async function listSupplierPrices(tenantId: string): Promise<KitchenInventorySupplierPrice[]> {
  const supabase = await getSupabaseServerClient();
  const { data, error } = await supabase
    .from("kitchen_inventory_supplier_prices")
    .select(
      "id, tenant_id, item_id, supplier_id, purchase_option_id, purchase_unit_id, price_per_purchase_unit, currency, source_type, source_ref, valid_from, valid_until, is_current, notes, created_at, updated_at, kitchen_inventory_items:kitchen_inventory_items!kitchen_inventory_supplier_prices_tenant_item_fkey(id,name), kitchen_inventory_suppliers:kitchen_inventory_suppliers!kitchen_inventory_supplier_prices_tenant_supplier_fkey(id,name), purchase_unit:kitchen_inventory_units!kitchen_inventory_supplier_prices_tenant_purchase_unit_fkey(id,code,name)",
    )
    .eq("tenant_id", tenantId)
    .order("updated_at", { ascending: false });
  if (error) throw new Error(`No fue posible listar precios de proveedor: ${error.message}`);
  return ((data ?? []) as Array<Record<string, unknown>>).map((row) => ({
    ...(row as unknown as KitchenInventorySupplierPrice),
    kitchen_inventory_items: Array.isArray(row.kitchen_inventory_items)
      ? ((row.kitchen_inventory_items[0] ?? null) as KitchenInventorySupplierPrice["kitchen_inventory_items"])
      : ((row.kitchen_inventory_items ?? null) as KitchenInventorySupplierPrice["kitchen_inventory_items"]),
    kitchen_inventory_suppliers: Array.isArray(row.kitchen_inventory_suppliers)
      ? ((row.kitchen_inventory_suppliers[0] ?? null) as KitchenInventorySupplierPrice["kitchen_inventory_suppliers"])
      : ((row.kitchen_inventory_suppliers ?? null) as KitchenInventorySupplierPrice["kitchen_inventory_suppliers"]),
    purchase_unit: Array.isArray(row.purchase_unit)
      ? ((row.purchase_unit[0] ?? null) as KitchenInventorySupplierPrice["purchase_unit"])
      : ((row.purchase_unit ?? null) as KitchenInventorySupplierPrice["purchase_unit"]),
  }));
}

export async function listSupplierPricesForItem(
  tenantId: string,
  itemId: string,
): Promise<KitchenInventorySupplierPrice[]> {
  const supabase = await getSupabaseServerClient();
  const { data, error } = await supabase
    .from("kitchen_inventory_supplier_prices")
    .select(
      "id, tenant_id, item_id, supplier_id, purchase_option_id, purchase_unit_id, price_per_purchase_unit, currency, source_type, source_ref, valid_from, valid_until, is_current, notes, created_at, updated_at, kitchen_inventory_items:kitchen_inventory_items!kitchen_inventory_supplier_prices_tenant_item_fkey(id,name), kitchen_inventory_suppliers:kitchen_inventory_suppliers!kitchen_inventory_supplier_prices_tenant_supplier_fkey(id,name), purchase_unit:kitchen_inventory_units!kitchen_inventory_supplier_prices_tenant_purchase_unit_fkey(id,code,name)",
    )
    .eq("tenant_id", tenantId)
    .eq("item_id", itemId)
    .order("updated_at", { ascending: false });
  if (error) throw new Error(`No fue posible listar precios de proveedor por insumo: ${error.message}`);
  return ((data ?? []) as Array<Record<string, unknown>>).map((row) => ({
    ...(row as unknown as KitchenInventorySupplierPrice),
    kitchen_inventory_items: Array.isArray(row.kitchen_inventory_items)
      ? ((row.kitchen_inventory_items[0] ?? null) as KitchenInventorySupplierPrice["kitchen_inventory_items"])
      : ((row.kitchen_inventory_items ?? null) as KitchenInventorySupplierPrice["kitchen_inventory_items"]),
    kitchen_inventory_suppliers: Array.isArray(row.kitchen_inventory_suppliers)
      ? ((row.kitchen_inventory_suppliers[0] ?? null) as KitchenInventorySupplierPrice["kitchen_inventory_suppliers"])
      : ((row.kitchen_inventory_suppliers ?? null) as KitchenInventorySupplierPrice["kitchen_inventory_suppliers"]),
    purchase_unit: Array.isArray(row.purchase_unit)
      ? ((row.purchase_unit[0] ?? null) as KitchenInventorySupplierPrice["purchase_unit"])
      : ((row.purchase_unit ?? null) as KitchenInventorySupplierPrice["purchase_unit"]),
  }));
}

export async function getCurrentSupplierPriceForPurchaseOption(
  tenantId: string,
  purchaseOptionId: string,
): Promise<KitchenInventorySupplierPrice | null> {
  const supabase = await getSupabaseServerClient();
  const { data, error } = await supabase
    .from("kitchen_inventory_supplier_prices")
    .select(
      "id, tenant_id, item_id, supplier_id, purchase_option_id, purchase_unit_id, price_per_purchase_unit, currency, source_type, source_ref, valid_from, valid_until, is_current, notes, created_at, updated_at",
    )
    .eq("tenant_id", tenantId)
    .eq("purchase_option_id", purchaseOptionId)
    .eq("is_current", true)
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(`No fue posible cargar precio actual por opción de compra: ${error.message}`);
  return (data as KitchenInventorySupplierPrice | null) ?? null;
}

export async function getLatestSupplierPriceForItemSupplier(
  tenantId: string,
  itemId: string,
  supplierId: string,
): Promise<KitchenInventorySupplierPrice | null> {
  const supabase = await getSupabaseServerClient();
  const { data, error } = await supabase
    .from("kitchen_inventory_supplier_prices")
    .select(
      "id, tenant_id, item_id, supplier_id, purchase_option_id, purchase_unit_id, price_per_purchase_unit, currency, source_type, source_ref, valid_from, valid_until, is_current, notes, created_at, updated_at",
    )
    .eq("tenant_id", tenantId)
    .eq("item_id", itemId)
    .eq("supplier_id", supplierId)
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(`No fue posible cargar precio de proveedor para insumo: ${error.message}`);
  return (data as KitchenInventorySupplierPrice | null) ?? null;
}
