export type KitchenInventoryCategory = {
  id: string;
  tenant_id: string;
  name: string;
  normalized_name: string;
  description: string | null;
  is_active: boolean;
};

export type KitchenInventoryUnit = {
  id: string;
  tenant_id: string;
  code: string;
  name: string;
  normalized_name: string;
  unit_type: "mass" | "volume" | "unit" | "package" | "other";
  is_base_unit: boolean;
  is_active: boolean;
};

export type KitchenInventorySupplier = {
  id: string;
  tenant_id: string;
  name: string;
  normalized_name: string;
  is_active: boolean;
};

export type KitchenInventoryLocation = {
  id: string;
  tenant_id: string;
  name: string;
  normalized_name: string;
  is_active: boolean;
};

export type KitchenInventoryItem = {
  id: string;
  tenant_id: string;
  category_id: string | null;
  default_unit_id: string;
  default_supplier_id: string | null;
  name: string;
  normalized_name: string;
  sku: string | null;
  description: string | null;
  current_unit_cost: number;
  standard_unit_cost: number | null;
  is_perishable: boolean;
  is_active: boolean;
  created_at: string;
  kitchen_inventory_categories?: Pick<KitchenInventoryCategory, "id" | "name"> | null;
  kitchen_inventory_units?: Pick<KitchenInventoryUnit, "id" | "code" | "name"> | null;
  kitchen_inventory_suppliers?: Pick<KitchenInventorySupplier, "id" | "name"> | null;
};

export type KitchenInventoryMovement = {
  id: string;
  tenant_id: string;
  item_id: string;
  location_id: string;
  unit_id: string;
  movement_type:
    | "opening_balance"
    | "purchase"
    | "manual_in"
    | "manual_out"
    | "adjustment_in"
    | "adjustment_out"
    | "waste"
    | "transfer_in"
    | "transfer_out";
  quantity: number;
  quantity_delta: number;
  unit_cost: number | null;
  total_cost: number | null;
  reason: string | null;
  source_type: "manual" | "import" | "event" | "transfer" | "correction";
  occurred_at: string;
  created_at: string;
  kitchen_inventory_items?: Pick<KitchenInventoryItem, "id" | "name"> | null;
  kitchen_inventory_locations?: Pick<KitchenInventoryLocation, "id" | "name"> | null;
  kitchen_inventory_units?: Pick<KitchenInventoryUnit, "id" | "code" | "name"> | null;
};

export type KitchenInventoryBalance = {
  tenant_id: string;
  item_id: string;
  location_id: string;
  quantity: number;
  updated_at: string;
};

export type KitchenInventoryPurchaseOption = {
  id: string;
  tenant_id: string;
  item_id: string;
  supplier_id: string | null;
  purchase_unit_id: string;
  inventory_unit_id: string;
  quantity_per_purchase_unit: number;
  min_purchase_quantity: number;
  purchase_multiple: number;
  is_default: boolean;
  is_active: boolean;
  notes: string | null;
  created_at: string;
  updated_at: string;
  kitchen_inventory_items?: Pick<KitchenInventoryItem, "id" | "name"> | null;
  kitchen_inventory_suppliers?: Pick<KitchenInventorySupplier, "id" | "name"> | null;
  purchase_unit?: Pick<KitchenInventoryUnit, "id" | "code" | "name"> | null;
  inventory_unit?: Pick<KitchenInventoryUnit, "id" | "code" | "name"> | null;
};

export type KitchenInventorySupplierPrice = {
  id: string;
  tenant_id: string;
  item_id: string;
  supplier_id: string;
  purchase_option_id: string | null;
  purchase_unit_id: string;
  price_per_purchase_unit: number;
  currency: string;
  source_type: "manual" | "supplier_list" | "quote" | "invoice" | "import";
  source_ref: string | null;
  valid_from: string | null;
  valid_until: string | null;
  is_current: boolean;
  notes: string | null;
  created_at: string;
  updated_at: string;
  kitchen_inventory_items?: Pick<KitchenInventoryItem, "id" | "name"> | null;
  kitchen_inventory_suppliers?: Pick<KitchenInventorySupplier, "id" | "name"> | null;
  purchase_unit?: Pick<KitchenInventoryUnit, "id" | "code" | "name"> | null;
};

export type KitchenInventoryItemOperationalState =
  | "completo"
  | "sin_opcion_compra"
  | "sin_precio_proveedor"
  | "sin_proveedor"
  | "costo_0"
  | "unidad_dudosa"
  | "test_sandbox";

export type KitchenInventoryItemOperationalRow = {
  item: KitchenInventoryItem;
  totalBalance: number;
  locationCount: number;
  locationNames: string[];
  estimatedValue: number;
  currentUnitCost: number;
  isAllowedZeroCost: boolean;
  hasDefaultPurchaseOption: boolean;
  defaultPurchaseOption: KitchenInventoryPurchaseOption | null;
  hasCurrentSupplierPrice: boolean;
  currentSupplierPrice: KitchenInventorySupplierPrice | null;
  stateTags: KitchenInventoryItemOperationalState[];
};
