"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { resolveSalesPosPageActor } from "@/lib/auth/module-page-access";
import {
  archiveCatalogV2ComboSlot,
  archiveCatalogV2ComboSlotOption,
  archiveCatalogV2Assignment,
  archiveCatalogV2ModifierGroup,
  archiveCatalogV2ModifierOption,
  archiveCatalogV2Product,
  archiveCatalogV2Variant,
  saveCatalogV2ComboSlot,
  saveCatalogV2ComboSlotOption,
  saveCatalogV2Assignment,
  saveCatalogV2ModifierGroup,
  saveCatalogV2ModifierOption,
  saveCatalogV2Product,
  saveCatalogV2ProductImage,
  saveCatalogV2Variant,
} from "@/lib/pos/catalog-v2/commands";
import {
  getCatalogV2ProductDetailPath,
  getCatalogV2ProductsPath,
} from "@/lib/pos/catalog-v2/paths";
import type {
  PosCatalogV2ModifierGroupFormValues,
  PosCatalogV2ModifierOptionFormValues,
  PosCatalogV2ComboSlotFormValues,
  PosCatalogV2ComboSlotOptionFormValues,
  PosCatalogV2ProductFormValues,
  PosCatalogV2ProductModifierGroupAssignmentFormValues,
  PosCatalogV2SellableVariantFormValues,
} from "@/types/pos-catalog-v2";
import type { SalesPosCatalogProductType } from "@/types/sales-pos-accounts";

export type CatalogV2ActionState = {
  error: string | null;
  fieldErrors: Record<string, string>;
};

const initialState: CatalogV2ActionState = {
  error: null,
  fieldErrors: {},
};

export type CatalogV2InlineActionResult = {
  ok: boolean;
  error: string | null;
};

function isRedirectErrorLike(error: unknown): boolean {
  if (typeof error !== "object" || error === null || !("digest" in error)) {
    return false;
  }

  return String((error as { digest?: unknown }).digest).startsWith("NEXT_REDIRECT");
}

function toTrimmedString(input: FormDataEntryValue | null): string {
  return String(input ?? "").trim();
}

function toBoolean(input: FormDataEntryValue | null): boolean {
  return String(input ?? "") === "on";
}

function getImageFile(formData: FormData): File | null {
  const file = formData.get("image");
  if (!file || typeof file !== "object") {
    return null;
  }

  if (!(file instanceof File)) {
    return null;
  }

  if (typeof file.size !== "number" || file.size <= 0) {
    return null;
  }

  return file;
}

function parseNullableInteger(input: FormDataEntryValue | null): number | null {
  const raw = toTrimmedString(input);
  if (!raw) {
    return null;
  }

  const parsed = Number(raw);
  if (!Number.isFinite(parsed)) {
    throw new Error("Número inválido.");
  }

  return Math.trunc(parsed);
}

function parseRequiredInteger(input: FormDataEntryValue | null): number {
  const parsed = parseNullableInteger(input);
  if (parsed === null) {
    throw new Error("Número requerido.");
  }

  return parsed;
}

function parsePriceToCents(input: FormDataEntryValue | null, allowNull = false): number | null {
  const raw = toTrimmedString(input);
  if (!raw) {
    if (allowNull) {
      return null;
    }
    throw new Error("Precio requerido.");
  }

  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed < 0) {
    throw new Error("Precio inválido.");
  }

  return Math.round(parsed * 100);
}

function parseProductType(value: FormDataEntryValue | null): SalesPosCatalogProductType {
  const normalized = toTrimmedString(value);
  if (normalized === "configurable" || normalized === "combo") {
    return normalized;
  }

  return "simple";
}

function parseSelectionMode(value: FormDataEntryValue | null): PosCatalogV2ModifierGroupFormValues["selection_mode"] {
  const normalized = toTrimmedString(value);
  return normalized === "multiple" ? "multiple" : "single";
}

function parseDisplayScope(value: FormDataEntryValue | null): PosCatalogV2ModifierGroupFormValues["display_scope"] {
  const normalized = toTrimmedString(value);
  if (normalized === "kitchen" || normalized === "both") {
    return normalized;
  }

  return "cashier";
}

function validateProductInput(formData: FormData): {
  input: PosCatalogV2ProductFormValues | null;
  fieldErrors: CatalogV2ActionState["fieldErrors"];
} {
  const fieldErrors: CatalogV2ActionState["fieldErrors"] = {};
  const name = toTrimmedString(formData.get("name"));
  const categoryRaw = toTrimmedString(formData.get("category_id"));
  const categoryId = categoryRaw || null;
  const productType = parseProductType(formData.get("product_type"));
  const productClass = toTrimmedString(formData.get("class")) === "drink" ? "drink" : "food";
  const defaultVariantRaw = toTrimmedString(formData.get("default_variant_id"));
  const defaultVariantId = defaultVariantRaw || null;
  const isActive = toBoolean(formData.get("is_active"));
  const isSoldOut = toBoolean(formData.get("is_sold_out"));
  const isPopular = toBoolean(formData.get("is_popular"));

  let basePriceCents: number | null = null;
  try {
    basePriceCents = parsePriceToCents(formData.get("base_price_cents"), true);
  } catch {
    fieldErrors.base_price_cents = "Precio base inválido.";
  }

  if (!name) {
    fieldErrors.name = "El nombre es obligatorio.";
  } else if (name.length > 120) {
    fieldErrors.name = "El nombre no puede exceder 120 caracteres.";
  }

  if (productType === "simple" || productType === "combo") {
    if (basePriceCents === null) {
      fieldErrors.base_price_cents = "El precio base es obligatorio para productos simples y combos.";
    }
  }

  if ((productType === "simple" || productType === "combo") && defaultVariantId !== null) {
    fieldErrors.default_variant_id = "Solo los productos configurables pueden tener variante por defecto.";
  }

  if (Object.keys(fieldErrors).length > 0) {
    return { input: null, fieldErrors };
  }

  return {
    input: {
      name,
      category_id: categoryId,
      product_type: productType,
      class: productClass,
      base_price_cents: productType === "configurable" ? null : basePriceCents,
      requires_variant_selection: productType === "configurable",
      default_variant_id: productType === "configurable" ? defaultVariantId : null,
      is_active: isActive,
      is_sold_out: isSoldOut,
      is_popular: isPopular,
    },
    fieldErrors: {},
  };
}

function validateVariantInput(formData: FormData): {
  input: PosCatalogV2SellableVariantFormValues | null;
  fieldErrors: CatalogV2ActionState["fieldErrors"];
} {
  const fieldErrors: CatalogV2ActionState["fieldErrors"] = {};
  const productId = toTrimmedString(formData.get("product_id"));
  const name = toTrimmedString(formData.get("name"));
  const isDefault = toBoolean(formData.get("is_default"));
  const isActive = toBoolean(formData.get("is_active"));
  const barcode = toTrimmedString(formData.get("barcode")) || null;
  const sku = toTrimmedString(formData.get("sku")) || null;
  const sortOrder = parseNullableInteger(formData.get("sort_order")) ?? 0;

  let priceCents: number | null = null;
  try {
    priceCents = parsePriceToCents(formData.get("price_cents"));
  } catch {
    fieldErrors.price_cents = "El precio es obligatorio.";
  }

  if (!productId) {
    fieldErrors.product_id = "El producto es obligatorio.";
  }

  if (!name) {
    fieldErrors.name = "El nombre es obligatorio.";
  }

  if (Object.keys(fieldErrors).length > 0 || priceCents === null) {
    return { input: null, fieldErrors };
  }

  return {
    input: {
      product_id: productId,
      name,
      price_cents: priceCents,
      is_default: isDefault,
      is_active: isActive,
      sort_order: sortOrder,
      barcode,
      sku,
    },
    fieldErrors: {},
  };
}

function validateModifierGroupInput(formData: FormData): {
  input: PosCatalogV2ModifierGroupFormValues | null;
  fieldErrors: CatalogV2ActionState["fieldErrors"];
} {
  const fieldErrors: CatalogV2ActionState["fieldErrors"] = {};
  const name = toTrimmedString(formData.get("name"));
  const selectionMode = parseSelectionMode(formData.get("selection_mode"));
  const isRequired = toBoolean(formData.get("is_required"));
  const displayScope = parseDisplayScope(formData.get("display_scope"));
  const isActive = toBoolean(formData.get("is_active"));
  const sortOrder = parseNullableInteger(formData.get("sort_order")) ?? 0;

  let minSelected = 0;
  let maxSelected = 1;
  try {
    minSelected = parseRequiredInteger(formData.get("min_selected"));
    maxSelected = parseRequiredInteger(formData.get("max_selected"));
  } catch {
    fieldErrors.min_selected = "Selecciona un mínimo válido.";
    fieldErrors.max_selected = "Selecciona un máximo válido.";
  }

  if (!name) {
    fieldErrors.name = "El nombre es obligatorio.";
  }

  if (isRequired && minSelected < 1) {
    fieldErrors.min_selected = "Si el grupo es requerido, el mínimo debe ser al menos 1.";
  }

  if (maxSelected < minSelected) {
    fieldErrors.max_selected = "El máximo no puede ser menor que el mínimo.";
  }

  if (Object.keys(fieldErrors).length > 0) {
    return { input: null, fieldErrors };
  }

  return {
    input: {
      name,
      selection_mode: selectionMode,
      is_required: isRequired,
      min_selected: minSelected,
      max_selected: maxSelected,
      display_scope: displayScope,
      is_active: isActive,
      sort_order: sortOrder,
    },
    fieldErrors: {},
  };
}

function validateModifierOptionInput(formData: FormData): {
  input: PosCatalogV2ModifierOptionFormValues | null;
  fieldErrors: CatalogV2ActionState["fieldErrors"];
} {
  const fieldErrors: CatalogV2ActionState["fieldErrors"] = {};
  const modifierGroupId = toTrimmedString(formData.get("modifier_group_id"));
  const name = toTrimmedString(formData.get("name"));
  const isDefault = toBoolean(formData.get("is_default"));
  const isActive = toBoolean(formData.get("is_active"));
  const reportingKey = toTrimmedString(formData.get("reporting_key")) || null;
  const sortOrder = parseNullableInteger(formData.get("sort_order")) ?? 0;

  let priceDeltaCents: number | null = null;
  try {
    priceDeltaCents = parsePriceToCents(formData.get("price_delta_cents"));
  } catch {
    fieldErrors.price_delta_cents = "El delta de precio es obligatorio.";
  }

  if (!modifierGroupId) {
    fieldErrors.modifier_group_id = "El grupo es obligatorio.";
  }

  if (!name) {
    fieldErrors.name = "El nombre es obligatorio.";
  }

  if (Object.keys(fieldErrors).length > 0 || priceDeltaCents === null) {
    return { input: null, fieldErrors };
  }

  return {
    input: {
      modifier_group_id: modifierGroupId,
      name,
      price_delta_cents: priceDeltaCents,
      is_default: isDefault,
      is_active: isActive,
      sort_order: sortOrder,
      reporting_key: reportingKey,
    },
    fieldErrors: {},
  };
}

function validateAssignmentInput(formData: FormData): {
  input: PosCatalogV2ProductModifierGroupAssignmentFormValues | null;
  fieldErrors: CatalogV2ActionState["fieldErrors"];
} {
  const fieldErrors: CatalogV2ActionState["fieldErrors"] = {};
  const productId = toTrimmedString(formData.get("product_id"));
  const modifierGroupId = toTrimmedString(formData.get("modifier_group_id"));
  const isActive = toBoolean(formData.get("is_active"));
  const sortOrder = parseNullableInteger(formData.get("sort_order")) ?? 0;
  const isRequiredOverrideRaw = toTrimmedString(formData.get("is_required_override"));
  const minSelectedOverrideRaw = toTrimmedString(formData.get("min_selected_override"));
  const maxSelectedOverrideRaw = toTrimmedString(formData.get("max_selected_override"));

  const isRequiredOverride =
    isRequiredOverrideRaw === "" ? null : isRequiredOverrideRaw === "true" || isRequiredOverrideRaw === "on";
  const minSelectedOverride = minSelectedOverrideRaw ? Number(minSelectedOverrideRaw) : null;
  const maxSelectedOverride = maxSelectedOverrideRaw ? Number(maxSelectedOverrideRaw) : null;

  if (!productId) {
    fieldErrors.product_id = "El producto es obligatorio.";
  }

  if (!modifierGroupId) {
    fieldErrors.modifier_group_id = "El grupo de modifiers es obligatorio.";
  }

  if (
    minSelectedOverride !== null &&
    (!Number.isFinite(minSelectedOverride) || minSelectedOverride < 0)
  ) {
    fieldErrors.min_selected_override = "El mínimo override debe ser un número válido.";
  }

  if (
    maxSelectedOverride !== null &&
    (!Number.isFinite(maxSelectedOverride) || maxSelectedOverride < 0)
  ) {
    fieldErrors.max_selected_override = "El máximo override debe ser un número válido.";
  }

  if (
    minSelectedOverride !== null &&
    maxSelectedOverride !== null &&
    maxSelectedOverride < minSelectedOverride
  ) {
    fieldErrors.max_selected_override = "El máximo override no puede ser menor que el mínimo.";
  }

  if (Object.keys(fieldErrors).length > 0) {
    return { input: null, fieldErrors };
  }

  return {
    input: {
      product_id: productId,
      modifier_group_id: modifierGroupId,
      is_required_override: isRequiredOverride,
      min_selected_override: minSelectedOverride,
      max_selected_override: maxSelectedOverride,
      is_active: isActive,
      sort_order: sortOrder,
    },
    fieldErrors: {},
  };
}

function validateComboSlotInput(formData: FormData): {
  input: PosCatalogV2ComboSlotFormValues | null;
  fieldErrors: CatalogV2ActionState["fieldErrors"];
} {
  const fieldErrors: CatalogV2ActionState["fieldErrors"] = {};
  const productId = toTrimmedString(formData.get("product_id"));
  const slotKey = toTrimmedString(formData.get("slot_key"));
  const name = toTrimmedString(formData.get("name"));
  const selectionMode = parseSelectionMode(formData.get("selection_mode"));
  const isActive = toBoolean(formData.get("is_active"));
  const sortOrder = parseNullableInteger(formData.get("sort_order")) ?? 0;

  let minSelected = 1;
  let maxSelected = 1;
  try {
    minSelected = parseRequiredInteger(formData.get("min_selected"));
    maxSelected = parseRequiredInteger(formData.get("max_selected"));
  } catch {
    fieldErrors.min_selected = "Selecciona un mínimo válido.";
    fieldErrors.max_selected = "Selecciona un máximo válido.";
  }

  if (!productId) {
    fieldErrors.product_id = "El producto del combo es obligatorio.";
  }

  if (!slotKey) {
    fieldErrors.slot_key = "La llave del slot es obligatoria.";
  }

  if (!name) {
    fieldErrors.name = "El nombre es obligatorio.";
  }

  if (selectionMode !== "single") {
    fieldErrors.selection_mode = "En Fase 1 los slots de combo solo soportan selección single.";
  }

  if (minSelected !== 1) {
    fieldErrors.min_selected = "En Fase 1 el mínimo debe ser 1.";
  }

  if (maxSelected !== 1) {
    fieldErrors.max_selected = "En Fase 1 el máximo debe ser 1.";
  }

  if (Object.keys(fieldErrors).length > 0) {
    return { input: null, fieldErrors };
  }

  return {
    input: {
      product_id: productId,
      slot_key: slotKey,
      name,
      selection_mode: selectionMode,
      min_selected: minSelected,
      max_selected: maxSelected,
      is_active: isActive,
      sort_order: sortOrder,
    },
    fieldErrors: {},
  };
}

function validateComboSlotOptionInput(formData: FormData): {
  input: PosCatalogV2ComboSlotOptionFormValues | null;
  fieldErrors: CatalogV2ActionState["fieldErrors"];
} {
  const fieldErrors: CatalogV2ActionState["fieldErrors"] = {};
  const comboSlotId = toTrimmedString(formData.get("combo_slot_id"));
  const name = toTrimmedString(formData.get("name"));
  const targetMode = toTrimmedString(formData.get("target_mode"));
  const linkedProductId = toTrimmedString(formData.get("linked_product_id")) || null;
  const linkedVariantId = toTrimmedString(formData.get("linked_sellable_variant_id")) || null;
  const isDefault = toBoolean(formData.get("is_default"));
  const isActive = toBoolean(formData.get("is_active"));
  const sortOrder = parseNullableInteger(formData.get("sort_order")) ?? 0;
  const reportingKey = toTrimmedString(formData.get("reporting_key")) || null;

  let priceDeltaCents: number | null = null;
  try {
    priceDeltaCents = parsePriceToCents(formData.get("price_delta_cents"));
  } catch {
    fieldErrors.price_delta_cents = "El delta de precio es obligatorio.";
  }

  if (!comboSlotId) {
    fieldErrors.combo_slot_id = "El combo slot es obligatorio.";
  }

  if (!name) {
    fieldErrors.name = "El nombre es obligatorio.";
  }

  if (targetMode !== "product" && targetMode !== "variant") {
    fieldErrors.target_mode = "Selecciona un tipo de target válido.";
  }

  if (targetMode === "product") {
    if (!linkedProductId) {
      fieldErrors.linked_product_id = "Selecciona un producto simple.";
    }
    if (linkedVariantId) {
      fieldErrors.linked_sellable_variant_id = "No mezcles producto y variante en el mismo target.";
    }
  }

  if (targetMode === "variant") {
    if (!linkedVariantId) {
      fieldErrors.linked_sellable_variant_id = "Selecciona una variante vendible.";
    }
    if (linkedProductId) {
      fieldErrors.linked_product_id = "No mezcles producto y variante en el mismo target.";
    }
  }

  if (Object.keys(fieldErrors).length > 0 || priceDeltaCents === null) {
    return { input: null, fieldErrors };
  }

  return {
    input: {
      combo_slot_id: comboSlotId,
      name,
      linked_product_id: targetMode === "product" ? linkedProductId : null,
      linked_sellable_variant_id: targetMode === "variant" ? linkedVariantId : null,
      price_delta_cents: priceDeltaCents,
      is_default: isDefault,
      is_active: isActive,
      sort_order: sortOrder,
      reporting_key: reportingKey,
    },
    fieldErrors: {},
  };
}

function resolveTenantSlug(formData: FormData): string {
  return toTrimmedString(formData.get("tenantSlug")).toLowerCase();
}

function resolveRedirectPath(formData: FormData, fallbackPath: string): string {
  const returnPath = toTrimmedString(formData.get("returnPath"));
  if (returnPath.startsWith("/")) {
    return returnPath;
  }

  return fallbackPath;
}

function legacyCatalogPath(tenantSlug: string): string {
  return `/${tenantSlug}/pos/catalog`;
}

function toRevalidatePath(path: string): string {
  return path.split(/[?#]/, 1)[0] || path;
}

export async function saveProductV2Action(
  _previousState: CatalogV2ActionState,
  formData: FormData,
): Promise<CatalogV2ActionState> {
  const tenantSlug = resolveTenantSlug(formData);

  if (!tenantSlug) {
    return { ...initialState, error: "Tenant inválido." };
  }

  const validation = validateProductInput(formData);
  if (!validation.input) {
    return { ...initialState, fieldErrors: validation.fieldErrors };
  }

  try {
    const { tenant, user } = await resolveSalesPosPageActor(tenantSlug, "products", "manage");
    const productId = toTrimmedString(formData.get("productId")) || null;

    await saveCatalogV2Product({
      tenantId: tenant.tenantId,
      actorUserId: user.id,
      id: productId,
      form: validation.input,
    });

    const redirectPath = resolveRedirectPath(formData, legacyCatalogPath(tenant.tenantSlug));
    revalidatePath(toRevalidatePath(redirectPath));
    redirect(redirectPath);
  } catch (error) {
    if (isRedirectErrorLike(error)) {
      throw error;
    }

    return {
      ...initialState,
      error: error instanceof Error ? error.message : "No se pudo guardar el producto.",
    };
  }
}

export async function archiveProductV2Action(formData: FormData): Promise<void> {
  const tenantSlug = resolveTenantSlug(formData);
  const productId = toTrimmedString(formData.get("productId"));
  if (!tenantSlug || !productId) {
    return;
  }

  const { tenant, user } = await resolveSalesPosPageActor(tenantSlug, "products", "manage");
  await archiveCatalogV2Product({ tenantId: tenant.tenantId, actorUserId: user.id, id: productId });
  const redirectPath = resolveRedirectPath(formData, legacyCatalogPath(tenant.tenantSlug));
  revalidatePath(toRevalidatePath(redirectPath));
  redirect(redirectPath);
}

export async function saveVariantV2Action(
  _previousState: CatalogV2ActionState,
  formData: FormData,
): Promise<CatalogV2ActionState> {
  const tenantSlug = resolveTenantSlug(formData);
  if (!tenantSlug) {
    return { ...initialState, error: "Tenant inválido." };
  }

  const validation = validateVariantInput(formData);
  if (!validation.input) {
    return { ...initialState, fieldErrors: validation.fieldErrors };
  }

  try {
    const { tenant, user } = await resolveSalesPosPageActor(tenantSlug, "products", "manage");
    const variantId = toTrimmedString(formData.get("variantId")) || null;

    await saveCatalogV2Variant({
      tenantId: tenant.tenantId,
      actorUserId: user.id,
      id: variantId,
      form: validation.input,
    });

    const redirectPath = resolveRedirectPath(formData, legacyCatalogPath(tenant.tenantSlug));
    revalidatePath(toRevalidatePath(redirectPath));
    redirect(redirectPath);
  } catch (error) {
    if (isRedirectErrorLike(error)) {
      throw error;
    }

    return {
      ...initialState,
      error: error instanceof Error ? error.message : "No se pudo guardar la variante.",
    };
  }
}

export async function archiveVariantV2Action(formData: FormData): Promise<void> {
  const tenantSlug = resolveTenantSlug(formData);
  const variantId = toTrimmedString(formData.get("variantId"));
  if (!tenantSlug || !variantId) {
    return;
  }

  const { tenant, user } = await resolveSalesPosPageActor(tenantSlug, "products", "manage");
  await archiveCatalogV2Variant({ tenantId: tenant.tenantId, actorUserId: user.id, id: variantId });
  const redirectPath = resolveRedirectPath(formData, legacyCatalogPath(tenant.tenantSlug));
  revalidatePath(toRevalidatePath(redirectPath));
  redirect(redirectPath);
}

export async function saveModifierGroupV2Action(
  _previousState: CatalogV2ActionState,
  formData: FormData,
): Promise<CatalogV2ActionState> {
  const tenantSlug = resolveTenantSlug(formData);
  if (!tenantSlug) {
    return { ...initialState, error: "Tenant inválido." };
  }

  const validation = validateModifierGroupInput(formData);
  if (!validation.input) {
    return { ...initialState, fieldErrors: validation.fieldErrors };
  }

  try {
    const { tenant, user } = await resolveSalesPosPageActor(tenantSlug, "products", "manage");
    const groupId = toTrimmedString(formData.get("modifierGroupId")) || null;

    await saveCatalogV2ModifierGroup({
      tenantId: tenant.tenantId,
      actorUserId: user.id,
      id: groupId,
      form: validation.input,
    });

    const redirectPath = resolveRedirectPath(formData, legacyCatalogPath(tenant.tenantSlug));
    revalidatePath(toRevalidatePath(redirectPath));
    redirect(redirectPath);
  } catch (error) {
    if (isRedirectErrorLike(error)) {
      throw error;
    }

    return {
      ...initialState,
      error: error instanceof Error ? error.message : "No se pudo guardar el grupo de modifiers.",
    };
  }
}

export async function archiveModifierGroupV2Action(formData: FormData): Promise<void> {
  const tenantSlug = resolveTenantSlug(formData);
  const groupId = toTrimmedString(formData.get("modifierGroupId"));
  if (!tenantSlug || !groupId) {
    return;
  }

  const { tenant, user } = await resolveSalesPosPageActor(tenantSlug, "products", "manage");
  await archiveCatalogV2ModifierGroup({
    tenantId: tenant.tenantId,
    actorUserId: user.id,
    id: groupId,
  });
  const redirectPath = resolveRedirectPath(formData, legacyCatalogPath(tenant.tenantSlug));
  revalidatePath(toRevalidatePath(redirectPath));
  redirect(redirectPath);
}

export async function saveModifierOptionV2Action(
  _previousState: CatalogV2ActionState,
  formData: FormData,
): Promise<CatalogV2ActionState> {
  const tenantSlug = resolveTenantSlug(formData);
  if (!tenantSlug) {
    return { ...initialState, error: "Tenant inválido." };
  }

  const validation = validateModifierOptionInput(formData);
  if (!validation.input) {
    return { ...initialState, fieldErrors: validation.fieldErrors };
  }

  try {
    const { tenant, user } = await resolveSalesPosPageActor(tenantSlug, "products", "manage");
    const optionId = toTrimmedString(formData.get("modifierOptionId")) || null;

    await saveCatalogV2ModifierOption({
      tenantId: tenant.tenantId,
      actorUserId: user.id,
      id: optionId,
      form: validation.input,
    });

    const redirectPath = resolveRedirectPath(formData, legacyCatalogPath(tenant.tenantSlug));
    revalidatePath(toRevalidatePath(redirectPath));
    redirect(redirectPath);
  } catch (error) {
    if (isRedirectErrorLike(error)) {
      throw error;
    }

    return {
      ...initialState,
      error: error instanceof Error ? error.message : "No se pudo guardar la opción del modifier.",
    };
  }
}

export async function archiveModifierOptionV2Action(formData: FormData): Promise<void> {
  const tenantSlug = resolveTenantSlug(formData);
  const optionId = toTrimmedString(formData.get("modifierOptionId"));
  if (!tenantSlug || !optionId) {
    return;
  }

  const { tenant, user } = await resolveSalesPosPageActor(tenantSlug, "products", "manage");
  await archiveCatalogV2ModifierOption({
    tenantId: tenant.tenantId,
    actorUserId: user.id,
    id: optionId,
  });
  const redirectPath = resolveRedirectPath(formData, legacyCatalogPath(tenant.tenantSlug));
  revalidatePath(toRevalidatePath(redirectPath));
  redirect(redirectPath);
}

export async function saveAssignmentV2Action(
  _previousState: CatalogV2ActionState,
  formData: FormData,
): Promise<CatalogV2ActionState> {
  const tenantSlug = resolveTenantSlug(formData);
  if (!tenantSlug) {
    return { ...initialState, error: "Tenant inválido." };
  }

  const validation = validateAssignmentInput(formData);
  if (!validation.input) {
    return { ...initialState, fieldErrors: validation.fieldErrors };
  }

  try {
    const { tenant, user } = await resolveSalesPosPageActor(tenantSlug, "products", "manage");
    const assignmentId = toTrimmedString(formData.get("assignmentId")) || null;

    await saveCatalogV2Assignment({
      tenantId: tenant.tenantId,
      actorUserId: user.id,
      id: assignmentId,
      form: validation.input,
    });

    const redirectPath = resolveRedirectPath(formData, legacyCatalogPath(tenant.tenantSlug));
    revalidatePath(toRevalidatePath(redirectPath));
    redirect(redirectPath);
  } catch (error) {
    if (isRedirectErrorLike(error)) {
      throw error;
    }

    return {
      ...initialState,
      error: error instanceof Error ? error.message : "No se pudo guardar la asignación.",
    };
  }
}

export async function archiveAssignmentV2Action(formData: FormData): Promise<void> {
  const tenantSlug = resolveTenantSlug(formData);
  const assignmentId = toTrimmedString(formData.get("assignmentId"));
  if (!tenantSlug || !assignmentId) {
    return;
  }

  const { tenant, user } = await resolveSalesPosPageActor(tenantSlug, "products", "manage");
  await archiveCatalogV2Assignment({
    tenantId: tenant.tenantId,
    actorUserId: user.id,
    id: assignmentId,
  });
  const redirectPath = resolveRedirectPath(formData, legacyCatalogPath(tenant.tenantSlug));
  revalidatePath(toRevalidatePath(redirectPath));
  redirect(redirectPath);
}

export async function saveComboSlotV2Action(
  _previousState: CatalogV2ActionState,
  formData: FormData,
): Promise<CatalogV2ActionState> {
  const tenantSlug = resolveTenantSlug(formData);
  if (!tenantSlug) {
    return { ...initialState, error: "Tenant inválido." };
  }

  const validation = validateComboSlotInput(formData);
  if (!validation.input) {
    return { ...initialState, fieldErrors: validation.fieldErrors };
  }

  try {
    const { tenant, user } = await resolveSalesPosPageActor(tenantSlug, "products", "manage");
    const comboSlotId = toTrimmedString(formData.get("comboSlotId")) || null;

    await saveCatalogV2ComboSlot({
      tenantId: tenant.tenantId,
      actorUserId: user.id,
      id: comboSlotId,
      form: validation.input,
    });

    const redirectPath = resolveRedirectPath(formData, legacyCatalogPath(tenant.tenantSlug));
    revalidatePath(toRevalidatePath(redirectPath));
    redirect(redirectPath);
  } catch (error) {
    if (isRedirectErrorLike(error)) {
      throw error;
    }

    return {
      ...initialState,
      error: error instanceof Error ? error.message : "No se pudo guardar el combo slot.",
    };
  }
}

export async function archiveComboSlotV2Action(formData: FormData): Promise<void> {
  const tenantSlug = resolveTenantSlug(formData);
  const comboSlotId = toTrimmedString(formData.get("comboSlotId"));
  if (!tenantSlug || !comboSlotId) {
    return;
  }

  const { tenant, user } = await resolveSalesPosPageActor(tenantSlug, "products", "manage");
  await archiveCatalogV2ComboSlot({
    tenantId: tenant.tenantId,
    actorUserId: user.id,
    id: comboSlotId,
  });
  const redirectPath = resolveRedirectPath(formData, legacyCatalogPath(tenant.tenantSlug));
  revalidatePath(toRevalidatePath(redirectPath));
  redirect(redirectPath);
}

export async function saveComboSlotOptionV2Action(
  _previousState: CatalogV2ActionState,
  formData: FormData,
): Promise<CatalogV2ActionState> {
  const tenantSlug = resolveTenantSlug(formData);
  if (!tenantSlug) {
    return { ...initialState, error: "Tenant inválido." };
  }

  const validation = validateComboSlotOptionInput(formData);
  if (!validation.input) {
    return { ...initialState, fieldErrors: validation.fieldErrors };
  }

  try {
    const { tenant, user } = await resolveSalesPosPageActor(tenantSlug, "products", "manage");
    const comboSlotOptionId = toTrimmedString(formData.get("comboSlotOptionId")) || null;

    await saveCatalogV2ComboSlotOption({
      tenantId: tenant.tenantId,
      actorUserId: user.id,
      id: comboSlotOptionId,
      form: validation.input,
    });

    const redirectPath = resolveRedirectPath(formData, legacyCatalogPath(tenant.tenantSlug));
    revalidatePath(redirectPath);
    redirect(redirectPath);
  } catch (error) {
    if (isRedirectErrorLike(error)) {
      throw error;
    }

    return {
      ...initialState,
      error: error instanceof Error ? error.message : "No se pudo guardar la opción del combo slot.",
    };
  }
}

export async function archiveComboSlotOptionV2Action(formData: FormData): Promise<void> {
  const tenantSlug = resolveTenantSlug(formData);
  const comboSlotOptionId = toTrimmedString(formData.get("comboSlotOptionId"));
  if (!tenantSlug || !comboSlotOptionId) {
    return;
  }

  const { tenant, user } = await resolveSalesPosPageActor(tenantSlug, "products", "manage");
  await archiveCatalogV2ComboSlotOption({
    tenantId: tenant.tenantId,
    actorUserId: user.id,
    id: comboSlotOptionId,
  });
  const redirectPath = resolveRedirectPath(formData, legacyCatalogPath(tenant.tenantSlug));
  revalidatePath(redirectPath);
  redirect(redirectPath);
}

export async function saveCatalogV2ProductImageAction(formData: FormData): Promise<CatalogV2InlineActionResult> {
  const tenantSlug = resolveTenantSlug(formData);
  const productId = toTrimmedString(formData.get("productId"));
  const imageFile = getImageFile(formData);

  if (!tenantSlug || !productId) {
    return { ok: false, error: "Solicitud inválida." };
  }

  if (!imageFile) {
    return { ok: false, error: "Selecciona una imagen válida." };
  }

  try {
    const { tenant, user } = await resolveSalesPosPageActor(tenantSlug, "products", "manage");

    await saveCatalogV2ProductImage({
      tenantId: tenant.tenantId,
      actorUserId: user.id,
      productId,
      imageFile,
    });

    revalidatePath(getCatalogV2ProductsPath(tenant.tenantSlug));
    revalidatePath(getCatalogV2ProductDetailPath(tenant.tenantSlug, productId));
    revalidatePath(`/${tenant.tenantSlug}/pos/catalog/products`);
    revalidatePath(`/${tenant.tenantSlug}/pos/catalog/products/${productId}/edit`);

    return { ok: true, error: null };
  } catch (error) {
    if (isRedirectErrorLike(error)) {
      throw error;
    }

    return {
      ok: false,
      error: error instanceof Error ? error.message : "No se pudo guardar la imagen del producto.",
    };
  }
}
