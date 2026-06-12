const RETAIL_POS_CANONICAL_QUANTITY_PATTERN = /^(0|[1-9]\d*)\.\d{3}$/;
const RETAIL_POS_NORMALIZABLE_QUANTITY_PATTERN = /^(0|[1-9]\d*)(?:\.(\d{1,3}))?$/;

export function isRetailPosCanonicalQuantity(value: string): boolean {
  return RETAIL_POS_CANONICAL_QUANTITY_PATTERN.test(value) && value !== "0.000";
}

export function normalizeRetailPosQuantity(input: string): string | null {
  const normalizedInput = input.trim();
  const match = RETAIL_POS_NORMALIZABLE_QUANTITY_PATTERN.exec(normalizedInput);

  if (!match) {
    return null;
  }

  const integerPart = match[1];
  const decimalPartSource = match[2] ?? "";
  const decimalPart = `${decimalPartSource}000`.slice(0, 3);
  const normalized = `${integerPart}.${decimalPart}`;

  return normalized === "0.000" ? null : normalized;
}
