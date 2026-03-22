import type {
  SalesPosComboSlot,
  SalesPosComboSlotOption,
  SalesPosModifierGroup,
  SalesPosModifierOption,
  SalesPosProduct,
  SalesPosProductModifierGroupAssignment,
  SalesPosSellableVariant,
} from "@/types/sales-pos-accounts";

export type PosCatalogV2ProductFormValues = {
  name: string;
  category_id: string | null;
  product_type: SalesPosProduct["product_type"];
  class: SalesPosProduct["class"];
  base_price_cents: number | null;
  requires_variant_selection: boolean;
  default_variant_id: string | null;
  is_active: boolean;
  is_sold_out: boolean;
  is_popular: boolean;
};

export type PosCatalogV2SellableVariantFormValues = {
  product_id: string;
  name: string;
  price_cents: number;
  is_default: boolean;
  is_active: boolean;
  sort_order: number;
  barcode: string | null;
  sku: string | null;
};

export type PosCatalogV2ModifierGroupFormValues = {
  name: string;
  selection_mode: SalesPosModifierGroup["selection_mode"];
  is_required: boolean;
  min_selected: number;
  max_selected: number;
  display_scope: SalesPosModifierGroup["display_scope"];
  is_active: boolean;
  sort_order: number;
};

export type PosCatalogV2ModifierOptionFormValues = {
  modifier_group_id: string;
  name: string;
  price_delta_cents: number;
  is_default: boolean;
  is_active: boolean;
  sort_order: number;
  reporting_key: string | null;
};

export type PosCatalogV2ProductModifierGroupAssignmentFormValues = {
  product_id: string;
  modifier_group_id: string;
  is_required_override: boolean | null;
  min_selected_override: number | null;
  max_selected_override: number | null;
  is_active: boolean;
  sort_order: number;
};

export type PosCatalogV2ComboSlotFormValues = {
  product_id: string;
  slot_key: string;
  name: string;
  selection_mode: SalesPosComboSlot["selection_mode"];
  min_selected: number;
  max_selected: number;
  is_active: boolean;
  sort_order: number;
};

export type PosCatalogV2ComboSlotOptionFormValues = {
  combo_slot_id: string;
  name: string;
  linked_product_id: string | null;
  linked_sellable_variant_id: string | null;
  price_delta_cents: number;
  is_default: boolean;
  is_active: boolean;
  sort_order: number;
  reporting_key: string | null;
};

export type PosCatalogV2ProductListItem = SalesPosProduct & {
  category_name: string | null;
  default_variant_name: string | null;
  variant_count: number;
  modifier_group_count: number;
  combo_slot_count: number;
};

export type PosCatalogV2SellableVariantListItem = SalesPosSellableVariant & {
  product_name: string | null;
};

export type PosCatalogV2ModifierGroupListItem = SalesPosModifierGroup & {
  option_count: number;
};

export type PosCatalogV2ModifierOptionListItem = SalesPosModifierOption & {
  modifier_group_name: string | null;
};

export type PosCatalogV2ProductModifierGroupAssignmentListItem =
  SalesPosProductModifierGroupAssignment & {
    product_name: string | null;
    modifier_group_name: string | null;
  };

export type PosCatalogV2ComboSlotListItem = SalesPosComboSlot & {
  product_name: string | null;
  option_count: number;
};

export type PosCatalogV2ComboSlotOptionListItem = SalesPosComboSlotOption & {
  combo_slot_name: string | null;
};
