import { getSupabaseServerClient } from "@/lib/supabase/server";
import type {
  PosCatalogV2ComboSlotListItem,
  PosCatalogV2ComboSlotOptionListItem,
  PosCatalogV2ComboSlotFormValues,
  PosCatalogV2ComboSlotOptionFormValues,
  PosCatalogV2ModifierGroupListItem,
  PosCatalogV2ModifierOptionListItem,
  PosCatalogV2ProductListItem,
  PosCatalogV2ProductModifierGroupAssignmentListItem,
  PosCatalogV2SellableVariantListItem,
} from "@/types/pos-catalog-v2";
import type {
  PosCatalogV2ModifierGroupFormValues,
  PosCatalogV2ModifierOptionFormValues,
  PosCatalogV2ProductFormValues,
  PosCatalogV2ProductModifierGroupAssignmentFormValues,
  PosCatalogV2SellableVariantFormValues,
} from "@/types/pos-catalog-v2";
import type { SalesPosCatalogProductType } from "@/types/sales-pos-accounts";

type TenantScopedInput = {
  tenantId: string;
  actorUserId: string;
};

function nowIso(): string {
  return new Date().toISOString();
}

function toNullableString(value: string | null | undefined): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

async function assertCategoryBelongsToTenant(tenantId: string, categoryId: string): Promise<void> {
  const supabase = await getSupabaseServerClient();
  const { data, error } = await supabase
    .from("catalog_categories")
    .select("id")
    .eq("tenant_id", tenantId)
    .eq("id", categoryId)
    .is("deleted_at", null)
    .maybeSingle();

  if (error) {
    throw new Error(`Unable to validate category: ${error.message}`);
  }

  if (!data) {
    throw new Error("La categoría no pertenece al tenant activo.");
  }
}

async function assertProductBelongsToTenant(tenantId: string, productId: string): Promise<void> {
  const supabase = await getSupabaseServerClient();
  const { data, error } = await supabase
    .from("products")
    .select("id")
    .eq("tenant_id", tenantId)
    .eq("id", productId)
    .is("deleted_at", null)
    .maybeSingle();

  if (error) {
    throw new Error(`Unable to validate product: ${error.message}`);
  }

  if (!data) {
    throw new Error("El producto no pertenece al tenant activo.");
  }
}

async function loadProductById(
  tenantId: string,
  productId: string,
): Promise<{ id: string; product_type: SalesPosCatalogProductType } | null> {
  const supabase = await getSupabaseServerClient();
  const { data, error } = await supabase
    .from("products")
    .select("id, product_type")
    .eq("tenant_id", tenantId)
    .eq("id", productId)
    .is("deleted_at", null)
    .maybeSingle<{ id: string; product_type: SalesPosCatalogProductType }>();

  if (error) {
    throw new Error(`Unable to validate product: ${error.message}`);
  }

  return data ?? null;
}

async function assertVariantBelongsToTenant(
  tenantId: string,
  variantId: string,
): Promise<{ id: string; product_id: string } | null> {
  const supabase = await getSupabaseServerClient();
  const { data, error } = await supabase
    .from("sellable_variants")
    .select("id, product_id")
    .eq("tenant_id", tenantId)
    .eq("id", variantId)
    .is("deleted_at", null)
    .maybeSingle<{ id: string; product_id: string }>();

  if (error) {
    throw new Error(`Unable to validate variant: ${error.message}`);
  }

  return data ?? null;
}

async function assertModifierGroupBelongsToTenant(
  tenantId: string,
  groupId: string,
): Promise<void> {
  const supabase = await getSupabaseServerClient();
  const { data, error } = await supabase
    .from("modifier_groups")
    .select("id")
    .eq("tenant_id", tenantId)
    .eq("id", groupId)
    .is("deleted_at", null)
    .maybeSingle();

  if (error) {
    throw new Error(`Unable to validate modifier group: ${error.message}`);
  }

  if (!data) {
    throw new Error("El grupo de modifiers no pertenece al tenant activo.");
  }
}

async function syncProductDefaultVariant(
  tenantId: string,
  productId: string,
  variantId: string | null,
  actorUserId: string,
): Promise<void> {
  const supabase = await getSupabaseServerClient();
  const now = nowIso();

  const { error } = await supabase
    .from("products")
    .update({
      default_variant_id: variantId,
      updated_by: actorUserId,
      updated_at: now,
    })
    .eq("tenant_id", tenantId)
    .eq("id", productId);

  if (error) {
    throw new Error(`Unable to update product default variant: ${error.message}`);
  }
}

async function clearOtherDefaultVariants(
  tenantId: string,
  productId: string,
  keepVariantId: string,
  actorUserId: string,
): Promise<void> {
  const supabase = await getSupabaseServerClient();
  const now = nowIso();

  const { error } = await supabase
    .from("sellable_variants")
    .update({
      is_default: false,
      updated_by: actorUserId,
      updated_at: now,
    })
    .eq("tenant_id", tenantId)
    .eq("product_id", productId)
    .neq("id", keepVariantId);

  if (error) {
    throw new Error(`Unable to normalize default variants: ${error.message}`);
  }
}

async function clearOtherDefaultModifierOptions(
  tenantId: string,
  modifierGroupId: string,
  keepOptionId: string,
  actorUserId: string,
): Promise<void> {
  const supabase = await getSupabaseServerClient();
  const now = nowIso();

  const { error } = await supabase
    .from("modifier_options")
    .update({
      is_default: false,
      updated_by: actorUserId,
      updated_at: now,
    })
    .eq("tenant_id", tenantId)
    .eq("modifier_group_id", modifierGroupId)
    .neq("id", keepOptionId);

  if (error) {
    throw new Error(`Unable to normalize default modifier options: ${error.message}`);
  }
}

async function loadVariantById(
  tenantId: string,
  variantId: string,
): Promise<{ id: string; product_id: string } | null> {
  return assertVariantBelongsToTenant(tenantId, variantId);
}

async function loadComboSlotById(
  tenantId: string,
  slotId: string,
): Promise<{ id: string; product_id: string; slot_key: string } | null> {
  const supabase = await getSupabaseServerClient();
  const { data, error } = await supabase
    .from("combo_slots")
    .select("id, product_id, slot_key")
    .eq("tenant_id", tenantId)
    .eq("id", slotId)
    .is("deleted_at", null)
    .maybeSingle<{ id: string; product_id: string; slot_key: string }>();

  if (error) {
    throw new Error(`Unable to validate combo slot: ${error.message}`);
  }

  return data ?? null;
}

async function clearOtherDefaultComboSlotOptions(
  tenantId: string,
  comboSlotId: string,
  keepOptionId: string,
  actorUserId: string,
): Promise<void> {
  const supabase = await getSupabaseServerClient();
  const now = nowIso();

  const { error } = await supabase
    .from("combo_slot_options")
    .update({
      is_default: false,
      updated_by: actorUserId,
      updated_at: now,
    })
    .eq("tenant_id", tenantId)
    .eq("combo_slot_id", comboSlotId)
    .neq("id", keepOptionId);

  if (error) {
    throw new Error(`Unable to normalize default combo slot options: ${error.message}`);
  }
}

export async function saveCatalogV2Product(input: {
  tenantId: string;
  actorUserId: string;
  id?: string | null;
  form: PosCatalogV2ProductFormValues;
}): Promise<PosCatalogV2ProductListItem> {
  const supabase = await getSupabaseServerClient();
  const now = nowIso();

  if (input.form.category_id) {
    await assertCategoryBelongsToTenant(input.tenantId, input.form.category_id);
  }

  if (input.form.default_variant_id) {
    if (!input.id) {
      throw new Error("La variante por defecto solo puede asignarse en un producto existente.");
    }

    const defaultVariant = await loadVariantById(input.tenantId, input.form.default_variant_id);
    if (!defaultVariant || defaultVariant.product_id !== input.id) {
      throw new Error("La variante por defecto debe pertenecer al mismo producto.");
    }
  }

  const payload = {
    tenant_id: input.tenantId,
    name: input.form.name,
    category_id: input.form.category_id,
    product_type: input.form.product_type,
    class: input.form.class,
    base_price_cents: input.form.base_price_cents,
    requires_variant_selection: input.form.requires_variant_selection,
    default_variant_id: input.form.default_variant_id,
    is_active: input.form.is_active,
    is_sold_out: input.form.is_sold_out,
    is_popular: input.form.is_popular,
    updated_by: input.actorUserId,
    updated_at: now,
  };

  const { data, error } = input.id
    ? await supabase
        .from("products")
        .update(payload)
        .eq("tenant_id", input.tenantId)
        .eq("id", input.id)
        .select(
          "id, tenant_id, category_id, product_type, class, name, base_price_cents, requires_variant_selection, default_variant_id, is_active, is_sold_out, is_popular, image_path, deleted_at, updated_at, created_at, created_by, updated_by",
        )
        .maybeSingle<PosCatalogV2ProductListItem>()
    : await supabase
        .from("products")
        .insert({
          ...payload,
          created_by: input.actorUserId,
        })
        .select(
          "id, tenant_id, category_id, product_type, class, name, base_price_cents, requires_variant_selection, default_variant_id, is_active, is_sold_out, is_popular, image_path, deleted_at, updated_at, created_at, created_by, updated_by",
        )
        .single<PosCatalogV2ProductListItem>();

  if (error) {
    throw new Error(`Unable to save POS product: ${error.message}`);
  }

  if (!data) {
    throw new Error("El producto no pudo resolverse.");
  }

  return data;
}

export async function archiveCatalogV2Product(input: TenantScopedInput & { id: string }): Promise<void> {
  const supabase = await getSupabaseServerClient();
  const now = nowIso();

  const { error } = await supabase
    .from("products")
    .update({
      deleted_at: now,
      is_active: false,
      updated_by: input.actorUserId,
      updated_at: now,
    })
    .eq("tenant_id", input.tenantId)
    .eq("id", input.id);

  if (error) {
    throw new Error(`Unable to archive POS product: ${error.message}`);
  }
}

export async function saveCatalogV2Variant(input: {
  tenantId: string;
  actorUserId: string;
  id?: string | null;
  form: PosCatalogV2SellableVariantFormValues;
}): Promise<PosCatalogV2SellableVariantListItem> {
  const supabase = await getSupabaseServerClient();
  const now = nowIso();

  await assertProductBelongsToTenant(input.tenantId, input.form.product_id);

  const payload = {
    tenant_id: input.tenantId,
    product_id: input.form.product_id,
    name: input.form.name,
    price_cents: input.form.price_cents,
    is_default: input.form.is_default,
    is_active: input.form.is_active,
    sort_order: input.form.sort_order,
    barcode: toNullableString(input.form.barcode),
    sku: toNullableString(input.form.sku),
    updated_by: input.actorUserId,
    updated_at: now,
  };

  const { data, error } = input.id
    ? await supabase
        .from("sellable_variants")
        .update(payload)
        .eq("tenant_id", input.tenantId)
        .eq("id", input.id)
        .select(
          "id, tenant_id, product_id, name, price_cents, is_default, is_active, sort_order, barcode, sku, deleted_at, updated_at, created_at, created_by, updated_by",
        )
        .maybeSingle<PosCatalogV2SellableVariantListItem>()
    : await supabase
        .from("sellable_variants")
        .insert({
          ...payload,
          created_by: input.actorUserId,
        })
        .select(
          "id, tenant_id, product_id, name, price_cents, is_default, is_active, sort_order, barcode, sku, deleted_at, updated_at, created_at, created_by, updated_by",
        )
        .single<PosCatalogV2SellableVariantListItem>();

  if (error) {
    throw new Error(`Unable to save sellable variant: ${error.message}`);
  }

  if (!data) {
    throw new Error("La variante no pudo resolverse.");
  }

  if (data.is_default) {
    await clearOtherDefaultVariants(input.tenantId, data.product_id, data.id, input.actorUserId);
    await syncProductDefaultVariant(input.tenantId, data.product_id, data.id, input.actorUserId);
  } else {
    const { data: product } = await supabase
      .from("products")
      .select("id, default_variant_id")
      .eq("tenant_id", input.tenantId)
      .eq("id", data.product_id)
      .maybeSingle<{ id: string; default_variant_id: string | null }>();

    if (product?.default_variant_id === data.id) {
      await syncProductDefaultVariant(input.tenantId, data.product_id, null, input.actorUserId);
    }
  }

  return data;
}

export async function archiveCatalogV2Variant(input: TenantScopedInput & { id: string }): Promise<void> {
  const supabase = await getSupabaseServerClient();
  const now = nowIso();

  const { data: variant } = await supabase
    .from("sellable_variants")
    .select("id, product_id, is_default")
    .eq("tenant_id", input.tenantId)
    .eq("id", input.id)
    .maybeSingle<{ id: string; product_id: string; is_default: boolean }>();

  const { error } = await supabase
    .from("sellable_variants")
    .update({
      deleted_at: now,
      is_active: false,
      is_default: false,
      updated_by: input.actorUserId,
      updated_at: now,
    })
    .eq("tenant_id", input.tenantId)
    .eq("id", input.id);

  if (error) {
    throw new Error(`Unable to archive sellable variant: ${error.message}`);
  }

  if (variant?.is_default) {
    await syncProductDefaultVariant(input.tenantId, variant.product_id, null, input.actorUserId);
  }
}

export async function saveCatalogV2ModifierGroup(input: {
  tenantId: string;
  actorUserId: string;
  id?: string | null;
  form: PosCatalogV2ModifierGroupFormValues;
}): Promise<PosCatalogV2ModifierGroupListItem> {
  const supabase = await getSupabaseServerClient();
  const now = nowIso();

  const payload = {
    tenant_id: input.tenantId,
    name: input.form.name,
    selection_mode: input.form.selection_mode,
    is_required: input.form.is_required,
    min_selected: input.form.min_selected,
    max_selected: input.form.max_selected,
    display_scope: input.form.display_scope,
    is_active: input.form.is_active,
    sort_order: input.form.sort_order,
    updated_by: input.actorUserId,
    updated_at: now,
  };

  const { data, error } = input.id
    ? await supabase
        .from("modifier_groups")
        .update(payload)
        .eq("tenant_id", input.tenantId)
        .eq("id", input.id)
        .select(
          "id, tenant_id, name, selection_mode, is_required, min_selected, max_selected, display_scope, is_active, sort_order, deleted_at, updated_at, created_at, created_by, updated_by",
        )
        .maybeSingle<PosCatalogV2ModifierGroupListItem>()
    : await supabase
        .from("modifier_groups")
        .insert({
          ...payload,
          created_by: input.actorUserId,
        })
        .select(
          "id, tenant_id, name, selection_mode, is_required, min_selected, max_selected, display_scope, is_active, sort_order, deleted_at, updated_at, created_at, created_by, updated_by",
        )
        .single<PosCatalogV2ModifierGroupListItem>();

  if (error) {
    throw new Error(`Unable to save modifier group: ${error.message}`);
  }

  if (!data) {
    throw new Error("El grupo de modifiers no pudo resolverse.");
  }

  return data;
}

export async function archiveCatalogV2ModifierGroup(
  input: TenantScopedInput & { id: string },
): Promise<void> {
  const supabase = await getSupabaseServerClient();
  const now = nowIso();

  const { error } = await supabase
    .from("modifier_groups")
    .update({
      deleted_at: now,
      is_active: false,
      updated_by: input.actorUserId,
      updated_at: now,
    })
    .eq("tenant_id", input.tenantId)
    .eq("id", input.id);

  if (error) {
    throw new Error(`Unable to archive modifier group: ${error.message}`);
  }
}

export async function saveCatalogV2ModifierOption(input: {
  tenantId: string;
  actorUserId: string;
  id?: string | null;
  form: PosCatalogV2ModifierOptionFormValues;
}): Promise<PosCatalogV2ModifierOptionListItem> {
  const supabase = await getSupabaseServerClient();
  const now = nowIso();

  await assertModifierGroupBelongsToTenant(input.tenantId, input.form.modifier_group_id);

  const payload = {
    tenant_id: input.tenantId,
    modifier_group_id: input.form.modifier_group_id,
    name: input.form.name,
    price_delta_cents: input.form.price_delta_cents,
    is_default: input.form.is_default,
    is_active: input.form.is_active,
    sort_order: input.form.sort_order,
    reporting_key: toNullableString(input.form.reporting_key),
    updated_by: input.actorUserId,
    updated_at: now,
  };

  const { data, error } = input.id
    ? await supabase
        .from("modifier_options")
        .update(payload)
        .eq("tenant_id", input.tenantId)
        .eq("id", input.id)
        .select(
          "id, tenant_id, modifier_group_id, name, price_delta_cents, is_default, is_active, sort_order, reporting_key, deleted_at, updated_at, created_at, created_by, updated_by",
        )
        .maybeSingle<PosCatalogV2ModifierOptionListItem>()
    : await supabase
        .from("modifier_options")
        .insert({
          ...payload,
          created_by: input.actorUserId,
        })
        .select(
          "id, tenant_id, modifier_group_id, name, price_delta_cents, is_default, is_active, sort_order, reporting_key, deleted_at, updated_at, created_at, created_by, updated_by",
        )
        .single<PosCatalogV2ModifierOptionListItem>();

  if (error) {
    throw new Error(`Unable to save modifier option: ${error.message}`);
  }

  if (!data) {
    throw new Error("La opción de modifier no pudo resolverse.");
  }

  if (data.is_default) {
    await clearOtherDefaultModifierOptions(
      input.tenantId,
      data.modifier_group_id,
      data.id,
      input.actorUserId,
    );
  }

  return data;
}

export async function archiveCatalogV2ModifierOption(
  input: TenantScopedInput & { id: string },
): Promise<void> {
  const supabase = await getSupabaseServerClient();
  const now = nowIso();

  const { error } = await supabase
    .from("modifier_options")
    .update({
      deleted_at: now,
      is_active: false,
      is_default: false,
      updated_by: input.actorUserId,
      updated_at: now,
    })
    .eq("tenant_id", input.tenantId)
    .eq("id", input.id);

  if (error) {
    throw new Error(`Unable to archive modifier option: ${error.message}`);
  }
}

export async function saveCatalogV2Assignment(input: {
  tenantId: string;
  actorUserId: string;
  id?: string | null;
  form: PosCatalogV2ProductModifierGroupAssignmentFormValues;
}): Promise<PosCatalogV2ProductModifierGroupAssignmentListItem> {
  const supabase = await getSupabaseServerClient();
  const now = nowIso();

  await assertProductBelongsToTenant(input.tenantId, input.form.product_id);
  await assertModifierGroupBelongsToTenant(input.tenantId, input.form.modifier_group_id);

  const payload = {
    tenant_id: input.tenantId,
    product_id: input.form.product_id,
    modifier_group_id: input.form.modifier_group_id,
    is_required_override: input.form.is_required_override,
    min_selected_override: input.form.min_selected_override,
    max_selected_override: input.form.max_selected_override,
    is_active: input.form.is_active,
    sort_order: input.form.sort_order,
    updated_by: input.actorUserId,
    updated_at: now,
  };

  const { data, error } = input.id
    ? await supabase
        .from("product_modifier_group_assignments")
        .update(payload)
        .eq("tenant_id", input.tenantId)
        .eq("id", input.id)
        .select(
          "id, tenant_id, product_id, modifier_group_id, is_required_override, min_selected_override, max_selected_override, sort_order, is_active, deleted_at, updated_at, created_at, created_by, updated_by",
        )
        .maybeSingle<PosCatalogV2ProductModifierGroupAssignmentListItem>()
    : await supabase
        .from("product_modifier_group_assignments")
        .insert({
          ...payload,
          created_by: input.actorUserId,
        })
        .select(
          "id, tenant_id, product_id, modifier_group_id, is_required_override, min_selected_override, max_selected_override, sort_order, is_active, deleted_at, updated_at, created_at, created_by, updated_by",
        )
        .single<PosCatalogV2ProductModifierGroupAssignmentListItem>();

  if (error) {
    throw new Error(`Unable to save modifier assignment: ${error.message}`);
  }

  if (!data) {
    throw new Error("La asignación de modifier no pudo resolverse.");
  }

  return data;
}

export async function archiveCatalogV2Assignment(
  input: TenantScopedInput & { id: string },
): Promise<void> {
  const supabase = await getSupabaseServerClient();
  const now = nowIso();

  const { error } = await supabase
    .from("product_modifier_group_assignments")
    .update({
      deleted_at: now,
      is_active: false,
      updated_by: input.actorUserId,
      updated_at: now,
    })
    .eq("tenant_id", input.tenantId)
    .eq("id", input.id);

  if (error) {
    throw new Error(`Unable to archive modifier assignment: ${error.message}`);
  }
}

export async function saveCatalogV2ComboSlot(input: {
  tenantId: string;
  actorUserId: string;
  id?: string | null;
  form: PosCatalogV2ComboSlotFormValues;
}): Promise<PosCatalogV2ComboSlotListItem> {
  const supabase = await getSupabaseServerClient();
  const now = nowIso();

  const product = await loadProductById(input.tenantId, input.form.product_id);
  if (!product) {
    throw new Error("El producto del combo no existe o fue archivado.");
  }

  if (product.product_type !== "combo") {
    throw new Error("Los slots solo pueden pertenecer a productos combo.");
  }

  if (input.form.selection_mode !== "single") {
    throw new Error("En Fase 1 los slots de combo solo soportan selección single.");
  }

  if (input.form.min_selected !== 1 || input.form.max_selected !== 1) {
    throw new Error("En Fase 1 los slots de combo deben usar mínimo 1 y máximo 1.");
  }

  const payload = {
    tenant_id: input.tenantId,
    product_id: input.form.product_id,
    slot_key: input.form.slot_key,
    name: input.form.name,
    selection_mode: input.form.selection_mode,
    min_selected: input.form.min_selected,
    max_selected: input.form.max_selected,
    is_active: input.form.is_active,
    sort_order: input.form.sort_order,
    updated_by: input.actorUserId,
    updated_at: now,
  };

  const { data, error } = input.id
    ? await supabase
        .from("combo_slots")
        .update(payload)
        .eq("tenant_id", input.tenantId)
        .eq("id", input.id)
        .select(
          "id, tenant_id, product_id, slot_key, name, selection_mode, min_selected, max_selected, sort_order, is_active, deleted_at, updated_at, created_at, created_by, updated_by",
        )
        .maybeSingle<PosCatalogV2ComboSlotListItem>()
    : await supabase
        .from("combo_slots")
        .insert({
          ...payload,
          created_by: input.actorUserId,
        })
        .select(
          "id, tenant_id, product_id, slot_key, name, selection_mode, min_selected, max_selected, sort_order, is_active, deleted_at, updated_at, created_at, created_by, updated_by",
        )
        .single<PosCatalogV2ComboSlotListItem>();

  if (error) {
    throw new Error(`Unable to save combo slot: ${error.message}`);
  }

  if (!data) {
    throw new Error("El combo slot no pudo resolverse.");
  }

  return data;
}

export async function archiveCatalogV2ComboSlot(input: TenantScopedInput & { id: string }): Promise<void> {
  const supabase = await getSupabaseServerClient();
  const now = nowIso();

  const { error } = await supabase
    .from("combo_slots")
    .update({
      deleted_at: now,
      is_active: false,
      updated_by: input.actorUserId,
      updated_at: now,
    })
    .eq("tenant_id", input.tenantId)
    .eq("id", input.id);

  if (error) {
    throw new Error(`Unable to archive combo slot: ${error.message}`);
  }
}

export async function saveCatalogV2ComboSlotOption(input: {
  tenantId: string;
  actorUserId: string;
  id?: string | null;
  form: PosCatalogV2ComboSlotOptionFormValues;
}): Promise<PosCatalogV2ComboSlotOptionListItem> {
  const supabase = await getSupabaseServerClient();
  const now = nowIso();

  const slot = await loadComboSlotById(input.tenantId, input.form.combo_slot_id);
  if (!slot) {
    throw new Error("El combo slot no existe o fue archivado.");
  }

  const linkedProductId = toNullableString(input.form.linked_product_id);
  const linkedVariantId = toNullableString(input.form.linked_sellable_variant_id);
  const hasProductTarget = linkedProductId !== null;
  const hasVariantTarget = linkedVariantId !== null;

  if (hasProductTarget === hasVariantTarget) {
    throw new Error("La opción de combo debe apuntar exactamente a un producto o a una variante.");
  }

  let normalizedLinkedProductId: string | null = null;
  let normalizedLinkedVariantId: string | null = null;

  if (hasProductTarget) {
    const targetProduct = await loadProductById(input.tenantId, linkedProductId);
    if (!targetProduct) {
      throw new Error("El producto enlazado no existe o fue archivado.");
    }

    if (targetProduct.product_type !== "simple") {
      throw new Error("En Fase 1, el target por producto debe ser un producto simple.");
    }

    normalizedLinkedProductId = targetProduct.id;
  } else {
    const targetVariant = await loadVariantById(input.tenantId, linkedVariantId as string);
    if (!targetVariant) {
      throw new Error("La variante enlazada no existe o fue archivada.");
    }

    const targetProduct = await loadProductById(input.tenantId, targetVariant.product_id);
    if (!targetProduct) {
      throw new Error("La variante enlazada no pertenece a un producto válido.");
    }

    if (targetProduct.product_type !== "configurable") {
      throw new Error("En Fase 1, el target por variante debe venir de un producto configurable.");
    }

    normalizedLinkedVariantId = targetVariant.id;
  }

  const payload = {
    tenant_id: input.tenantId,
    combo_slot_id: slot.id,
    name: input.form.name,
    linked_product_id: normalizedLinkedProductId,
    linked_sellable_variant_id: normalizedLinkedVariantId,
    price_delta_cents: input.form.price_delta_cents,
    is_default: input.form.is_default,
    is_active: input.form.is_active,
    sort_order: input.form.sort_order,
    reporting_key: toNullableString(input.form.reporting_key),
    updated_by: input.actorUserId,
    updated_at: now,
  };

  const { data, error } = input.id
    ? await supabase
        .from("combo_slot_options")
        .update(payload)
        .eq("tenant_id", input.tenantId)
        .eq("id", input.id)
        .select(
          "id, tenant_id, combo_slot_id, name, linked_product_id, linked_sellable_variant_id, price_delta_cents, is_default, is_active, sort_order, reporting_key, deleted_at, updated_at, created_at, created_by, updated_by",
        )
        .maybeSingle<PosCatalogV2ComboSlotOptionListItem>()
    : await supabase
        .from("combo_slot_options")
        .insert({
          ...payload,
          created_by: input.actorUserId,
        })
        .select(
          "id, tenant_id, combo_slot_id, name, linked_product_id, linked_sellable_variant_id, price_delta_cents, is_default, is_active, sort_order, reporting_key, deleted_at, updated_at, created_at, created_by, updated_by",
        )
        .single<PosCatalogV2ComboSlotOptionListItem>();

  if (error) {
    throw new Error(`Unable to save combo slot option: ${error.message}`);
  }

  if (!data) {
    throw new Error("La opción del combo slot no pudo resolverse.");
  }

  if (data.is_default) {
    await clearOtherDefaultComboSlotOptions(input.tenantId, data.combo_slot_id, data.id, input.actorUserId);
  }

  return data;
}

export async function archiveCatalogV2ComboSlotOption(
  input: TenantScopedInput & { id: string },
): Promise<void> {
  const supabase = await getSupabaseServerClient();
  const now = nowIso();

  const { error } = await supabase
    .from("combo_slot_options")
    .update({
      deleted_at: now,
      is_active: false,
      is_default: false,
      updated_by: input.actorUserId,
      updated_at: now,
    })
    .eq("tenant_id", input.tenantId)
    .eq("id", input.id);

  if (error) {
    throw new Error(`Unable to archive combo slot option: ${error.message}`);
  }
}

export async function listCatalogV2ComboSlotsForProduct(
  tenantId: string,
  productId: string,
): Promise<PosCatalogV2ComboSlotListItem[]> {
  const supabase = await getSupabaseServerClient();
  const { data, error } = await supabase
    .from("combo_slots")
    .select(
      "id, tenant_id, product_id, slot_key, name, selection_mode, min_selected, max_selected, sort_order, is_active, deleted_at, updated_at, created_at, created_by, updated_by",
    )
    .eq("tenant_id", tenantId)
    .eq("product_id", productId)
    .order("sort_order", { ascending: true })
    .order("name", { ascending: true });

  if (error) {
    throw new Error(`Unable to list combo slots: ${error.message}`);
  }

  return (data ?? []) as unknown as PosCatalogV2ComboSlotListItem[];
}

export async function listCatalogV2ComboSlotOptionsForSlot(
  tenantId: string,
  slotId: string,
): Promise<PosCatalogV2ComboSlotOptionListItem[]> {
  const supabase = await getSupabaseServerClient();
  const { data, error } = await supabase
    .from("combo_slot_options")
    .select(
      "id, tenant_id, combo_slot_id, name, linked_product_id, linked_sellable_variant_id, price_delta_cents, is_default, is_active, sort_order, reporting_key, deleted_at, updated_at, created_at, created_by, updated_by",
    )
    .eq("tenant_id", tenantId)
    .eq("combo_slot_id", slotId)
    .order("sort_order", { ascending: true })
    .order("name", { ascending: true });

  if (error) {
    throw new Error(`Unable to list combo slot options: ${error.message}`);
  }

  return (data ?? []) as unknown as PosCatalogV2ComboSlotOptionListItem[];
}
