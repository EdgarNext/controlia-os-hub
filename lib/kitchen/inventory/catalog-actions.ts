"use server";

import { revalidatePath } from "next/cache";
import { resolveTenantModulePageActor } from "@/lib/auth/module-page-access";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { normalizeKitchenName } from "./normalizers";

export type KitchenCatalogActionState = { ok: boolean; message: string; itemId?: string; duplicateItemId?: string };

const value = (formData: FormData, key: string) => String(formData.get(key) ?? "").trim();

async function access(tenantSlug: string) {
  return resolveTenantModulePageActor(tenantSlug.toLowerCase(), "kitchen_inventory", "items", "manage");
}

function revalidate(tenantSlug: string, itemId?: string) {
  revalidatePath(`/${tenantSlug}/kitchen/catalog`);
  revalidatePath(`/${tenantSlug}/kitchen/inventory/items`);
  revalidatePath(`/${tenantSlug}/kitchen/inventory/data-quality`);
  if (itemId) revalidatePath(`/${tenantSlug}/kitchen/catalog/${itemId}`);
}

async function assertReference(table: string, tenantId: string, id: string, label: string) {
  const supabase = await getSupabaseServerClient();
  const { data, error } = await supabase.from(table).select("id").eq("tenant_id", tenantId).eq("id", id).maybeSingle();
  if (error || !data) throw new Error(`${label} inválido para el tenant.`);
}

export async function createKitchenCatalogItemAction(_previous: KitchenCatalogActionState, formData: FormData): Promise<KitchenCatalogActionState> {
  try {
    const tenantSlug = value(formData, "tenantSlug");
    const name = value(formData, "name");
    const defaultUnitId = value(formData, "defaultUnitId");
    if (!tenantSlug || !name || !defaultUnitId) return { ok: false, message: "Nombre y unidad operativa son obligatorios." };
    const { tenant, user } = await access(tenantSlug);
    const supabase = await getSupabaseServerClient();
    const normalizedName = normalizeKitchenName(name);
    const duplicate = await supabase.from("kitchen_inventory_items").select("id").eq("tenant_id", tenant.tenantId).eq("normalized_name", normalizedName).maybeSingle();
    if (duplicate.error) throw duplicate.error;
    if (duplicate.data) return { ok: false, message: "Ya existe un insumo con ese nombre.", duplicateItemId: duplicate.data.id };
    await assertReference("kitchen_inventory_units", tenant.tenantId, defaultUnitId, "La unidad");
    const categoryId = value(formData, "categoryId");
    if (categoryId) await assertReference("kitchen_inventory_categories", tenant.tenantId, categoryId, "La categoría");
    const { data, error } = await supabase.from("kitchen_inventory_items").insert({
      tenant_id: tenant.tenantId, name, normalized_name: normalizedName, default_unit_id: defaultUnitId,
      category_id: categoryId || null, description: value(formData, "description") || null,
      current_unit_cost: 0, standard_unit_cost: null, is_perishable: false, created_by: user.id,
    }).select("id").single();
    if (error) throw error;
    revalidate(tenant.tenantSlug, data.id);
    return { ok: true, message: "Insumo creado. Ahora puedes configurar su proveedor, presentación y precio.", itemId: data.id };
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : "No se pudo crear el insumo." };
  }
}

export async function updateKitchenCatalogItemAction(_previous: KitchenCatalogActionState, formData: FormData): Promise<KitchenCatalogActionState> {
  try {
    const tenantSlug = value(formData, "tenantSlug"); const itemId = value(formData, "itemId"); const name = value(formData, "name"); const unitId = value(formData, "defaultUnitId");
    if (!tenantSlug || !itemId || !name || !unitId) return { ok: false, message: "Nombre y unidad operativa son obligatorios." };
    const { tenant } = await access(tenantSlug); const supabase = await getSupabaseServerClient();
    const current = await supabase.from("kitchen_inventory_items").select("id,default_unit_id").eq("tenant_id", tenant.tenantId).eq("id", itemId).maybeSingle();
    if (current.error || !current.data) return { ok: false, message: "El insumo no existe para este tenant." };
    const normalizedName = normalizeKitchenName(name);
    const duplicate = await supabase.from("kitchen_inventory_items").select("id").eq("tenant_id", tenant.tenantId).eq("normalized_name", normalizedName).neq("id", itemId).maybeSingle();
    if (duplicate.error) throw duplicate.error;
    if (duplicate.data) return { ok: false, message: "Ya existe otro insumo con ese nombre.", duplicateItemId: duplicate.data.id };
    await assertReference("kitchen_inventory_units", tenant.tenantId, unitId, "La unidad");
    const categoryId = value(formData, "categoryId"); if (categoryId) await assertReference("kitchen_inventory_categories", tenant.tenantId, categoryId, "La categoría");
    if (unitId !== current.data.default_unit_id) {
      const checks = await Promise.all([
        supabase.from("kitchen_recipe_lines").select("id", { count: "exact", head: true }).eq("tenant_id", tenant.tenantId).eq("item_id", itemId),
        supabase.from("kitchen_inventory_movements").select("id", { count: "exact", head: true }).eq("tenant_id", tenant.tenantId).eq("item_id", itemId),
        supabase.from("kitchen_inventory_balances").select("item_id", { count: "exact", head: true }).eq("tenant_id", tenant.tenantId).eq("item_id", itemId),
        supabase.from("kitchen_inventory_purchase_options").select("id", { count: "exact", head: true }).eq("tenant_id", tenant.tenantId).eq("item_id", itemId),
        supabase.from("kitchen_inventory_supplier_prices").select("id", { count: "exact", head: true }).eq("tenant_id", tenant.tenantId).eq("item_id", itemId),
        supabase.from("kitchen_inventory_price_history").select("id", { count: "exact", head: true }).eq("tenant_id", tenant.tenantId).eq("item_id", itemId),
        supabase.from("event_catering_requirements").select("id", { count: "exact", head: true }).eq("tenant_id", tenant.tenantId).eq("item_id", itemId),
      ]);
      if (checks.some((check) => check.error)) throw new Error("No se pudo validar el historial del insumo.");
      if (checks.some((check) => (check.count ?? 0) > 0)) return { ok: false, message: "La unidad no puede modificarse porque este insumo ya se utiliza o tiene historial." };
    }
    const { error } = await supabase.from("kitchen_inventory_items").update({ name, normalized_name: normalizedName, default_unit_id: unitId, category_id: categoryId || null, description: value(formData, "description") || null }).eq("tenant_id", tenant.tenantId).eq("id", itemId);
    if (error) throw error; revalidate(tenant.tenantSlug, itemId); return { ok: true, message: "Datos del insumo actualizados.", itemId };
  } catch (error) { return { ok: false, message: error instanceof Error ? error.message : "No se pudo actualizar el insumo." }; }
}
