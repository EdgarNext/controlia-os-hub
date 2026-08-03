export type PostSaleReportDocument = {
  id: string;
  original_order_id: string;
  original_folio: string;
  cash_shift_id: string | null;
  document_type: "sale_cancellation" | "return_full" | "return_partial";
  status: "draft" | "pending_confirmation" | "completed" | "rejected" | "cancelled" | "failed";
  refund_status: "not_required" | "pending" | "completed" | "failed" | "cancelled";
  refund_method: "cash" | "card_external" | "store_credit_future" | "mixed";
  gross_amount_cents: number;
  discount_amount_cents: number;
  net_amount_cents: number;
  refund_amount_cents: number;
  reason_code: string;
  comment: string | null;
  created_by_pos_user_id: string | null;
  responsible_user_name: string | null;
  created_at: string;
  confirmed_at: string | null;
};

export type PostSaleReportLegacyRefund = {
  id: string;
  post_sale_document_id: string;
  refund_method: "cash" | "card_external" | "store_credit_future";
  status: "not_required" | "pending" | "completed" | "failed" | "cancelled";
  amount_cents: number;
  external_reference: string | null;
  processed_at: string | null;
};

export type PostSaleReportComponent = {
  id: string;
  post_sale_document_id: string;
  refund_method: "cash" | "card";
  amount_cents: number;
  status: "completed" | "pending_external_confirmation" | "failed" | "cancelled";
  external_reference?: string | null;
  confirmed_at?: string | null;
};

export type PostSaleReportPayment = {
  order_id: string;
  payment_method: "cash" | "card";
};

export type PostSaleReportCashMovement = {
  post_sale_document_id: string | null;
  amount_cents: number;
};

export type PostSaleReportLine = {
  post_sale_document_id: string;
  line_number: number;
  quantity_returned_now: string | number;
};

export type PostSaleReportFilters = {
  operationType: "all" | "sale_cancellation" | "return_full" | "return_partial";
  refundStatus: "all" | "not_required" | "pending" | "completed" | "failed" | "cancelled";
  refundMethod: "all" | "cash" | "card_external" | "store_credit_future" | "mixed";
  reasonCode: string | null;
  responsibleUserId: string | null;
};

export type PostSaleReportRow = {
  documentId: string;
  registeredAt: string;
  confirmedAt: string | null;
  processedAt: string | null;
  operationType: PostSaleReportDocument["document_type"];
  operationLabel: string;
  originalOrderId: string;
  originalFolio: string;
  originalPaymentMethod: "cash" | "card" | "mixed" | "unknown";
  refundMethod: "cash" | "card_external" | "store_credit_future" | "mixed" | null;
  refundStatus: "not_required" | "pending" | "completed" | "failed" | "cancelled" | null;
  commercialAmountCents: number;
  refundAmountCents: number;
  cashReturnedCents: number;
  cardCompletedCents: number;
  cardPendingCents: number;
  reasonCode: string;
  comment: string | null;
  responsibleUserName: string | null;
  responsibleUserId: string | null;
  externalReference: string | null;
  cashShiftId: string | null;
  lineCount: number;
  quantityReturned: number;
  componentCount: number;
  hasModernComponents: boolean;
  coverageLabel: "Componentes modernos" | "Registro histórico";
};

function sum(values: number[]) {
  return values.reduce((total, value) => total + value, 0);
}

function parseQuantity(value: string | number) {
  const parsed = typeof value === "number" ? value : Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function operationLabel(type: PostSaleReportDocument["document_type"]) {
  return type === "sale_cancellation"
    ? "Venta cancelada"
    : type === "return_full"
      ? "Devolución total"
      : "Devolución parcial";
}

function classifyPaymentMethods(methods: Array<"cash" | "card">): "cash" | "card" | "mixed" | "unknown" {
  const unique = new Set(methods);
  if (unique.size === 0) return "unknown";
  if (unique.has("cash") && unique.has("card")) return "mixed";
  return unique.has("cash") ? "cash" : "card";
}

export function buildPostSaleReportSummary(input: {
  documents: PostSaleReportDocument[];
  legacyRefunds: PostSaleReportLegacyRefund[];
  components: PostSaleReportComponent[];
  payments: PostSaleReportPayment[];
  cashMovements: PostSaleReportCashMovement[];
  lines: PostSaleReportLine[];
  filters: PostSaleReportFilters;
}) {
  const legacyByDocument = new Map<string, PostSaleReportLegacyRefund>();
  for (const refund of input.legacyRefunds) {
    const current = legacyByDocument.get(refund.post_sale_document_id);
    if (!current || (current.processed_at ?? "") < (refund.processed_at ?? "")) {
      legacyByDocument.set(refund.post_sale_document_id, refund);
    }
  }
  const componentsByDocument = new Map<string, PostSaleReportComponent[]>();
  for (const component of input.components) {
    const bucket = componentsByDocument.get(component.post_sale_document_id) ?? [];
    bucket.push(component);
    componentsByDocument.set(component.post_sale_document_id, bucket);
  }
  const methodsByOrder = new Map<string, Array<"cash" | "card">>();
  for (const payment of input.payments) {
    const bucket = methodsByOrder.get(payment.order_id) ?? [];
    bucket.push(payment.payment_method);
    methodsByOrder.set(payment.order_id, bucket);
  }
  const linesByDocument = new Map<string, PostSaleReportLine[]>();
  for (const line of input.lines) {
    const bucket = linesByDocument.get(line.post_sale_document_id) ?? [];
    bucket.push(line);
    linesByDocument.set(line.post_sale_document_id, bucket);
  }

  const records = input.documents.map((document) => {
    const modernComponents = componentsByDocument.get(document.id) ?? [];
    const legacy = legacyByDocument.get(document.id);
    const components = modernComponents.length > 0
      ? modernComponents
      : legacy
        ? [{
            id: legacy.id,
            post_sale_document_id: document.id,
            refund_method: legacy.refund_method === "cash" ? "cash" as const : "card" as const,
            amount_cents: legacy.amount_cents,
            status: legacy.status === "pending"
              ? "pending_external_confirmation" as const
              : legacy.status === "completed"
                ? "completed" as const
                : legacy.status === "failed"
                  ? "failed" as const
                  : "cancelled" as const,
            external_reference: legacy.external_reference,
          }]
        : [];
    const hasPending = components.some((component) => component.status === "pending_external_confirmation");
    const effectiveStatus = components.length === 0
      ? document.refund_status
      : hasPending
        ? "pending"
        : components.every((component) => component.status === "completed")
          ? "completed"
          : components.some((component) => component.status === "failed")
            ? "failed"
            : "cancelled";
    const hasCash = components.some((component) => component.refund_method === "cash");
    const hasCard = components.some((component) => component.refund_method === "card");
    const refundMethod = components.length === 0
      ? (document.refund_amount_cents > 0 ? document.refund_method : null)
      : hasCash && hasCard ? "mixed" : hasCash ? "cash" : "card_external";
    const cashReturnedCents = sum(components.filter((component) => component.refund_method === "cash" && component.status === "completed").map((component) => component.amount_cents));
    const cardCompletedCents = sum(components.filter((component) => component.refund_method === "card" && component.status === "completed").map((component) => component.amount_cents));
    const cardPendingCents = sum(components.filter((component) => component.refund_method === "card" && component.status === "pending_external_confirmation").map((component) => component.amount_cents));
    return {
      document,
      components,
      legacy: modernComponents.length === 0 && Boolean(legacy),
      effectiveStatus,
      refundMethod,
      originalPaymentMethod: classifyPaymentMethods(methodsByOrder.get(document.original_order_id) ?? []),
      cashReturnedCents,
      cardCompletedCents,
      cardPendingCents,
      lineRows: linesByDocument.get(document.id) ?? [],
    };
  }).filter((record) => {
    const { document } = record;
    return (input.filters.operationType === "all" || input.filters.operationType === document.document_type)
      && (input.filters.refundStatus === "all" || input.filters.refundStatus === record.effectiveStatus)
      && (input.filters.refundMethod === "all" || input.filters.refundMethod === record.refundMethod)
      && (!input.filters.reasonCode || input.filters.reasonCode === document.reason_code)
      && (!input.filters.responsibleUserId || input.filters.responsibleUserId === document.created_by_pos_user_id);
  });

  const cashComponentsCents = sum(records.flatMap((record) => record.components.filter((component) => component.refund_method === "cash" && component.status === "completed").map((component) => component.amount_cents)));
  const cardComponentsCents = sum(records.flatMap((record) => record.components.filter((component) => component.refund_method === "card" && component.status === "completed").map((component) => component.amount_cents)));
  const pendingCardCents = sum(records.flatMap((record) => record.components.filter((component) => component.refund_method === "card" && component.status === "pending_external_confirmation").map((component) => component.amount_cents)));
  const componentTotalsMatchDocuments = records.every((record) => sum(record.components.map((component) => component.amount_cents)) === record.document.refund_amount_cents);
  const cashMovementByDocument = new Map<string, number>();
  for (const movement of input.cashMovements) {
    if (movement.post_sale_document_id) {
      cashMovementByDocument.set(movement.post_sale_document_id, (cashMovementByDocument.get(movement.post_sale_document_id) ?? 0) + movement.amount_cents);
    }
  }
  const completedCashMatchesMovements = records.every((record) => record.cashReturnedCents === (cashMovementByDocument.get(record.document.id) ?? 0));
  const completedDocumentsHaveNoPendingComponents = records.every((record) => record.document.status !== "completed" || !record.components.some((component) => component.status === "pending_external_confirmation"));
  const warnings = [
    !componentTotalsMatchDocuments ? "Los componentes de reembolso no coinciden con el total cancelado." : null,
    !completedCashMatchesMovements ? "Las devoluciones de efectivo no coinciden con los movimientos de caja." : null,
    !completedDocumentsHaveNoPendingComponents ? "Existe un documento completado con componentes pendientes." : null,
    records.some((record) => record.components.length === 0 && record.document.refund_amount_cents > 0) ? "No fue posible demostrar la distribución del reembolso histórico." : null,
  ].filter((warning): warning is string => Boolean(warning));
  const rows: PostSaleReportRow[] = records.map((record) => {
    const legacyRefund = legacyByDocument.get(record.document.id);
    const externalReference = record.components.find((component) => component.external_reference)?.external_reference ?? legacyRefund?.external_reference ?? null;
    return {
      documentId: record.document.id,
      registeredAt: record.document.created_at,
      confirmedAt: record.document.confirmed_at,
      processedAt: legacyRefund?.processed_at ?? null,
      operationType: record.document.document_type,
      operationLabel: operationLabel(record.document.document_type),
      originalOrderId: record.document.original_order_id,
      originalFolio: record.document.original_folio,
      originalPaymentMethod: record.originalPaymentMethod,
      refundMethod: record.refundMethod,
      refundStatus: record.effectiveStatus,
      commercialAmountCents: record.document.net_amount_cents,
      refundAmountCents: record.document.refund_amount_cents,
      cashReturnedCents: record.cashReturnedCents,
      cardCompletedCents: record.cardCompletedCents,
      cardPendingCents: record.cardPendingCents,
      reasonCode: record.document.reason_code,
      comment: record.document.comment,
      responsibleUserName: record.document.responsible_user_name,
      responsibleUserId: record.document.created_by_pos_user_id,
      externalReference,
      cashShiftId: record.document.cash_shift_id,
      lineCount: record.lineRows.length,
      quantityReturned: sum(record.lineRows.map((line) => parseQuantity(line.quantity_returned_now))),
      componentCount: record.components.length,
      hasModernComponents: !record.legacy,
      coverageLabel: record.components.length > 0 && !record.legacy
        ? ("Componentes modernos" as const)
        : ("Registro histórico" as const),
    };
  }).sort((left, right) => right.registeredAt.localeCompare(left.registeredAt));

  const completedRecords = records.filter((record) => record.effectiveStatus === "completed");
  const pendingRecords = records.filter((record) => record.effectiveStatus === "pending");
  const cashOnlyRecords = records.filter((record) => record.refundMethod === "cash");
  const cardOnlyRecords = records.filter((record) => record.refundMethod === "card_external");
  const mixedRecords = records.filter((record) => record.refundMethod === "mixed");
  return {
    records,
    rows,
    summary: {
      cancellation_documents_count: records.length,
      completed_documents_count: completedRecords.length,
      pending_documents_count: pendingRecords.length,
      cash_only_cancellations_count: cashOnlyRecords.length,
      card_only_cancellations_count: cardOnlyRecords.length,
      mixed_cancellations_count: mixedRecords.length,
      total_cancelled_cents: sum(records.map((record) => record.document.refund_amount_cents)),
      completed_cash_refunds_cents: cashComponentsCents,
      completed_card_refunds_cents: cardComponentsCents,
      pending_card_refunds_cents: pendingCardCents,
      completed_refunds_cents: cashComponentsCents + cardComponentsCents,
      pending_refunds_cents: pendingCardCents,
      refund_components_count: records.reduce((count, record) => count + record.components.length, 0),
      cash_components_count: records.reduce((count, record) => count + record.components.filter((component) => component.refund_method === "cash").length, 0),
      card_components_count: records.reduce((count, record) => count + record.components.filter((component) => component.refund_method === "card").length, 0),
      reconciliation: {
        component_totals_match_documents: componentTotalsMatchDocuments,
        completed_cash_matches_cash_movements: completedCashMatchesMovements,
        completed_documents_have_no_pending_components: completedDocumentsHaveNoPendingComponents,
      },
      warnings,
    },
  };
}
