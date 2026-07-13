import {
  RetailAuditSkeleton,
  RetailInlineStatsSkeleton,
  RetailMetricGridSkeleton,
  RetailReportLoadingState,
  RetailReportsFiltersSkeleton,
  RetailSectionCardSkeleton,
  RetailTableSkeleton,
} from "./_components/retail-reports-ui";

export default function RetailReportsOverviewLoading() {
  return (
    <RetailReportLoadingState
      title="Resumen retail del dia"
      description="Vista ejecutiva minima para cierre operativo: ventas, pedidos, metodos de pago y lectura de auditoria sin bloquear por falta de evidencia de impresion."
    >
      <RetailReportsFiltersSkeleton />
      <RetailMetricGridSkeleton />

      <RetailSectionCardSkeleton
        title="Estado de pedidos"
        description="Conteo operativo para confirmar cuanto se cobro, cuanto se cancelo y si hay pendientes por revisar."
      >
        <RetailInlineStatsSkeleton count={3} />
      </RetailSectionCardSkeleton>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)]">
        <RetailSectionCardSkeleton
          title="Ventas por metodo"
          description="Lectura minima para distinguir efectivo contra tarjeta."
        >
          <RetailTableSkeleton columns={3} rows={2} />
        </RetailSectionCardSkeleton>

        <RetailSectionCardSkeleton
          title="Auditoria"
          description="Si no hay `ticket_events`, el reporte mantiene metrica en cero y agrega contexto."
        >
          <RetailAuditSkeleton />
        </RetailSectionCardSkeleton>
      </div>

      <RetailSectionCardSkeleton
        title="Pedidos recientes"
        description="Muestra pedidos pagados, pendientes y cancelados con terminal de origen, terminal de cobro y marcas de tiempo."
      >
        <RetailTableSkeleton columns={9} rows={6} titleLines={2} />
      </RetailSectionCardSkeleton>
    </RetailReportLoadingState>
  );
}
