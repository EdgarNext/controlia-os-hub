export type RetailPosHistoricalSalePriceTier = "public" | "wholesale";

export type RetailPosHistoricalSaleLineInput = {
  lineNumber: number;
  quantity: string;
  publicUnitPriceSnapshotCents: number | null | undefined;
  wholesaleUnitPriceSnapshotCents: number | null | undefined;
  approvedPriceTier: RetailPosHistoricalSalePriceTier | null | undefined;
  approvedUnitPriceCents: number | null | undefined;
  unitPriceCents: number | null | undefined;
  unitCostSnapshotCents: number | null | undefined;
};

export type RetailPosHistoricalSaleLineIssue = {
  code:
    | "APPROVED_PRICE_TIER_REQUIRED"
    | "PRICE_SNAPSHOT_REQUIRED"
    | "APPROVED_PRICE_MISMATCH"
    | "APPLIED_PRICE_MISMATCH"
    | "HISTORICAL_COST_REQUIRED"
    | "INVALID_QUANTITY"
    | "INVALID_MONEY_VALUE";
  lineNumber: number;
};

function isNonNegativeInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= 0;
}

export function getRetailPosApprovedBasePriceCents(
  line: Pick<
    RetailPosHistoricalSaleLineInput,
    | "approvedPriceTier"
    | "publicUnitPriceSnapshotCents"
    | "wholesaleUnitPriceSnapshotCents"
  >,
) {
  if (line.approvedPriceTier === "public") return line.publicUnitPriceSnapshotCents ?? null;
  if (line.approvedPriceTier === "wholesale") return line.wholesaleUnitPriceSnapshotCents ?? null;
  return null;
}

export function validateRetailPosHistoricalSaleLine(
  line: RetailPosHistoricalSaleLineInput,
  options: { requireHistoricalCost?: boolean } = {},
): RetailPosHistoricalSaleLineIssue[] {
  const issues: RetailPosHistoricalSaleLineIssue[] = [];
  const add = (code: RetailPosHistoricalSaleLineIssue["code"]) =>
    issues.push({ code, lineNumber: line.lineNumber });

  if (!/^\d+(?:\.\d+)?$/.test(line.quantity) || Number(line.quantity) <= 0) {
    add("INVALID_QUANTITY");
  }

  if (line.approvedPriceTier !== "public" && line.approvedPriceTier !== "wholesale") {
    add("APPROVED_PRICE_TIER_REQUIRED");
    return issues;
  }

  if (
    !isNonNegativeInteger(line.publicUnitPriceSnapshotCents) ||
    !isNonNegativeInteger(line.wholesaleUnitPriceSnapshotCents)
  ) {
    add("PRICE_SNAPSHOT_REQUIRED");
  }

  const approvedBasePriceCents = getRetailPosApprovedBasePriceCents(line);
  if (!isNonNegativeInteger(approvedBasePriceCents) || line.approvedUnitPriceCents !== approvedBasePriceCents) {
    add("APPROVED_PRICE_MISMATCH");
  }

  if (!isNonNegativeInteger(line.unitPriceCents) || line.unitPriceCents !== approvedBasePriceCents) {
    add("APPLIED_PRICE_MISMATCH");
  }

  if (options.requireHistoricalCost !== false && !isNonNegativeInteger(line.unitCostSnapshotCents)) {
    add("HISTORICAL_COST_REQUIRED");
  }

  return issues;
}

export function assertRetailPosHistoricalSaleLine(
  line: RetailPosHistoricalSaleLineInput,
  options: { requireHistoricalCost?: boolean } = {},
) {
  const issues = validateRetailPosHistoricalSaleLine(line, options);
  return { ok: issues.length === 0, issues } as const;
}
