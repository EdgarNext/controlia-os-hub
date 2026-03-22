import { getSupabaseServerClient } from "@/lib/supabase/server";
import type {
  PosCatalogV2ComboSlotListItem,
  PosCatalogV2ComboSlotOptionListItem,
  PosCatalogV2ModifierGroupListItem,
  PosCatalogV2ModifierOptionListItem,
  PosCatalogV2ProductListItem,
  PosCatalogV2ProductModifierGroupAssignmentListItem,
  PosCatalogV2SellableVariantListItem,
} from "@/types/pos-catalog-v2";
import type {
  SalesPosComboSlot,
  SalesPosComboSlotOption,
  SalesPosModifierGroup,
  SalesPosModifierOption,
  SalesPosProduct,
  SalesPosProductModifierGroupAssignment,
  SalesPosSellableVariant,
} from "@/types/sales-pos-accounts";
import type { PosCatalogCategorySelectItem } from "@/types/pos-catalog";

type ProductRow = SalesPosProduct;
type VariantRow = SalesPosSellableVariant;
type ModifierGroupRow = SalesPosModifierGroup;
type ModifierOptionRow = SalesPosModifierOption;
type AssignmentRow = SalesPosProductModifierGroupAssignment;
type ComboSlotRow = SalesPosComboSlot;
type ComboSlotOptionRow = SalesPosComboSlotOption;

async function listCategories(tenantId: string): Promise<PosCatalogCategorySelectItem[]> {
  const supabase = await getSupabaseServerClient();
  const { data, error } = await supabase
    .from("catalog_categories")
    .select("id, tenant_id, name")
    .eq("tenant_id", tenantId)
    .eq("is_active", true)
    .is("deleted_at", null)
    .order("sort_order", { ascending: true })
    .order("name", { ascending: true });

  if (error) {
    throw new Error(`Unable to load catalog categories: ${error.message}`);
  }

  return (data ?? []) as PosCatalogCategorySelectItem[];
}

async function listProductsBase(tenantId: string): Promise<ProductRow[]> {
  const supabase = await getSupabaseServerClient();
  const { data, error } = await supabase
    .from("products")
    .select(
      "id, tenant_id, category_id, product_type, class, name, base_price_cents, requires_variant_selection, default_variant_id, is_active, is_sold_out, is_popular, image_path, deleted_at, updated_at, created_at, created_by, updated_by",
    )
    .eq("tenant_id", tenantId)
    .order("deleted_at", { ascending: true, nullsFirst: true })
    .order("name", { ascending: true });

  if (error) {
    throw new Error(`Unable to load POS products: ${error.message}`);
  }

  return (data ?? []) as ProductRow[];
}

async function listVariantsBase(tenantId: string): Promise<VariantRow[]> {
  const supabase = await getSupabaseServerClient();
  const { data, error } = await supabase
    .from("sellable_variants")
    .select(
      "id, tenant_id, product_id, name, price_cents, is_default, is_active, sort_order, barcode, sku, deleted_at, updated_at, created_at, created_by, updated_by",
    )
    .eq("tenant_id", tenantId)
    .order("deleted_at", { ascending: true, nullsFirst: true })
    .order("sort_order", { ascending: true })
    .order("name", { ascending: true });

  if (error) {
    throw new Error(`Unable to load sellable variants: ${error.message}`);
  }

  return (data ?? []) as VariantRow[];
}

async function listModifierGroupsBase(tenantId: string): Promise<ModifierGroupRow[]> {
  const supabase = await getSupabaseServerClient();
  const { data, error } = await supabase
    .from("modifier_groups")
    .select(
      "id, tenant_id, name, selection_mode, is_required, min_selected, max_selected, display_scope, is_active, sort_order, deleted_at, updated_at, created_at, created_by, updated_by",
    )
    .eq("tenant_id", tenantId)
    .order("deleted_at", { ascending: true, nullsFirst: true })
    .order("sort_order", { ascending: true })
    .order("name", { ascending: true });

  if (error) {
    throw new Error(`Unable to load modifier groups: ${error.message}`);
  }

  return (data ?? []) as ModifierGroupRow[];
}

async function listModifierOptionsBase(tenantId: string): Promise<ModifierOptionRow[]> {
  const supabase = await getSupabaseServerClient();
  const { data, error } = await supabase
    .from("modifier_options")
    .select(
      "id, tenant_id, modifier_group_id, name, price_delta_cents, is_default, is_active, sort_order, reporting_key, deleted_at, updated_at, created_at, created_by, updated_by",
    )
    .eq("tenant_id", tenantId)
    .order("deleted_at", { ascending: true, nullsFirst: true })
    .order("sort_order", { ascending: true })
    .order("name", { ascending: true });

  if (error) {
    throw new Error(`Unable to load modifier options: ${error.message}`);
  }

  return (data ?? []) as ModifierOptionRow[];
}

async function listAssignmentsBase(tenantId: string): Promise<AssignmentRow[]> {
  const supabase = await getSupabaseServerClient();
  const { data, error } = await supabase
    .from("product_modifier_group_assignments")
    .select(
      "id, tenant_id, product_id, modifier_group_id, is_required_override, min_selected_override, max_selected_override, sort_order, is_active, deleted_at, updated_at, created_at, created_by, updated_by",
    )
    .eq("tenant_id", tenantId)
    .order("deleted_at", { ascending: true, nullsFirst: true })
    .order("sort_order", { ascending: true })
    .order("id", { ascending: true });

  if (error) {
    throw new Error(`Unable to load product modifier assignments: ${error.message}`);
  }

  return (data ?? []) as AssignmentRow[];
}

async function listComboSlotsBase(tenantId: string): Promise<ComboSlotRow[]> {
  const supabase = await getSupabaseServerClient();
  const { data, error } = await supabase
    .from("combo_slots")
    .select(
      "id, tenant_id, product_id, slot_key, name, selection_mode, min_selected, max_selected, sort_order, is_active, deleted_at, updated_at, created_at, created_by, updated_by",
    )
    .eq("tenant_id", tenantId)
    .order("deleted_at", { ascending: true, nullsFirst: true })
    .order("sort_order", { ascending: true })
    .order("name", { ascending: true });

  if (error) {
    throw new Error(`Unable to load combo slots: ${error.message}`);
  }

  return (data ?? []) as ComboSlotRow[];
}

async function listComboSlotOptionsBase(tenantId: string): Promise<ComboSlotOptionRow[]> {
  const supabase = await getSupabaseServerClient();
  const { data, error } = await supabase
    .from("combo_slot_options")
    .select(
      "id, tenant_id, combo_slot_id, name, linked_product_id, linked_sellable_variant_id, price_delta_cents, is_default, is_active, sort_order, reporting_key, deleted_at, updated_at, created_at, created_by, updated_by",
    )
    .eq("tenant_id", tenantId)
    .order("deleted_at", { ascending: true, nullsFirst: true })
    .order("sort_order", { ascending: true })
    .order("name", { ascending: true });

  if (error) {
    throw new Error(`Unable to load combo slot options: ${error.message}`);
  }

  return (data ?? []) as ComboSlotOptionRow[];
}

export async function listCatalogV2Products(tenantId: string): Promise<PosCatalogV2ProductListItem[]> {
  const [categories, products, variants, assignments, slots] = await Promise.all([
    listCategories(tenantId),
    listProductsBase(tenantId),
    listVariantsBase(tenantId),
    listAssignmentsBase(tenantId),
    listComboSlotsBase(tenantId),
  ]);

  const categoryNameById = new Map(categories.map((category) => [category.id, category.name]));
  const defaultVariantNameByProductId = new Map<string, string>();
  const variantCountByProductId = new Map<string, number>();
  for (const variant of variants) {
    if (variant.deleted_at != null) {
      continue;
    }
    variantCountByProductId.set(
      variant.product_id,
      (variantCountByProductId.get(variant.product_id) || 0) + 1,
    );
    if (variant.is_default && !defaultVariantNameByProductId.has(variant.product_id)) {
      defaultVariantNameByProductId.set(variant.product_id, variant.name);
    }
  }
  const assignmentCountByProductId = new Map<string, number>();
  for (const assignment of assignments) {
    if (assignment.deleted_at != null) {
      continue;
    }
    assignmentCountByProductId.set(
      assignment.product_id,
      (assignmentCountByProductId.get(assignment.product_id) || 0) + 1,
    );
  }
  const comboSlotCountByProductId = new Map<string, number>();
  for (const slot of slots) {
    if (slot.deleted_at != null) {
      continue;
    }
    comboSlotCountByProductId.set(
      slot.product_id,
      (comboSlotCountByProductId.get(slot.product_id) || 0) + 1,
    );
  }

  return products.map((product) => ({
    ...product,
    category_name: product.category_id ? categoryNameById.get(product.category_id) || null : null,
    default_variant_name:
        product.default_variant_id
        ? variants.find((variant) => variant.id === product.default_variant_id)?.name || null
        : defaultVariantNameByProductId.get(product.id) || null,
    variant_count: variantCountByProductId.get(product.id) || 0,
    modifier_group_count: assignmentCountByProductId.get(product.id) || 0,
    combo_slot_count: comboSlotCountByProductId.get(product.id) || 0,
  }));
}

export async function listCatalogV2Variants(
  tenantId: string,
): Promise<PosCatalogV2SellableVariantListItem[]> {
  const [variants, products] = await Promise.all([
    listVariantsBase(tenantId),
    listProductsBase(tenantId),
  ]);
  const productNameById = new Map(products.map((product) => [product.id, product.name]));
  return variants.map((variant) => ({
    ...variant,
    product_name: productNameById.get(variant.product_id) || null,
  }));
}

export async function listCatalogV2ModifierGroups(
  tenantId: string,
): Promise<PosCatalogV2ModifierGroupListItem[]> {
  const [groups, options] = await Promise.all([
    listModifierGroupsBase(tenantId),
    listModifierOptionsBase(tenantId),
  ]);
  const optionCountByGroupId = new Map<string, number>();
  for (const option of options) {
    if (option.deleted_at != null) {
      continue;
    }
    optionCountByGroupId.set(
      option.modifier_group_id,
      (optionCountByGroupId.get(option.modifier_group_id) || 0) + 1,
    );
  }

  return groups.map((group) => ({
    ...group,
    option_count: optionCountByGroupId.get(group.id) || 0,
  }));
}

export async function listCatalogV2ModifierOptions(
  tenantId: string,
): Promise<PosCatalogV2ModifierOptionListItem[]> {
  const [options, groups] = await Promise.all([
    listModifierOptionsBase(tenantId),
    listModifierGroupsBase(tenantId),
  ]);
  const groupNameById = new Map(groups.map((group) => [group.id, group.name]));
  return options.map((option) => ({
    ...option,
    modifier_group_name: groupNameById.get(option.modifier_group_id) || null,
  }));
}

export async function listCatalogV2Assignments(
  tenantId: string,
): Promise<PosCatalogV2ProductModifierGroupAssignmentListItem[]> {
  const [assignments, products, groups] = await Promise.all([
    listAssignmentsBase(tenantId),
    listProductsBase(tenantId),
    listModifierGroupsBase(tenantId),
  ]);
  const productNameById = new Map(products.map((product) => [product.id, product.name]));
  const groupNameById = new Map(groups.map((group) => [group.id, group.name]));
  return assignments.map((assignment) => ({
    ...assignment,
    product_name: productNameById.get(assignment.product_id) || null,
    modifier_group_name: groupNameById.get(assignment.modifier_group_id) || null,
  }));
}

export async function listCatalogV2ComboSlots(
  tenantId: string,
): Promise<PosCatalogV2ComboSlotListItem[]> {
  const [slots, products, options] = await Promise.all([
    listComboSlotsBase(tenantId),
    listProductsBase(tenantId),
    listComboSlotOptionsBase(tenantId),
  ]);
  const productNameById = new Map(products.map((product) => [product.id, product.name]));
  const optionCountBySlotId = new Map<string, number>();
  for (const option of options) {
    if (option.deleted_at != null) {
      continue;
    }
    optionCountBySlotId.set(
      option.combo_slot_id,
      (optionCountBySlotId.get(option.combo_slot_id) || 0) + 1,
    );
  }
  return slots.map((slot) => ({
    ...slot,
    product_name: productNameById.get(slot.product_id) || null,
    option_count: optionCountBySlotId.get(slot.id) || 0,
  }));
}

export async function listCatalogV2ComboSlotOptions(
  tenantId: string,
): Promise<PosCatalogV2ComboSlotOptionListItem[]> {
  const [options, slots] = await Promise.all([
    listComboSlotOptionsBase(tenantId),
    listComboSlotsBase(tenantId),
  ]);
  const slotNameById = new Map(slots.map((slot) => [slot.id, slot.name]));
  return options.map((option) => ({
    ...option,
    combo_slot_name: slotNameById.get(option.combo_slot_id) || null,
  }));
}

export type PosCatalogV2ProductSelectItem = Pick<
  PosCatalogV2ProductListItem,
  "id" | "name" | "product_type" | "category_id" | "is_active" | "deleted_at"
>;

export type PosCatalogV2VariantSelectItem = Pick<
  PosCatalogV2SellableVariantListItem,
  "id" | "product_id" | "name" | "is_default" | "is_active" | "deleted_at"
>;

export type PosCatalogV2ModifierGroupSelectItem = Pick<
  PosCatalogV2ModifierGroupListItem,
  "id" | "name" | "selection_mode" | "is_required" | "display_scope" | "is_active" | "deleted_at"
>;

export async function listCatalogV2ProductsForSelect(
  tenantId: string,
): Promise<PosCatalogV2ProductSelectItem[]> {
  const products = await listProductsBase(tenantId);
  return products
    .filter((product) => product.deleted_at == null)
    .map((product) => ({
      id: product.id,
      name: product.name,
      product_type: product.product_type,
      category_id: product.category_id,
      is_active: product.is_active,
      deleted_at: product.deleted_at,
    }));
}

export async function listCatalogV2VariantsForSelect(
  tenantId: string,
): Promise<PosCatalogV2VariantSelectItem[]> {
  const variants = await listVariantsBase(tenantId);
  return variants
    .filter((variant) => variant.deleted_at == null)
    .map((variant) => ({
      id: variant.id,
      product_id: variant.product_id,
      name: variant.name,
      is_default: variant.is_default,
      is_active: variant.is_active,
      deleted_at: variant.deleted_at,
    }));
}

export async function listCatalogV2ModifierGroupsForSelect(
  tenantId: string,
): Promise<PosCatalogV2ModifierGroupSelectItem[]> {
  const groups = await listModifierGroupsBase(tenantId);
  return groups
    .filter((group) => group.deleted_at == null)
    .map((group) => ({
      id: group.id,
      name: group.name,
      selection_mode: group.selection_mode,
      is_required: group.is_required,
      display_scope: group.display_scope,
      is_active: group.is_active,
      deleted_at: group.deleted_at,
    }));
}

export async function getCatalogV2ProductById(
  tenantId: string,
  id: string,
): Promise<PosCatalogV2ProductListItem | null> {
  const products = await listCatalogV2Products(tenantId);
  return products.find((product) => product.id === id) || null;
}

export async function getCatalogV2VariantById(
  tenantId: string,
  id: string,
): Promise<PosCatalogV2SellableVariantListItem | null> {
  const variants = await listCatalogV2Variants(tenantId);
  return variants.find((variant) => variant.id === id) || null;
}

export async function getCatalogV2ModifierGroupById(
  tenantId: string,
  id: string,
): Promise<PosCatalogV2ModifierGroupListItem | null> {
  const groups = await listCatalogV2ModifierGroups(tenantId);
  return groups.find((group) => group.id === id) || null;
}

export async function getCatalogV2ModifierOptionById(
  tenantId: string,
  id: string,
): Promise<PosCatalogV2ModifierOptionListItem | null> {
  const options = await listCatalogV2ModifierOptions(tenantId);
  return options.find((option) => option.id === id) || null;
}

export async function getCatalogV2AssignmentById(
  tenantId: string,
  id: string,
): Promise<PosCatalogV2ProductModifierGroupAssignmentListItem | null> {
  const assignments = await listCatalogV2Assignments(tenantId);
  return assignments.find((assignment) => assignment.id === id) || null;
}

export async function listCatalogV2CategoriesForSelect(
  tenantId: string,
): Promise<PosCatalogCategorySelectItem[]> {
  return listCategories(tenantId);
}
