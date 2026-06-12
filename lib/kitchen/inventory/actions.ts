"use server";

import { revalidatePath } from "next/cache";
import { resolveTenantModulePageActor } from "@/lib/auth/module-page-access";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { normalizeKitchenCode, normalizeKitchenName } from "./normalizers";

export type KitchenInventoryActionState = {
  ok: boolean;
  message: string;
};

function toTrimmedString(input: FormDataEntryValue | null): string {
  return String(input ?? "").trim();
}

function toPositiveNumber(input: FormDataEntryValue | null, field: string): number {
  const value = Number(String(input ?? "").trim());
  if (!Number.isFinite(value) || value <= 0) {
    throw new Error(`${field} debe ser mayor a 0.`);
  }
  return value;
}

function toNonNegativeNumber(input: FormDataEntryValue | null, field: string): number {
  const value = Number(String(input ?? "").trim());
  if (!Number.isFinite(value) || value < 0) {
    throw new Error(`${field} debe ser mayor o igual a 0.`);
  }
  return value;
}

function toOptionalNonNegativeNumber(input: FormDataEntryValue | null): number | null {
  const raw = String(input ?? "").trim();
  if (!raw) return null;
  const value = Number(raw);
  if (!Number.isFinite(value) || value < 0) {
    throw new Error("Valor numérico inválido.");
  }
  return value;
}

async function resolveKitchenInventoryManage(tenantSlug: string) {
  return resolveTenantModulePageActor(tenantSlug, "kitchen_inventory", "items", "manage");
}

async function assertTenantScopedReference(
  table: string,
  tenantId: string,
  id: string,
  label: string,
): Promise<void> {
  const supabase = await getSupabaseServerClient();
  const { data, error } = await supabase.from(table).select("id").eq("tenant_id", tenantId).eq("id", id).maybeSingle();
  if (error || !data) {
    throw new Error(`${label} inválido para el tenant.`);
  }
}

function revalidateKitchenInventoryPaths(tenantSlug: string) {
  revalidatePath(`/${tenantSlug}/kitchen`);
  revalidatePath(`/${tenantSlug}/kitchen/inventory`);
  revalidatePath(`/${tenantSlug}/kitchen/inventory/items`);
  revalidatePath(`/${tenantSlug}/kitchen/inventory/data-quality`);
  revalidatePath(`/${tenantSlug}/kitchen/inventory/movements`);
  revalidatePath(`/${tenantSlug}/kitchen/reports`);
}

export async function createKitchenInventoryCategoryAction(
  _previousState: KitchenInventoryActionState,
  formData: FormData,
): Promise<KitchenInventoryActionState> {
  try {
    const tenantSlug = toTrimmedString(formData.get("tenantSlug")).toLowerCase();
    const name = toTrimmedString(formData.get("name"));
    const description = toTrimmedString(formData.get("description"));

    if (!tenantSlug || !name) {
      return { ok: false, message: "Tenant y nombre son obligatorios." };
    }

    const { tenant, user } = await resolveKitchenInventoryManage(tenantSlug);
    const supabase = await getSupabaseServerClient();
    const { error } = await supabase.from("kitchen_inventory_categories").insert({
      tenant_id: tenant.tenantId,
      name,
      normalized_name: normalizeKitchenName(name),
      description: description || null,
      created_by: user.id,
    });

    if (error) throw new Error(`No se pudo crear la categoría: ${error.message}`);
    revalidateKitchenInventoryPaths(tenant.tenantSlug);
    return { ok: true, message: "Categoría creada." };
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : "No se pudo crear la categoría." };
  }
}

export async function createKitchenInventoryUnitAction(
  _previousState: KitchenInventoryActionState,
  formData: FormData,
): Promise<KitchenInventoryActionState> {
  try {
    const tenantSlug = toTrimmedString(formData.get("tenantSlug")).toLowerCase();
    const code = normalizeKitchenCode(toTrimmedString(formData.get("code")));
    const name = toTrimmedString(formData.get("name"));
    const unitType = toTrimmedString(formData.get("unitType"));

    if (!tenantSlug || !code || !name || !unitType) {
      return { ok: false, message: "Tenant, código, nombre y tipo de unidad son obligatorios." };
    }

    if (!["mass", "volume", "unit", "package", "other"].includes(unitType)) {
      return { ok: false, message: "Tipo de unidad inválido." };
    }

    const { tenant, user } = await resolveKitchenInventoryManage(tenantSlug);
    const supabase = await getSupabaseServerClient();
    const { error } = await supabase.from("kitchen_inventory_units").insert({
      tenant_id: tenant.tenantId,
      code,
      name,
      normalized_name: normalizeKitchenName(name),
      unit_type: unitType,
      created_by: user.id,
    });

    if (error) throw new Error(`No se pudo crear la unidad: ${error.message}`);
    revalidateKitchenInventoryPaths(tenant.tenantSlug);
    return { ok: true, message: "Unidad creada." };
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : "No se pudo crear la unidad." };
  }
}

export async function createKitchenInventorySupplierAction(
  _previousState: KitchenInventoryActionState,
  formData: FormData,
): Promise<KitchenInventoryActionState> {
  try {
    const tenantSlug = toTrimmedString(formData.get("tenantSlug")).toLowerCase();
    const name = toTrimmedString(formData.get("name"));

    if (!tenantSlug || !name) {
      return { ok: false, message: "Tenant y nombre son obligatorios." };
    }

    const { tenant, user } = await resolveTenantModulePageActor(
      tenantSlug,
      "kitchen_inventory",
      "suppliers",
      "manage",
    );

    const supabase = await getSupabaseServerClient();
    const { error } = await supabase.from("kitchen_inventory_suppliers").insert({
      tenant_id: tenant.tenantId,
      name,
      normalized_name: normalizeKitchenName(name),
      created_by: user.id,
    });

    if (error) throw new Error(`No se pudo crear el proveedor: ${error.message}`);
    revalidateKitchenInventoryPaths(tenant.tenantSlug);
    return { ok: true, message: "Proveedor creado." };
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : "No se pudo crear el proveedor." };
  }
}

export async function createKitchenInventoryLocationAction(
  _previousState: KitchenInventoryActionState,
  formData: FormData,
): Promise<KitchenInventoryActionState> {
  try {
    const tenantSlug = toTrimmedString(formData.get("tenantSlug")).toLowerCase();
    const name = toTrimmedString(formData.get("name"));

    if (!tenantSlug || !name) {
      return { ok: false, message: "Tenant y nombre son obligatorios." };
    }

    const { tenant, user } = await resolveTenantModulePageActor(
      tenantSlug,
      "kitchen_inventory",
      "locations",
      "manage",
    );

    const supabase = await getSupabaseServerClient();
    const { error } = await supabase.from("kitchen_inventory_locations").insert({
      tenant_id: tenant.tenantId,
      name,
      normalized_name: normalizeKitchenName(name),
      created_by: user.id,
    });

    if (error) throw new Error(`No se pudo crear la ubicación: ${error.message}`);
    revalidateKitchenInventoryPaths(tenant.tenantSlug);
    return { ok: true, message: "Ubicación creada." };
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : "No se pudo crear la ubicación." };
  }
}

export async function createKitchenInventoryItemAction(
  _previousState: KitchenInventoryActionState,
  formData: FormData,
): Promise<KitchenInventoryActionState> {
  try {
    const tenantSlug = toTrimmedString(formData.get("tenantSlug")).toLowerCase();
    const name = toTrimmedString(formData.get("name"));
    const defaultUnitId = toTrimmedString(formData.get("defaultUnitId"));
    const categoryId = toTrimmedString(formData.get("categoryId"));
    const defaultSupplierId = toTrimmedString(formData.get("defaultSupplierId"));
    const currentUnitCost = toNonNegativeNumber(formData.get("currentUnitCost"), "El costo unitario");
    const sku = toTrimmedString(formData.get("sku"));
    const description = toTrimmedString(formData.get("description"));
    const isPerishable = toTrimmedString(formData.get("isPerishable")) === "on";

    if (!tenantSlug || !name || !defaultUnitId) {
      return { ok: false, message: "Tenant, nombre y unidad por defecto son obligatorios." };
    }

    const { tenant, user } = await resolveKitchenInventoryManage(tenantSlug);

    const supabase = await getSupabaseServerClient();
    const { error } = await supabase.from("kitchen_inventory_items").insert({
      tenant_id: tenant.tenantId,
      category_id: categoryId || null,
      default_unit_id: defaultUnitId,
      default_supplier_id: defaultSupplierId || null,
      name,
      normalized_name: normalizeKitchenName(name),
      sku: sku || null,
      description: description || null,
      current_unit_cost: currentUnitCost,
      is_perishable: isPerishable,
      created_by: user.id,
    });

    if (error) throw new Error(`No se pudo crear el insumo: ${error.message}`);
    revalidateKitchenInventoryPaths(tenant.tenantSlug);
    return { ok: true, message: "Insumo creado." };
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : "No se pudo crear el insumo." };
  }
}

export async function createKitchenInventoryStockRuleAction(
  _previousState: KitchenInventoryActionState,
  formData: FormData,
): Promise<KitchenInventoryActionState> {
  try {
    const tenantSlug = toTrimmedString(formData.get("tenantSlug")).toLowerCase();
    const itemId = toTrimmedString(formData.get("itemId"));
    const locationId = toTrimmedString(formData.get("locationId"));
    const minQuantity = toOptionalNonNegativeNumber(formData.get("minQuantity"));
    const maxQuantity = toOptionalNonNegativeNumber(formData.get("maxQuantity"));
    const reorderQuantity = toOptionalNonNegativeNumber(formData.get("reorderQuantity"));

    if (!tenantSlug || !itemId) {
      return { ok: false, message: "Tenant e insumo son obligatorios." };
    }

    if (minQuantity != null && maxQuantity != null && maxQuantity < minQuantity) {
      return { ok: false, message: "La cantidad máxima debe ser mayor o igual a la mínima." };
    }

    const { tenant, user } = await resolveKitchenInventoryManage(tenantSlug);
    const supabase = await getSupabaseServerClient();

    const { error } = await supabase.from("kitchen_inventory_stock_rules").upsert(
      {
        tenant_id: tenant.tenantId,
        item_id: itemId,
        location_id: locationId || null,
        min_quantity: minQuantity,
        max_quantity: maxQuantity,
        reorder_quantity: reorderQuantity,
        created_by: user.id,
      },
      { onConflict: "tenant_id,item_id,location_id" },
    );

    if (error) throw new Error(`No se pudo guardar la regla de stock: ${error.message}`);
    revalidateKitchenInventoryPaths(tenant.tenantSlug);
    return { ok: true, message: "Regla de stock guardada." };
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : "No se pudo guardar la regla." };
  }
}

export async function recordKitchenInventoryMovementAction(
  _previousState: KitchenInventoryActionState,
  formData: FormData,
): Promise<KitchenInventoryActionState> {
  try {
    const tenantSlug = toTrimmedString(formData.get("tenantSlug")).toLowerCase();
    const itemId = toTrimmedString(formData.get("itemId"));
    const locationId = toTrimmedString(formData.get("locationId"));
    const unitId = toTrimmedString(formData.get("unitId"));
    const movementType = toTrimmedString(formData.get("movementType"));
    const quantity = toPositiveNumber(formData.get("quantity"), "La cantidad");
    const unitCost = toOptionalNonNegativeNumber(formData.get("unitCost"));
    const reason = toTrimmedString(formData.get("reason"));

    if (!tenantSlug || !itemId || !locationId || !unitId || !movementType) {
      return { ok: false, message: "Todos los campos obligatorios del movimiento deben completarse." };
    }

    const validMovementTypes = [
      "opening_balance",
      "purchase",
      "manual_in",
      "manual_out",
      "adjustment_in",
      "adjustment_out",
      "waste",
      "transfer_in",
      "transfer_out",
    ];

    if (!validMovementTypes.includes(movementType)) {
      return { ok: false, message: "Tipo de movimiento inválido." };
    }

    const { tenant } = await resolveTenantModulePageActor(
      tenantSlug,
      "kitchen_inventory",
      "movements",
      "manage",
    );

    const supabase = await getSupabaseServerClient();
    const idempotencyKey = `${tenant.tenantId}:${itemId}:${locationId}:${movementType}:${Date.now()}`;

    const { error } = await supabase.rpc("kitchen_inventory_record_movement", {
      p_tenant_id: tenant.tenantId,
      p_item_id: itemId,
      p_location_id: locationId,
      p_unit_id: unitId,
      p_movement_type: movementType,
      p_quantity: quantity,
      p_unit_cost: unitCost,
      p_reason: reason || null,
      p_source_type: "manual",
      p_source_id: null,
      p_idempotency_key: idempotencyKey,
      p_occurred_at: new Date().toISOString(),
    });

    if (error) {
      if (error.message.toLowerCase().includes("negative inventory")) {
        return { ok: false, message: "No se puede dejar inventario negativo." };
      }

      throw new Error(`No se pudo registrar el movimiento: ${error.message}`);
    }

    revalidateKitchenInventoryPaths(tenant.tenantSlug);
    return { ok: true, message: "Movimiento registrado." };
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : "No se pudo registrar el movimiento." };
  }
}

export async function transferKitchenInventoryBetweenLocationsAction(
  _previousState: KitchenInventoryActionState,
  formData: FormData,
): Promise<KitchenInventoryActionState> {
  try {
    const tenantSlug = toTrimmedString(formData.get("tenantSlug")).toLowerCase();
    const itemId = toTrimmedString(formData.get("itemId"));
    const fromLocationId = toTrimmedString(formData.get("fromLocationId"));
    const toLocationId = toTrimmedString(formData.get("toLocationId"));
    const quantity = toPositiveNumber(formData.get("quantity"), "La cantidad");
    const reason = toTrimmedString(formData.get("reason"));

    if (!tenantSlug || !itemId || !fromLocationId || !toLocationId) {
      return { ok: false, message: "Tenant, insumo y ubicaciones son obligatorios." };
    }

    if (fromLocationId === toLocationId) {
      return { ok: false, message: "La ubicación origen y destino deben ser distintas." };
    }

    const { tenant } = await resolveTenantModulePageActor(
      tenantSlug,
      "kitchen_inventory",
      "movements",
      "manage",
    );

    await assertTenantScopedReference("kitchen_inventory_items", tenant.tenantId, itemId, "Insumo");
    await assertTenantScopedReference("kitchen_inventory_locations", tenant.tenantId, fromLocationId, "Ubicación origen");
    await assertTenantScopedReference("kitchen_inventory_locations", tenant.tenantId, toLocationId, "Ubicación destino");

    const supabase = await getSupabaseServerClient();
    const { data: item, error: itemError } = await supabase
      .from("kitchen_inventory_items")
      .select("id,default_unit_id")
      .eq("tenant_id", tenant.tenantId)
      .eq("id", itemId)
      .maybeSingle();
    if (itemError || !item?.default_unit_id) {
      throw new Error("No se pudo determinar la unidad por defecto del insumo.");
    }

    const idempotencyBase = `${tenant.tenantId}:${itemId}:${fromLocationId}:${toLocationId}:${Date.now()}`;
    const occurredAt = new Date().toISOString();
    const transferReason = reason || "Transferencia entre ubicaciones";

    const { error: outError } = await supabase.rpc("kitchen_inventory_record_movement", {
      p_tenant_id: tenant.tenantId,
      p_item_id: itemId,
      p_location_id: fromLocationId,
      p_unit_id: item.default_unit_id,
      p_movement_type: "transfer_out",
      p_quantity: quantity,
      p_unit_cost: null,
      p_reason: transferReason,
      p_source_type: "transfer",
      p_source_id: null,
      p_idempotency_key: `${idempotencyBase}:out`,
      p_occurred_at: occurredAt,
    });
    if (outError) {
      if (outError.message.toLowerCase().includes("negative inventory")) {
        return { ok: false, message: "No hay existencia suficiente en la ubicación origen." };
      }
      throw new Error(`No se pudo registrar salida de transferencia: ${outError.message}`);
    }

    const { error: inError } = await supabase.rpc("kitchen_inventory_record_movement", {
      p_tenant_id: tenant.tenantId,
      p_item_id: itemId,
      p_location_id: toLocationId,
      p_unit_id: item.default_unit_id,
      p_movement_type: "transfer_in",
      p_quantity: quantity,
      p_unit_cost: null,
      p_reason: transferReason,
      p_source_type: "transfer",
      p_source_id: null,
      p_idempotency_key: `${idempotencyBase}:in`,
      p_occurred_at: occurredAt,
    });
    if (inError) {
      throw new Error(`Salida registrada, pero falló entrada en destino: ${inError.message}`);
    }

    revalidateKitchenInventoryPaths(tenant.tenantSlug);
    return { ok: true, message: "Transferencia registrada." };
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : "No se pudo registrar la transferencia." };
  }
}

export async function createPurchaseOptionAction(
  _previousState: KitchenInventoryActionState,
  formData: FormData,
): Promise<KitchenInventoryActionState> {
  try {
    const tenantSlug = toTrimmedString(formData.get("tenantSlug")).toLowerCase();
    const itemId = toTrimmedString(formData.get("itemId"));
    const supplierId = toTrimmedString(formData.get("supplierId"));
    const purchaseUnitId = toTrimmedString(formData.get("purchaseUnitId"));
    const inventoryUnitId = toTrimmedString(formData.get("inventoryUnitId"));
    const quantityPerPurchaseUnit = toPositiveNumber(formData.get("quantityPerPurchaseUnit"), "Cantidad por unidad de compra");
    const minPurchaseQuantity = toPositiveNumber(formData.get("minPurchaseQuantity"), "Mínimo de compra");
    const purchaseMultiple = toPositiveNumber(formData.get("purchaseMultiple"), "Múltiplo de compra");
    const notes = toTrimmedString(formData.get("notes"));
    const isDefault = toTrimmedString(formData.get("isDefault")) === "on";
    if (!tenantSlug || !itemId || !purchaseUnitId || !inventoryUnitId) {
      return { ok: false, message: "Tenant, insumo y unidades son obligatorios." };
    }

    const { tenant, user } = await resolveKitchenInventoryManage(tenantSlug);
    await assertTenantScopedReference("kitchen_inventory_items", tenant.tenantId, itemId, "Insumo");
    if (supplierId) {
      await assertTenantScopedReference("kitchen_inventory_suppliers", tenant.tenantId, supplierId, "Proveedor");
    }
    await assertTenantScopedReference("kitchen_inventory_units", tenant.tenantId, purchaseUnitId, "Unidad de compra");
    await assertTenantScopedReference("kitchen_inventory_units", tenant.tenantId, inventoryUnitId, "Unidad de inventario");

    const supabase = await getSupabaseServerClient();
    if (isDefault) {
      let resetDefault = supabase
        .from("kitchen_inventory_purchase_options")
        .update({ is_default: false })
        .eq("tenant_id", tenant.tenantId)
        .eq("item_id", itemId)
        .eq("is_active", true);
      if (supplierId) {
        resetDefault = resetDefault.eq("supplier_id", supplierId);
      } else {
        resetDefault = resetDefault.is("supplier_id", null);
      }
      const { error: resetError } = await resetDefault;
      if (resetError) throw new Error(`No se pudo reasignar opción default: ${resetError.message}`);
    }

    const { error } = await supabase.from("kitchen_inventory_purchase_options").insert({
      tenant_id: tenant.tenantId,
      item_id: itemId,
      supplier_id: supplierId || null,
      purchase_unit_id: purchaseUnitId,
      inventory_unit_id: inventoryUnitId,
      quantity_per_purchase_unit: quantityPerPurchaseUnit,
      min_purchase_quantity: minPurchaseQuantity,
      purchase_multiple: purchaseMultiple,
      is_default: isDefault,
      notes: notes || null,
      created_by: user.id,
    });
    if (error) throw new Error(`No se pudo crear opción de compra: ${error.message}`);

    revalidateKitchenInventoryPaths(tenant.tenantSlug);
    return { ok: true, message: "Opción de compra creada." };
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : "No se pudo crear opción de compra." };
  }
}

export async function updatePurchaseOptionAction(
  _previousState: KitchenInventoryActionState,
  formData: FormData,
): Promise<KitchenInventoryActionState> {
  try {
    const tenantSlug = toTrimmedString(formData.get("tenantSlug")).toLowerCase();
    const optionId = toTrimmedString(formData.get("optionId"));
    const quantityPerPurchaseUnit = toPositiveNumber(formData.get("quantityPerPurchaseUnit"), "Cantidad por unidad de compra");
    const minPurchaseQuantity = toPositiveNumber(formData.get("minPurchaseQuantity"), "Mínimo de compra");
    const purchaseMultiple = toPositiveNumber(formData.get("purchaseMultiple"), "Múltiplo de compra");
    const notes = toTrimmedString(formData.get("notes"));
    const isDefault = toTrimmedString(formData.get("isDefault")) === "on";
    const isActive = toTrimmedString(formData.get("isActive")) !== "off";
    if (!tenantSlug || !optionId) return { ok: false, message: "Tenant y opción son obligatorios." };

    const { tenant } = await resolveKitchenInventoryManage(tenantSlug);
    const supabase = await getSupabaseServerClient();
    const { data: option, error: optionError } = await supabase
      .from("kitchen_inventory_purchase_options")
      .select("id,item_id,supplier_id")
      .eq("tenant_id", tenant.tenantId)
      .eq("id", optionId)
      .maybeSingle();
    if (optionError || !option) throw new Error("Opción de compra inválida para el tenant.");

    if (isDefault) {
      let resetDefault = supabase
        .from("kitchen_inventory_purchase_options")
        .update({ is_default: false })
        .eq("tenant_id", tenant.tenantId)
        .eq("item_id", option.item_id)
        .eq("is_active", true);
      if (option.supplier_id) {
        resetDefault = resetDefault.eq("supplier_id", option.supplier_id);
      } else {
        resetDefault = resetDefault.is("supplier_id", null);
      }
      const { error: resetError } = await resetDefault;
      if (resetError) throw new Error(`No se pudo reasignar opción default: ${resetError.message}`);
    }

    const { error } = await supabase
      .from("kitchen_inventory_purchase_options")
      .update({
        quantity_per_purchase_unit: quantityPerPurchaseUnit,
        min_purchase_quantity: minPurchaseQuantity,
        purchase_multiple: purchaseMultiple,
        is_default: isDefault,
        is_active: isActive,
        notes: notes || null,
      })
      .eq("tenant_id", tenant.tenantId)
      .eq("id", option.id);
    if (error) throw new Error(`No se pudo actualizar opción de compra: ${error.message}`);

    revalidateKitchenInventoryPaths(tenant.tenantSlug);
    return { ok: true, message: "Opción de compra actualizada." };
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : "No se pudo actualizar opción de compra." };
  }
}

export async function deactivatePurchaseOptionAction(
  _previousState: KitchenInventoryActionState,
  formData: FormData,
): Promise<KitchenInventoryActionState> {
  try {
    const tenantSlug = toTrimmedString(formData.get("tenantSlug")).toLowerCase();
    const optionId = toTrimmedString(formData.get("optionId"));
    if (!tenantSlug || !optionId) return { ok: false, message: "Tenant y opción son obligatorios." };
    const { tenant } = await resolveKitchenInventoryManage(tenantSlug);
    const supabase = await getSupabaseServerClient();
    const { error } = await supabase
      .from("kitchen_inventory_purchase_options")
      .update({ is_active: false, is_default: false })
      .eq("tenant_id", tenant.tenantId)
      .eq("id", optionId);
    if (error) throw new Error(`No se pudo desactivar opción de compra: ${error.message}`);
    revalidateKitchenInventoryPaths(tenant.tenantSlug);
    return { ok: true, message: "Opción de compra desactivada." };
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : "No se pudo desactivar opción de compra." };
  }
}

export async function setDefaultPurchaseOptionAction(
  _previousState: KitchenInventoryActionState,
  formData: FormData,
): Promise<KitchenInventoryActionState> {
  try {
    const tenantSlug = toTrimmedString(formData.get("tenantSlug")).toLowerCase();
    const optionId = toTrimmedString(formData.get("optionId"));
    if (!tenantSlug || !optionId) return { ok: false, message: "Tenant y opción son obligatorios." };
    const { tenant } = await resolveKitchenInventoryManage(tenantSlug);
    const supabase = await getSupabaseServerClient();
    const { data: option, error: optionError } = await supabase
      .from("kitchen_inventory_purchase_options")
      .select("id,item_id,supplier_id")
      .eq("tenant_id", tenant.tenantId)
      .eq("id", optionId)
      .maybeSingle();
    if (optionError || !option) throw new Error("Opción de compra inválida para el tenant.");

    let resetDefault = supabase
      .from("kitchen_inventory_purchase_options")
      .update({ is_default: false })
      .eq("tenant_id", tenant.tenantId)
      .eq("item_id", option.item_id)
      .eq("is_active", true);
    if (option.supplier_id) {
      resetDefault = resetDefault.eq("supplier_id", option.supplier_id);
    } else {
      resetDefault = resetDefault.is("supplier_id", null);
    }
    const { error: resetError } = await resetDefault;
    if (resetError) throw new Error(`No se pudo limpiar opción default previa: ${resetError.message}`);

    const { error } = await supabase
      .from("kitchen_inventory_purchase_options")
      .update({ is_default: true })
      .eq("tenant_id", tenant.tenantId)
      .eq("id", option.id);
    if (error) throw new Error(`No se pudo marcar opción default: ${error.message}`);

    revalidateKitchenInventoryPaths(tenant.tenantSlug);
    return { ok: true, message: "Opción default actualizada." };
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : "No se pudo actualizar default." };
  }
}

export async function createSupplierPriceAction(
  _previousState: KitchenInventoryActionState,
  formData: FormData,
): Promise<KitchenInventoryActionState> {
  try {
    const tenantSlug = toTrimmedString(formData.get("tenantSlug")).toLowerCase();
    const itemId = toTrimmedString(formData.get("itemId"));
    const supplierId = toTrimmedString(formData.get("supplierId"));
    const purchaseOptionId = toTrimmedString(formData.get("purchaseOptionId"));
    const purchaseUnitId = toTrimmedString(formData.get("purchaseUnitId"));
    const pricePerPurchaseUnit = toNonNegativeNumber(formData.get("pricePerPurchaseUnit"), "Precio por unidad de compra");
    const sourceType = toTrimmedString(formData.get("sourceType")) || "manual";
    const sourceRef = toTrimmedString(formData.get("sourceRef"));
    const validFrom = toTrimmedString(formData.get("validFrom"));
    const validUntil = toTrimmedString(formData.get("validUntil"));
    const notes = toTrimmedString(formData.get("notes"));
    const isCurrent = toTrimmedString(formData.get("isCurrent")) !== "off";
    if (!tenantSlug || !itemId || !supplierId || !purchaseUnitId) {
      return { ok: false, message: "Tenant, insumo, proveedor y unidad de compra son obligatorios." };
    }
    if (!["manual", "supplier_list", "quote", "invoice", "import"].includes(sourceType)) {
      return { ok: false, message: "Fuente de precio inválida." };
    }

    const { tenant, user } = await resolveKitchenInventoryManage(tenantSlug);
    await assertTenantScopedReference("kitchen_inventory_items", tenant.tenantId, itemId, "Insumo");
    await assertTenantScopedReference("kitchen_inventory_suppliers", tenant.tenantId, supplierId, "Proveedor");
    await assertTenantScopedReference("kitchen_inventory_units", tenant.tenantId, purchaseUnitId, "Unidad de compra");
    if (purchaseOptionId) {
      await assertTenantScopedReference("kitchen_inventory_purchase_options", tenant.tenantId, purchaseOptionId, "Opción de compra");
    }

    const supabase = await getSupabaseServerClient();
    if (isCurrent) {
      const { error: resetError } = await supabase
        .from("kitchen_inventory_supplier_prices")
        .update({ is_current: false })
        .eq("tenant_id", tenant.tenantId)
        .eq("item_id", itemId)
        .eq("supplier_id", supplierId)
        .eq("purchase_unit_id", purchaseUnitId)
        .eq("is_current", true);
      if (resetError) throw new Error(`No se pudo limpiar precio current previo: ${resetError.message}`);
    }

    const { error } = await supabase.from("kitchen_inventory_supplier_prices").insert({
      tenant_id: tenant.tenantId,
      item_id: itemId,
      supplier_id: supplierId,
      purchase_option_id: purchaseOptionId || null,
      purchase_unit_id: purchaseUnitId,
      price_per_purchase_unit: pricePerPurchaseUnit,
      source_type: sourceType,
      source_ref: sourceRef || null,
      valid_from: validFrom || null,
      valid_until: validUntil || null,
      is_current: isCurrent,
      notes: notes || null,
      created_by: user.id,
    });
    if (error) throw new Error(`No se pudo crear precio de proveedor: ${error.message}`);

    revalidateKitchenInventoryPaths(tenant.tenantSlug);
    revalidatePath(`/${tenant.tenantSlug}/kitchen/events/requisitions`);
    return { ok: true, message: "Precio de proveedor guardado." };
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : "No se pudo guardar precio de proveedor." };
  }
}

type PurchaseOptionCompatibilityInput = {
  tenantId: string;
  itemId: string;
  supplierId: string;
  purchaseUnitId: string;
  inventoryUnitId: string;
  quantityPerPurchaseUnit: number;
  minPurchaseQuantity: number;
  purchaseMultiple: number;
};

async function findCompatiblePurchaseOption(input: PurchaseOptionCompatibilityInput) {
  const supabase = await getSupabaseServerClient();
  const { data, error } = await supabase
    .from("kitchen_inventory_purchase_options")
    .select("id,is_active,is_default,created_at")
    .eq("tenant_id", input.tenantId)
    .eq("item_id", input.itemId)
    .eq("supplier_id", input.supplierId)
    .eq("purchase_unit_id", input.purchaseUnitId)
    .eq("inventory_unit_id", input.inventoryUnitId)
    .eq("quantity_per_purchase_unit", input.quantityPerPurchaseUnit)
    .eq("min_purchase_quantity", input.minPurchaseQuantity)
    .eq("purchase_multiple", input.purchaseMultiple)
    .order("is_default", { ascending: false })
    .order("created_at", { ascending: false });
  if (error) throw new Error(`No se pudo validar opción compatible: ${error.message}`);
  return (data ?? []) as Array<{ id: string; is_active: boolean; is_default: boolean; created_at: string }>;
}

export async function createUnifiedPurchaseOptionAndPriceAction(
  _previousState: KitchenInventoryActionState,
  formData: FormData,
): Promise<KitchenInventoryActionState> {
  try {
    const tenantSlug = toTrimmedString(formData.get("tenantSlug")).toLowerCase();
    const itemId = toTrimmedString(formData.get("itemId"));
    const supplierId = toTrimmedString(formData.get("supplierId"));
    const purchaseUnitId = toTrimmedString(formData.get("purchaseUnitId"));
    const inventoryUnitId = toTrimmedString(formData.get("inventoryUnitId"));
    const quantityPerPurchaseUnit = toPositiveNumber(formData.get("quantityPerPurchaseUnit"), "Cantidad por unidad de compra");
    const minPurchaseQuantity = toPositiveNumber(formData.get("minPurchaseQuantity"), "Mínimo de compra");
    const purchaseMultiple = toPositiveNumber(formData.get("purchaseMultiple"), "Múltiplo de compra");
    const pricePerPurchaseUnit = toNonNegativeNumber(formData.get("pricePerPurchaseUnit"), "Precio por unidad de compra");
    const sourceType = toTrimmedString(formData.get("sourceType")) || "manual";
    const sourceRef = toTrimmedString(formData.get("sourceRef"));
    const notes = toTrimmedString(formData.get("notes"));
    const isDefault = toTrimmedString(formData.get("isDefault")) === "on";
    const isCurrent = toTrimmedString(formData.get("isCurrent")) !== "off";

    if (!tenantSlug || !itemId || !supplierId || !purchaseUnitId || !inventoryUnitId) {
      return { ok: false, message: "Completa insumo, proveedor y unidades." };
    }
    if (!["manual", "supplier_list", "quote", "invoice", "import"].includes(sourceType)) {
      return { ok: false, message: "Fuente de precio inválida." };
    }

    const { tenant, user } = await resolveKitchenInventoryManage(tenantSlug);
    await assertTenantScopedReference("kitchen_inventory_items", tenant.tenantId, itemId, "Insumo");
    await assertTenantScopedReference("kitchen_inventory_suppliers", tenant.tenantId, supplierId, "Proveedor");
    await assertTenantScopedReference("kitchen_inventory_units", tenant.tenantId, purchaseUnitId, "Unidad de compra");
    await assertTenantScopedReference("kitchen_inventory_units", tenant.tenantId, inventoryUnitId, "Unidad de inventario");

    const supabase = await getSupabaseServerClient();

    const compatible = await findCompatiblePurchaseOption({
      tenantId: tenant.tenantId,
      itemId,
      supplierId,
      purchaseUnitId,
      inventoryUnitId,
      quantityPerPurchaseUnit,
      minPurchaseQuantity,
      purchaseMultiple,
    });

    const activeCompatible = compatible.find((row) => row.is_active);
    const inactiveCompatible = compatible.find((row) => !row.is_active);

    if (!activeCompatible && inactiveCompatible) {
      return {
        ok: false,
        message: "Existe una opción compatible inactiva. Reactívala o crea una variante distinta.",
      };
    }

    let purchaseOptionId = activeCompatible?.id ?? "";
    const reusedOption = Boolean(activeCompatible);

    if (!purchaseOptionId) {
      if (isDefault) {
        const { error: resetDefaultError } = await supabase
          .from("kitchen_inventory_purchase_options")
          .update({ is_default: false })
          .eq("tenant_id", tenant.tenantId)
          .eq("item_id", itemId)
          .eq("supplier_id", supplierId)
          .eq("is_active", true);
        if (resetDefaultError) throw new Error(`No se pudo reasignar opción default: ${resetDefaultError.message}`);
      }

      const { data: optionRow, error: optionInsertError } = await supabase
        .from("kitchen_inventory_purchase_options")
        .insert({
          tenant_id: tenant.tenantId,
          item_id: itemId,
          supplier_id: supplierId,
          purchase_unit_id: purchaseUnitId,
          inventory_unit_id: inventoryUnitId,
          quantity_per_purchase_unit: quantityPerPurchaseUnit,
          min_purchase_quantity: minPurchaseQuantity,
          purchase_multiple: purchaseMultiple,
          is_default: isDefault,
          is_active: true,
          notes: notes || null,
          created_by: user.id,
        })
        .select("id")
        .single();
      if (optionInsertError || !optionRow) throw new Error(`No se pudo crear opción de compra: ${optionInsertError?.message}`);
      purchaseOptionId = optionRow.id;
    } else if (isDefault) {
      const { error: resetDefaultError } = await supabase
        .from("kitchen_inventory_purchase_options")
        .update({ is_default: false })
        .eq("tenant_id", tenant.tenantId)
        .eq("item_id", itemId)
        .eq("supplier_id", supplierId)
        .eq("is_active", true);
      if (resetDefaultError) throw new Error(`No se pudo limpiar default previo: ${resetDefaultError.message}`);
      const { error: setDefaultError } = await supabase
        .from("kitchen_inventory_purchase_options")
        .update({ is_default: true })
        .eq("tenant_id", tenant.tenantId)
        .eq("id", purchaseOptionId);
      if (setDefaultError) throw new Error(`No se pudo marcar opción default: ${setDefaultError.message}`);
    }

    if (isCurrent) {
      const { error: resetCurrentError } = await supabase
        .from("kitchen_inventory_supplier_prices")
        .update({ is_current: false })
        .eq("tenant_id", tenant.tenantId)
        .eq("item_id", itemId)
        .eq("supplier_id", supplierId)
        .eq("purchase_unit_id", purchaseUnitId)
        .eq("is_current", true);
      if (resetCurrentError) throw new Error(`No se pudo limpiar precio current previo: ${resetCurrentError.message}`);
    }

    const { error: priceInsertError } = await supabase.from("kitchen_inventory_supplier_prices").insert({
      tenant_id: tenant.tenantId,
      item_id: itemId,
      supplier_id: supplierId,
      purchase_option_id: purchaseOptionId,
      purchase_unit_id: purchaseUnitId,
      price_per_purchase_unit: pricePerPurchaseUnit,
      source_type: sourceType,
      source_ref: sourceRef || null,
      is_current: isCurrent,
      notes: notes || null,
      created_by: user.id,
    });
    if (priceInsertError) throw new Error(`No se pudo guardar precio proveedor: ${priceInsertError.message}`);

    revalidateKitchenInventoryPaths(tenant.tenantSlug);
    revalidatePath(`/${tenant.tenantSlug}/kitchen/events/requisitions`);
    return {
      ok: true,
      message: reusedOption
        ? "Se usó opción existente y se guardó precio proveedor."
        : "Opción de compra y precio proveedor guardados.",
    };
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error ? error.message : "No se pudo guardar configuración unificada.",
    };
  }
}

export async function updateSupplierPriceAction(
  _previousState: KitchenInventoryActionState,
  formData: FormData,
): Promise<KitchenInventoryActionState> {
  try {
    const tenantSlug = toTrimmedString(formData.get("tenantSlug")).toLowerCase();
    const priceId = toTrimmedString(formData.get("priceId"));
    const pricePerPurchaseUnit = toNonNegativeNumber(formData.get("pricePerPurchaseUnit"), "Precio por unidad de compra");
    const sourceRef = toTrimmedString(formData.get("sourceRef"));
    const notes = toTrimmedString(formData.get("notes"));
    if (!tenantSlug || !priceId) return { ok: false, message: "Tenant y precio son obligatorios." };
    const { tenant } = await resolveKitchenInventoryManage(tenantSlug);
    const supabase = await getSupabaseServerClient();
    const { error } = await supabase
      .from("kitchen_inventory_supplier_prices")
      .update({
        price_per_purchase_unit: pricePerPurchaseUnit,
        source_ref: sourceRef || null,
        notes: notes || null,
      })
      .eq("tenant_id", tenant.tenantId)
      .eq("id", priceId);
    if (error) throw new Error(`No se pudo actualizar precio proveedor: ${error.message}`);
    revalidateKitchenInventoryPaths(tenant.tenantSlug);
    revalidatePath(`/${tenant.tenantSlug}/kitchen/events/requisitions`);
    return { ok: true, message: "Precio proveedor actualizado." };
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : "No se pudo actualizar precio proveedor." };
  }
}

export async function setCurrentSupplierPriceAction(
  _previousState: KitchenInventoryActionState,
  formData: FormData,
): Promise<KitchenInventoryActionState> {
  try {
    const tenantSlug = toTrimmedString(formData.get("tenantSlug")).toLowerCase();
    const priceId = toTrimmedString(formData.get("priceId"));
    if (!tenantSlug || !priceId) return { ok: false, message: "Tenant y precio son obligatorios." };
    const { tenant } = await resolveKitchenInventoryManage(tenantSlug);
    const supabase = await getSupabaseServerClient();
    const { data: row, error: rowError } = await supabase
      .from("kitchen_inventory_supplier_prices")
      .select("id,item_id,supplier_id,purchase_unit_id")
      .eq("tenant_id", tenant.tenantId)
      .eq("id", priceId)
      .maybeSingle();
    if (rowError || !row) throw new Error("Precio proveedor inválido para el tenant.");

    const { error: resetError } = await supabase
      .from("kitchen_inventory_supplier_prices")
      .update({ is_current: false })
      .eq("tenant_id", tenant.tenantId)
      .eq("item_id", row.item_id)
      .eq("supplier_id", row.supplier_id)
      .eq("purchase_unit_id", row.purchase_unit_id)
      .eq("is_current", true);
    if (resetError) throw new Error(`No se pudo limpiar precio current previo: ${resetError.message}`);

    const { error } = await supabase
      .from("kitchen_inventory_supplier_prices")
      .update({ is_current: true })
      .eq("tenant_id", tenant.tenantId)
      .eq("id", row.id);
    if (error) throw new Error(`No se pudo marcar precio current: ${error.message}`);

    revalidateKitchenInventoryPaths(tenant.tenantSlug);
    revalidatePath(`/${tenant.tenantSlug}/kitchen/events/requisitions`);
    return { ok: true, message: "Precio current actualizado." };
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : "No se pudo actualizar precio current." };
  }
}

export async function saveKitchenInventoryQuickFixAction(
  _previousState: KitchenInventoryActionState,
  formData: FormData,
): Promise<KitchenInventoryActionState> {
  try {
    const tenantSlug = toTrimmedString(formData.get("tenantSlug")).toLowerCase();
    const itemId = toTrimmedString(formData.get("itemId"));
    const categoryId = toTrimmedString(formData.get("categoryId"));
    const supplierId = toTrimmedString(formData.get("defaultSupplierId"));
    const currentUnitCost = toNonNegativeNumber(formData.get("currentUnitCost"), "El costo unitario");
    const defaultPurchaseOptionId = toTrimmedString(formData.get("defaultPurchaseOptionId"));
    const pricePerPurchaseUnitRaw = toTrimmedString(formData.get("pricePerPurchaseUnit"));
    const createPurchaseOption = toTrimmedString(formData.get("createPurchaseOption")) === "on";
    const createPurchaseUnitId = toTrimmedString(formData.get("createPurchaseUnitId"));
    const createQuantityPerPurchaseUnitRaw = toTrimmedString(formData.get("createQuantityPerPurchaseUnit"));
    const createMinPurchaseQuantityRaw = toTrimmedString(formData.get("createMinPurchaseQuantity"));
    const createPurchaseMultipleRaw = toTrimmedString(formData.get("createPurchaseMultiple"));
    const createNotes = toTrimmedString(formData.get("createPurchaseOptionNotes"));
    const createIsDefault = toTrimmedString(formData.get("createPurchaseOptionIsDefault")) === "on";
    const reactivateCompatibleOptionId = toTrimmedString(formData.get("reactivateCompatibleOption"));
    const confirmReplaceCurrentPrice = toTrimmedString(formData.get("confirmReplaceCurrentPrice")) === "on";

    if (!tenantSlug || !itemId) {
      return { ok: false, message: "Tenant e insumo son obligatorios." };
    }

    const { tenant, user } = await resolveKitchenInventoryManage(tenantSlug);
    await assertTenantScopedReference("kitchen_inventory_items", tenant.tenantId, itemId, "Insumo");
    if (categoryId) {
      await assertTenantScopedReference("kitchen_inventory_categories", tenant.tenantId, categoryId, "Categoría");
    }
    if (supplierId) {
      await assertTenantScopedReference("kitchen_inventory_suppliers", tenant.tenantId, supplierId, "Proveedor");
    }
    if (defaultPurchaseOptionId) {
      await assertTenantScopedReference(
        "kitchen_inventory_purchase_options",
        tenant.tenantId,
        defaultPurchaseOptionId,
        "Opción de compra",
      );
    }
    if (createPurchaseOption && createPurchaseUnitId) {
      await assertTenantScopedReference("kitchen_inventory_units", tenant.tenantId, createPurchaseUnitId, "Unidad de compra");
    }

    const supabase = await getSupabaseServerClient();

    const { data: itemRow, error: itemError } = await supabase
      .from("kitchen_inventory_items")
      .select("id,default_unit_id,default_supplier_id")
      .eq("tenant_id", tenant.tenantId)
      .eq("id", itemId)
      .maybeSingle();
    if (itemError || !itemRow) {
      throw new Error("No se pudo cargar el insumo.");
    }

    let selectedPurchaseOption:
      | {
          id: string;
          item_id: string;
          supplier_id: string | null;
          purchase_unit_id: string;
          is_active: boolean;
          is_default: boolean;
        }
      | null = null;

    if (defaultPurchaseOptionId) {
      const { data: optionRow, error: optionError } = await supabase
        .from("kitchen_inventory_purchase_options")
        .select("id,item_id,supplier_id,purchase_unit_id,is_active,is_default")
        .eq("tenant_id", tenant.tenantId)
        .eq("id", defaultPurchaseOptionId)
        .maybeSingle();
      if (optionError || !optionRow) {
        throw new Error("Opción de compra inválida para el tenant.");
      }
      if (optionRow.item_id !== itemId) {
        throw new Error("La opción de compra no pertenece al insumo seleccionado.");
      }
      if (!optionRow.is_active) {
        throw new Error("La opción de compra debe estar activa para usarse como default.");
      }
      selectedPurchaseOption = optionRow;
    }

    const resolvedSupplierId = supplierId || null;
    if (selectedPurchaseOption?.supplier_id && resolvedSupplierId && selectedPurchaseOption.supplier_id !== resolvedSupplierId) {
      throw new Error("La opción de compra no coincide con el proveedor default seleccionado.");
    }

    const { error: itemUpdateError } = await supabase
      .from("kitchen_inventory_items")
      .update({
        category_id: categoryId || null,
        default_supplier_id: resolvedSupplierId,
        current_unit_cost: currentUnitCost,
      })
      .eq("tenant_id", tenant.tenantId)
      .eq("id", itemId);
    if (itemUpdateError) {
      throw new Error(`No se pudo actualizar datos básicos del insumo: ${itemUpdateError.message}`);
    }

    if (selectedPurchaseOption) {
      let resetDefault = supabase
        .from("kitchen_inventory_purchase_options")
        .update({ is_default: false })
        .eq("tenant_id", tenant.tenantId)
        .eq("item_id", itemId)
        .eq("is_active", true);
      if (selectedPurchaseOption.supplier_id) {
        resetDefault = resetDefault.eq("supplier_id", selectedPurchaseOption.supplier_id);
      } else {
        resetDefault = resetDefault.is("supplier_id", null);
      }
      const { error: resetDefaultError } = await resetDefault;
      if (resetDefaultError) {
        throw new Error(`No se pudo limpiar opción de compra default previa: ${resetDefaultError.message}`);
      }

      const { error: setDefaultError } = await supabase
        .from("kitchen_inventory_purchase_options")
        .update({ is_default: true })
        .eq("tenant_id", tenant.tenantId)
        .eq("id", selectedPurchaseOption.id);
      if (setDefaultError) {
        throw new Error(`No se pudo actualizar opción de compra default: ${setDefaultError.message}`);
      }
    }

    if (createPurchaseOption) {
      if (!resolvedSupplierId) {
        throw new Error("Para crear presentación de compra, primero define proveedor default.");
      }
      if (!itemRow.default_unit_id) {
        throw new Error("No se encontró unidad base del insumo para crear presentación de compra.");
      }
      if (!createPurchaseUnitId) {
        throw new Error("Selecciona unidad de compra para crear la presentación.");
      }

      const quantityPerPurchaseUnit = toPositiveNumber(
        createQuantityPerPurchaseUnitRaw,
        "Cantidad por unidad de compra",
      );
      const minPurchaseQuantity = toPositiveNumber(
        createMinPurchaseQuantityRaw || "1",
        "Mínimo de compra",
      );
      const purchaseMultiple = toPositiveNumber(
        createPurchaseMultipleRaw || "1",
        "Múltiplo de compra",
      );

      const { data: compatibleRows, error: compatibleError } = await supabase
        .from("kitchen_inventory_purchase_options")
        .select("id,is_active,is_default")
        .eq("tenant_id", tenant.tenantId)
        .eq("item_id", itemId)
        .eq("supplier_id", resolvedSupplierId)
        .eq("purchase_unit_id", createPurchaseUnitId)
        .eq("inventory_unit_id", itemRow.default_unit_id)
        .eq("quantity_per_purchase_unit", quantityPerPurchaseUnit)
        .eq("min_purchase_quantity", minPurchaseQuantity)
        .eq("purchase_multiple", purchaseMultiple)
        .order("is_default", { ascending: false })
        .order("created_at", { ascending: false });

      if (compatibleError) {
        throw new Error(`No se pudo validar presentación de compra compatible: ${compatibleError.message}`);
      }

      const activeCompatible = (compatibleRows ?? []).find((row) => row.is_active);
      const inactiveCompatible = (compatibleRows ?? []).find((row) => !row.is_active);

      if (!activeCompatible) {
        if (inactiveCompatible) {
          if (!reactivateCompatibleOptionId || reactivateCompatibleOptionId !== inactiveCompatible.id) {
            throw new Error("Existe una presentación compatible inactiva. Confirma reactivarla desde el drawer.");
          }
          const { error: reactivateError } = await supabase
            .from("kitchen_inventory_purchase_options")
            .update({ is_active: true })
            .eq("tenant_id", tenant.tenantId)
            .eq("id", inactiveCompatible.id);
          if (reactivateError) {
            throw new Error(`No se pudo reactivar presentación compatible: ${reactivateError.message}`);
          }
          selectedPurchaseOption = {
            ...inactiveCompatible,
            item_id: itemId,
            supplier_id: resolvedSupplierId,
            purchase_unit_id: createPurchaseUnitId,
          };
          if (createIsDefault) {
            const { error: resetDefaultError } = await supabase
              .from("kitchen_inventory_purchase_options")
              .update({ is_default: false })
              .eq("tenant_id", tenant.tenantId)
              .eq("item_id", itemId)
              .eq("supplier_id", resolvedSupplierId)
              .eq("is_active", true);
            if (resetDefaultError) {
              throw new Error(`No se pudo limpiar presentación default previa: ${resetDefaultError.message}`);
            }
            const { error: setDefaultError } = await supabase
              .from("kitchen_inventory_purchase_options")
              .update({ is_default: true })
              .eq("tenant_id", tenant.tenantId)
              .eq("id", inactiveCompatible.id);
            if (setDefaultError) {
              throw new Error(`No se pudo marcar presentación default reactivada: ${setDefaultError.message}`);
            }
          }
        } else {
          if (createIsDefault) {
            const { error: resetDefaultError } = await supabase
              .from("kitchen_inventory_purchase_options")
            .update({ is_default: false })
            .eq("tenant_id", tenant.tenantId)
            .eq("item_id", itemId)
            .eq("supplier_id", resolvedSupplierId)
            .eq("is_active", true);
          if (resetDefaultError) {
            throw new Error(`No se pudo limpiar presentación default previa: ${resetDefaultError.message}`);
          }
        }

        const { data: createdOption, error: createOptionError } = await supabase
          .from("kitchen_inventory_purchase_options")
          .insert({
            tenant_id: tenant.tenantId,
            item_id: itemId,
            supplier_id: resolvedSupplierId,
            purchase_unit_id: createPurchaseUnitId,
            inventory_unit_id: itemRow.default_unit_id,
            quantity_per_purchase_unit: quantityPerPurchaseUnit,
            min_purchase_quantity: minPurchaseQuantity,
            purchase_multiple: purchaseMultiple,
            is_default: createIsDefault,
            notes: createNotes || null,
            created_by: user.id,
          })
          .select("id,item_id,supplier_id,purchase_unit_id,is_active,is_default")
          .single();
        if (createOptionError || !createdOption) {
          throw new Error(`No se pudo crear presentación de compra: ${createOptionError?.message}`);
        }
        selectedPurchaseOption = createdOption;
        }
      } else {
        selectedPurchaseOption = {
          ...activeCompatible,
          item_id: itemId,
          supplier_id: resolvedSupplierId,
          purchase_unit_id: createPurchaseUnitId,
        };
        if (createIsDefault) {
          const { error: resetDefaultError } = await supabase
            .from("kitchen_inventory_purchase_options")
            .update({ is_default: false })
            .eq("tenant_id", tenant.tenantId)
            .eq("item_id", itemId)
            .eq("supplier_id", resolvedSupplierId)
            .eq("is_active", true);
          if (resetDefaultError) {
            throw new Error(`No se pudo limpiar presentación default previa: ${resetDefaultError.message}`);
          }
          const { error: setDefaultError } = await supabase
            .from("kitchen_inventory_purchase_options")
            .update({ is_default: true })
            .eq("tenant_id", tenant.tenantId)
            .eq("id", activeCompatible.id);
          if (setDefaultError) {
            throw new Error(`No se pudo marcar presentación default: ${setDefaultError.message}`);
          }
        }
      }
    }

    if (pricePerPurchaseUnitRaw) {
      if (!selectedPurchaseOption) {
        throw new Error("Para guardar precio vigente, primero selecciona opción de compra default.");
      }
      if (!resolvedSupplierId) {
        throw new Error("Para guardar precio vigente, primero define proveedor default.");
      }
      const pricePerPurchaseUnit = toNonNegativeNumber(pricePerPurchaseUnitRaw, "El precio proveedor");

      const { data: previousCurrentRows, error: previousCurrentError } = await supabase
        .from("kitchen_inventory_supplier_prices")
        .select("id")
        .eq("tenant_id", tenant.tenantId)
        .eq("item_id", itemId)
        .eq("supplier_id", resolvedSupplierId)
        .eq("purchase_unit_id", selectedPurchaseOption.purchase_unit_id)
        .eq("is_current", true);
      if (previousCurrentError) {
        throw new Error(`No se pudo validar precio current previo: ${previousCurrentError.message}`);
      }
      if ((previousCurrentRows ?? []).length > 0 && !confirmReplaceCurrentPrice) {
        throw new Error("Confirma reemplazar el precio vigente para continuar.");
      }

      const { error: resetCurrentError } = await supabase
        .from("kitchen_inventory_supplier_prices")
        .update({ is_current: false })
        .eq("tenant_id", tenant.tenantId)
        .eq("item_id", itemId)
        .eq("supplier_id", resolvedSupplierId)
        .eq("purchase_unit_id", selectedPurchaseOption.purchase_unit_id)
        .eq("is_current", true);
      if (resetCurrentError) {
        throw new Error(`No se pudo limpiar precio proveedor current previo: ${resetCurrentError.message}`);
      }

      const { error: insertPriceError } = await supabase
        .from("kitchen_inventory_supplier_prices")
        .insert({
          tenant_id: tenant.tenantId,
          item_id: itemId,
          supplier_id: resolvedSupplierId,
          purchase_option_id: selectedPurchaseOption.id,
          purchase_unit_id: selectedPurchaseOption.purchase_unit_id,
          price_per_purchase_unit: pricePerPurchaseUnit,
          source_type: "manual",
          source_ref: "quick_fix_drawer",
          is_current: true,
          notes: "Actualizado desde Data Quality (corrección rápida).",
          created_by: user.id,
        });
      if (insertPriceError) {
        throw new Error(`No se pudo guardar precio proveedor current: ${insertPriceError.message}`);
      }
    }

    revalidateKitchenInventoryPaths(tenant.tenantSlug);
    revalidatePath(`/${tenant.tenantSlug}/kitchen/events/requisitions`);
    revalidatePath(`/${tenant.tenantSlug}/kitchen/inventory/presentaciones-precios`);
    return { ok: true, message: "Corrección rápida guardada." };
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : "No se pudo guardar la corrección rápida." };
  }
}

export async function normalizeKitchenInventoryItemUnitAction(
  _previousState: KitchenInventoryActionState,
  formData: FormData,
): Promise<KitchenInventoryActionState> {
  try {
    const tenantSlug = toTrimmedString(formData.get("tenantSlug")).toLowerCase();
    const itemId = toTrimmedString(formData.get("itemId"));
    const nextDefaultUnitId = toTrimmedString(formData.get("nextDefaultUnitId"));
    const nextCurrentUnitCostRaw = toTrimmedString(formData.get("nextCurrentUnitCost"));
    const alignDefaultPurchaseOption = toTrimmedString(formData.get("alignDefaultPurchaseOption")) === "on";
    const forceHistoricalConfirm = toTrimmedString(formData.get("confirmHistoricalImpact")) === "on";
    const forcePhrase = toTrimmedString(formData.get("confirmHistoricalPhrase"));

    if (!tenantSlug || !itemId || !nextDefaultUnitId) {
      return { ok: false, message: "Tenant, insumo y nueva unidad base son obligatorios." };
    }

    const { tenant } = await resolveKitchenInventoryManage(tenantSlug);
    await assertTenantScopedReference("kitchen_inventory_items", tenant.tenantId, itemId, "Insumo");
    await assertTenantScopedReference("kitchen_inventory_units", tenant.tenantId, nextDefaultUnitId, "Nueva unidad base");

    const supabase = await getSupabaseServerClient();
    const [{ data: itemRow, error: itemError }, { data: defaultOption, error: optionError }, { data: currentPrice, error: priceError }] =
      await Promise.all([
        supabase
          .from("kitchen_inventory_items")
          .select("id,default_unit_id,current_unit_cost")
          .eq("tenant_id", tenant.tenantId)
          .eq("id", itemId)
          .maybeSingle(),
        supabase
          .from("kitchen_inventory_purchase_options")
          .select("id,item_id,inventory_unit_id,quantity_per_purchase_unit,is_active,is_default")
          .eq("tenant_id", tenant.tenantId)
          .eq("item_id", itemId)
          .eq("is_active", true)
          .eq("is_default", true)
          .limit(1)
          .maybeSingle(),
        supabase
          .from("kitchen_inventory_supplier_prices")
          .select("id,item_id,price_per_purchase_unit,purchase_option_id,is_current")
          .eq("tenant_id", tenant.tenantId)
          .eq("item_id", itemId)
          .eq("is_current", true)
          .order("updated_at", { ascending: false })
          .limit(1)
          .maybeSingle(),
      ]);
    if (itemError || !itemRow) throw new Error("No se pudo cargar el insumo a normalizar.");
    if (optionError) throw new Error(`No se pudo cargar opción default: ${optionError.message}`);
    if (priceError) throw new Error(`No se pudo cargar precio current: ${priceError.message}`);

    const [{ count: balanceCount, error: balanceError }, { count: movementCount, error: movementError }, { count: recipeLineCount, error: recipeError }] =
      await Promise.all([
        supabase.from("kitchen_inventory_balances").select("*", { count: "exact", head: true }).eq("tenant_id", tenant.tenantId).eq("item_id", itemId),
        supabase.from("kitchen_inventory_movements").select("*", { count: "exact", head: true }).eq("tenant_id", tenant.tenantId).eq("item_id", itemId),
        supabase.from("kitchen_recipe_lines").select("*", { count: "exact", head: true }).eq("tenant_id", tenant.tenantId).eq("item_id", itemId),
      ]);
    if (balanceError) throw new Error(`No se pudo validar balances: ${balanceError.message}`);
    if (movementError) throw new Error(`No se pudo validar movimientos: ${movementError.message}`);
    if (recipeError) throw new Error(`No se pudo validar recetas: ${recipeError.message}`);

    const hasHistoricalImpact = (balanceCount ?? 0) > 0 || (movementCount ?? 0) > 0 || (recipeLineCount ?? 0) > 0;
    if (hasHistoricalImpact) {
      if (!forceHistoricalConfirm) {
        throw new Error("Confirma impacto histórico para cambiar unidad base.");
      }
      if (forcePhrase !== "NORMALIZAR UNIDAD") {
        throw new Error("Escribe la frase exacta NORMALIZAR UNIDAD para continuar.");
      }
    }

    let nextCurrentUnitCost: number | null = null;
    if (nextCurrentUnitCostRaw) {
      nextCurrentUnitCost = toNonNegativeNumber(nextCurrentUnitCostRaw, "Costo unitario nuevo");
    } else if (
      currentPrice &&
      defaultOption &&
      defaultOption.quantity_per_purchase_unit != null &&
      Number(defaultOption.quantity_per_purchase_unit) > 0
    ) {
      nextCurrentUnitCost = Number(currentPrice.price_per_purchase_unit) / Number(defaultOption.quantity_per_purchase_unit);
    }

    const itemPayload: { default_unit_id: string; current_unit_cost?: number } = {
      default_unit_id: nextDefaultUnitId,
    };
    if (nextCurrentUnitCost != null) itemPayload.current_unit_cost = nextCurrentUnitCost;

    const { error: updateItemError } = await supabase
      .from("kitchen_inventory_items")
      .update(itemPayload)
      .eq("tenant_id", tenant.tenantId)
      .eq("id", itemId);
    if (updateItemError) throw new Error(`No se pudo actualizar unidad base del insumo: ${updateItemError.message}`);

    if (alignDefaultPurchaseOption && defaultOption) {
      const { error: alignOptionError } = await supabase
        .from("kitchen_inventory_purchase_options")
        .update({ inventory_unit_id: nextDefaultUnitId })
        .eq("tenant_id", tenant.tenantId)
        .eq("id", defaultOption.id)
        .eq("item_id", itemId);
      if (alignOptionError) {
        throw new Error(`No se pudo alinear unidad inventario de opción default: ${alignOptionError.message}`);
      }
    }

    revalidateKitchenInventoryPaths(tenant.tenantSlug);
    revalidatePath(`/${tenant.tenantSlug}/kitchen/inventory/presentaciones-precios`);
    return { ok: true, message: "Unidad base normalizada desde Data Quality." };
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : "No se pudo normalizar unidad base." };
  }
}


export async function deactivateSupplierPriceAction(
  _previousState: KitchenInventoryActionState,
  formData: FormData,
): Promise<KitchenInventoryActionState> {
  try {
    const tenantSlug = toTrimmedString(formData.get("tenantSlug")).toLowerCase();
    const priceId = toTrimmedString(formData.get("priceId"));
    if (!tenantSlug || !priceId) return { ok: false, message: "Tenant y precio son obligatorios." };
    const { tenant } = await resolveKitchenInventoryManage(tenantSlug);
    const supabase = await getSupabaseServerClient();
    const { error } = await supabase
      .from("kitchen_inventory_supplier_prices")
      .update({ is_current: false, valid_until: new Date().toISOString().slice(0, 10) })
      .eq("tenant_id", tenant.tenantId)
      .eq("id", priceId);
    if (error) throw new Error(`No se pudo desactivar precio proveedor: ${error.message}`);
    revalidateKitchenInventoryPaths(tenant.tenantSlug);
    revalidatePath(`/${tenant.tenantSlug}/kitchen/events/requisitions`);
    return { ok: true, message: "Precio proveedor desactivado." };
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : "No se pudo desactivar precio proveedor." };
  }
}
