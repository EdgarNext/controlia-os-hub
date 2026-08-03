import type { RetailPosPaymentMethod } from "@/shared/types/retail-pos";

export type RetailPosPaymentSummaryMethod = RetailPosPaymentMethod | "mixed";

export type RetailPosPaymentTenderDraft = {
  sequence: number;
  method: RetailPosPaymentMethod;
  amount_cents: number;
  received_amount_cents: number | null;
  reference: string | null;
};

export type RetailPosPaymentTender = RetailPosPaymentTenderDraft & {
  change_cents: number;
};

export type RetailPosOrderPaymentApplicationDraft = {
  order_id: string;
  amount_cents: number;
};

export type RetailPosPaymentTransactionDraft = {
  command_id: string;
  order_id: string;
  expected_order_revision: number;
  tenders: RetailPosPaymentTenderDraft[];
};

export type RetailPosPaymentValidationErrorCode =
  | "AMBIGUOUS_PAYMENT_INPUT"
  | "INVALID_TOTAL"
  | "EMPTY_TENDERS"
  | "TOO_MANY_TENDERS"
  | "DUPLICATE_METHOD"
  | "INVALID_SEQUENCE"
  | "UNSUPPORTED_METHOD"
  | "INVALID_AMOUNT"
  | "CASH_RECEIVED_REQUIRED"
  | "CASH_RECEIVED_INSUFFICIENT"
  | "CARD_RECEIVED_NOT_ALLOWED"
  | "TOTAL_MISMATCH";

export type RetailPosPaymentValidationError = {
  code: RetailPosPaymentValidationErrorCode;
  sequence: number | null;
};

export type RetailPosPaymentValidationResult = {
  ok: boolean;
  errors: RetailPosPaymentValidationError[];
};

export type RetailPosPaymentNormalizationResult =
  | { ok: true; tenders: RetailPosPaymentTender[] }
  | { ok: false; errors: RetailPosPaymentValidationError[] };

export type RetailPosPaymentSummary = {
  method: RetailPosPaymentSummaryMethod;
  cash_amount_cents: number;
  card_amount_cents: number;
  tender_count: number;
};

export type RetailPosPaymentFingerprintPayload = {
  order_id: string;
  expected_order_revision: number;
  tenders: Array<{
    sequence: number;
    method: RetailPosPaymentMethod;
    amount_cents: number;
    received_amount_cents: number | null;
    reference: string | null;
  }>;
};

export type RetailPosLegacyPaymentInput = {
  command_id: string;
  order_id: string;
  expected_order_revision: number;
  payment_method: RetailPosPaymentMethod;
  amount_cents: number;
  received_amount_cents: number | null;
  card_reference: string | null;
};

export type RetailPosPaymentRequestInput = {
  payment?: RetailPosLegacyPaymentInput;
  tenders?: RetailPosPaymentTenderDraft[];
};

function isSafeNonNegativeInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0;
}

function normalizeReference(reference: string | null) {
  const normalized = reference?.trim() ?? "";
  return normalized || null;
}

function error(code: RetailPosPaymentValidationErrorCode, sequence: number | null = null) {
  return { code, sequence } satisfies RetailPosPaymentValidationError;
}

export function normalizeRetailPosPaymentTenders(
  tenders: RetailPosPaymentTenderDraft[],
): RetailPosPaymentNormalizationResult {
  if (tenders.length === 0) return { ok: false, errors: [error("EMPTY_TENDERS")] };
  if (tenders.length > 2) return { ok: false, errors: [error("TOO_MANY_TENDERS")] };

  const errors: RetailPosPaymentValidationError[] = [];
  const sequences = new Set<number>();
  const methods = new Set<RetailPosPaymentMethod>();

  for (const tender of tenders) {
    if (!isSafeNonNegativeInteger(tender.sequence) || tender.sequence < 1 || tender.sequence > 2) {
      errors.push(error("INVALID_SEQUENCE", tender.sequence));
    } else if (sequences.has(tender.sequence)) {
      errors.push(error("INVALID_SEQUENCE", tender.sequence));
    } else {
      sequences.add(tender.sequence);
    }

    if (tender.method !== "cash" && tender.method !== "card") {
      errors.push(error("UNSUPPORTED_METHOD", tender.sequence));
    } else if (methods.has(tender.method)) {
      errors.push(error("DUPLICATE_METHOD", tender.sequence));
    } else {
      methods.add(tender.method);
    }

    if (!isSafeNonNegativeInteger(tender.amount_cents) || tender.amount_cents <= 0) {
      errors.push(error("INVALID_AMOUNT", tender.sequence));
    }

    if (tender.method === "cash") {
      if (!isSafeNonNegativeInteger(tender.received_amount_cents)) {
        errors.push(error("CASH_RECEIVED_REQUIRED", tender.sequence));
      } else if (tender.received_amount_cents < tender.amount_cents) {
        errors.push(error("CASH_RECEIVED_INSUFFICIENT", tender.sequence));
      }
    }

    if (tender.method === "card" && tender.received_amount_cents !== null) {
      errors.push(error("CARD_RECEIVED_NOT_ALLOWED", tender.sequence));
    }
  }

  if (errors.length > 0) return { ok: false, errors };

  const normalized = [...tenders]
    .sort((left, right) => left.sequence - right.sequence)
    .map((tender) => ({
      ...tender,
      reference: normalizeReference(tender.reference),
      change_cents: tender.method === "cash"
        ? (tender.received_amount_cents as number) - tender.amount_cents
        : 0,
    }));

  const expectedSequences = normalized.length === 1 ? [1] : [1, 2];
  if (normalized.some((tender, index) => tender.sequence !== expectedSequences[index])) {
    return { ok: false, errors: [error("INVALID_SEQUENCE")] };
  }

  return { ok: true, tenders: normalized };
}

export function sumRetailPosAppliedAmountCents(
  tenders: RetailPosPaymentTender[] | RetailPosPaymentTenderDraft[],
) {
  return tenders.reduce((total, tender) => total + tender.amount_cents, 0);
}

export function deriveRetailPosCashChangeCents(tender: RetailPosPaymentTenderDraft) {
  if (tender.method !== "cash" || tender.received_amount_cents === null) return 0;
  return tender.received_amount_cents - tender.amount_cents;
}

export function deriveRetailPosPaymentSummary(
  tenders: RetailPosPaymentTender[] | RetailPosPaymentTenderDraft[],
): RetailPosPaymentSummary {
  const cashAmount = tenders
    .filter((tender) => tender.method === "cash")
    .reduce((total, tender) => total + tender.amount_cents, 0);
  const cardAmount = tenders
    .filter((tender) => tender.method === "card")
    .reduce((total, tender) => total + tender.amount_cents, 0);

  return {
    method: cashAmount > 0 && cardAmount > 0 ? "mixed" : cashAmount > 0 ? "cash" : "card",
    cash_amount_cents: cashAmount,
    card_amount_cents: cardAmount,
    tender_count: tenders.length,
  };
}

export function validateRetailPosPaymentTransactionAgainstTotal(
  transaction: RetailPosPaymentTransactionDraft,
  expectedTotalCents: number,
): RetailPosPaymentValidationResult & { normalized_tenders?: RetailPosPaymentTender[] } {
  if (!isSafeNonNegativeInteger(expectedTotalCents) || expectedTotalCents <= 0) {
    return { ok: false, errors: [error("INVALID_TOTAL")] };
  }

  const normalized = normalizeRetailPosPaymentTenders(transaction.tenders);
  if (!normalized.ok) return normalized;

  const appliedAmount = sumRetailPosAppliedAmountCents(normalized.tenders);
  if (appliedAmount !== expectedTotalCents) {
    return { ok: false, errors: [error("TOTAL_MISMATCH")], normalized_tenders: normalized.tenders };
  }

  return { ok: true, errors: [], normalized_tenders: normalized.tenders };
}

export function buildRetailPosPaymentFingerprintPayload(
  transaction: RetailPosPaymentTransactionDraft,
): RetailPosPaymentFingerprintPayload | RetailPosPaymentValidationResult {
  const normalized = normalizeRetailPosPaymentTenders(transaction.tenders);
  if (!normalized.ok) return normalized;

  return {
    order_id: transaction.order_id,
    expected_order_revision: transaction.expected_order_revision,
    tenders: normalized.tenders.map(({ sequence, method, amount_cents, received_amount_cents, reference }) => ({
      sequence,
      method,
      amount_cents,
      received_amount_cents,
      reference,
    })),
  };
}

export function adaptLegacyPaymentToTransactionDraft(
  payment: RetailPosLegacyPaymentInput,
): RetailPosPaymentTransactionDraft {
  return {
    command_id: payment.command_id,
    order_id: payment.order_id,
    expected_order_revision: payment.expected_order_revision,
    tenders: [{
      sequence: 1,
      method: payment.payment_method,
      amount_cents: payment.amount_cents,
      received_amount_cents: payment.received_amount_cents,
      reference: payment.card_reference,
    }],
  };
}

export function normalizeRetailPosPaymentRequest(
  input: RetailPosPaymentRequestInput,
): RetailPosPaymentTransactionDraft | RetailPosPaymentValidationResult {
  const hasLegacy = input.payment !== undefined;
  const hasTenders = input.tenders !== undefined;
  if (hasLegacy === hasTenders) {
    return { ok: false, errors: [{ code: "AMBIGUOUS_PAYMENT_INPUT", sequence: null }] };
  }

  const transaction = hasLegacy
    ? adaptLegacyPaymentToTransactionDraft(input.payment as RetailPosLegacyPaymentInput)
    : {
        command_id: "",
        order_id: "",
        expected_order_revision: 0,
        tenders: input.tenders as RetailPosPaymentTenderDraft[],
      };
  const normalized = normalizeRetailPosPaymentTenders(transaction.tenders);
  if (!normalized.ok) return normalized;
  return { ...transaction, tenders: normalized.tenders };
}
