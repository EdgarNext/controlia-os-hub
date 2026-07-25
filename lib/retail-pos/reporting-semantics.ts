export type RetailReportingFormat = "currency" | "count" | "quantity" | "percent" | "date" | "datetime";

export type RetailReportingTermKey =
  | "gross_sales"
  | "collected_sales"
  | "granted_discount"
  | "commercial_result"
  | "voided_order_before_payment"
  | "paid_sale_cancellation"
  | "return_operation"
  | "reimbursement"
  | "cash_collections"
  | "card_collections"
  | "cash_reimbursements"
  | "card_reimbursements"
  | "pending_reimbursements"
  | "returned_amount"
  | "collected_units"
  | "collected_lines"
  | "distinct_collected_products"
  | "post_sale_recorded_date"
  | "expected_cash_from_sales_and_reimbursements"
  | "declared_cash"
  | "cash_difference"
  | "shift_operational_close"
  | "report_z";

export type RetailReportingTerm = {
  key: RetailReportingTermKey;
  label: string;
  description: string;
  format?: RetailReportingFormat;
};

const TERMS: Record<RetailReportingTermKey, RetailReportingTerm> = {
  gross_sales: {
    key: "gross_sales",
    label: "Venta bruta",
    description: "Importe de las ventas cobradas antes de aplicar descuentos.",
    format: "currency",
  },
  collected_sales: {
    key: "collected_sales",
    label: "Venta cobrada",
    description: "Total pagado por ventas del periodo después de descuentos.",
    format: "currency",
  },
  granted_discount: {
    key: "granted_discount",
    label: "Descuento concedido",
    description: "Monto que se dejó de cobrar mediante descuentos por línea o descuento general.",
    format: "currency",
  },
  commercial_result: {
    key: "commercial_result",
    label: "Resultado comercial del periodo",
    description:
      "Venta cobrada menos anulaciones de venta pagada y devoluciones registradas durante el mismo periodo.",
    format: "currency",
  },
  voided_order_before_payment: {
    key: "voided_order_before_payment",
    label: "Pedido anulado antes del pago",
    description: "Pedido eliminado antes de haberse registrado un cobro.",
    format: "count",
  },
  paid_sale_cancellation: {
    key: "paid_sale_cancellation",
    label: "Venta cancelada",
    description: "Venta previamente cobrada que fue revertida en su totalidad.",
    format: "count",
  },
  return_operation: {
    key: "return_operation",
    label: "Devolución",
    description: "Mercancía devuelta total o parcialmente después de una venta.",
    format: "count",
  },
  reimbursement: {
    key: "reimbursement",
    label: "Reembolso",
    description: "Salida de dinero relacionada con una anulación de venta pagada o una devolución.",
    format: "currency",
  },
  cash_collections: {
    key: "cash_collections",
    label: "Cobros en efectivo",
    description: "Pagos recibidos en efectivo dentro del periodo o turno.",
    format: "currency",
  },
  card_collections: {
    key: "card_collections",
    label: "Cobros con tarjeta",
    description: "Pagos recibidos con tarjeta dentro del periodo o turno.",
    format: "currency",
  },
  cash_reimbursements: {
    key: "cash_reimbursements",
    label: "Reembolsos en efectivo",
    description: "Reembolsos en efectivo completados dentro del periodo o turno.",
    format: "currency",
  },
  card_reimbursements: {
    key: "card_reimbursements",
    label: "Reembolsos con tarjeta",
    description: "Reembolsos con tarjeta completados dentro del periodo o turno.",
    format: "currency",
  },
  pending_reimbursements: {
    key: "pending_reimbursements",
    label: "Reembolsos pendientes",
    description: "Reembolsos todavía no completados al cierre del periodo consultado.",
    format: "currency",
  },
  returned_amount: {
    key: "returned_amount",
    label: "Monto devuelto",
    description: "Valor comercial de la mercancía devuelta durante el periodo.",
    format: "currency",
  },
  collected_units: {
    key: "collected_units",
    label: "Unidades cobradas",
    description: "Cantidad de unidades en líneas de ventas cobradas.",
    format: "quantity",
  },
  collected_lines: {
    key: "collected_lines",
    label: "Líneas cobradas",
    description: "Número de líneas pertenecientes a ventas cobradas.",
    format: "count",
  },
  distinct_collected_products: {
    key: "distinct_collected_products",
    label: "Productos distintos cobrados",
    description: "Número de productos diferentes presentes en ventas cobradas.",
    format: "count",
  },
  post_sale_recorded_date: {
    key: "post_sale_recorded_date",
    label: "Fecha registrada",
    description: "Fecha usada actualmente para incluir una operación de postventa en el reporte.",
    format: "datetime",
  },
  expected_cash_from_sales_and_reimbursements: {
    key: "expected_cash_from_sales_and_reimbursements",
    label: "Efectivo esperado por ventas y reembolsos",
    description:
      "Fondo inicial más cobros en efectivo menos reembolsos en efectivo completados, conforme a la fórmula actual.",
    format: "currency",
  },
  declared_cash: {
    key: "declared_cash",
    label: "Efectivo declarado",
    description: "Importe contado y registrado al cerrar el turno.",
    format: "currency",
  },
  cash_difference: {
    key: "cash_difference",
    label: "Diferencia de caja",
    description: "Efectivo declarado menos efectivo esperado por ventas y reembolsos.",
    format: "currency",
  },
  shift_operational_close: {
    key: "shift_operational_close",
    label: "Cierre operativo del turno",
    description: "Documento o vista de cierre correspondiente a un turno operativo.",
  },
  report_z: {
    key: "report_z",
    label: "Reporte Z",
    description: "Nombre secundario usado actualmente para el cierre operativo del turno.",
  },
};

const GLOSSARY_TERM_ORDER: RetailReportingTermKey[] = [
  "gross_sales",
  "collected_sales",
  "granted_discount",
  "commercial_result",
  "voided_order_before_payment",
  "paid_sale_cancellation",
  "return_operation",
  "reimbursement",
  "expected_cash_from_sales_and_reimbursements",
  "declared_cash",
  "cash_difference",
];

export const RETAIL_REPORTING_TIME_ZONE = "America/Mexico_City";

export const RETAIL_REPORTING_PERIOD_NOTES = {
  overview: {
    primaryDateLabel: "Criterio principal: fecha de cobro para ventas y fecha registrada para postventa.",
    note:
      "Las ventas se incluyen según su fecha de cobro. Las anulaciones y devoluciones se incluyen según la fecha en que fueron registradas. Una operación de postventa puede corresponder a una venta de un periodo anterior.",
  },
  sales: {
    primaryDateLabel: "Criterio principal: fecha de cobro para ventas y fecha registrada para postventa.",
    note:
      "Las ventas se incluyen según su fecha de cobro. Las anulaciones y devoluciones se incluyen según la fecha en que fueron registradas. Una operación de postventa puede corresponder a una venta de un periodo anterior.",
  },
  cash: {
    primaryDateLabel: "Criterio principal: apertura o cierre del turno dentro del periodo.",
    note:
      "El reporte incluye los turnos que abrieron o cerraron dentro del periodo seleccionado. Los importes de cada turno se calculan con las operaciones asociadas a ese turno.",
  },
  post_sale: {
    primaryDateLabel: "Criterio principal: fecha registrada de la operación.",
    note:
      "Las operaciones se incluyen según su fecha registrada. La fecha de confirmación o procesamiento puede ser distinta.",
  },
  products: {
    primaryDateLabel: "Criterio principal: fecha de cobro de la venta.",
    note:
      "Los productos se incluyen según la fecha de cobro de la venta. Las devoluciones posteriores todavía no se descuentan de las unidades cobradas.",
  },
  z_report: {
    primaryDateLabel: "Criterio principal: operaciones asociadas al turno.",
    note:
      "Este cierre corresponde a las operaciones asociadas al turno y no necesariamente a un día calendario completo.",
  },
} as const;

export function getRetailReportingTerm(key: RetailReportingTermKey): RetailReportingTerm {
  return TERMS[key];
}

export function getRetailReportingLabel(key: RetailReportingTermKey): string {
  return TERMS[key].label;
}

export function getRetailReportingGlossaryTerms(): RetailReportingTerm[] {
  return GLOSSARY_TERM_ORDER.map((key) => TERMS[key]);
}
