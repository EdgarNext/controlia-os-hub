import type { CateringPlanFinancialPricing, CateringFinancialDashboardSummary, EventCateringPlan } from "./types";

export type CurrentServiceFoodCostSource = "updated_snapshot" | "initial_snapshot" | "current_preview" | "unavailable";

export type CurrentServiceFoodCost = {
  amount: number | null;
  source: CurrentServiceFoodCostSource;
};

function validCost(value: number | null | undefined): value is number {
  return value != null && Number.isFinite(value) && value >= 0;
}

export function resolveCurrentServiceFoodCost(input: {
  updatedCost: number | null;
  initialCost: number | null;
  previewCost: number | null;
  estimatedCost: number | null;
}): CurrentServiceFoodCost {
  if (validCost(input.updatedCost)) return { amount: input.updatedCost, source: "updated_snapshot" };
  if (validCost(input.initialCost)) return { amount: input.initialCost, source: "initial_snapshot" };
  if (validCost(input.previewCost)) return { amount: input.previewCost, source: "current_preview" };
  if (validCost(input.estimatedCost)) return { amount: input.estimatedCost, source: "current_preview" };
  return { amount: null, source: "unavailable" };
}

export function calculateServiceCostPerPerson(
  serviceCost: number | null,
  plannedGuestCount: number | null | undefined,
): number | null {
  if (!validCost(serviceCost) || plannedGuestCount == null || !Number.isFinite(plannedGuestCount) || plannedGuestCount <= 0) {
    return null;
  }
  return Number((serviceCost / plannedGuestCount).toFixed(4));
}

type PricingSnapshotLike = {
  snapshotKind: "initial" | "updated";
  pricingModelVersion: string | null;
  createdAt: string;
};

export function resolveCateringPricingSource(
  planStatus: EventCateringPlan["status"],
  hasApplicableV1Snapshot: boolean,
): "current_preview" | "snapshot_v1" | "legacy_unavailable" {
  if (planStatus === "draft" || planStatus === "planned") return "current_preview";
  return hasApplicableV1Snapshot ? "snapshot_v1" : "legacy_unavailable";
}

export function selectPreferredV1Snapshot<T extends PricingSnapshotLike>(snapshots: T[]): T | null {
  const v1 = snapshots
    .filter((snapshot) => snapshot.pricingModelVersion === "service_margin_v1")
    .sort((left, right) => right.createdAt.localeCompare(left.createdAt));
  return v1.find((snapshot) => snapshot.snapshotKind === "updated")
    ?? v1.find((snapshot) => snapshot.snapshotKind === "initial")
    ?? null;
}

export function aggregateFinancialPricing(
  pricing: CateringPlanFinancialPricing[],
): Pick<CateringFinancialDashboardSummary, "pricingReadyServices" | "pricingIncompleteServices" | "legacyPricingUnavailableServices" | "serviceCostBasisTotal" | "extraLaborCostTotal" | "suggestedProfitTotal" | "suggestedServicePriceTotal" | "effectiveSuggestedMarginPct"> {
  const ready = pricing.filter((item) => item.status === "ready");
  const sum = (field: "serviceCostBasis" | "extraLaborCost" | "suggestedProfit" | "suggestedServicePrice") =>
    Number(ready.reduce((total, item) => total + (item[field] ?? 0), 0).toFixed(4));
  const suggestedProfitTotal = sum("suggestedProfit");
  const suggestedServicePriceTotal = sum("suggestedServicePrice");

  return {
    pricingReadyServices: ready.length,
    pricingIncompleteServices: pricing.filter((item) => item.status === "incomplete").length,
    legacyPricingUnavailableServices: pricing.filter((item) => item.source === "legacy_unavailable").length,
    serviceCostBasisTotal: sum("serviceCostBasis"),
    extraLaborCostTotal: sum("extraLaborCost"),
    suggestedProfitTotal,
    suggestedServicePriceTotal,
    effectiveSuggestedMarginPct: suggestedServicePriceTotal > 0
      ? Number(((suggestedProfitTotal / suggestedServicePriceTotal) * 100).toFixed(4))
      : null,
  };
}
