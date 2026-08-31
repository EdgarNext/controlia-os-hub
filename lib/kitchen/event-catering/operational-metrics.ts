export type OperationalRequirementQuantity = { unitId: string | null; quantity: number };
export type OperationalReceiptQuantity = { status: string; unitId: string | null; quantity: number };
export type OperationalConsumptionQuantity = { unitId: string | null; consumed: number; waste: number };

export type OperationalExecutionCostInput = {
  receivedCosts: Array<number | null | undefined>;
  consumptionCosts: Array<{ consumedCost: number; wasteCost: number }>;
};

export function calculateOperationalExecutionCosts(input: OperationalExecutionCostInput) {
  return {
    receivedCost: input.receivedCosts.reduce<number>((total, value) => total + (value ?? 0), 0),
    consumedCost: input.consumptionCosts.reduce<number>((total, row) => total + row.consumedCost, 0),
    wasteCost: input.consumptionCosts.reduce<number>((total, row) => total + row.wasteCost, 0),
  };
}

export function calculateOperationalQuantityMetrics(
  requirements: OperationalRequirementQuantity[],
  receipts: OperationalReceiptQuantity[],
  consumption: OperationalConsumptionQuantity[],
) {
  const requiredUnits = new Set(requirements.map((row) => row.unitId).filter(Boolean));
  const receivedRows = receipts.filter((row) => row.status === "received");
  const receivedUnits = new Set(receivedRows.map((row) => row.unitId).filter(Boolean));
  const consumptionUnits = new Set(consumption.map((row) => row.unitId).filter(Boolean));
  const allUnits = new Set([...requiredUnits, ...receivedUnits, ...consumptionUnits]);
  const hasMissingUnit = [...requirements, ...receivedRows, ...consumption].some((row) => row.unitId == null);
  const comparable = allUnits.size <= 1 && !hasMissingUnit;
  const totalRequiredQty = requirements.reduce((total, row) => total + row.quantity, 0);
  const totalReceivedQty = receivedRows.reduce((total, row) => total + row.quantity, 0);
  const totalConsumedQty = consumption.reduce((total, row) => total + row.consumed, 0);
  const totalWasteQty = consumption.reduce((total, row) => total + row.waste, 0);

  return {
    totalRequiredQty,
    totalReceivedQty,
    totalConsumedQty,
    totalWasteQty,
    comparable,
    varianceReceivedVsRequired: comparable ? totalReceivedQty - totalRequiredQty : null,
    varianceConsumedVsReceived: comparable ? totalConsumedQty + totalWasteQty - totalReceivedQty : null,
  };
}
