import { getSupabaseServerClient } from "@/lib/supabase/server";
import type {
  KitchenInventoryItem,
  KitchenInventoryPurchaseOption,
  KitchenInventorySupplier,
  KitchenInventorySupplierPrice,
} from "./types";
import {
  listKitchenInventoryItems,
  listKitchenInventorySuppliers,
  listPurchaseOptions,
  listSupplierPrices,
} from "./queries";

type UpcomingImpactLine = {
  eventId: string;
  eventName: string | null;
  eventStatus: string | null;
  startsAt: string;
  requiredQuantity: number;
  snapshotUnitCost: number;
};

export type KitchenInventoryPriceUpdateOption = {
  id: string;
  itemId: string;
  supplierId: string | null;
  purchaseUnitId: string;
  purchaseUnitCode: string | null;
  inventoryUnitId: string;
  inventoryUnitCode: string | null;
  quantityPerPurchaseUnit: number;
  isDefault: boolean;
  currentPrice: {
    id: string;
    pricePerPurchaseUnit: number;
    sourceRef: string | null;
    validFrom: string | null;
  } | null;
  derivedUnitCost: number | null;
};

export type KitchenInventoryPriceUpdateItem = {
  id: string;
  name: string;
  defaultUnitId: string;
  defaultUnitCode: string | null;
  currentUnitCost: number;
  defaultSupplierId: string | null;
  options: KitchenInventoryPriceUpdateOption[];
  upcomingImpactLines: UpcomingImpactLine[];
};

export type KitchenInventoryPriceUpdateRecentBatch = {
  id: string;
  supplierName: string | null;
  invoiceRef: string;
  invoiceDate: string;
  status: string;
  lineCount: number;
  appliedAt: string | null;
  createdAt: string;
};

export type KitchenInventoryPriceUpdateViewData = {
  suppliers: KitchenInventorySupplier[];
  items: KitchenInventoryPriceUpdateItem[];
  suggestedItemIds: string[];
  upcomingEventsWithoutInitialSnapshot: Array<{
    id: string;
    name: string | null;
    status: string | null;
    startsAt: string;
  }>;
  recentBatches: KitchenInventoryPriceUpdateRecentBatch[];
};

function isCancelledEventStatus(status: string | null | undefined): boolean {
  const normalized = String(status ?? "").trim().toLocaleLowerCase("es-MX");
  return normalized === "cancelled" || normalized === "canceled" || normalized === "cancelado" || normalized === "cancelada";
}

function toSingle<T>(value: T | T[] | null | undefined): T | null {
  return Array.isArray(value) ? (value[0] ?? null) : (value ?? null);
}

function buildOptionsByItem(
  purchaseOptions: KitchenInventoryPurchaseOption[],
  currentPrices: KitchenInventorySupplierPrice[],
): Map<string, KitchenInventoryPriceUpdateOption[]> {
  const currentPriceByOptionId = new Map<string, KitchenInventorySupplierPrice>();
  for (const price of currentPrices) {
    if (!price.is_current || !price.purchase_option_id) continue;
    if (!currentPriceByOptionId.has(price.purchase_option_id)) {
      currentPriceByOptionId.set(price.purchase_option_id, price);
    }
  }

  const optionsByItem = new Map<string, KitchenInventoryPriceUpdateOption[]>();
  for (const option of purchaseOptions.filter((row) => row.is_active)) {
    const currentPrice = currentPriceByOptionId.get(option.id) ?? null;
    const nextOption: KitchenInventoryPriceUpdateOption = {
      id: option.id,
      itemId: option.item_id,
      supplierId: option.supplier_id,
      purchaseUnitId: option.purchase_unit_id,
      purchaseUnitCode: option.purchase_unit?.code ?? null,
      inventoryUnitId: option.inventory_unit_id,
      inventoryUnitCode: option.inventory_unit?.code ?? null,
      quantityPerPurchaseUnit: Number(option.quantity_per_purchase_unit ?? 0),
      isDefault: option.is_default,
      currentPrice: currentPrice
        ? {
            id: currentPrice.id,
            pricePerPurchaseUnit: Number(currentPrice.price_per_purchase_unit ?? 0),
            sourceRef: currentPrice.source_ref ?? null,
            validFrom: currentPrice.valid_from ?? null,
          }
        : null,
      derivedUnitCost:
        currentPrice && Number(option.quantity_per_purchase_unit ?? 0) > 0
          ? Number(currentPrice.price_per_purchase_unit ?? 0) / Number(option.quantity_per_purchase_unit ?? 0)
          : null,
    };
    const list = optionsByItem.get(option.item_id) ?? [];
    list.push(nextOption);
    optionsByItem.set(option.item_id, list);
  }

  for (const [, list] of optionsByItem) {
    list.sort((left, right) => {
      if (left.isDefault !== right.isDefault) return left.isDefault ? -1 : 1;
      if ((left.supplierId ?? "") !== (right.supplierId ?? "")) {
        return (left.supplierId ?? "").localeCompare(right.supplierId ?? "");
      }
      return (left.purchaseUnitCode ?? "").localeCompare(right.purchaseUnitCode ?? "");
    });
  }

  return optionsByItem;
}

async function loadUpcomingImpactLines(tenantId: string): Promise<{
  impactByItemId: Map<string, UpcomingImpactLine[]>;
  suggestedItemIds: string[];
  upcomingEventsWithoutInitialSnapshot: KitchenInventoryPriceUpdateViewData["upcomingEventsWithoutInitialSnapshot"];
}> {
  const supabase = await getSupabaseServerClient();
  const now = new Date();
  const end = new Date(now);
  end.setDate(end.getDate() + 30);

  const { data: eventRows, error: eventError } = await supabase
    .from("events")
    .select("id,name,status,starts_at")
    .eq("tenant_id", tenantId)
    .gte("starts_at", now.toISOString())
    .lt("starts_at", end.toISOString())
    .order("starts_at", { ascending: true });
  if (eventError) throw new Error(`No fue posible cargar próximos eventos: ${eventError.message}`);

  const upcomingEvents = (eventRows ?? [])
    .map((row) => ({
      id: String(row.id),
      name: (row as { name?: string | null }).name ?? null,
      status: (row as { status?: string | null }).status ?? null,
      startsAt: String((row as { starts_at: string }).starts_at),
    }))
    .filter((row) => !isCancelledEventStatus(row.status));

  if (upcomingEvents.length === 0) {
    return {
      impactByItemId: new Map(),
      suggestedItemIds: [],
      upcomingEventsWithoutInitialSnapshot: [],
    };
  }

  const eventIds = upcomingEvents.map((row) => row.id);
  const eventById = new Map(upcomingEvents.map((row) => [row.id, row]));

  const { data: snapshotRows, error: snapshotError } = await supabase
    .from("event_catering_costing_snapshots")
    .select("id,event_id,created_at")
    .eq("tenant_id", tenantId)
    .eq("snapshot_kind", "initial")
    .eq("snapshot_status", "completed")
    .in("event_id", eventIds)
    .order("created_at", { ascending: false });
  if (snapshotError) throw new Error(`No fue posible cargar snapshots de costeo inicial: ${snapshotError.message}`);

  const latestSnapshotByEventId = new Map<string, { id: string; eventId: string }>();
  for (const row of snapshotRows ?? []) {
    const eventId = String(row.event_id);
    if (!latestSnapshotByEventId.has(eventId)) {
      latestSnapshotByEventId.set(eventId, { id: String(row.id), eventId });
    }
  }

  const snapshotIds = Array.from(latestSnapshotByEventId.values()).map((row) => row.id);
  const upcomingEventsWithoutInitialSnapshot = upcomingEvents.filter((row) => !latestSnapshotByEventId.has(row.id));

  if (snapshotIds.length === 0) {
    return {
      impactByItemId: new Map(),
      suggestedItemIds: [],
      upcomingEventsWithoutInitialSnapshot,
    };
  }

  const { data: lineRows, error: lineError } = await supabase
    .from("event_catering_costing_item_lines")
    .select("snapshot_id,event_id,item_id,required_quantity,operational_unit_cost")
    .eq("tenant_id", tenantId)
    .in("snapshot_id", snapshotIds);
  if (lineError) throw new Error(`No fue posible cargar líneas congeladas de costeo: ${lineError.message}`);

  const impactByItemId = new Map<string, UpcomingImpactLine[]>();
  for (const row of lineRows ?? []) {
    const itemId = String(row.item_id);
    const event = eventById.get(String(row.event_id));
    if (!event) continue;
    const list = impactByItemId.get(itemId) ?? [];
    list.push({
      eventId: event.id,
      eventName: event.name,
      eventStatus: event.status,
      startsAt: event.startsAt,
      requiredQuantity: Number(row.required_quantity ?? 0),
      snapshotUnitCost: Number(row.operational_unit_cost ?? 0),
    });
    impactByItemId.set(itemId, list);
  }

  const suggestedItemIds = Array.from(impactByItemId.entries())
    .sort((left, right) => {
      const leftEventCount = new Set(left[1].map((line) => line.eventId)).size;
      const rightEventCount = new Set(right[1].map((line) => line.eventId)).size;
      if (leftEventCount !== rightEventCount) return rightEventCount - leftEventCount;
      const leftQty = left[1].reduce((sum, line) => sum + line.requiredQuantity, 0);
      const rightQty = right[1].reduce((sum, line) => sum + line.requiredQuantity, 0);
      return rightQty - leftQty;
    })
    .map(([itemId]) => itemId);

  return {
    impactByItemId,
    suggestedItemIds,
    upcomingEventsWithoutInitialSnapshot,
  };
}

async function loadRecentBatches(tenantId: string): Promise<KitchenInventoryPriceUpdateRecentBatch[]> {
  const supabase = await getSupabaseServerClient();
  const { data, error } = await supabase
    .from("kitchen_inventory_price_update_batches")
    .select(
      "id,invoice_ref,invoice_date,status,line_count,applied_at,created_at,kitchen_inventory_suppliers:kitchen_inventory_suppliers!kitchen_inventory_price_update_batches_tenant_supplier_fkey(name)",
    )
    .eq("tenant_id", tenantId)
    .order("created_at", { ascending: false })
    .limit(10);

  if (error) {
    if (error.code === "42P01") return [];
    throw new Error(`No fue posible cargar facturas recientes de precios: ${error.message}`);
  }

  return ((data ?? []) as Array<Record<string, unknown>>).map((row) => ({
    id: String(row.id),
    supplierName: toSingle(row.kitchen_inventory_suppliers as { name?: string | null } | Array<{ name?: string | null }> | null)?.name ?? null,
    invoiceRef: String(row.invoice_ref),
    invoiceDate: String(row.invoice_date),
    status: String(row.status),
    lineCount: Number(row.line_count ?? 0),
    appliedAt: (row.applied_at as string | null) ?? null,
    createdAt: String(row.created_at),
  }));
}

export async function getKitchenInventoryPriceUpdateViewData(
  tenantId: string,
): Promise<KitchenInventoryPriceUpdateViewData> {
  const [items, suppliers, purchaseOptions, supplierPrices, upcomingImpact, recentBatches] = await Promise.all([
    listKitchenInventoryItems(tenantId),
    listKitchenInventorySuppliers(tenantId),
    listPurchaseOptions(tenantId),
    listSupplierPrices(tenantId),
    loadUpcomingImpactLines(tenantId),
    loadRecentBatches(tenantId),
  ]);

  const optionsByItem = buildOptionsByItem(purchaseOptions, supplierPrices.filter((row) => row.is_current));
  const nextItems: KitchenInventoryPriceUpdateItem[] = items
    .filter((item) => item.is_active)
    .map((item: KitchenInventoryItem) => ({
      id: item.id,
      name: item.name,
      defaultUnitId: item.default_unit_id,
      defaultUnitCode: item.kitchen_inventory_units?.code ?? null,
      currentUnitCost: Number(item.current_unit_cost ?? 0),
      defaultSupplierId: item.default_supplier_id ?? null,
      options: optionsByItem.get(item.id) ?? [],
      upcomingImpactLines: upcomingImpact.impactByItemId.get(item.id) ?? [],
    }))
    .sort((left, right) => left.name.localeCompare(right.name, "es-MX"));

  return {
    suppliers,
    items: nextItems,
    suggestedItemIds: upcomingImpact.suggestedItemIds,
    upcomingEventsWithoutInitialSnapshot: upcomingImpact.upcomingEventsWithoutInitialSnapshot,
    recentBatches,
  };
}
