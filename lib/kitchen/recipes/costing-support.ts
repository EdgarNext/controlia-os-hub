import { getSupabaseServerClient } from "@/lib/supabase/server";

export type KitchenRecipeItemCostSupport = {
  hasActivePurchaseOption: boolean;
  hasCurrentSupplierPrice: boolean;
  hasZeroSupplierPrice: boolean;
};

export async function loadKitchenRecipeItemCostSupport(
  tenantId: string,
  itemIds: string[],
): Promise<Map<string, KitchenRecipeItemCostSupport>> {
  const supportByItem = new Map<string, KitchenRecipeItemCostSupport>();
  const uniqueItemIds = Array.from(new Set(itemIds.filter(Boolean)));
  if (uniqueItemIds.length === 0) return supportByItem;

  const supabase = await getSupabaseServerClient();
  const { data: purchaseOptions, error: purchaseOptionsError } = await supabase
    .from("kitchen_inventory_purchase_options")
    .select("id,item_id,is_active")
    .eq("tenant_id", tenantId)
    .in("item_id", uniqueItemIds);
  if (purchaseOptionsError) {
    throw new Error(`No fue posible cargar purchase options para costeo: ${purchaseOptionsError.message}`);
  }

  const activePurchaseOptions = (purchaseOptions ?? []).filter((row) => row.is_active);
  const activePurchaseOptionIds = activePurchaseOptions.map((row) => row.id);

  const supplierPricesRes = activePurchaseOptionIds.length
    ? await supabase
        .from("kitchen_inventory_supplier_prices")
        .select("purchase_option_id,is_current,price_per_purchase_unit")
        .eq("tenant_id", tenantId)
        .in("purchase_option_id", activePurchaseOptionIds)
    : { data: [], error: null };
  if (supplierPricesRes.error) {
    throw new Error(`No fue posible cargar supplier prices para costeo: ${supplierPricesRes.error.message}`);
  }

  const currentPriceByPurchaseOption = new Map<
    string,
    { hasCurrentSupplierPrice: boolean; hasZeroSupplierPrice: boolean }
  >();
  for (const row of supplierPricesRes.data ?? []) {
    if (!row.is_current) continue;
    currentPriceByPurchaseOption.set(row.purchase_option_id, {
      hasCurrentSupplierPrice: true,
      hasZeroSupplierPrice: Number(row.price_per_purchase_unit ?? 0) === 0,
    });
  }

  for (const itemId of uniqueItemIds) {
    const itemPurchaseOptions = activePurchaseOptions.filter((row) => row.item_id === itemId);
    const support: KitchenRecipeItemCostSupport = {
      hasActivePurchaseOption: itemPurchaseOptions.length > 0,
      hasCurrentSupplierPrice: false,
      hasZeroSupplierPrice: false,
    };

    for (const purchaseOption of itemPurchaseOptions) {
      const currentPrice = currentPriceByPurchaseOption.get(purchaseOption.id);
      if (!currentPrice) continue;
      support.hasCurrentSupplierPrice = true;
      if (currentPrice.hasZeroSupplierPrice) support.hasZeroSupplierPrice = true;
    }

    supportByItem.set(itemId, support);
  }

  return supportByItem;
}
