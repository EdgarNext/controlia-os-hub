import { resolveTenantModulePageContext } from "@/lib/auth/module-page-access";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { calculateCateringServicePricing } from "./financial-model";
import { buildBatchPlanPricing } from "./pricing-batch";
import type {
  CateringCostingSettings,
  CateringEffectiveCostingSettings,
  CateringEffectivePlanPricing,
  CateringPlanPricingPreview,
} from "./pricing-types";

type ServerSupabaseClient = Awaited<ReturnType<typeof getSupabaseServerClient>>;

const DEFAULT_MARGIN_PCT = 25;
const DEFAULT_CURRENCY = "MXN";

function mapSettings(row: Record<string, unknown>, persisted: boolean): CateringEffectiveCostingSettings {
  return {
    tenant_id: String(row.tenant_id),
    default_target_margin_pct: Number(row.default_target_margin_pct ?? DEFAULT_MARGIN_PCT),
    default_extra_staff_unit_cost: row.default_extra_staff_unit_cost == null ? null : Number(row.default_extra_staff_unit_cost),
    currency: String(row.currency ?? DEFAULT_CURRENCY),
    created_at: String(row.created_at ?? ""),
    updated_at: String(row.updated_at ?? ""),
    persisted,
  };
}

function mapPricing(row: Record<string, unknown>, persisted: boolean): CateringEffectivePlanPricing {
  return {
    id: String(row.id ?? ""),
    tenant_id: String(row.tenant_id),
    plan_id: String(row.plan_id),
    extra_staff_count: Number(row.extra_staff_count ?? 0),
    extra_staff_unit_cost: row.extra_staff_unit_cost == null ? null : Number(row.extra_staff_unit_cost),
    target_margin_pct: Number(row.target_margin_pct ?? DEFAULT_MARGIN_PCT),
    staff_rate_source: row.staff_rate_source === "plan_override" ? "plan_override" : "tenant_default",
    margin_source: row.margin_source === "plan_override" ? "plan_override" : "tenant_default",
    currency: String(row.currency ?? DEFAULT_CURRENCY),
    created_at: String(row.created_at ?? ""),
    updated_at: String(row.updated_at ?? ""),
    persisted,
  };
}

export async function getCateringPlanPricingForTenant(
  supabase: ServerSupabaseClient,
  tenantId: string,
  planId: string,
): Promise<CateringEffectivePlanPricing> {
  const [{ data: plan, error: planError }, { data: row, error: pricingError }, { data: settingsRow, error: settingsError }] = await Promise.all([
    supabase.from("event_catering_plans").select("id").eq("tenant_id", tenantId).eq("id", planId).maybeSingle(),
    supabase.from("event_catering_plan_pricing").select("id,tenant_id,plan_id,extra_staff_count,extra_staff_unit_cost,target_margin_pct,staff_rate_source,margin_source,currency,created_at,updated_at").eq("tenant_id", tenantId).eq("plan_id", planId).maybeSingle(),
    supabase.from("event_catering_costing_settings").select("tenant_id,default_target_margin_pct,default_extra_staff_unit_cost,currency,created_at,updated_at").eq("tenant_id", tenantId).maybeSingle(),
  ]);
  if (planError || !plan) throw new Error("Plan inválido para el tenant.");
  if (pricingError) throw new Error(`No se pudo cargar pricing del plan: ${pricingError.message}`);
  if (settingsError) throw new Error(`No se pudieron cargar defaults de costeo: ${settingsError.message}`);
  if (row) return mapPricing(row as Record<string, unknown>, true);
  const settings = mapSettings(settingsRow as Record<string, unknown> | null ?? { tenant_id: tenantId }, Boolean(settingsRow));
  return mapPricing({
    tenant_id: tenantId,
    plan_id: planId,
    extra_staff_count: 0,
    extra_staff_unit_cost: settings.default_extra_staff_unit_cost,
    target_margin_pct: settings.default_target_margin_pct,
    staff_rate_source: "tenant_default",
    margin_source: "tenant_default",
    currency: settings.currency,
  }, false);
}

export async function getCateringPlanPricingBatchForTenant(
  supabase: ServerSupabaseClient,
  tenantId: string,
  planIds: string[],
): Promise<Map<string, CateringEffectivePlanPricing>> {
  const uniquePlanIds = Array.from(new Set(planIds));
  if (uniquePlanIds.length === 0) return new Map();

  const [{ data: plans, error: planError }, { data: rows, error: pricingError }, { data: settingsRow, error: settingsError }] = await Promise.all([
    supabase
      .from("event_catering_plans")
      .select("id")
      .eq("tenant_id", tenantId)
      .in("id", uniquePlanIds),
    supabase
      .from("event_catering_plan_pricing")
      .select("id,tenant_id,plan_id,extra_staff_count,extra_staff_unit_cost,target_margin_pct,staff_rate_source,margin_source,currency,created_at,updated_at")
      .eq("tenant_id", tenantId)
      .in("plan_id", uniquePlanIds),
    supabase
      .from("event_catering_costing_settings")
      .select("tenant_id,default_target_margin_pct,default_extra_staff_unit_cost,currency,created_at,updated_at")
      .eq("tenant_id", tenantId)
      .maybeSingle(),
  ]);

  if (planError) throw new Error("Plan inválido para el tenant.");
  if (pricingError) throw new Error(`No se pudo cargar pricing de los planes: ${pricingError.message}`);
  if (settingsError) throw new Error(`No se pudieron cargar defaults de costeo: ${settingsError.message}`);

  return buildBatchPlanPricing({
    tenantId,
    planIds: uniquePlanIds,
    planIdsFound: (plans ?? []).map((plan) => String(plan.id)),
    pricingRows: (rows ?? []) as Array<Record<string, unknown>> as never,
    settings: settingsRow as Record<string, unknown> | null as never,
  });
}

export async function getCateringCostingSettings(tenantSlug: string): Promise<CateringEffectiveCostingSettings> {
  const tenant = await resolveTenantModulePageContext(tenantSlug, "event_catering", "plans", "read");
  const supabase = await getSupabaseServerClient();
  const { data, error } = await supabase
    .from("event_catering_costing_settings")
    .select("tenant_id,default_target_margin_pct,default_extra_staff_unit_cost,currency,created_at,updated_at")
    .eq("tenant_id", tenant.tenantId)
    .maybeSingle();
  if (error) throw new Error(`No se pudieron cargar settings de costeo: ${error.message}`);
  return mapSettings(data as Record<string, unknown> | null ?? { tenant_id: tenant.tenantId }, Boolean(data));
}

export async function getCateringPlanPricing(
  tenantSlug: string,
  planId: string,
): Promise<CateringEffectivePlanPricing> {
  const tenant = await resolveTenantModulePageContext(tenantSlug, "event_catering", "plans", "read");
  const supabase = await getSupabaseServerClient();
  const [{ data: plan, error: planError }, { data: row, error: pricingError }, settings] = await Promise.all([
    supabase.from("event_catering_plans").select("id").eq("tenant_id", tenant.tenantId).eq("id", planId).maybeSingle(),
    supabase.from("event_catering_plan_pricing").select("id,tenant_id,plan_id,extra_staff_count,extra_staff_unit_cost,target_margin_pct,staff_rate_source,margin_source,currency,created_at,updated_at").eq("tenant_id", tenant.tenantId).eq("plan_id", planId).maybeSingle(),
    getCateringCostingSettings(tenantSlug),
  ]);
  if (planError || !plan) throw new Error("Plan inválido para el tenant.");
  if (pricingError) throw new Error(`No se pudo cargar pricing del plan: ${pricingError.message}`);
  if (row) return mapPricing(row as Record<string, unknown>, true);
  return mapPricing({
    tenant_id: tenant.tenantId,
    plan_id: planId,
    extra_staff_count: 0,
    extra_staff_unit_cost: settings.default_extra_staff_unit_cost,
    target_margin_pct: settings.default_target_margin_pct,
    staff_rate_source: "tenant_default",
    margin_source: "tenant_default",
    currency: settings.currency,
  }, false);
}

export async function getCateringPlanPricingPreview(
  tenantSlug: string,
  planId: string,
): Promise<CateringPlanPricingPreview> {
  const tenant = await resolveTenantModulePageContext(tenantSlug, "event_catering", "plans", "read");
  const supabase = await getSupabaseServerClient();
  const { data: plan, error } = await supabase
    .from("event_catering_plans")
    .select("id,estimated_total_cost,planned_guest_count")
    .eq("tenant_id", tenant.tenantId)
    .eq("id", planId)
    .maybeSingle();
  if (error || !plan) throw new Error("Plan inválido para el tenant.");
  const pricing = await getCateringPlanPricing(tenantSlug, planId);
  const foodCost = Number(plan.estimated_total_cost ?? 0);
  return {
    planId,
    foodCost,
    pricing,
    result: calculateCateringServicePricing({
      foodCost,
      extraStaffCount: pricing.extra_staff_count,
      extraStaffUnitCost: pricing.extra_staff_unit_cost,
      targetMarginPct: pricing.target_margin_pct,
      plannedGuestCount: plan.planned_guest_count == null ? null : Number(plan.planned_guest_count),
      currency: pricing.currency,
    }),
  };
}

export type { CateringCostingSettings };

export type CateringPlanPricingSnapshot = {
  snapshotKind: "initial" | "updated";
  createdAt: string;
  pricingModelVersion: string | null;
  foodCost: number;
  plannedGuestCount: number | null;
  extraStaffCount: number | null;
  extraStaffUnitCost: number | null;
  extraStaffCost: number | null;
  serviceCostBasis: number | null;
  targetMarginPct: number | null;
  suggestedProfit: number | null;
  suggestedServicePrice: number | null;
};

export async function getCateringPlanPricingSnapshots(
  tenantSlug: string,
  planId: string,
): Promise<CateringPlanPricingSnapshot[]> {
  const tenant = await resolveTenantModulePageContext(tenantSlug, "event_catering", "plans", "read");
  const supabase = await getSupabaseServerClient();
  const { data: summaries, error: summariesError } = await supabase
    .from("event_catering_costing_service_summaries")
    .select("snapshot_id,total_cost,planned_guest_count_snapshot,extra_staff_count,extra_staff_unit_cost,extra_staff_total_cost,service_cost_basis,target_margin_pct,suggested_profit,suggested_service_price,pricing_model_version,created_at")
    .eq("tenant_id", tenant.tenantId)
    .eq("plan_id", planId)
    .order("created_at", { ascending: false })
    .limit(20);
  if (summariesError) throw new Error(`No se pudieron cargar snapshots financieros: ${summariesError.message}`);
  const snapshotIds = [...new Set((summaries ?? []).map((row) => String(row.snapshot_id)))];
  if (snapshotIds.length === 0) return [];
  const { data: snapshots, error: snapshotsError } = await supabase
    .from("event_catering_costing_snapshots")
    .select("id,snapshot_kind,created_at,pricing_model_version")
    .eq("tenant_id", tenant.tenantId)
    .in("id", snapshotIds);
  if (snapshotsError) throw new Error(`No se pudieron cargar snapshots financieros: ${snapshotsError.message}`);
  const snapshotById = new Map((snapshots ?? []).map((row) => [String(row.id), row]));
  return (summaries ?? []).flatMap((row) => {
    const snapshot = snapshotById.get(String(row.snapshot_id));
    if (!snapshot || (snapshot.snapshot_kind !== "initial" && snapshot.snapshot_kind !== "updated")) return [];
    return [{ snapshotKind: snapshot.snapshot_kind, createdAt: String(snapshot.created_at), pricingModelVersion: snapshot.pricing_model_version ? String(snapshot.pricing_model_version) : null, foodCost: Number(row.total_cost ?? 0), plannedGuestCount: row.planned_guest_count_snapshot == null ? null : Number(row.planned_guest_count_snapshot), extraStaffCount: row.extra_staff_count == null ? null : Number(row.extra_staff_count), extraStaffUnitCost: row.extra_staff_unit_cost == null ? null : Number(row.extra_staff_unit_cost), extraStaffCost: row.extra_staff_total_cost == null ? null : Number(row.extra_staff_total_cost), serviceCostBasis: row.service_cost_basis == null ? null : Number(row.service_cost_basis), targetMarginPct: row.target_margin_pct == null ? null : Number(row.target_margin_pct), suggestedProfit: row.suggested_profit == null ? null : Number(row.suggested_profit), suggestedServicePrice: row.suggested_service_price == null ? null : Number(row.suggested_service_price) }];
  });
}
