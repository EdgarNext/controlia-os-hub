import type { CateringPricingStatus, CateringPricingWarning } from "./financial-model";

export type CateringCostingSettings = {
  tenant_id: string;
  default_target_margin_pct: number;
  default_extra_staff_unit_cost: number | null;
  currency: string;
  created_at: string;
  updated_at: string;
};

export type CateringEffectiveCostingSettings = CateringCostingSettings & {
  persisted: boolean;
};

export type CateringPlanPricing = {
  id: string;
  tenant_id: string;
  plan_id: string;
  extra_staff_count: number;
  extra_staff_unit_cost: number | null;
  target_margin_pct: number;
  staff_rate_source: "tenant_default" | "plan_override";
  margin_source: "tenant_default" | "plan_override";
  currency: string;
  created_at: string;
  updated_at: string;
};

export type CateringEffectivePlanPricing = CateringPlanPricing & {
  persisted: boolean;
};

export type CateringPlanPricingPreview = {
  planId: string;
  foodCost: number;
  pricing: CateringEffectivePlanPricing;
  result: import("./financial-model").CateringServicePricingResult;
};

export type { CateringPricingStatus, CateringPricingWarning };
