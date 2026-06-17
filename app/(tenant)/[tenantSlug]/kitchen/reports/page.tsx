import Link from "next/link";
import { StatePanel } from "@/components/ui/state-panel";
import { KitchenMetricCard } from "@/app/(tenant)/[tenantSlug]/kitchen/_components/kitchen-metric-card";
import { KitchenPageHeader } from "@/app/(tenant)/[tenantSlug]/kitchen/_components/kitchen-page-header";
import { EventCateringBadge } from "@/app/(tenant)/[tenantSlug]/kitchen/events/_components/event-catering-badge";
import { getCateringFinancialDashboard } from "@/lib/kitchen/event-catering/queries";
import type {
  CateringFinancialDashboardAlert,
  CateringFinancialDashboardRow,
  CateringFinancialDashboardStatus,
} from "@/lib/kitchen/event-catering/types";
import { resolveKitchenPage } from "../_lib/page-access";

type KitchenReportsPageProps = {
  params: Promise<{ tenantSlug: string }>;
};

function formatMoney(value: number) {
  return `$${Number(value).toLocaleString("es-MX", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function getStatusBadge(status: CateringFinancialDashboardStatus) {
  switch (status) {
    case "closed":
      return <EventCateringBadge label="Cerrado" tone="success" />;
    case "consumed":
      return <EventCateringBadge label="Consumido" tone="info" />;
    case "received":
      return <EventCateringBadge label="Recibido" tone="info" />;
    case "requisitioned":
      return <EventCateringBadge label="Requisicionado" tone="warning" />;
    case "partial":
      return <EventCateringBadge label="Reporte parcial" tone="muted" />;
    case "review_required":
      return <EventCateringBadge label="Requiere revisión" tone="danger" />;
    case "planned":
    default:
      return <EventCateringBadge label="Planeado" tone="muted" />;
  }
}

function getAlertBadge(alert: CateringFinancialDashboardAlert) {
  switch (alert) {
    case "high_remaining_inventory":
      return <EventCateringBadge label="Remanente alto" tone="warning" />;
    case "purchase_above_estimate":
      return <EventCateringBadge label="Compra mayor al estimado" tone="warning" />;
    case "over_consumption":
      return <EventCateringBadge label="Sobreconsumo" tone="danger" />;
    case "material_waste":
      return <EventCateringBadge label="Merma relevante" tone="danger" />;
    case "partial_report":
      return <EventCateringBadge label="Reporte parcial" tone="info" />;
    case "no_material_issue":
    default:
      return <EventCateringBadge label="Sin problema relevante" tone="success" />;
  }
}

function DashboardRow({ row }: { row: CateringFinancialDashboardRow }) {
  return (
    <tr className="border-t border-border align-top transition-colors hover:bg-surface-2/50">
      <td className="px-2 py-2 text-foreground">
        <div className="font-medium">{row.eventName ?? row.eventId.slice(0, 8)}</div>
        <div className="text-muted">{row.planName ?? row.planId.slice(0, 8)}</div>
      </td>
      <td className="px-2 py-2 text-muted">
        {row.eventDate ? new Date(row.eventDate).toLocaleDateString("es-MX") : "—"}
      </td>
      <td className="px-2 py-2 text-foreground">
        <div>{getStatusBadge(row.financialStatus)}</div>
        <div className="mt-1 text-muted">{row.operationalStatus}</div>
      </td>
      <td className="px-2 py-2 text-foreground">{formatMoney(row.estimatedInitialCost)}</td>
      <td className="px-2 py-2 text-foreground">{formatMoney(row.requisitionedCost)}</td>
      <td className="px-2 py-2 text-foreground">{formatMoney(row.receivedCost)}</td>
      <td className="px-2 py-2 text-foreground">{formatMoney(row.consumedCost)}</td>
      <td className="px-2 py-2 text-foreground">{formatMoney(row.remainingInventoryValue)}</td>
      <td className="px-2 py-2 text-foreground">{formatMoney(row.wasteCost)}</td>
      <td className="px-2 py-2 text-foreground">{formatMoney(row.grossPurchaseVariance)}</td>
      <td className="px-2 py-2 text-foreground">{formatMoney(row.netConsumptionVariance)}</td>
      <td className="px-2 py-2 text-foreground">
        {row.costPerPerson != null ? formatMoney(row.costPerPerson) : "No disponible"}
      </td>
      <td className="px-2 py-2 text-foreground">
        <div>{getAlertBadge(row.alerts[0] ?? "no_material_issue")}</div>
        <div className="mt-1 text-muted">{row.reading}</div>
      </td>
      <td className="px-2 py-2">
        <Link href={row.detailHref} className="text-xs underline underline-offset-2">
          Ver servicio
        </Link>
      </td>
    </tr>
  );
}

export default async function KitchenReportsPage({ params }: KitchenReportsPageProps) {
  const { tenantSlug } = await params;

  const [inventory, recipes, catering] = await Promise.all([
    resolveKitchenPage(tenantSlug, "kitchen_inventory", "reports"),
    resolveKitchenPage(tenantSlug, "kitchen_recipes", "reports"),
    resolveKitchenPage(tenantSlug, "event_catering", "reports"),
  ]);

  if (!inventory.ok && !recipes.ok && !catering.ok) {
    return (
      <StatePanel
        kind="permission"
        title="Sin permisos para reportes"
        message="No tienes acceso de lectura a reportes de kitchen-ops en este tenant."
      />
    );
  }

  if (!catering.ok) {
    return (
      <StatePanel
        kind="permission"
        title="Sin acceso a reportes de catering"
        message="Tienes acceso a reportes de kitchen-ops, pero no al dashboard financiero de catering."
      />
    );
  }

  const dashboard = await getCateringFinancialDashboard(tenantSlug);

  if (dashboard.rows.length === 0) {
    return (
      <div className="space-y-4">
        <KitchenPageHeader
          eyebrow="Reportes Cocina"
          title="Dashboard gerencial de catering"
          description="Resumen financiero de servicios: estimado, compra, consumo real y remanente recuperable."
        />
        <StatePanel
          kind="empty"
          title="Aún no hay servicios con información financiera suficiente"
          message="Cuando existan servicios de catering con costeo, requisición, recepción o consumo, aparecerán aquí para análisis gerencial."
        />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <KitchenPageHeader
        eyebrow="Reportes Cocina"
        title="Dashboard gerencial de catering"
        description="Resumen financiero de servicios: estimado, compra, consumo real y remanente recuperable."
        metadata={
          <>
            <span>Servicios analizados: {dashboard.summary.servicesAnalyzed.toLocaleString("es-MX")}</span>
            <span className="mx-2">·</span>
            <span>Servicios con revisión: {dashboard.summary.servicesRequiringReview.toLocaleString("es-MX")}</span>
          </>
        }
      />

      <section className="rounded-[var(--radius-base)] border border-border bg-surface p-4">
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
          <KitchenMetricCard label="Servicios analizados" value={dashboard.summary.servicesAnalyzed} />
          <KitchenMetricCard label="Costo estimado total" value={formatMoney(dashboard.summary.estimatedInitialCostTotal)} />
          <KitchenMetricCard label="Compra / recepción total" value={formatMoney(dashboard.summary.receivedCostTotal)} />
          <KitchenMetricCard label="Consumo real total" value={formatMoney(dashboard.summary.consumedCostTotal)} />
          <KitchenMetricCard label="Inventario remanente" value={formatMoney(dashboard.summary.remainingInventoryValueTotal)} tone={dashboard.summary.remainingInventoryValueTotal > 0 ? "warning" : "default"} />
          <KitchenMetricCard label="Merma total" value={formatMoney(dashboard.summary.wasteCostTotal)} tone={dashboard.summary.wasteCostTotal > 0 ? "warning" : "default"} />
          <KitchenMetricCard label="Variación bruta" value={formatMoney(dashboard.summary.grossPurchaseVarianceTotal)} tone={dashboard.summary.grossPurchaseVarianceTotal > 0 ? "warning" : "default"} />
          <KitchenMetricCard label="Variación neta" value={formatMoney(dashboard.summary.netConsumptionVarianceTotal)} tone={Math.abs(dashboard.summary.netConsumptionVarianceTotal) > 0.01 ? "warning" : "default"} />
          <KitchenMetricCard label="Servicios con revisión requerida" value={dashboard.summary.servicesRequiringReview} tone={dashboard.summary.servicesRequiringReview > 0 ? "warning" : "default"} />
        </div>
        <div className="mt-3 rounded-[var(--radius-base)] border border-border bg-surface-2 p-3">
          <p className="text-xs font-medium text-foreground">Lectura gerencial global</p>
          <p className="mt-1 text-xs text-muted">{dashboard.narrative}</p>
        </div>
      </section>

      <section className="rounded-[var(--radius-base)] border border-border bg-surface p-4">
        <h2 className="text-sm font-semibold text-foreground">Servicios de catering</h2>
        <p className="mt-1 text-xs text-muted">
          Vista ejecutiva para comparar estimado, compra, consumo real, remanente y alertas financieras por servicio.
        </p>
        <div className="mt-3 overflow-x-auto">
          <table className="min-w-full text-xs">
            <thead>
              <tr className="text-left text-muted">
                <th className="px-2 py-1">Evento / servicio</th>
                <th className="px-2 py-1">Fecha</th>
                <th className="px-2 py-1">Estado</th>
                <th className="px-2 py-1">Estimado inicial</th>
                <th className="px-2 py-1">Requisicionado</th>
                <th className="px-2 py-1">Recibido / comprado</th>
                <th className="px-2 py-1">Consumido real</th>
                <th className="px-2 py-1">Remanente</th>
                <th className="px-2 py-1">Merma</th>
                <th className="px-2 py-1">Variación bruta</th>
                <th className="px-2 py-1">Variación neta</th>
                <th className="px-2 py-1">Costo por persona</th>
                <th className="px-2 py-1">Alerta / lectura</th>
                <th className="px-2 py-1">Acción</th>
              </tr>
            </thead>
            <tbody>
              {dashboard.rows.map((row) => (
                <DashboardRow key={row.planId} row={row} />
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
