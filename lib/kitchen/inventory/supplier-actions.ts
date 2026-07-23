"use server";

import { revalidatePath } from "next/cache";
import { resolveTenantModulePageActor } from "@/lib/auth/module-page-access";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { normalizeKitchenName } from "./normalizers";
import type { KitchenInventoryActionState } from "./actions";

const value = (formData: FormData, key: string) => String(formData.get(key) ?? "").trim();
async function access(tenantSlug: string) { return resolveTenantModulePageActor(tenantSlug.toLowerCase(), "kitchen_inventory", "suppliers", "manage"); }
function revalidate(tenantSlug: string, supplierId?: string) {
  revalidatePath(`/${tenantSlug}/kitchen/catalog/providers`);
  revalidatePath(`/${tenantSlug}/kitchen/catalog`);
  if (supplierId) revalidatePath(`/${tenantSlug}/kitchen/catalog/providers/${supplierId}`);
}

export async function updateKitchenInventorySupplierAction(_previous: KitchenInventoryActionState, formData: FormData): Promise<KitchenInventoryActionState> {
  try {
    const tenantSlug = value(formData, "tenantSlug"); const supplierId = value(formData, "supplierId"); const name = value(formData, "name");
    if (!tenantSlug || !supplierId || !name) return { ok: false, message: "Nombre del proveedor es obligatorio." };
    const { tenant } = await access(tenantSlug); const supabase = await getSupabaseServerClient(); const normalizedName = normalizeKitchenName(name);
    const duplicate = await supabase.from("kitchen_inventory_suppliers").select("id").eq("tenant_id", tenant.tenantId).eq("normalized_name", normalizedName).neq("id", supplierId).maybeSingle();
    if (duplicate.error) throw duplicate.error;
    if (duplicate.data) return { ok: false, message: "Ya existe otro proveedor con este nombre.", duplicateSupplierId: duplicate.data.id };
    const { error } = await supabase.from("kitchen_inventory_suppliers").update({ name, normalized_name: normalizedName, contact_name: value(formData, "contactName") || null, phone: value(formData, "phone") || null, email: value(formData, "email") || null, notes: value(formData, "notes") || null }).eq("tenant_id", tenant.tenantId).eq("id", supplierId);
    if (error) throw error; revalidate(tenant.tenantSlug, supplierId); return { ok: true, message: "Proveedor actualizado.", supplierId };
  } catch (error) { return { ok: false, message: error instanceof Error ? error.message : "No se pudo actualizar el proveedor." }; }
}

export async function setKitchenInventorySupplierActiveAction(_previous: KitchenInventoryActionState, formData: FormData): Promise<KitchenInventoryActionState> {
  try {
    const tenantSlug = value(formData, "tenantSlug"); const supplierId = value(formData, "supplierId"); const nextActive = value(formData, "nextActive") === "true";
    if (!tenantSlug || !supplierId) return { ok: false, message: "Proveedor inválido." };
    const { tenant } = await access(tenantSlug); const supabase = await getSupabaseServerClient();
    if (!nextActive) {
      const [items, options, prices] = await Promise.all([
        supabase.from("kitchen_inventory_items").select("id,name", { count: "exact" }).eq("tenant_id", tenant.tenantId).eq("default_supplier_id", supplierId).eq("is_active", true),
        supabase.from("kitchen_inventory_purchase_options").select("id", { count: "exact" }).eq("tenant_id", tenant.tenantId).eq("supplier_id", supplierId).eq("is_active", true),
        supabase.from("kitchen_inventory_supplier_prices").select("id", { count: "exact" }).eq("tenant_id", tenant.tenantId).eq("supplier_id", supplierId).eq("is_current", true),
      ]);
      if (items.error || options.error || prices.error) throw new Error("No se pudieron validar las dependencias del proveedor.");
      const itemCount = items.count ?? 0; const optionCount = options.count ?? 0; const priceCount = prices.count ?? 0;
      if (itemCount || optionCount || priceCount) return { ok: false, message: `No puedes desactivar este proveedor todavía. Se utiliza como referencia en ${itemCount} insumos activos, tiene ${optionCount} presentaciones activas y ${priceCount} precios vigentes. Reasigna o cierra esas referencias antes de desactivarlo.` };
    }
    const { error } = await supabase.from("kitchen_inventory_suppliers").update({ is_active: nextActive }).eq("tenant_id", tenant.tenantId).eq("id", supplierId);
    if (error) throw error; revalidate(tenant.tenantSlug, supplierId); return { ok: true, message: nextActive ? "Proveedor reactivado." : "Proveedor desactivado.", supplierId };
  } catch (error) { return { ok: false, message: error instanceof Error ? error.message : "No se pudo cambiar el estado del proveedor." }; }
}
