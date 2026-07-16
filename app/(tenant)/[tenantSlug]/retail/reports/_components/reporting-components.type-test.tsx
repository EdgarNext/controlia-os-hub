import { RetailAttentionBlock } from "./RetailAttentionBlock";
import { RetailReportGlossaryButton } from "./RetailReportGlossaryButton";
import { RetailReportPeriodContext } from "./RetailReportPeriodContext";
import { RetailCommercialWaterfallChart } from "./charts/RetailCommercialWaterfallChart";
import { RetailPaymentMixChart } from "./charts/RetailPaymentMixChart";
import { RetailPostSaleReasonsChart } from "./charts/RetailPostSaleReasonsChart";
import { RetailPostSaleTrendChart } from "./charts/RetailPostSaleTrendChart";
import { RetailRefundStatusChart } from "./charts/RetailRefundStatusChart";
import { RetailSalesActivityChart } from "./charts/RetailSalesActivityChart";
import { RetailSalesAdjustmentsChart } from "./charts/RetailSalesAdjustmentsChart";
import { RetailSalesTrendChart } from "./charts/RetailSalesTrendChart";

export const reportingComponentsTypeTest = (
  <>
    <RetailReportPeriodContext
      periodLabel="2026-07-14 -> 2026-07-15"
      primaryDateLabel="Criterio principal: fecha de cobro para ventas y fecha registrada para postventa."
      note="Texto largo de validación para confirmar que el componente acepta explicaciones extensas sin cambiar el contrato de props ni depender de datos externos."
    />

    <RetailAttentionBlock items={[]} />

    <RetailAttentionBlock
      items={[
        {
          id: "long-copy",
          title: "Reembolsos pendientes con explicación larga",
          description:
            "Texto largo de validación para comprobar que el bloque acepta mensajes extensos, cantidades opcionales, importes opcionales y enlaces sin romper el contrato de props.",
          quantity: "12",
          amount: "$1,234.56",
          href: "/las-quintas/retail/reports/post-sale",
          linkLabel: "Revisar detalle",
          accessibleLabel: "Ir al detalle de reembolsos pendientes",
        },
      ]}
    />

    <RetailReportGlossaryButton />

    <RetailCommercialWaterfallChart
      data={[
        { key: "gross_sales", label: "Venta bruta", amountCents: 100000, kind: "total" },
        { key: "discounts", label: "Descuento concedido con etiqueta larga", amountCents: 12000, kind: "decrease" },
        { key: "collected_sales", label: "Venta cobrada", amountCents: 88000, kind: "subtotal", href: "/las-quintas/retail/reports/sales" },
        { key: "sale_cancellations", label: "Anulación de venta pagada", amountCents: 5000, kind: "decrease", href: "/las-quintas/retail/reports/post-sale" },
        { key: "returns", label: "Devolución", amountCents: 3000, kind: "decrease" },
        { key: "commercial_result", label: "Resultado comercial del periodo", amountCents: 80000, kind: "total" },
      ]}
    />

    <RetailPaymentMixChart
      data={[
        { method: "cash", label: "Cobros en efectivo", amountCents: 0, share: null },
        { method: "card", label: "Cobros con tarjeta", amountCents: 0, share: null, href: "/las-quintas/retail/reports/sales" },
      ]}
    />

    <RetailSalesTrendChart granularity="none" points={[]} />

    <RetailSalesTrendChart
      granularity="day"
      points={[
        {
          periodKey: "2026-07-14",
          periodLabel: "14 jul",
          dateFrom: "2026-07-14",
          dateTo: "2026-07-14",
          collectedSalesCents: 100000,
          commercialResultCents: -5000,
          saleCancellationsCents: 100000,
          returnsCents: 5000,
          href: "/las-quintas/retail/reports/sales?dateFrom=2026-07-14&dateTo=2026-07-14",
        },
      ]}
    />

    <RetailSalesActivityChart
      granularity="day"
      points={[
        {
          periodKey: "2026-07-14",
          periodLabel: "14 jul",
          dateFrom: "2026-07-14",
          dateTo: "2026-07-14",
          collectedSalesCents: 100000,
          paidSalesCount: 2,
          averageTicketCents: 50000,
          href: "/las-quintas/retail/reports/sales?dateFrom=2026-07-14&dateTo=2026-07-14",
        },
      ]}
    />

    <RetailSalesAdjustmentsChart
      granularity="day"
      points={[
        {
          periodKey: "2026-07-14",
          periodLabel: "14 jul",
          dateFrom: "2026-07-14",
          dateTo: "2026-07-14",
          discountsCents: 0,
          saleCancellationsCents: 100000,
          returnsCents: 5000,
          discountHref: "/las-quintas/retail/reports/sales#sales-discount-breakdown",
          postSaleHref: "/las-quintas/retail/reports/post-sale?dateFrom=2026-07-14&dateTo=2026-07-14",
        },
      ]}
    />

    <RetailPostSaleTrendChart
      granularity="day"
      points={[
        {
          periodKey: "2026-07-14",
          periodLabel: "14 jul",
          dateFrom: "2026-07-14",
          dateTo: "2026-07-14",
          saleCancellationsCount: 2,
          fullReturnsCount: 1,
          partialReturnsCount: 0,
          saleCancellationsCents: 100000,
          fullReturnsCents: 5000,
          partialReturnsCents: 0,
          saleCancellationHref: "/las-quintas/retail/reports/post-sale?dateFrom=2026-07-14&dateTo=2026-07-14&operationType=sale_cancellation",
          fullReturnHref: "/las-quintas/retail/reports/post-sale?dateFrom=2026-07-14&dateTo=2026-07-14&operationType=return_full",
          partialReturnHref: "/las-quintas/retail/reports/post-sale?dateFrom=2026-07-14&dateTo=2026-07-14&operationType=return_partial",
        },
      ]}
    />

    <RetailPostSaleReasonsChart
      rows={[
        {
          reasonCode: "operator_error",
          label: "Error de operación con etiqueta especialmente larga",
          operationsCount: 4,
          totalAmountCents: 105000,
          href: "/las-quintas/retail/reports/post-sale?reasonCode=operator_error",
        },
      ]}
    />

    <RetailRefundStatusChart
      data={[
        {
          key: "completed",
          label: "Completados",
          refundsCount: 3,
          amountCents: 5000,
          share: 1,
          href: "/las-quintas/retail/reports/post-sale?refundStatus=completed",
        },
      ]}
    />
  </>
);
