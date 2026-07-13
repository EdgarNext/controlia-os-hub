import {
  RetailMetricGridSkeleton,
  RetailReportLoadingState,
  RetailReportsFiltersSkeleton,
  RetailSectionCardSkeleton,
  RetailTableSkeleton,
} from "../_components/retail-reports-ui";

export default function RetailReportsProductsLoading() {
  return (
    <RetailReportLoadingState
      title="Productos vendidos"
      description="Concentrado de productos y variantes vendidas solo en pedidos pagados, con cantidad, total y precio promedio."
    >
      <RetailReportsFiltersSkeleton />
      <RetailMetricGridSkeleton count={3} columnsClassName="xl:grid-cols-3" />

      <RetailSectionCardSkeleton
        title="Ranking de productos"
        description="Solo se consideran ordenes pagadas. Cancelados y pendientes quedan fuera del agregado."
      >
        <RetailTableSkeleton columns={7} rows={8} titleLines={2} />
      </RetailSectionCardSkeleton>
    </RetailReportLoadingState>
  );
}
