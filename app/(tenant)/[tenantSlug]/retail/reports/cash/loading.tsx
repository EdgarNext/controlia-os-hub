import {
  RetailMetricGridSkeleton,
  RetailReportLoadingState,
  RetailReportsFiltersSkeleton,
  RetailSectionCardSkeleton,
  RetailTableSkeleton,
} from "../_components/retail-reports-ui";

export default function RetailReportsCashLoading() {
  return (
    <RetailReportLoadingState
      title="Cierres y turnos de caja"
      description="Reporte minimo por cash shift para revisar fondo, efectivo esperado, declarado, diferencia y mix de cobro."
    >
      <RetailReportsFiltersSkeleton includeOrderStatus={false} />
      <RetailMetricGridSkeleton />

      <RetailSectionCardSkeleton
        title="Detalle por turno"
        description="Incluye terminal, usuario, montos de apertura y cierre, diferencia y volumen de pagos."
      >
        <RetailTableSkeleton columns={12} rows={6} titleLines={3} />
      </RetailSectionCardSkeleton>
    </RetailReportLoadingState>
  );
}
