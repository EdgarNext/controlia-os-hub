import type { RetailPosPurchaseCostingDetail, RetailPosPurchaseCostingLine } from "@/shared/types/retail-pos";

export type PurchaseCostingMutationPatch = Record<string, unknown>;
export type PurchaseCostingMutationEnvelope = {
  mutationId: number;
  expectedRevision: number;
  baseDocument: RetailPosPurchaseCostingDetail;
  patch: PurchaseCostingMutationPatch;
};

type HeaderField = "supplierId" | "invoiceReference" | "invoiceDate" | "taxRateBps" | "discountRateBps" | "defaultPublicMarkupBps" | "defaultWholesaleMarkupBps";

export function reconcilePurchaseCostingDocument(
  serverDocument: RetailPosPurchaseCostingDetail,
  localDocument: RetailPosPurchaseCostingDetail,
  mutation: PurchaseCostingMutationEnvelope,
) {
  const mergedLines = serverDocument.lines.map((serverLine) => {
    const localLine = localDocument.lines.find((line) => line.id === serverLine.id);
    const baseLine = mutation.baseDocument.lines.find((line) => line.id === serverLine.id);
    if (!localLine || !baseLine) return serverLine;
    const mergedLine = { ...serverLine };
    for (const key of Object.keys(localLine) as Array<keyof RetailPosPurchaseCostingLine>) {
      if (!Object.is(localLine[key], baseLine[key])) mergedLine[key] = localLine[key] as never;
    }
    return mergedLine;
  });
  const merged = { ...serverDocument, lines: mergedLines } as RetailPosPurchaseCostingDetail;
  const headerFields: HeaderField[] = ["supplierId", "invoiceReference", "invoiceDate", "taxRateBps", "discountRateBps", "defaultPublicMarkupBps", "defaultWholesaleMarkupBps"];
  for (const field of headerFields) {
    if (!Object.is(localDocument[field], mutation.baseDocument[field])) merged[field] = localDocument[field] as never;
  }
  return merged;
}
