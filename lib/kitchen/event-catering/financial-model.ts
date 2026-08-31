export type CateringPricingStatus = "ready" | "incomplete";

export type CateringPricingWarning = "missing_extra_staff_unit_cost";

export type CateringServicePricingInput = {
  foodCost: number;
  extraStaffCount: number;
  extraStaffUnitCost: number | null;
  targetMarginPct: number;
  plannedGuestCount: number | null;
  currency: string;
};

export type CateringServicePricingResult = {
  status: CateringPricingStatus;
  currency: string;
  foodCost: number;
  extraStaffCount: number;
  extraStaffUnitCost: number | null;
  extraLaborCost: number;
  serviceCostBasis: number;
  targetMarginPct: number;
  suggestedProfit: number | null;
  suggestedServicePrice: number | null;
  resultingMarginPct: number | null;
  plannedGuestCount: number | null;
  suggestedPricePerGuest: number | null;
  warnings: CateringPricingWarning[];
};

function assertFinite(value: number, field: string): void {
  if (!Number.isFinite(value)) throw new Error(`${field} debe ser un número finito.`);
}

function assertNonNegative(value: number, field: string): void {
  assertFinite(value, field);
  if (value < 0) throw new Error(`${field} no puede ser negativo.`);
}

export function calculateCateringServicePricing(
  input: CateringServicePricingInput,
): CateringServicePricingResult {
  assertNonNegative(input.foodCost, "foodCost");
  assertFinite(input.extraStaffCount, "extraStaffCount");
  if (!Number.isInteger(input.extraStaffCount) || input.extraStaffCount < 0) {
    throw new Error("extraStaffCount debe ser un entero mayor o igual a 0.");
  }
  if (input.extraStaffUnitCost !== null) assertNonNegative(input.extraStaffUnitCost, "extraStaffUnitCost");
  assertFinite(input.targetMarginPct, "targetMarginPct");
  if (input.targetMarginPct < 0 || input.targetMarginPct >= 100) {
    throw new Error("targetMarginPct debe ser mayor o igual a 0 y menor a 100.");
  }
  if (input.plannedGuestCount !== null) assertNonNegative(input.plannedGuestCount, "plannedGuestCount");
  if (!input.currency.trim()) throw new Error("currency es obligatoria.");

  const warnings: CateringPricingWarning[] = [];
  const hasMissingStaffRate = input.extraStaffCount > 0 && input.extraStaffUnitCost === null;
  if (hasMissingStaffRate) warnings.push("missing_extra_staff_unit_cost");

  const extraLaborCost = input.extraStaffCount === 0
    ? 0
    : input.extraStaffCount * (input.extraStaffUnitCost ?? 0);
  const serviceCostBasis = input.foodCost + extraLaborCost;
  const isReady = !hasMissingStaffRate;
  const suggestedServicePrice = isReady
    ? serviceCostBasis / (1 - input.targetMarginPct / 100)
    : null;
  const suggestedProfit = suggestedServicePrice === null ? null : suggestedServicePrice - serviceCostBasis;
  const resultingMarginPct = suggestedServicePrice && suggestedServicePrice !== 0
    ? (suggestedProfit! / suggestedServicePrice) * 100
    : input.targetMarginPct === 0
      ? 0
      : null;
  const suggestedPricePerGuest = suggestedServicePrice !== null && input.plannedGuestCount !== null && input.plannedGuestCount > 0
    ? suggestedServicePrice / input.plannedGuestCount
    : null;

  return {
    status: isReady ? "ready" : "incomplete",
    currency: input.currency,
    foodCost: input.foodCost,
    extraStaffCount: input.extraStaffCount,
    extraStaffUnitCost: input.extraStaffUnitCost,
    extraLaborCost,
    serviceCostBasis,
    targetMarginPct: input.targetMarginPct,
    suggestedProfit,
    suggestedServicePrice,
    resultingMarginPct,
    plannedGuestCount: input.plannedGuestCount,
    suggestedPricePerGuest,
    warnings,
  };
}
