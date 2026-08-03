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
      title="Ventas"
      description="Lectura comercial para venta bruta, descuento concedido, venta cobrada, ticket promedio, postventa registrada y resultado del periodo."
    >
      <RetailReportsFiltersSkeleton />
      <RetailMetricGridSkeleton />

      <div className="grid gap-4 xl:grid-cols-2">
        <RetailSectionCardSkeleton
          title="Actividad de ventas"
          description="Desglose compacto de venta bruta, descuento concedido, venta cobrada y ventas pagadas."
        >
          <RetailTableSkeleton columns={2} rows={4} />
        </RetailSectionCardSkeleton>

        <RetailSectionCardSkeleton
          title="Postventa registrada"
          description="Cancelaciones y devoluciones registradas durante el periodo."
        >
          <RetailTableSkeleton columns={2} rows={5} />
        </RetailSectionCardSkeleton>
      </div>

      <RetailSectionCardSkeleton
        title="Resultado"
        description="Relación compacta entre venta cobrada, postventa y resultado comercial."
      >
        <RetailTableSkeleton columns={1} rows={1} />
      </RetailSectionCardSkeleton>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
        <RetailSectionCardSkeleton
          title="Venta cobrada y ticket promedio por periodo"
          description="Serie temporal de venta cobrada y ticket promedio."
        >
          <div className="h-[340px] rounded-[var(--radius-base)] bg-surface-2/80" />
        </RetailSectionCardSkeleton>

        <RetailSectionCardSkeleton
          title="Descuentos y postventa por periodo"
          description="Comparación de descuentos, cancelaciones y devoluciones."
        >
          <div className="h-[320px] rounded-[var(--radius-base)] bg-surface-2/80" />
        </RetailSectionCardSkeleton>
      </div>

      <RetailSectionCardSkeleton
        title="Descuentos y operaciones debajo del costo"
        description="Indicadores y desglose por motivo y usuario."
      >
        <RetailTableSkeleton columns={3} rows={4} />
      </RetailSectionCardSkeleton>

      <RetailSectionCardSkeleton
        title="Ventas del rango"
        description="Tabla operativa para revisar fecha de cobro, montos, método y estado de postventa."
      >
        <RetailTableSkeleton columns={8} rows={6} titleLines={2} />
      </RetailSectionCardSkeleton>
    </RetailReportLoadingState>
  );
}
