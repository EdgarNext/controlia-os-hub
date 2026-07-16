import {
  RetailAuditSkeleton,
  RetailMetricGridSkeleton,
  RetailReportLoadingState,
  RetailReportsFiltersSkeleton,
  RetailSectionCardSkeleton,
  RetailTableSkeleton,
} from "./_components/retail-reports-ui";

export default function RetailReportsOverviewLoading() {
  return (
    <RetailReportLoadingState
      title="Resumen retail"
      description="Vista ejecutiva y operativa para venta cobrada, resultado comercial, descuentos concedidos, asuntos de atención y tendencia del periodo."
    >
      <RetailReportsFiltersSkeleton />
      <RetailMetricGridSkeleton />

      <RetailSectionCardSkeleton
        title="Desglose del resultado comercial"
        description="Ajustes incluidos en el resultado y movimientos financieros pendientes."
      >
        <RetailTableSkeleton columns={2} rows={3} />
      </RetailSectionCardSkeleton>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.5fr)_minmax(280px,0.9fr)]">
        <RetailSectionCardSkeleton
          title="Construcción del resultado comercial"
          description="Waterfall operativo con venta bruta, descuentos, venta cobrada y postventa."
        >
          <div className="h-[320px] rounded-[var(--radius-base)] bg-surface-2/80" />
        </RetailSectionCardSkeleton>

        <RetailSectionCardSkeleton
          title="Mezcla de cobro"
          description="Distribución de cobros en efectivo y con tarjeta."
        >
          <div className="h-[240px] rounded-[var(--radius-base)] bg-surface-2/80" />
        </RetailSectionCardSkeleton>
      </div>

      <RetailSectionCardSkeleton
        title="Tendencia de venta cobrada y resultado comercial"
        description="Serie temporal agregada según el rango seleccionado."
      >
        <div className="h-[320px] rounded-[var(--radius-base)] bg-surface-2/80" />
      </RetailSectionCardSkeleton>

      <RetailSectionCardSkeleton
        title="Pedidos recientes"
        description="Folio, estado, fecha relevante, total, método de cobro y señales rápidas del pedido."
      >
        <RetailTableSkeleton columns={8} rows={6} titleLines={2} />
      </RetailSectionCardSkeleton>

      <RetailSectionCardSkeleton
        title="Auditoría de impresión"
        description="Sección secundaria para impresiones, reimpresiones y fallos registrados."
      >
        <RetailAuditSkeleton />
      </RetailSectionCardSkeleton>
    </RetailReportLoadingState>
  );
}
