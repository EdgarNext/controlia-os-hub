import { getSupabaseServerClient } from "@/lib/supabase/server";
import type { KitchenInventorySupplier } from "./types";

export type SupplierScope = "active" | "inactive" | "all";
export type SupplierFilters = { query?: string; status?: SupplierScope };
export type KitchenSupplierListRow = KitchenInventorySupplier & { itemCount: number; activePresentationCount: number; currentPriceCount: number; lastPriceUpdatedAt: string | null; review: boolean };
export type KitchenSupplierSummary = { active: number; withItems: number; withoutPresentations: number; inactive: number };
export type KitchenSupplierListData = { rows: KitchenSupplierListRow[]; total: number; page: number; pageCount: number; pageSize: number; summary: KitchenSupplierSummary };
export type KitchenSupplierDetail = KitchenSupplierListRow & { relationships: Array<{ id: string; itemId: string; itemName: string; purchaseUnitCode: string | null; inventoryUnitCode: string | null; quantity: number; price: number | null; currency: string | null; isDefault: boolean; isActive: boolean; priceUpdatedAt: string | null }> };

function single<T>(value: T | T[] | null | undefined): T | null { return Array.isArray(value) ? value[0] ?? null : value ?? null; }
function normalizeStatus(status: SupplierScope | undefined): SupplierScope { return status === "inactive" || status === "all" ? status : "active"; }

export async function getKitchenSupplierListData(tenantId: string, filters: SupplierFilters = {}, requestedPage = 1, pageSize = 25): Promise<KitchenSupplierListData> {
  const supabase = await getSupabaseServerClient(); let query = supabase.from("kitchen_inventory_suppliers").select("id,tenant_id,name,normalized_name,contact_name,phone,email,notes,is_active,created_at,updated_at", { count: "exact" }).eq("tenant_id", tenantId).order("name");
  const search = filters.query?.trim(); if (search) query = query.ilike("name", `%${search}%`);
  const scope = normalizeStatus(filters.status); if (scope === "active") query = query.eq("is_active", true); if (scope === "inactive") query = query.eq("is_active", false);
  const safeSize = Math.min(Math.max(pageSize, 1), 50); const requestedStart = (Math.max(requestedPage, 1) - 1) * safeSize; query = query.range(requestedStart, requestedStart + safeSize - 1);
  const [{ data: supplierRows, error: supplierError, count }, itemRefs, optionRefs, priceRefs, activeCount, inactiveCount] = await Promise.all([
    query,
    supabase.from("kitchen_inventory_items").select("default_supplier_id").eq("tenant_id", tenantId).eq("is_active", true).not("default_supplier_id", "is", null),
    supabase.from("kitchen_inventory_purchase_options").select("supplier_id,is_active").eq("tenant_id", tenantId).not("supplier_id", "is", null),
    supabase.from("kitchen_inventory_supplier_prices").select("supplier_id,is_current,updated_at").eq("tenant_id", tenantId).not("supplier_id", "is", null),
    supabase.from("kitchen_inventory_suppliers").select("id", { count: "exact" }).eq("tenant_id", tenantId).eq("is_active", true),
    supabase.from("kitchen_inventory_suppliers").select("id", { count: "exact", head: true }).eq("tenant_id", tenantId).eq("is_active", false),
  ]);
  if (supplierError || itemRefs.error || optionRefs.error || priceRefs.error || activeCount.error || inactiveCount.error) throw new Error(`No fue posible cargar proveedores: ${(supplierError ?? itemRefs.error ?? optionRefs.error ?? priceRefs.error ?? activeCount.error ?? inactiveCount.error)?.message}`);
  const itemCount = new Map<string, number>(); for (const row of itemRefs.data ?? []) if (row.default_supplier_id) itemCount.set(row.default_supplier_id, (itemCount.get(row.default_supplier_id) ?? 0) + 1);
  const activeOptionCount = new Map<string, number>(); for (const row of optionRefs.data ?? []) if (row.supplier_id && row.is_active) activeOptionCount.set(row.supplier_id, (activeOptionCount.get(row.supplier_id) ?? 0) + 1);
  const currentPriceCount = new Map<string, number>(); const latestPrice = new Map<string, string>(); for (const row of priceRefs.data ?? []) if (row.supplier_id && row.is_current) { currentPriceCount.set(row.supplier_id, (currentPriceCount.get(row.supplier_id) ?? 0) + 1); if (row.updated_at && (!latestPrice.get(row.supplier_id) || row.updated_at > latestPrice.get(row.supplier_id)!)) latestPrice.set(row.supplier_id, row.updated_at); }
  const rows = (supplierRows ?? []).map((supplier) => ({ ...supplier as KitchenInventorySupplier, itemCount: itemCount.get(supplier.id) ?? 0, activePresentationCount: activeOptionCount.get(supplier.id) ?? 0, currentPriceCount: currentPriceCount.get(supplier.id) ?? 0, lastPriceUpdatedAt: latestPrice.get(supplier.id) ?? null, review: (activeOptionCount.get(supplier.id) ?? 0) > 0 && (currentPriceCount.get(supplier.id) ?? 0) === 0 }));
  const total = count ?? 0; const pageCount = Math.max(1, Math.ceil(total / safeSize)); const page = Math.min(Math.max(requestedPage, 1), pageCount);
  const suppliersWithActiveOptions = new Set([...activeOptionCount.entries()].filter(([, value]) => value > 0).map(([id]) => id));
  return { rows, total, page, pageCount, pageSize: safeSize, summary: { active: activeCount.count ?? 0, inactive: inactiveCount.count ?? 0, withItems: [...itemCount.values()].filter((value) => value > 0).length, withoutPresentations: (activeCount.data ?? []).filter((supplier) => !suppliersWithActiveOptions.has(supplier.id)).length } };
}

export async function getKitchenSupplierDetail(tenantId: string, supplierId: string): Promise<KitchenSupplierDetail | null> {
  const supabase = await getSupabaseServerClient(); const supplier = await supabase.from("kitchen_inventory_suppliers").select("id,tenant_id,name,normalized_name,contact_name,phone,email,notes,is_active,created_at,updated_at").eq("tenant_id", tenantId).eq("id", supplierId).maybeSingle();
  if (supplier.error) throw new Error(`No fue posible cargar el proveedor: ${supplier.error.message}`); if (!supplier.data) return null;
  const [items, options, prices] = await Promise.all([
    supabase.from("kitchen_inventory_items").select("id,name,is_active").eq("tenant_id", tenantId).eq("default_supplier_id", supplierId),
    supabase.from("kitchen_inventory_purchase_options").select("id,item_id,purchase_unit_id,inventory_unit_id,quantity_per_purchase_unit,is_default,is_active,kitchen_inventory_items:kitchen_inventory_items!kitchen_inventory_purchase_options_tenant_item_fkey(id,name),purchase_unit:kitchen_inventory_units!kitchen_inventory_purchase_options_tenant_purchase_unit_fkey(id,code),inventory_unit:kitchen_inventory_units!kitchen_inventory_purchase_options_tenant_inventory_unit_fkey(id,code)").eq("tenant_id", tenantId).eq("supplier_id", supplierId).order("updated_at", { ascending: false }).range(0, 99),
    supabase.from("kitchen_inventory_supplier_prices").select("id,purchase_option_id,price_per_purchase_unit,currency,is_current,updated_at").eq("tenant_id", tenantId).eq("supplier_id", supplierId).order("updated_at", { ascending: false }).range(0, 199),
  ]);
  if (items.error || options.error || prices.error) throw new Error(`No fue posible cargar relaciones del proveedor: ${(items.error ?? options.error ?? prices.error)?.message}`);
  const priceByOption = new Map<string, typeof prices.data[number]>(); for (const price of prices.data ?? []) if (price.is_current && price.purchase_option_id && !priceByOption.has(price.purchase_option_id)) priceByOption.set(price.purchase_option_id, price);
  const relationships = (options.data ?? []).map((option) => { const item = single(option.kitchen_inventory_items); const purchaseUnit = single(option.purchase_unit); const inventoryUnit = single(option.inventory_unit); const price = priceByOption.get(option.id); return { id: option.id, itemId: option.item_id, itemName: item?.name ?? "Insumo", purchaseUnitCode: purchaseUnit?.code ?? null, inventoryUnitCode: inventoryUnit?.code ?? null, quantity: Number(option.quantity_per_purchase_unit), price: price ? Number(price.price_per_purchase_unit) : null, currency: price?.currency ?? null, isDefault: option.is_default, isActive: option.is_active, priceUpdatedAt: price?.updated_at ?? null }; });
  const itemCount = items.data?.length ?? 0; const activePresentationCount = relationships.filter((relationship) => relationship.isActive).length; const currentPriceCount = (prices.data ?? []).filter((price) => price.is_current).length; const latestPriceUpdatedAt = (prices.data ?? []).find((price) => price.is_current)?.updated_at ?? null;
  return { ...(supplier.data as KitchenInventorySupplier), itemCount, activePresentationCount, currentPriceCount, lastPriceUpdatedAt: latestPriceUpdatedAt, review: activePresentationCount > 0 && currentPriceCount === 0, relationships };
}
