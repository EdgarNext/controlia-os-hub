import type { PriceTierClassification } from "./price-tier-economics";

export const RETAIL_PRICE_TIER_LABELS: Record<PriceTierClassification, string> = {
  public: "Precio público",
  wholesale: "Precio mayoreo",
  unknown: "Sin nivel registrado",
};

export function getRetailPriceTierLabel(tier: PriceTierClassification) {
  return RETAIL_PRICE_TIER_LABELS[tier];
}

export function calculateRetailShareBps(amountCents: number, totalCents: number) {
  return totalCents > 0 ? Math.round((amountCents * 10_000) / totalCents) : null;
}

export function getRetailCostCoverageNotice(input: {
  linesWithCost: number;
  totalLines: number;
  costCoverageByAmountBps: number | null;
}) {
  if (input.totalLines === 0 || input.linesWithCost === input.totalLines) return null;
  const amount = input.costCoverageByAmountBps === null ? "sin cobertura monetaria" : `${(input.costCoverageByAmountBps / 100).toFixed(1)}% del importe`;
  return `Margen calculado solo con costo histórico disponible: ${input.linesWithCost} de ${input.totalLines} líneas (${amount}).`;
}
