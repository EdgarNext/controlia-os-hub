export type PriceTier = "public" | "wholesale";

export type PriceTierEconomicLine = {
  publicUnitPriceSnapshotCents?: number | null;
  wholesaleUnitPriceSnapshotCents?: number | null;
  requestedPriceTier?: PriceTier | null;
  approvedPriceTier?: PriceTier | null;
  approvedUnitPriceCents?: number | null;
  unitPriceCents?: number | null;
  quantity: string | number;
  directDiscountCents?: number | null;
  orderDiscountAllocationCents?: number | null;
  totalDiscountCents?: number | null;
  unitCostSnapshotCents?: number | null;
};

export function parseEconomicQuantity(quantity: string | number) {
  const value = typeof quantity === "number" ? quantity : Number.parseFloat(quantity);
  return Number.isFinite(value) ? value : 0;
}

export function getFinalApprovedTier(line: PriceTierEconomicLine): PriceTier {
  return line.approvedPriceTier === "wholesale" ? "wholesale" : "public";
}

export function getPublicUnitSnapshot(line: PriceTierEconomicLine) {
  return line.publicUnitPriceSnapshotCents ?? line.unitPriceCents ?? 0;
}

export function getApprovedUnitPrice(line: PriceTierEconomicLine) {
  const tier = getFinalApprovedTier(line);
  if (typeof line.approvedUnitPriceCents === "number") return line.approvedUnitPriceCents;
  return tier === "wholesale"
    ? line.wholesaleUnitPriceSnapshotCents ?? getPublicUnitSnapshot(line)
    : getPublicUnitSnapshot(line);
}

export function getManualLineDiscount(line: PriceTierEconomicLine) {
  return Math.max(0, line.directDiscountCents ?? line.totalDiscountCents ?? 0);
}

export function getManualOrderDiscount(line: PriceTierEconomicLine) {
  return Math.max(0, line.orderDiscountAllocationCents ?? 0);
}

export function calculatePriceTierEconomics(line: PriceTierEconomicLine) {
  const quantity = parseEconomicQuantity(line.quantity);
  const publicReferenceCents = Math.round(getPublicUnitSnapshot(line) * quantity);
  const approvedBaseCents = Math.round(getApprovedUnitPrice(line) * quantity);
  const manualLineDiscountCents = getManualLineDiscount(line);
  const allocatedOrderDiscountCents = getManualOrderDiscount(line);
  const finalNetCents = Math.max(0, approvedBaseCents - manualLineDiscountCents - allocatedOrderDiscountCents);
  const costCents = typeof line.unitCostSnapshotCents === "number" ? Math.round(line.unitCostSnapshotCents * quantity) : null;
  return {
    tier: getFinalApprovedTier(line),
    publicReferenceCents,
    approvedBaseCents,
    priceTierDifferenceCents: publicReferenceCents - approvedBaseCents,
    manualLineDiscountCents,
    allocatedOrderDiscountCents,
    manualDiscountCents: manualLineDiscountCents + allocatedOrderDiscountCents,
    finalNetCents,
    baseMarginCents: costCents === null ? null : approvedBaseCents - costCents,
    finalMarginCents: costCents === null ? null : finalNetCents - costCents,
  };
}

export function classifyPriceTier(lines: PriceTierEconomicLine[]) {
  const tiers = new Set(lines.map(getFinalApprovedTier));
  if (tiers.has("wholesale") && tiers.has("public")) return "mixed" as const;
  return tiers.has("wholesale") ? "wholesale" as const : "public" as const;
}

export function classifyPriceTierDecision(line: PriceTierEconomicLine) {
  if (line.requestedPriceTier === "wholesale" && line.approvedPriceTier === "wholesale") return "requested_approved" as const;
  if (line.requestedPriceTier === "wholesale" && line.approvedPriceTier === "public") return "requested_rejected" as const;
  if (line.requestedPriceTier === "public" && line.approvedPriceTier === "wholesale") return "cashier_direct" as const;
  return "public" as const;
}
