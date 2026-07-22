export type ExistingPurchaseOptionDraftLine = {
  mode: "existing_purchase_option";
  itemId: string;
  purchaseOptionId: string;
  newPrice: string | number;
  usedForCosting: boolean;
  notes?: string;
};

export type NewPurchaseOptionDraftPayload = {
  purchaseUnitId: string;
  quantityPerPurchaseUnit: string | number;
  inventoryUnitId: string;
};

export type NewPurchaseOptionDraftLine = {
  mode: "new_purchase_option";
  itemId: string;
  newPurchaseOption: NewPurchaseOptionDraftPayload;
  newPrice: string | number;
  usedForCosting: boolean;
  notes?: string;
};

export type PriceUpdateDraftLine = ExistingPurchaseOptionDraftLine | NewPurchaseOptionDraftLine;

export function parseNumericInput(input: string | number | null | undefined): number | null {
  if (typeof input === "number") {
    return Number.isFinite(input) ? input : null;
  }

  const normalized = String(input ?? "").trim();
  if (!normalized) return null;

  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

export function roundTo(value: number, decimals = 4): number {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}
