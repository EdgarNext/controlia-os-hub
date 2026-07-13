import { StatePanel } from "@/components/ui/state-panel";
import { resolveRetailPosTypePageContext } from "@/lib/auth/tenant-pos-access";
import { getRetailSalesReport } from "@/lib/retail-pos/reports";
import {
  RetailMetricGrid,
  RetailOrdersTable,
  RetailPaymentMethodsTable,
  RetailReportsFiltersCard,
  RetailReportsHeader,
  RetailSectionCard,
  buildRetailReportsFilters,
  formatCurrency,
  formatNumber,
  type RetailReportsSearchParams,
} from "../_components/retail-reports-ui";

type RetailSalesPageProps = {
  params: Promise<{ tenantSlug: string }>;
  searchParams: Promise<RetailReportsSearchParams>;
};

export default async function RetailSalesPage({ params, searchParams }: RetailSalesPageProps) {
  const { tenantSlug } = await params;
  const tenant = await resolveRetailPosTypePageContext(tenantSlug, "catalog", "read");
  const filters = buildRetailReportsFilters(await searchParams);
  const report = await getRetailSalesReport(tenant.tenantId, filters);

  return (
    <div className="space-y-4">
      <RetailReportsHeader
        title="Ventas y pedidos cobrados"
        description="Corte operativo centrado en venta neta, metodo de pago y detalle de pedidos dentro del rango seleccionado."
        metadata={`Tenant ${tenant.tenantName} · ${report.filters.dateFrom} a ${report.filters.dateTo}`}
      />

      <RetailReportsFiltersCard
        tenantSlug={tenantSlug}
        filters={report.filters}
        devices={report.devices}
        basePath="/retail/reports/sales"
      />

      <RetailMetricGrid
        items={[
          {
            label: "Venta neta",
            value: formatCurrency(report.summary.netSalesCents),
            detail: `${formatNumber(report.summary.paidOrders)} ordenes pagadas`,
          },
          {
            label: "Bruta",
            value: formatCurrency(report.summary.grossSalesCents),
            detail: `Descuentos ${formatCurrency(report.summary.discountsCents)}`,
          },
          {
            label: "Lineas vendidas",
            value: formatNumber(report.summary.soldLinesCount),
            detail: `Unidades ${formatNumber(report.summary.soldUnits)}`,
          },
          {
            label: "Ticket promedio",
            value: formatCurrency(report.summary.averageTicketCents),
          },
        ]}
      />

      <RetailSectionCard title="Metodos de pago" description="Totales y volumen de pagos conciliables con el corte de caja.">
        <RetailPaymentMethodsTable paymentMethods={report.paymentMethods} />
      </RetailSectionCard>

      <RetailSectionCard
        title="Pedidos del rango"
        description="Tabla operativa para revisar folio, estado, terminales involucradas y fecha de pago o cancelacion."
      >
        {report.orders.length > 0 ? (
          <RetailOrdersTable orders={report.orders} />
        ) : (
          <StatePanel
            kind="empty"
            title="Sin pedidos para este filtro"
            message="No hay pedidos que coincidan con el rango o con la terminal seleccionada."
          />
        )}
      </RetailSectionCard>
    </div>
  );
}
