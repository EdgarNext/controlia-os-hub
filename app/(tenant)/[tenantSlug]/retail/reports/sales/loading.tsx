import {
  RetailMetricGridSkeleton,
  RetailReportLoadingState,
  RetailReportsFiltersSkeleton,
  RetailSectionCardSkeleton,
  RetailTableSkeleton,
} from "../_components/retail-reports-ui";

export default function RetailReportsSalesLoading() {
  return (
    <RetailReportLoadingState
      title="Ventas y pedidos cobrados"
      description="Corte operativo centrado en venta neta, metodo de pago y detalle de pedidos dentro del rango seleccionado."
    >
      <RetailReportsFiltersSkeleton />
      <RetailMetricGridSkeleton />

      <RetailSectionCardSkeleton
        title="Metodos de pago"
        description="Totales y volumen de pagos conciliables con el corte de caja."
      >
        <RetailTableSkeleton columns={3} rows={2} />
      </RetailSectionCardSkeleton>

      <RetailSectionCardSkeleton
        title="Pedidos del rango"
        description="Tabla operativa para revisar folio, estado, terminales involucradas y fecha de pago o cancelacion."
      >
        <RetailTableSkeleton columns={9} rows={6} titleLines={2} />
      </RetailSectionCardSkeleton>
    </RetailReportLoadingState>
  );
}
