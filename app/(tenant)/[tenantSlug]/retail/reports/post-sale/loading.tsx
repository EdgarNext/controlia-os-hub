import {
  RetailMetricGridSkeleton,
  RetailReportLoadingState,
  RetailSectionCardSkeleton,
  RetailTableSkeleton,
} from "../_components/retail-reports-ui";

export default function RetailReportsPostSaleLoading() {
  return (
    <RetailReportLoadingState
      title="Postventa"
      description="Reporte específico para ventas canceladas, devoluciones y reembolsos registrados dentro del rango seleccionado."
    >
      <RetailSectionCardSkeleton
        title="Filtros de postventa"
        description="Fecha registrada, tipo de operación, estado de reembolso, motivo y usuario responsable."
      >
        <RetailTableSkeleton columns={3} rows={2} />
      </RetailSectionCardSkeleton>

      <RetailMetricGridSkeleton />

      <RetailSectionCardSkeleton
        title="Desglose de reembolsos"
        description="Separación de reembolsos completados y pendientes por método."
      >
        <RetailTableSkeleton columns={4} rows={2} />
      </RetailSectionCardSkeleton>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
        <RetailSectionCardSkeleton
          title="Evolución de operaciones de postventa"
          description="Serie temporal con selector de operaciones y monto comercial."
        >
          <div className="h-[360px] rounded-[var(--radius-base)] bg-surface-2/80" />
        </RetailSectionCardSkeleton>

        <div className="grid gap-4">
          <RetailSectionCardSkeleton
            title="Motivos principales"
            description="Motivos con mayor concentración por operaciones o monto."
          >
            <div className="h-[300px] rounded-[var(--radius-base)] bg-surface-2/80" />
          </RetailSectionCardSkeleton>

          <RetailSectionCardSkeleton
            title="Reembolsos por estado"
            description="Distribución compacta de reembolsos completados y pendientes."
          >
            <div className="h-[220px] rounded-[var(--radius-base)] bg-surface-2/80" />
          </RetailSectionCardSkeleton>
        </div>
      </div>

      <RetailSectionCardSkeleton
        title="Análisis por usuario y motivos"
        description="Tablas complementarias de actividad registrada."
      >
        <RetailTableSkeleton columns={4} rows={5} />
      </RetailSectionCardSkeleton>

      <RetailSectionCardSkeleton
        title="Operaciones de postventa"
        description="Tabla operativa con fecha registrada, tipo, reembolso, motivo y usuario responsable."
      >
        <RetailTableSkeleton columns={9} rows={6} titleLines={2} />
      </RetailSectionCardSkeleton>
    </RetailReportLoadingState>
  );
}
