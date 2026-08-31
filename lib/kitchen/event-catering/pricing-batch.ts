import type { CateringEffectivePlanPricing } from "./pricing-types";

type PricingRow = {
  id?: string;
  tenant_id: string;
  plan_id: string;
  extra_staff_count?: number | null;
  extra_staff_unit_cost?: number | null;
  target_margin_pct?: number | null;
  staff_rate_source?: string | null;
  margin_source?: string | null;
  currency?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
};

type SettingsRow = {
  tenant_id: string;
  default_target_margin_pct?: number | null;
  default_extra_staff_unit_cost?: number | null;
  currency?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
};

function mapPricing(row: PricingRow, persisted: boolean): CateringEffectivePlanPricing {
  return {
    id: String(row.id ?? ""),
    tenant_id: row.tenant_id,
    plan_id: row.plan_id,
    extra_staff_count: Number(row.extra_staff_count ?? 0),
    extra_staff_unit_cost: row.extra_staff_unit_cost == null ? null : Number(row.extra_staff_unit_cost),
    target_margin_pct: Number(row.target_margin_pct ?? 25),
    staff_rate_source: row.staff_rate_source === "plan_override" ? "plan_override" : "tenant_default",
    margin_source: row.margin_source === "plan_override" ? "plan_override" : "tenant_default",
    currency: String(row.currency ?? "MXN"),
    created_at: String(row.created_at ?? ""),
    updated_at: String(row.updated_at ?? ""),
    persisted,
  };
}

export function buildBatchPlanPricing(input: {
  tenantId: string;
  planIds: string[];
  planIdsFound: string[];
  pricingRows: PricingRow[];
  settings: SettingsRow | null;
}): Map<string, CateringEffectivePlanPricing> {
  const uniquePlanIds = Array.from(new Set(input.planIds));
  const found = new Set(input.planIdsFound);
  if (uniquePlanIds.some((planId) => !found.has(planId))) {
    throw new Error("Plan inválido para el tenant.");
  }

  const settings = input.settings ?? { tenant_id: input.tenantId };
  const persistedByPlanId = new Map(
    input.pricingRows.map((row) => [row.plan_id, mapPricing(row, true)]),
  );

  return new Map(uniquePlanIds.map((planId) => [
    planId,
    persistedByPlanId.get(planId) ?? mapPricing({
      tenant_id: input.tenantId,
      plan_id: planId,
      extra_staff_count: 0,
      extra_staff_unit_cost: settings.default_extra_staff_unit_cost,
      target_margin_pct: settings.default_target_margin_pct,
      staff_rate_source: "tenant_default",
      margin_source: "tenant_default",
      currency: settings.currency,
    }, false),
  ]));
}
