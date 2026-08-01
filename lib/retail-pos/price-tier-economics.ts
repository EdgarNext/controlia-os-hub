export type PriceTier = "public" | "wholesale";
export type PriceTierClassification = PriceTier | "unknown";

export type PriceTierEconomicLine = {
  publicUnitPriceSnapshotCents?: number | null;
  wholesaleUnitPriceSnapshotCents?: number | null;
  requestedPriceTier?: PriceTier | null;
  approvedPriceTier?: PriceTier | null;
  approvedUnitPriceCents?: number | null;
  unitPriceCents?: number | null;
  quantity: string | number;
  lineSubtotalCents?: number | null;
  lineTotalCents?: number | null;
  directDiscountCents?: number | null;
  orderDiscountAllocationCents?: number | null;
  totalDiscountCents?: number | null;
  unitCostSnapshotCents?: number | null;
};

type QuantityRational = { numerator: bigint; denominator: bigint };

function toSafeInteger(value: bigint, field: string) {
  if (value > BigInt(Number.MAX_SAFE_INTEGER) || value < BigInt(Number.MIN_SAFE_INTEGER)) {
    throw new RangeError(`${field} exceeds the safe integer range.`);
  }
  return Number(value);
}

function parseQuantityRational(quantity: string | number): QuantityRational {
  const source = typeof quantity === "number" ? String(quantity) : quantity.trim();
  const match = /^(\d+)(?:\.(\d+))?$/.exec(source);
  if (!match) return { numerator: BigInt(0), denominator: BigInt(1) };

  const fraction = match[2] ?? "";
  const denominator = BigInt(10) ** BigInt(fraction.length);
  return {
    numerator: BigInt(match[1]) * denominator + BigInt(fraction || "0"),
    denominator,
  };
}

function multiplyCentsByQuantity(cents: number, quantity: QuantityRational, field: string) {
  if (!Number.isSafeInteger(cents) || cents < 0) return null;
  const product = BigInt(cents) * quantity.numerator;
  const rounded = (product * BigInt(2) + quantity.denominator) / (quantity.denominator * BigInt(2));
  return toSafeInteger(rounded, field);
}

function roundRatioToBasisPoints(numerator: number, denominator: number) {
  if (!Number.isSafeInteger(numerator) || !Number.isSafeInteger(denominator) || denominator <= 0) {
    return null;
  }
  return toSafeInteger((BigInt(numerator) * BigInt(10_000) + BigInt(Math.floor(denominator / 2))) / BigInt(denominator), "margin_percent_bps");
}

export function parseEconomicQuantity(quantity: string | number) {
  const parsed = parseQuantityRational(quantity);
  return Number(parsed.numerator) / Number(parsed.denominator);
}

export function getApprovedPriceTier(line: PriceTierEconomicLine): PriceTierClassification {
  return line.approvedPriceTier === "public" || line.approvedPriceTier === "wholesale"
    ? line.approvedPriceTier
    : "unknown";
}

export function getPublicUnitSnapshot(line: PriceTierEconomicLine) {
  return line.publicUnitPriceSnapshotCents ?? null;
}

export function getApprovedUnitPrice(line: PriceTierEconomicLine) {
  const tier = getApprovedPriceTier(line);
  if (tier === "unknown") return null;
  const snapshot = tier === "wholesale"
    ? line.wholesaleUnitPriceSnapshotCents
    : line.publicUnitPriceSnapshotCents;
  return snapshot ?? null;
}

function getDirectDiscount(line: PriceTierEconomicLine) {
  if (typeof line.directDiscountCents === "number") return Math.max(0, line.directDiscountCents);
  const total = Math.max(0, line.totalDiscountCents ?? 0);
  const allocatedOrder = Math.max(0, line.orderDiscountAllocationCents ?? 0);
  return Math.max(0, total - allocatedOrder);
}

export function getManualLineDiscount(line: PriceTierEconomicLine) {
  return getDirectDiscount(line);
}

export function getManualOrderDiscount(line: PriceTierEconomicLine) {
  return Math.max(0, line.orderDiscountAllocationCents ?? 0);
}

function getHistoricalFinalNetCents(
  line: PriceTierEconomicLine,
  quantity: QuantityRational,
  manualDiscountCents: number,
) {
  if (typeof line.lineTotalCents === "number") return line.lineTotalCents;
  if (typeof line.unitPriceCents === "number") {
    const appliedCents = multiplyCentsByQuantity(line.unitPriceCents, quantity, "final_net_cents");
    return appliedCents === null ? null : Math.max(0, appliedCents - manualDiscountCents);
  }
  return null;
}

export function calculatePriceTierEconomics(line: PriceTierEconomicLine) {
  const quantity = parseQuantityRational(line.quantity);
  const tier = getApprovedPriceTier(line);
  const publicReferenceCents = typeof line.publicUnitPriceSnapshotCents === "number"
    ? multiplyCentsByQuantity(line.publicUnitPriceSnapshotCents, quantity, "public_reference_cents")
    : null;
  const approvedUnitPriceCents = getApprovedUnitPrice(line);
  const approvedBaseCents = approvedUnitPriceCents === null
    ? null
    : multiplyCentsByQuantity(approvedUnitPriceCents, quantity, "approved_base_cents");
  const manualLineDiscountCents = getManualLineDiscount(line);
  const allocatedOrderDiscountCents = getManualOrderDiscount(line);
  const persistedDiscountCents = typeof line.totalDiscountCents === "number"
    ? Math.max(0, line.totalDiscountCents)
    : manualLineDiscountCents + allocatedOrderDiscountCents;
  const finalNetCents = getHistoricalFinalNetCents(line, quantity, persistedDiscountCents);
  const manualDiscountCents = approvedBaseCents === null || finalNetCents === null
    ? null
    : Math.max(0, approvedBaseCents - finalNetCents);
  const costCents = typeof line.unitCostSnapshotCents === "number"
    ? multiplyCentsByQuantity(line.unitCostSnapshotCents, quantity, "cost_cents")
    : null;
  const finalMarginCents = costCents === null || finalNetCents === null
    ? null
    : finalNetCents - costCents;
  const baseMarginCents = costCents === null || approvedBaseCents === null
    ? null
    : approvedBaseCents - costCents;
  const effectiveFinalUnitBelowCost = typeof line.unitCostSnapshotCents === "number" && finalNetCents !== null
    ? BigInt(finalNetCents) * quantity.denominator < BigInt(line.unitCostSnapshotCents) * quantity.numerator
    : null;

  return {
    tier,
    publicReferenceCents,
    approvedBaseCents,
    priceTierDifferenceCents:
      publicReferenceCents === null || approvedBaseCents === null
        ? null
        : publicReferenceCents - approvedBaseCents,
    manualLineDiscountCents,
    allocatedOrderDiscountCents,
    manualDiscountCents,
    finalNetCents,
    costCents,
    totalCostCents: costCents,
    baseMarginCents,
    finalMarginCents,
    marginPercentBps: finalMarginCents === null || finalNetCents === null
      ? null
      : roundRatioToBasisPoints(finalMarginCents, finalNetCents),
    belowCost: effectiveFinalUnitBelowCost === true,
    belowCostSalesCents: effectiveFinalUnitBelowCost === true && finalNetCents !== null ? finalNetCents : 0,
    belowCostMarginCents: effectiveFinalUnitBelowCost === true && finalMarginCents !== null ? finalMarginCents : 0,
  };
}

export type RetailCommercialCoverage = {
  totalLines: number;
  publicLines: number;
  wholesaleLines: number;
  unknownLines: number;
  totalNetSalesCents: number;
  publicNetSalesCents: number;
  wholesaleNetSalesCents: number;
  unknownNetSalesCents: number;
  linesWithCost: number;
  linesWithoutCost: number;
  netSalesWithCostCents: number;
  netSalesWithoutCostCents: number;
  costCoverageByLinesBps: number | null;
  costCoverageByAmountBps: number | null;
};

export function buildRetailCommercialCoverage(
  rows: ReadonlyArray<{ line: PriceTierEconomicLine; economics?: ReturnType<typeof calculatePriceTierEconomics> }>,
): RetailCommercialCoverage {
  const result: RetailCommercialCoverage = {
    totalLines: rows.length,
    publicLines: 0,
    wholesaleLines: 0,
    unknownLines: 0,
    totalNetSalesCents: 0,
    publicNetSalesCents: 0,
    wholesaleNetSalesCents: 0,
    unknownNetSalesCents: 0,
    linesWithCost: 0,
    linesWithoutCost: 0,
    netSalesWithCostCents: 0,
    netSalesWithoutCostCents: 0,
    costCoverageByLinesBps: null,
    costCoverageByAmountBps: null,
  };

  for (const row of rows) {
    const economics = row.economics ?? calculatePriceTierEconomics(row.line);
    const net = economics.finalNetCents ?? 0;
    result.totalNetSalesCents += net;
    if (economics.tier === "public") {
      result.publicLines += 1;
      result.publicNetSalesCents += net;
    } else if (economics.tier === "wholesale") {
      result.wholesaleLines += 1;
      result.wholesaleNetSalesCents += net;
    } else {
      result.unknownLines += 1;
      result.unknownNetSalesCents += net;
    }

    if (economics.costCents === null) {
      result.linesWithoutCost += 1;
      result.netSalesWithoutCostCents += net;
    } else {
      result.linesWithCost += 1;
      result.netSalesWithCostCents += net;
    }
  }

  result.costCoverageByLinesBps = result.totalLines === 0
    ? null
    : Math.round((result.linesWithCost * 10_000) / result.totalLines);
  result.costCoverageByAmountBps = result.totalNetSalesCents === 0
    ? null
    : Math.round((result.netSalesWithCostCents * 10_000) / result.totalNetSalesCents);
  return result;
}

export function classifyPriceTier(lines: PriceTierEconomicLine[]): PriceTierClassification | "mixed" {
  const tiers = new Set(lines.map(getApprovedPriceTier));
  if (tiers.has("wholesale") && tiers.has("public")) return "mixed";
  if (tiers.has("unknown")) return tiers.size === 1 ? "unknown" : "mixed";
  return tiers.has("wholesale") ? "wholesale" : "public";
}

export function classifyPriceTierDecision(line: PriceTierEconomicLine) {
  if (line.requestedPriceTier === "wholesale" && line.approvedPriceTier === "wholesale") return "requested_approved" as const;
  if (line.requestedPriceTier === "wholesale" && line.approvedPriceTier === "public") return "requested_rejected" as const;
  if (line.requestedPriceTier === "public" && line.approvedPriceTier === "wholesale") return "cashier_direct" as const;
  return "public" as const;
}
