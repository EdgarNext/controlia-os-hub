"use server";

import { revalidatePath } from "next/cache";
import { resolveTenantModulePageActor } from "@/lib/auth/module-page-access";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import type { CateringEffectivePlanPricing } from "./pricing-types";

function text(formData: FormData, name: string): string {
  return String(formData.get(name) ?? "").trim();
}

function parseNumber(value: string, field: string): number {
  const parsed = Number(value.replace(",", "."));
  if (!Number.isFinite(parsed)) throw new Error(`${field} debe ser numérico.`);
  return parsed;
}

function parseMargin(value: string): number {
  const parsed = parseNumber(value, "El margen");
  if (parsed < 0 || parsed >= 100) throw new Error("El margen debe ser mayor o igual a 0 y menor a 100.");
  return parsed;
}

function parseStaffCount(value: string): number {
  const parsed = parseNumber(value, "El personal extra");
  if (!Number.isInteger(parsed) || parsed < 0) throw new Error("El personal extra debe ser un entero mayor o igual a 0.");
  return parsed;
}

function parseNullableRate(value: string): number | null {
  if (!value || value.toLowerCase() === "null") return null;
  const parsed = parseNumber(value, "La tarifa de personal extra");
  if (parsed < 0) throw new Error("La tarifa de personal extra no puede ser negativa.");
  return parsed;
}

function revalidatePricingPaths(tenantSlug: string): void {
  revalidatePath(`/${tenantSlug}/kitchen/events`);
  revalidatePath(`/${tenantSlug}/kitchen/events/plans`);
  revalidatePath(`/${tenantSlug}/kitchen/events/costing-settings`);
  revalidatePath(`/${tenantSlug}/kitchen/events/[eventId]/catering/[planId]`, "page");
}

export async function ensureCateringPlanPricingForTenant(
  tenantId: string,
  planId: string,
  userId: string,
): Promise<CateringEffectivePlanPricing> {
  const supabase = await getSupabaseServerClient();
  const { data: plan, error: planError } = await supabase
    .from("event_catering_plans")
    .select("id")
    .eq("tenant_id", tenantId)
    .eq("id", planId)
    .maybeSingle();
  if (planError || !plan) throw new Error("Plan inválido para el tenant.");

  const { data: existing, error: existingError } = await supabase
    .from("event_catering_plan_pricing")
    .select("id,tenant_id,plan_id,extra_staff_count,extra_staff_unit_cost,target_margin_pct,staff_rate_source,margin_source,currency,created_at,updated_at")
    .eq("tenant_id", tenantId)
    .eq("plan_id", planId)
    .maybeSingle();
  if (existingError) throw new Error(`No se pudo cargar pricing del plan: ${existingError.message}`);
  if (existing) return { ...(existing as CateringEffectivePlanPricing), persisted: true };

  const settings = await getCateringCostingSettingsByTenantId(supabase, tenantId);
  const { error: insertError } = await supabase.from("event_catering_plan_pricing").insert({
    tenant_id: tenantId,
    plan_id: planId,
    extra_staff_count: 0,
    extra_staff_unit_cost: settings.default_extra_staff_unit_cost,
    target_margin_pct: settings.default_target_margin_pct,
    staff_rate_source: "tenant_default",
    margin_source: "tenant_default",
    currency: settings.currency,
    created_by: userId,
    updated_by: userId,
  });
  if (insertError && insertError.code !== "23505") {
    throw new Error(`No se pudo inicializar pricing del plan: ${insertError.message}`);
  }
  const { data: persisted, error: persistedError } = await supabase
    .from("event_catering_plan_pricing")
    .select("id,tenant_id,plan_id,extra_staff_count,extra_staff_unit_cost,target_margin_pct,staff_rate_source,margin_source,currency,created_at,updated_at")
    .eq("tenant_id", tenantId)
    .eq("plan_id", planId)
    .single();
  if (persistedError || !persisted) throw new Error("No se pudo recuperar pricing inicializado del plan.");
  return { ...(persisted as CateringEffectivePlanPricing), persisted: true };
}

async function getCateringCostingSettingsByTenantId(
  supabase: Awaited<ReturnType<typeof getSupabaseServerClient>>,
  tenantId: string,
) {
  const { data, error } = await supabase
    .from("event_catering_costing_settings")
    .select("tenant_id,default_target_margin_pct,default_extra_staff_unit_cost,currency,created_at,updated_at")
    .eq("tenant_id", tenantId)
    .maybeSingle();
  if (error) throw new Error(`No se pudieron cargar defaults de costeo: ${error.message}`);
  return {
    tenant_id: tenantId,
    default_target_margin_pct: Number(data?.default_target_margin_pct ?? 25),
    default_extra_staff_unit_cost: data?.default_extra_staff_unit_cost == null ? null : Number(data.default_extra_staff_unit_cost),
    currency: String(data?.currency ?? "MXN"),
    created_at: String(data?.created_at ?? ""),
    updated_at: String(data?.updated_at ?? ""),
  };
}

export async function updateCateringCostingSettingsAction(formData: FormData): Promise<void> {
  const tenantSlug = text(formData, "tenantSlug").toLowerCase();
  if (!tenantSlug) throw new Error("Tenant es obligatorio.");
  const { tenant, user } = await resolveTenantModulePageActor(tenantSlug, "event_catering", "plans", "manage");
  const margin = parseMargin(text(formData, "defaultTargetMarginPct"));
  const rate = parseNullableRate(text(formData, "defaultExtraStaffUnitCost"));
  const supabase = await getSupabaseServerClient();
  const { data, error } = await supabase
    .from("event_catering_costing_settings")
    .upsert({ tenant_id: tenant.tenantId, default_target_margin_pct: margin, default_extra_staff_unit_cost: rate, currency: "MXN", updated_by: user.id }, { onConflict: "tenant_id" })
    .select("tenant_id")
    .single();
  if (error || !data) throw new Error(`No se pudieron actualizar defaults de costeo: ${error?.message ?? "error"}`);
  revalidatePricingPaths(tenant.tenantSlug);
}

export async function updateCateringPlanPricingAction(formData: FormData): Promise<void> {
  const tenantSlug = text(formData, "tenantSlug").toLowerCase();
  const planId = text(formData, "planId");
  if (!tenantSlug || !planId) throw new Error("Tenant y plan son obligatorios.");
  const { tenant, user } = await resolveTenantModulePageActor(tenantSlug, "event_catering", "plans", "manage");
  const current = await ensureCateringPlanPricingForTenant(tenant.tenantId, planId, user.id);
  const patch: Record<string, unknown> = { updated_by: user.id };
  if (formData.has("extraStaffCount")) patch.extra_staff_count = parseStaffCount(text(formData, "extraStaffCount"));
  if (formData.has("extraStaffUnitCost")) {
    patch.extra_staff_unit_cost = parseNullableRate(text(formData, "extraStaffUnitCost"));
    patch.staff_rate_source = "plan_override";
  }
  if (formData.has("targetMarginPct")) {
    patch.target_margin_pct = parseMargin(text(formData, "targetMarginPct"));
    patch.margin_source = "plan_override";
  }
  if (Object.keys(patch).length === 1) throw new Error("No se recibieron cambios de pricing.");
  const supabase = await getSupabaseServerClient();
  const { error } = await supabase.from("event_catering_plan_pricing").update(patch).eq("tenant_id", tenant.tenantId).eq("id", current.id).eq("plan_id", planId);
  if (error) throw new Error(`No se pudo actualizar pricing del plan: ${error.message}`);
  revalidatePricingPaths(tenant.tenantSlug);
}

async function resetPlanPricingField(formData: FormData, field: "margin" | "rate"): Promise<void> {
  const tenantSlug = text(formData, "tenantSlug").toLowerCase();
  const planId = text(formData, "planId");
  if (!tenantSlug || !planId) throw new Error("Tenant y plan son obligatorios.");
  const { tenant, user } = await resolveTenantModulePageActor(tenantSlug, "event_catering", "plans", "manage");
  const current = await ensureCateringPlanPricingForTenant(tenant.tenantId, planId, user.id);
  const settings = await getCateringCostingSettingsByTenantId(await getSupabaseServerClient(), tenant.tenantId);
  const supabase = await getSupabaseServerClient();
  const patch = field === "margin"
    ? { target_margin_pct: settings.default_target_margin_pct, margin_source: "tenant_default", updated_by: user.id }
    : { extra_staff_unit_cost: settings.default_extra_staff_unit_cost, staff_rate_source: "tenant_default", updated_by: user.id };
  const { error } = await supabase.from("event_catering_plan_pricing").update(patch).eq("tenant_id", tenant.tenantId).eq("id", current.id).eq("plan_id", planId);
  if (error) throw new Error(`No se pudo restablecer pricing del plan: ${error.message}`);
  revalidatePricingPaths(tenant.tenantSlug);
}

export async function resetCateringPlanMarginToDefaultAction(formData: FormData): Promise<void> {
  return resetPlanPricingField(formData, "margin");
}

export async function resetCateringPlanStaffRateToDefaultAction(formData: FormData): Promise<void> {
  return resetPlanPricingField(formData, "rate");
}

export async function updateCateringCostingSettingsWithFeedbackAction(
  _previousState: import("./mutation-action-state").KitchenMutationActionState,
  formData: FormData,
): Promise<import("./mutation-action-state").KitchenMutationActionState> {
  try {
    await updateCateringCostingSettingsAction(formData);
    return { error: null, success: "Valores predeterminados actualizados." };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "No se pudieron actualizar los valores predeterminados.", success: null };
  }
}

export async function updateCateringPlanPricingWithFeedbackAction(
  _previousState: import("./mutation-action-state").KitchenMutationActionState,
  formData: FormData,
): Promise<import("./mutation-action-state").KitchenMutationActionState> {
  try {
    await updateCateringPlanPricingAction(formData);
    return { error: null, success: "Costeo del servicio actualizado." };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "No se pudo actualizar el costeo del servicio.", success: null };
  }
}

export async function resetCateringPlanMarginToDefaultWithFeedbackAction(
  _previousState: import("./mutation-action-state").KitchenMutationActionState,
  formData: FormData,
): Promise<import("./mutation-action-state").KitchenMutationActionState> {
  try {
    await resetCateringPlanMarginToDefaultAction(formData);
    return { error: null, success: "Se aplicó el margen predeterminado." };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "No se pudo restablecer el margen.", success: null };
  }
}

export async function resetCateringPlanStaffRateToDefaultWithFeedbackAction(
  _previousState: import("./mutation-action-state").KitchenMutationActionState,
  formData: FormData,
): Promise<import("./mutation-action-state").KitchenMutationActionState> {
  try {
    await resetCateringPlanStaffRateToDefaultAction(formData);
    return { error: null, success: "Se aplicó la tarifa predeterminada." };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "No se pudo restablecer la tarifa.", success: null };
  }
}
