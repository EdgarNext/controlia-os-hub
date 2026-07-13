import { StatePanel } from "@/components/ui/state-panel";
import { resolveRetailPosTypePageContext } from "@/lib/auth/tenant-pos-access";
import { getRetailReportsOverview } from "@/lib/retail-pos/reports";
import {
  RetailAuditPanel,
  RetailOrdersTable,
  RetailOverviewMetrics,
  RetailPaymentMethodsTable,
  RetailReportsFiltersCard,
  RetailReportsHeader,
  RetailSectionCard,
  buildRetailReportsFilters,
  type RetailReportsSearchParams,
} from "./_components/retail-reports-ui";

type RetailReportsOverviewPageProps = {
  params: Promise<{ tenantSlug: string }>;
  searchParams: Promise<RetailReportsSearchParams>;
};

export default async function RetailReportsOverviewPage({
  params,
  searchParams,
}: RetailReportsOverviewPageProps) {
  const { tenantSlug } = await params;
  const tenant = await resolveRetailPosTypePageContext(tenantSlug, "catalog", "read");
  const filters = buildRetailReportsFilters(await searchParams);
  const overview = await getRetailReportsOverview(tenant.tenantId, filters);

  return (
    <div className="space-y-4">
      <RetailReportsHeader
        title="Resumen retail del dia"
        description="Vista ejecutiva minima para cierre operativo: ventas, pedidos, metodos de pago y lectura de auditoria sin bloquear por falta de evidencia de impresion."
        metadata={`Tenant ${tenant.tenantName} · Rango ${overview.dateRangeLabel}`}
      />

      <RetailReportsFiltersCard
        tenantSlug={tenantSlug}
        filters={overview.filters}
        devices={overview.devices}
        basePath="/retail/reports"
      />

      <RetailOverviewMetrics overview={overview} />

      <RetailSectionCard
        title="Estado de pedidos"
        description="Conteo operativo para confirmar cuanto se cobro, cuanto se cancelo y si hay pendientes por revisar."
      >
        <div className="grid gap-3 md:grid-cols-3">
          <div className="rounded-[var(--radius-base)] border border-border bg-surface-2 p-3">
            <p className="text-xs text-muted">Total de ordenes</p>
            <p className="text-xl font-semibold text-foreground">{overview.summary.totalOrders.toLocaleString("es-MX")}</p>
          </div>
          <div className="rounded-[var(--radius-base)] border border-border bg-surface-2 p-3">
            <p className="text-xs text-muted">Pendientes</p>
            <p className="text-xl font-semibold text-foreground">{overview.summary.pendingOrders.toLocaleString("es-MX")}</p>
          </div>
          <div className="rounded-[var(--radius-base)] border border-border bg-surface-2 p-3">
            <p className="text-xs text-muted">Canceladas</p>
            <p className="text-xl font-semibold text-foreground">{overview.summary.cancelledOrders.toLocaleString("es-MX")}</p>
          </div>
        </div>
      </RetailSectionCard>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)]">
        <RetailSectionCard title="Ventas por metodo" description="Lectura minima para distinguir efectivo contra tarjeta.">
          <RetailPaymentMethodsTable paymentMethods={overview.paymentMethods} />
        </RetailSectionCard>

        <RetailSectionCard title="Auditoria" description="Si no hay `ticket_events`, el reporte mantiene metrica en cero y agrega contexto.">
          <RetailAuditPanel audit={overview.audit} />
        </RetailSectionCard>
      </div>

      <RetailSectionCard
        title="Pedidos recientes"
        description="Muestra pedidos pagados, pendientes y cancelados con terminal de origen, terminal de cobro y marcas de tiempo."
      >
        {overview.recentOrders.length > 0 ? (
          <RetailOrdersTable orders={overview.recentOrders} />
        ) : (
          <StatePanel
            kind="empty"
            title="Sin pedidos en el rango seleccionado"
            message="Ajusta fechas, terminal o estado para revisar otro corte operativo."
          />
        )}
      </RetailSectionCard>
    </div>
  );
}
