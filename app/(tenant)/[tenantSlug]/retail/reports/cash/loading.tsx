import {
  RetailInlineStatsSkeleton,
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
      description="Vista operativa para cobros, reembolsos, conciliación de efectivo y seguimiento de turnos abiertos y cerrados."
    >
      <RetailReportsFiltersSkeleton includeOrderStatus={false} />
      <RetailMetricGridSkeleton />
      <RetailSectionCardSkeleton
        title="Desglose de reembolsos"
        description="Separando completados y pendientes por tipo."
      >
        <RetailInlineStatsSkeleton count={3} />
      </RetailSectionCardSkeleton>
      <div className="grid gap-4 xl:grid-cols-2">
        <RetailSectionCardSkeleton
          title="Efectivo esperado contra declarado por turno"
          description="Comparando cierres con información disponible."
        >
          <div className="h-[320px] rounded-[var(--radius-base)] bg-surface-2/80" />
        </RetailSectionCardSkeleton>
        <RetailSectionCardSkeleton
          title="Diferencias de caja por turno"
          description="Ubicando turnos con sobrante o faltante."
        >
          <div className="h-[320px] rounded-[var(--radius-base)] bg-surface-2/80" />
        </RetailSectionCardSkeleton>
      </div>
      <RetailSectionCardSkeleton
        title="Composición de cobros por turno"
        description="Efectivo y tarjeta dentro de cada turno."
      >
        <div className="h-[320px] rounded-[var(--radius-base)] bg-surface-2/80" />
      </RetailSectionCardSkeleton>
      <RetailSectionCardSkeleton
        title="Turnos abiertos"
        description="Separados de los cierres definitivos."
      >
        <RetailInlineStatsSkeleton count={2} />
      </RetailSectionCardSkeleton>

      <RetailSectionCardSkeleton
        title="Turnos cerrados"
        description="Tabla principal de conciliación y acceso al cierre operativo."
      >
        <RetailTableSkeleton columns={8} rows={6} titleLines={3} />
      </RetailSectionCardSkeleton>
    </RetailReportLoadingState>
  );
}
