export type CashFinancialTransaction = {
  id: string;
  total_applied_cents: number;
  cash_shift_id: string;
};

export type CashFinancialApplication = {
  payment_transaction_id: string;
  amount_cents: number;
};

/**
 * A payment transaction is financially settled only after an effective
 * application exists for it. Payment rows and retry attempts are evidence,
 * not independent sales.
 */
export function getCanonicalCashTransactionIds(
  transactions: Pick<CashFinancialTransaction, "id">[],
  applications: CashFinancialApplication[],
) {
  const transactionIds = new Set(transactions.map((transaction) => transaction.id));
  return new Set(
    applications
      .filter((application) => application.amount_cents > 0 && transactionIds.has(application.payment_transaction_id))
      .map((application) => application.payment_transaction_id),
  );
}

export type CashFinancialTender = {
  id: string;
  payment_transaction_id: string | null;
  cash_shift_id: string;
  payment_method: "cash" | "card";
  amount_cents: number;
  received_amount_cents: number | null;
  change_cents: number;
};

export type CashFinancialRefundComponent = {
  id: string;
  post_sale_document_id: string;
  cash_shift_id?: string | null;
  refund_method: "cash" | "card";
  amount_cents: number;
  status: "completed" | "pending_external_confirmation" | "failed" | "cancelled";
};

export type CashFinancialCashMovement = {
  id: string;
  cash_shift_id: string;
  movement_type: "post_sale_cash_refund";
  amount_cents: number;
};

export type CashFinancialSummaryInput = {
  opening_float_cents: number;
  transactions: CashFinancialTransaction[];
  tenders: CashFinancialTender[];
  applications?: CashFinancialApplication[];
  refund_components?: CashFinancialRefundComponent[];
  cash_movements?: CashFinancialCashMovement[];
  other_cash_in_cents?: number;
  other_cash_out_cents?: number;
};

export type RetailPosCashFinancialSummary = {
  sales_count: number;
  payment_transactions_count: number;
  tenders_count: number;
  cash_only_sales_count: number;
  card_only_sales_count: number;
  mixed_sales_count: number;
  cash_tenders_count: number;
  card_tenders_count: number;
  gross_sales_cents: number;
  cash_sales_cents: number;
  card_sales_cents: number;
  cash_received_cents: number;
  cash_change_cents: number;
  completed_cash_refunds_cents: number;
  completed_card_refunds_cents: number;
  pending_card_refunds_cents: number;
  completed_refunds_cents: number;
  pending_refunds_cents: number;
  settled_net_sales_cents: number;
  opening_float_cents: number;
  other_cash_in_cents: number;
  other_cash_out_cents: number;
  expected_cash_cents: number;
  expected_cash_variation_cents?: number;
  reconciliation: {
    tender_total_matches_sales: boolean;
    application_total_matches_sales?: boolean;
    received_less_change_matches_cash_sales: boolean;
    cash_components_match_cash_movements: boolean;
  };
  warnings: string[];
};

export function getRetailCashFinancialReconciliationMessages(
  summary: Pick<RetailPosCashFinancialSummary, "reconciliation">,
) {
  return [
    !summary.reconciliation.tender_total_matches_sales
      ? "Los componentes de cobro no coinciden con las ventas."
      : null,
    !summary.reconciliation.application_total_matches_sales
      ? "Las aplicaciones de pago no coinciden con las ventas liquidadas."
      : null,
    !summary.reconciliation.received_less_change_matches_cash_sales
      ? "El efectivo recibido menos el cambio no coincide con el efectivo aplicado."
      : null,
    !summary.reconciliation.cash_components_match_cash_movements
      ? "Las devoluciones de efectivo no coinciden con los movimientos de caja."
      : null,
  ].filter((message): message is string => Boolean(message));
}

function sum(values: number[]) {
  return values.reduce((total, value) => total + value, 0);
}

export function buildRetailPosCashFinancialSummary(
  input: CashFinancialSummaryInput,
): RetailPosCashFinancialSummary {
  const transactions = new Map(input.transactions.map((transaction) => [transaction.id, transaction]));
  const applicationsByTransaction = new Map<string, number>();
  for (const application of input.applications ?? []) {
    applicationsByTransaction.set(
      application.payment_transaction_id,
      (applicationsByTransaction.get(application.payment_transaction_id) ?? 0) + application.amount_cents,
    );
  }
  const tendersByTransaction = new Map<string, CashFinancialTender[]>();
  const warnings: string[] = [];

  for (const tender of input.tenders) {
    if (!tender.payment_transaction_id || !transactions.has(tender.payment_transaction_id)) {
      warnings.push(`orphan_tender:${tender.id}`);
      continue;
    }
    const bucket = tendersByTransaction.get(tender.payment_transaction_id) ?? [];
    bucket.push(tender);
    tendersByTransaction.set(tender.payment_transaction_id, bucket);
  }

  let grossSalesCents = 0;
  let cashSalesCents = 0;
  let cardSalesCents = 0;
  let cashReceivedCents = 0;
  let cashChangeCents = 0;
  let cashOnlySalesCount = 0;
  let cardOnlySalesCount = 0;
  let mixedSalesCount = 0;
  let salesCount = 0;

  for (const transaction of transactions.values()) {
    const tenders = tendersByTransaction.get(transaction.id) ?? [];
    const tenderTotal = sum(tenders.map((tender) => tender.amount_cents));
    if (tenderTotal !== transaction.total_applied_cents) {
      warnings.push(`transaction_tender_total_mismatch:${transaction.id}`);
    }
    if (tenders.length === 0) {
      warnings.push(`transaction_without_tenders:${transaction.id}`);
      continue;
    }
    salesCount += 1;
    grossSalesCents += transaction.total_applied_cents;
    const hasCash = tenders.some((tender) => tender.payment_method === "cash");
    const hasCard = tenders.some((tender) => tender.payment_method === "card");
    if (hasCash && hasCard) mixedSalesCount += 1;
    else if (hasCash) cashOnlySalesCount += 1;
    else if (hasCard) cardOnlySalesCount += 1;
  }

  for (const tender of input.tenders) {
    if (tender.payment_method === "cash") {
      cashSalesCents += tender.amount_cents;
      cashReceivedCents += tender.received_amount_cents ?? 0;
      cashChangeCents += tender.change_cents;
    } else {
      cardSalesCents += tender.amount_cents;
    }
  }

  const receivedLessChangeMatchesCashSales = cashReceivedCents - cashChangeCents === cashSalesCents;
  if (!receivedLessChangeMatchesCashSales) warnings.push("cash_received_less_change_mismatch");

  const components = input.refund_components ?? [];
  const completedCashRefundsCents = sum(
    components.filter((component) => component.refund_method === "cash" && component.status === "completed").map((component) => component.amount_cents),
  );
  const completedCardRefundsCents = sum(
    components.filter((component) => component.refund_method === "card" && component.status === "completed").map((component) => component.amount_cents),
  );
  const pendingCardRefundsCents = sum(
    components.filter((component) => component.refund_method === "card" && component.status === "pending_external_confirmation").map((component) => component.amount_cents),
  );
  const completedRefundsCents = completedCashRefundsCents + completedCardRefundsCents;
  const pendingRefundsCents = pendingCardRefundsCents;
  const cashMovementsCents = sum(
    (input.cash_movements ?? []).filter((movement) => movement.movement_type === "post_sale_cash_refund").map((movement) => movement.amount_cents),
  );
  const cashComponentsMatchCashMovements = completedCashRefundsCents === cashMovementsCents;
  if (!cashComponentsMatchCashMovements) warnings.push("cash_component_movement_mismatch");

  const otherCashInCents = input.other_cash_in_cents ?? 0;
  const otherCashOutCents = input.other_cash_out_cents ?? 0;
  const expectedCashCents =
    input.opening_float_cents + cashSalesCents + otherCashInCents - otherCashOutCents - completedCashRefundsCents;
  const expectedCashVariationCents = cashSalesCents + otherCashInCents - otherCashOutCents - completedCashRefundsCents;
  const applicationTotalMatchesSales = input.applications === undefined
    ? true
    : [...transactions.values()].every(
        (transaction) => (applicationsByTransaction.get(transaction.id) ?? 0) === transaction.total_applied_cents,
      );
  if (!applicationTotalMatchesSales) warnings.push("transaction_application_total_mismatch");

  return {
    sales_count: salesCount,
    payment_transactions_count: transactions.size,
    tenders_count: input.tenders.length,
    cash_only_sales_count: cashOnlySalesCount,
    card_only_sales_count: cardOnlySalesCount,
    mixed_sales_count: mixedSalesCount,
    cash_tenders_count: input.tenders.filter((tender) => tender.payment_method === "cash").length,
    card_tenders_count: input.tenders.filter((tender) => tender.payment_method === "card").length,
    gross_sales_cents: grossSalesCents,
    cash_sales_cents: cashSalesCents,
    card_sales_cents: cardSalesCents,
    cash_received_cents: cashReceivedCents,
    cash_change_cents: cashChangeCents,
    completed_cash_refunds_cents: completedCashRefundsCents,
    completed_card_refunds_cents: completedCardRefundsCents,
    pending_card_refunds_cents: pendingCardRefundsCents,
    completed_refunds_cents: completedRefundsCents,
    pending_refunds_cents: pendingRefundsCents,
    settled_net_sales_cents: grossSalesCents - completedRefundsCents,
    opening_float_cents: input.opening_float_cents,
    other_cash_in_cents: otherCashInCents,
    other_cash_out_cents: otherCashOutCents,
    expected_cash_cents: expectedCashCents,
    expected_cash_variation_cents: expectedCashVariationCents,
    reconciliation: {
      tender_total_matches_sales: cashSalesCents + cardSalesCents === grossSalesCents && !warnings.some((warning) => warning.includes("transaction_tender_total_mismatch")),
      application_total_matches_sales: applicationTotalMatchesSales,
      received_less_change_matches_cash_sales: receivedLessChangeMatchesCashSales,
      cash_components_match_cash_movements: cashComponentsMatchCashMovements,
    },
    warnings,
  };
}
