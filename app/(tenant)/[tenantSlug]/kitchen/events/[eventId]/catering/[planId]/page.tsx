import { Suspense } from "react";
import Link from "next/link";
import { StatePanel } from "@/components/ui/state-panel";
import { getCurrentTenantModulePageAccessMap, hasModulePageAccess } from "@/lib/auth/module-page-access";
import {
  generateCateringRequisitionFromShortagesAction,
  recalculateCateringRequirementsAction,
  removeRecipeFromCateringPlanAction,
  reserveInventoryForCateringPlanAction,
  updatePlanRecipeServingsAction,
} from "@/lib/kitchen/event-catering/actions";
import {
  getCateringPlanPriceReviewSummary,
  getEventForCatering,
  getCateringPlanFinancialReport,
  getCateringPlan,
  getCateringPlanOperationalSummary,
  getPlanDraftRequisition,
  listCateringPlanItemFlow,
  listCateringPlanWarnings,
  listCateringRequirements,
  listConsumptionRecordsForPlan,
  listPlanRecipes,
  listReadyRecipesForCatering,
  listRequirementShortagesFromRequirements,
  summarizeCateringRequirements,
} from "@/lib/kitchen/event-catering/queries";
import { KitchenTableSkeleton } from "@/app/(tenant)/[tenantSlug]/kitchen/_components/kitchen-loading-skeletons";
import { KitchenMetricCard } from "@/app/(tenant)/[tenantSlug]/kitchen/_components/kitchen-metric-card";
import { KitchenPageHeader } from "@/app/(tenant)/[tenantSlug]/kitchen/_components/kitchen-page-header";
import { KitchenStatusBadge } from "@/app/(tenant)/[tenantSlug]/kitchen/_components/kitchen-status-badge";
import { KitchenSubmitButton } from "@/app/(tenant)/[tenantSlug]/kitchen/_components/kitchen-submit-button";
import { EventCateringContextHeader } from "@/app/(tenant)/[tenantSlug]/kitchen/events/_components/event-catering-context-header";
import { EventCateringBadge } from "@/app/(tenant)/[tenantSlug]/kitchen/events/_components/event-catering-badge";
import { resolveKitchenPage } from "../../../../_lib/page-access";
import { AddReadyRecipeToPlanForm } from "./_components/plan-forms";
import type {
  CateringPlanFinancialLine,
  CateringPlanFinancialStatus,
  CateringPlanFinancialVarianceReason,
} from "@/lib/kitchen/event-catering/types";

type KitchenEventCateringPlanPageProps = {
  params: Promise<{ tenantSlug: string; eventId: string; planId: string }>;
};

function getRequirementActionPriority({
  hasRecipes,
  requirementsCount,
  shortageCount,
}: {
  hasRecipes: boolean;
  requirementsCount: number;
  shortageCount: number;
}) {
  if (!hasRecipes) return "add_recipe" as const;
  if (requirementsCount === 0) return "refresh_requirements" as const;
  if (shortageCount > 0) return "generate_requisition" as const;
  return "reserve_inventory" as const;
}

export default async function KitchenEventCateringPlanPage({ params }: KitchenEventCateringPlanPageProps) {
  const { tenantSlug, eventId, planId } = await params;
  const result = await resolveKitchenPage(tenantSlug, "event_catering", "plans");
  if (!result.ok) {
    return <StatePanel kind="permission" title="Sin permisos" message="No tienes acceso a planes de catering." />;
  }

  const [plan, event, accessMap] = await Promise.all([
    getCateringPlan(result.tenant.tenantSlug, planId),
    getEventForCatering(result.tenant.tenantSlug, eventId),
    getCurrentTenantModulePageAccessMap(result.tenant.tenantId, "event_catering"),
  ]);

  if (!plan || plan.event_id !== eventId) {
    return <StatePanel kind="empty" title="Plan no encontrado" message="El plan no existe o no pertenece a este evento." />;
  }

  const canManagePlans = hasModulePageAccess(accessMap.plans ?? "none", "manage");
  const canManageRequirements = hasModulePageAccess(accessMap.requirements ?? "none", "manage");
  const canManageRequisitions = hasModulePageAccess(accessMap.requisitions ?? "none", "manage");
  const planRecipesPromise = listPlanRecipes(result.tenant.tenantSlug, plan.id);
  const requirementsPromise = listCateringRequirements(result.tenant.tenantSlug, plan.id);
  const itemFlowPromise = listCateringPlanItemFlow(result.tenant.tenantSlug, plan.id);
  const warningsPromise = itemFlowPromise.then((itemFlow) =>
    listCateringPlanWarnings(result.tenant.tenantSlug, plan.id, { itemFlow }),
  );
  const consumptionsPromise = listConsumptionRecordsForPlan(result.tenant.tenantSlug, plan.id);
  const expectedAttendance = Number(event?.expected_attendance ?? 0);
  const plannedGuestCount = Number(plan.planned_guest_count ?? 0);
  const hasGuestDelta = expectedAttendance > 0 && plannedGuestCount > 0;
  const guestDelta = hasGuestDelta ? plannedGuestCount - expectedAttendance : 0;
  const consumptions = await consumptionsPromise;
  const confirmedConsumption = consumptions.find((row) => row.status === "confirmed") ?? null;
  const draftConsumption = consumptions.find((row) => row.status === "draft") ?? null;
  const isServiceClosed = confirmedConsumption != null;

  return (
    <div className="space-y-4">
      <KitchenPageHeader
        eyebrow="Servicio de catering"
        title={`Servicio: ${plan.name ?? `Plan ${plan.id.slice(0, 8)}`}`}
        description="Revisa costo, recetas, faltantes y siguiente paso operativo del servicio."
        metadata={
          <>
            <span>Evento: {event?.name ?? eventId.slice(0, 8)}</span>
            <span className="mx-2">·</span>
            <span>Fecha: {event?.starts_at ? new Date(event.starts_at).toLocaleString("es-MX") : "—"}</span>
            <span className="mx-2">·</span>
            <span>Costo estimado: ${Number(plan.estimated_total_cost).toLocaleString("es-MX", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
            <span className="mx-2">·</span>
            <span>Estado: <KitchenStatusBadge status={plan.status} /></span>
            <span className="mx-2">·</span>
            <span>
              Asistencia esperada: {expectedAttendance > 0 ? expectedAttendance.toLocaleString("es-MX") : "—"} · Base del plan:{" "}
              {plannedGuestCount > 0 ? plannedGuestCount.toLocaleString("es-MX") : "—"}
              {hasGuestDelta ? ` · Diferencia: ${guestDelta > 0 ? "+" : ""}${guestDelta.toLocaleString("es-MX")}` : ""}
            </span>
          </>
        }
        actions={
          <Link
            href={`/${tenantSlug}/kitchen/events/${eventId}/catering/${plan.id}/consumption${confirmedConsumption ? `/${confirmedConsumption.id}` : draftConsumption ? `/${draftConsumption.id}` : ""}`}
            className="inline-flex rounded border border-border bg-surface px-2 py-1 text-xs"
          >
            {isServiceClosed ? "Ver consumo confirmado" : "Gestionar consumo"}
          </Link>
        }
      />
      {isServiceClosed ? (
        <section className="rounded-[var(--radius-base)] border border-primary/20 bg-primary/10 p-3 text-xs">
          <p className="font-semibold text-foreground">Este servicio ya tiene consumo confirmado. El inventario ya fue impactado.</p>
          {confirmedConsumption ? (
            <Link
              href={`/${tenantSlug}/kitchen/events/${eventId}/catering/${plan.id}/consumption/${confirmedConsumption.id}`}
              className="mt-2 inline-flex underline underline-offset-2"
            >
              Abrir consumo confirmado
            </Link>
          ) : null}
        </section>
      ) : null}
      <EventCateringContextHeader
        tenantSlug={tenantSlug}
        eventId={eventId}
        eventName={event?.name ?? null}
        eventDate={event?.starts_at ?? null}
        planId={plan.id}
        planName={plan.name}
        peopleBase={plan.planned_guest_count}
        operationalStatus={plan.status}
      />

      <Suspense fallback={<KitchenTableSkeleton rows={2} columns={4} />}>
        <PlanOperationalSummarySection
          tenantSlug={result.tenant.tenantSlug}
          planId={plan.id}
          requirementsPromise={requirementsPromise}
        />
      </Suspense>

      <Suspense fallback={<KitchenTableSkeleton rows={8} columns={6} />}>
        <PlanFinancialReportSection
          tenantSlug={result.tenant.tenantSlug}
          planId={plan.id}
        />
      </Suspense>

      <Suspense fallback={<KitchenTableSkeleton rows={5} columns={4} />}>
        <PlanRecipesSection
          tenantSlug={result.tenant.tenantSlug}
          uiTenantSlug={tenantSlug}
          planId={plan.id}
          canManagePlans={canManagePlans}
          suggestedServings={plan.planned_guest_count != null ? Number(plan.planned_guest_count) : null}
          planRecipesPromise={planRecipesPromise}
        />
      </Suspense>

      <Suspense fallback={<KitchenTableSkeleton rows={4} columns={4} />}>
        <PlanPriceReviewSection tenantSlug={result.tenant.tenantSlug} planId={plan.id} />
      </Suspense>

      <Suspense fallback={<KitchenTableSkeleton rows={8} columns={7} />}>
        <PlanRequirementsSection
          uiTenantSlug={tenantSlug}
          planId={plan.id}
          requirementsPromise={requirementsPromise}
        />
      </Suspense>

      <PlanActionsSection
        uiTenantSlug={tenantSlug}
        planId={plan.id}
        canManageRequirements={canManageRequirements}
        canManageRequisitions={canManageRequisitions}
        isServiceClosed={isServiceClosed}
        requirementsPromise={requirementsPromise}
        planRecipesPromise={planRecipesPromise}
      />

      <Suspense fallback={<KitchenTableSkeleton rows={8} columns={10} />}>
        <PlanItemFlowSection itemFlowPromise={itemFlowPromise} />
      </Suspense>

      <Suspense fallback={<KitchenTableSkeleton rows={5} columns={2} />}>
        <PlanWarningsSection warningsPromise={warningsPromise} />
      </Suspense>
    </div>
  );
}

async function PlanOperationalSummarySection({
  tenantSlug,
  planId,
  requirementsPromise,
}: {
  tenantSlug: string;
  planId: string;
  requirementsPromise: ReturnType<typeof listCateringRequirements>;
}) {
  const [requirements, operationalSummary] = await Promise.all([
    requirementsPromise,
    getCateringPlanOperationalSummary(tenantSlug, planId),
  ]);
  const summary = summarizeCateringRequirements(requirements);

  return (
    <>
      <section className="rounded-[var(--radius-base)] border border-border bg-surface p-4">
        <p className="text-xs text-muted">
          Líneas requeridas: {summary.totalRequiredLines} · Faltantes: {summary.shortageCount} · Costo faltante: $
          {Number(summary.totalShortageCost).toLocaleString("es-MX", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
        </p>
      </section>
      <section className="rounded-[var(--radius-base)] border border-border bg-surface p-4">
        <h2 className="text-sm font-semibold text-foreground">Resumen operativo</h2>
        <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          <KitchenMetricCard label="Costo estimado" value={`$${Number(operationalSummary.estimated_plan_cost).toLocaleString("es-MX",{minimumFractionDigits:2,maximumFractionDigits:2})}`} />
          <KitchenMetricCard label="Requisicionado" value={`$${Number(operationalSummary.requisition_total).toLocaleString("es-MX",{minimumFractionDigits:2,maximumFractionDigits:2})}`} />
          <KitchenMetricCard label="Recibido" value={`$${Number(operationalSummary.received_total_cost).toLocaleString("es-MX",{minimumFractionDigits:2,maximumFractionDigits:2})}`} />
          <KitchenMetricCard label="Consumido" value={`$${Number(operationalSummary.consumed_total_cost).toLocaleString("es-MX",{minimumFractionDigits:2,maximumFractionDigits:2})}`} />
          <KitchenMetricCard label="Merma" value={`$${Number(operationalSummary.waste_total_cost).toLocaleString("es-MX",{minimumFractionDigits:2,maximumFractionDigits:2})}`} />
          <KitchenMetricCard label="Insumos con faltante" value={operationalSummary.shortage_count} tone={Number(operationalSummary.shortage_count) > 0 ? "warning" : "default"} />
          <KitchenMetricCard label="Costo faltante estimado" value={`$${Number(operationalSummary.estimated_shortage_cost).toLocaleString("es-MX",{minimumFractionDigits:2,maximumFractionDigits:2})}`} tone={Number(operationalSummary.estimated_shortage_cost) > 0 ? "warning" : "default"} />
          <KitchenMetricCard label="Estado operativo" value={operationalSummary.operational_status_label} tone={operationalSummary.operational_status_label === "En planeación" || operationalSummary.operational_status_label === "Consumo registrado" || operationalSummary.operational_status_label === "Listo para consumo" ? "default" : "warning"} />
        </div>
        <p className="mt-3 text-xs text-muted">
          Las diferencias de cantidades se muestran por insumo y unidad para evitar mezclar kg, litros y piezas.
        </p>
      </section>
    </>
  );
}

function formatMoney(value: number | null | undefined) {
  if (value == null) return "No disponible";
  return `$${Number(value).toLocaleString("es-MX", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function formatQuantity(value: number | null | undefined, unitCode?: string | null) {
  if (value == null) return "No disponible";
  return `${Number(value).toLocaleString("es-MX", { minimumFractionDigits: 2, maximumFractionDigits: 4 })}${unitCode ? ` ${unitCode}` : ""}`;
}

function getFinancialStatusBadge(status: CateringPlanFinancialStatus) {
  switch (status) {
    case "ok":
      return <EventCateringBadge label="OK" tone="success" />;
    case "remaining_inventory":
      return <EventCateringBadge label="Remanente" tone="info" />;
    case "over_purchase":
      return <EventCateringBadge label="Sobrecompra" tone="warning" />;
    case "waste":
      return <EventCateringBadge label="Merma" tone="warning" />;
    case "operational_zero_cost":
      return <EventCateringBadge label="Zero-cost operativo" tone="muted" />;
    case "partial":
      return <EventCateringBadge label="Reporte parcial" tone="info" />;
    case "review_needed":
      return <EventCateringBadge label="Revisar" tone="danger" />;
    default:
      return <EventCateringBadge label="Revisar" tone="danger" />;
  }
}

function getVarianceReasonLabel(reason: CateringPlanFinancialVarianceReason) {
  switch (reason) {
    case "ok":
      return "Sin variación material";
    case "price_change":
      return "Cambio de precio";
    case "supplier_change":
      return "Cambio de proveedor";
    case "purchase_presentation":
      return "Presentación de compra";
    case "minimum_purchase_or_multiple":
      return "Compra mínima o múltiplo";
    case "over_purchase_remaining_inventory":
      return "Remanente recuperable";
    case "received_less_than_requisitioned":
      return "Recibido menor a requisición";
    case "consumed_less_than_received":
      return "Consumido menor a recibido";
    case "waste":
      return "Merma";
    case "operational_zero_cost":
      return "Zero-cost operativo";
    case "review_needed":
      return "Revisión necesaria";
    default:
      return "Revisión necesaria";
  }
}

function PlanFinancialLineRow({ line }: { line: CateringPlanFinancialLine }) {
  return (
    <tr className="border-t border-border align-top transition-colors hover:bg-surface-2/50">
      <td className="px-2 py-2 text-foreground">
        <div className="font-medium">{line.itemName ?? line.itemId.slice(0, 8)}</div>
        <div className="text-muted">{line.unitCode ?? "ud"}</div>
      </td>
      <td className="px-2 py-2 text-foreground">
        <div>{line.supplierName ?? "No disponible"}</div>
        <div className="text-muted">{line.purchasePresentation ?? "No disponible"}</div>
      </td>
      <td className="px-2 py-2 text-foreground">
        <div>Req: {formatQuantity(line.requiredQuantity, line.unitCode)}</div>
        <div className="text-muted">Rec: {formatQuantity(line.receivedQuantity, line.unitCode)}</div>
        <div className="text-muted">Cons: {formatQuantity(line.consumedQuantity, line.unitCode)}</div>
      </td>
      <td className="px-2 py-2 text-foreground">
        <div>{formatQuantity(line.remainingQuantity, line.unitCode)}</div>
        <div className="text-muted">Merma: {formatQuantity(line.wasteQuantity, line.unitCode)}</div>
      </td>
      <td className="px-2 py-2 text-foreground">
        <div>Recibido: {formatMoney(line.receivedCost)}</div>
        <div className="text-muted">Consumido: {formatMoney(line.consumedCost)}</div>
        <div className="text-muted">Remanente: {formatMoney(line.remainingValue)}</div>
      </td>
      <td className="px-2 py-2 text-foreground">
        <div>{getFinancialStatusBadge(line.financialStatus)}</div>
        <div className="mt-1 text-muted">{getVarianceReasonLabel(line.primaryVarianceReason)}</div>
      </td>
    </tr>
  );
}

async function PlanFinancialReportSection({
  tenantSlug,
  planId,
}: {
  tenantSlug: string;
  planId: string;
}) {
  const report = await getCateringPlanFinancialReport(tenantSlug, planId);
  const { summary } = report;
  const topLines = report.lines.filter((line) => line.isFinanciallyRelevant || line.isOperationalZeroCost);

  return (
    <section className="rounded-[var(--radius-base)] border border-border bg-surface p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-foreground">Cierre financiero del servicio</h2>
          <p className="mt-1 text-xs text-muted">
            Diferencia entre costo estimado, compra planeada, compra recibida, consumo real, merma e inventario recuperable.
          </p>
        </div>
        <div>{getFinancialStatusBadge(summary.reportStatus === "closed" ? "ok" : summary.reportStatus === "partial" ? "partial" : "remaining_inventory")}</div>
      </div>

      <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        <KitchenMetricCard label="Costo estimado inicial" value={formatMoney(summary.estimatedInitialCost)} hint="Costo base del servicio al momento del costeo." />
        <KitchenMetricCard label="Total requisicionado" value={formatMoney(summary.requisitionedCost)} hint="Compra planeada a partir de requisiciones." />
        <KitchenMetricCard label="Total recibido/comprado" value={formatMoney(summary.receivedCost)} hint="Valor recibido para abastecer el servicio." />
        <KitchenMetricCard label="Costo consumido real" value={formatMoney(summary.consumedCost)} hint="Valor efectivamente consumido por el evento." />
        <KitchenMetricCard label="Merma" value={formatMoney(summary.wasteCost)} hint="Costo de salida no recuperable." tone={summary.wasteCost > 0 ? "warning" : "default"} />
        <KitchenMetricCard label="Inventario remanente" value={formatMoney(summary.remainingInventoryValue)} hint="Valor comprado que quedó disponible para uso futuro." tone={summary.remainingInventoryValue > 0 ? "warning" : "default"} />
        <KitchenMetricCard label="Variación bruta compra vs estimado" value={formatMoney(summary.grossPurchaseVariance)} hint="Diferencia entre compra/recepción y estimado inicial." tone={summary.grossPurchaseVariance > 0 ? "warning" : "default"} />
        <KitchenMetricCard label="Variación neta consumo vs estimado" value={formatMoney(summary.netConsumptionVariance)} hint="Diferencia entre consumo real + merma y estimado inicial." tone={Math.abs(summary.netConsumptionVariance) > 0.01 ? "warning" : "default"} />
      </div>

      <div className="mt-3 grid gap-2 sm:grid-cols-3">
        <KitchenMetricCard label="Estimado por persona" value={formatMoney(summary.estimatedCostPerPerson)} />
        <KitchenMetricCard label="Compra por persona" value={formatMoney(summary.purchasedCostPerPerson)} />
        <KitchenMetricCard label="Consumo real por persona" value={formatMoney(summary.consumedCostPerPerson)} />
      </div>

      <div className="mt-3 rounded-[var(--radius-base)] border border-border bg-surface-2 p-3">
        <p className="text-xs font-medium text-foreground">Lectura gerencial</p>
        <p className="mt-1 text-xs text-muted">{report.narrative}</p>
      </div>

      <div className="mt-3 flex flex-wrap gap-2 text-xs text-muted">
        <span>Requisiciones: {summary.requisitionCount}</span>
        <span>·</span>
        <span>Recepciones recibidas: {summary.receivedReceiptCount}</span>
        <span>·</span>
        <span>Consumos confirmados: {summary.confirmedConsumptionCount}</span>
        <span>·</span>
        <span>Zero-cost operativo: {summary.operationalZeroCostLineCount}</span>
      </div>

      <div className="mt-4 overflow-x-auto">
        <table className="min-w-full text-xs">
          <thead>
            <tr className="text-left text-muted">
              <th className="px-2 py-1">Insumo</th>
              <th className="px-2 py-1">Proveedor / presentación</th>
              <th className="px-2 py-1">Cantidades</th>
              <th className="px-2 py-1">Remanente</th>
              <th className="px-2 py-1">Costos</th>
              <th className="px-2 py-1">Estado / causa</th>
            </tr>
          </thead>
          <tbody>
            {topLines.map((line) => (
              <PlanFinancialLineRow key={`${line.itemId}:${line.unitId}`} line={line} />
            ))}
          </tbody>
        </table>
      </div>

      <p className="mt-2 text-xs text-muted">
        Los totales monetarios sí se consolidan. Las cantidades se muestran por insumo y unidad para no mezclar kg, litros y piezas.
      </p>
    </section>
  );
}

async function PlanRecipesSection({
  tenantSlug,
  uiTenantSlug,
  planId,
  canManagePlans,
  suggestedServings,
  planRecipesPromise,
}: {
  tenantSlug: string;
  uiTenantSlug: string;
  planId: string;
  canManagePlans: boolean;
  suggestedServings: number | null;
  planRecipesPromise: ReturnType<typeof listPlanRecipes>;
}) {
  const [planRecipes, readyRecipes] = await Promise.all([
    planRecipesPromise,
    listReadyRecipesForCatering(tenantSlug),
  ]);
  const hasRecipes = planRecipes.length > 0;

  return (
    <>
      {planRecipes.length === 0 ? (
        <>
          {canManagePlans ? (
            <AddReadyRecipeToPlanForm
              tenantSlug={uiTenantSlug}
              planId={planId}
              suggestedServings={suggestedServings}
              recipes={readyRecipes}
            />
          ) : null}
          <StatePanel kind="empty" title="Sin recetas en el servicio" message="Agrega recetas ready para estimar el costo del servicio." />
        </>
      ) : (
        <section className="rounded-[var(--radius-base)] border border-border bg-surface p-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="text-sm font-semibold text-foreground">Recetas del servicio</h2>
              <p className="text-xs text-muted">Cada receta muestra su base para este servicio, costo estimado y acciones de ajuste.</p>
            </div>
          </div>
          <div className="mt-2 space-y-2">
            {planRecipes.map((planRecipe) => (
              <div key={planRecipe.id} className="rounded border border-border bg-surface-2 p-3">
                <p className="text-sm text-foreground">
                  {planRecipe.kitchen_recipe_recipes?.name ?? `Receta ${planRecipe.recipe_id.slice(0, 8)}`} ·
                  Categoría: {planRecipe.kitchen_recipe_recipes?.category ?? "Sin categoría"}
                </p>
                <p className="text-xs text-muted">
                  Base para este servicio: {Number(planRecipe.planned_servings).toLocaleString("es-MX", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ·
                  Multiplicador: {Number(planRecipe.multiplier).toLocaleString("es-MX", { minimumFractionDigits: 2, maximumFractionDigits: 4 })} ·
                  Costo de esta receta en el servicio: ${Number(planRecipe.estimated_cost).toLocaleString("es-MX", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ·
                  Estado receta: <KitchenStatusBadge status={planRecipe.kitchen_recipe_recipes?.status} />
                </p>
                {canManagePlans ? (
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <form action={updatePlanRecipeServingsAction} className="flex items-center gap-2">
                      <input type="hidden" name="tenantSlug" value={uiTenantSlug} />
                      <input type="hidden" name="planId" value={planId} />
                      <input type="hidden" name="planRecipeId" value={planRecipe.id} />
                      <input
                        name="plannedServings"
                        type="number"
                        min="0.0001"
                        step="0.0001"
                        defaultValue={String(planRecipe.planned_servings)}
                        aria-label="Personas o porciones planeadas para esta receta"
                        className="h-8 w-40 rounded-[var(--radius-base)] border border-border bg-surface px-2 text-xs"
                      />
                      <KitchenSubmitButton pendingLabel="Guardando..." variant="secondary" className="px-2 py-1 text-xs">
                        Guardar
                      </KitchenSubmitButton>
                    </form>
                    <form action={removeRecipeFromCateringPlanAction}>
                      <input type="hidden" name="tenantSlug" value={uiTenantSlug} />
                      <input type="hidden" name="planId" value={planId} />
                      <input type="hidden" name="planRecipeId" value={planRecipe.id} />
                      <KitchenSubmitButton pendingLabel="Quitando..." variant="secondary" className="px-2 py-1 text-xs">
                        Quitar receta
                      </KitchenSubmitButton>
                    </form>
                  </div>
                ) : null}
              </div>
            ))}
          </div>
          {canManagePlans && hasRecipes ? (
            <details className="mt-3 rounded border border-border bg-surface p-3">
              <summary className="cursor-pointer text-xs font-medium text-foreground">Agregar receta</summary>
              <div className="mt-3">
                <AddReadyRecipeToPlanForm
                  tenantSlug={uiTenantSlug}
                  planId={planId}
                  suggestedServings={suggestedServings}
                  recipes={readyRecipes}
                />
              </div>
            </details>
          ) : null}
        </section>
      )}
    </>
  );
}

async function PlanPriceReviewSection({
  tenantSlug,
  planId,
}: {
  tenantSlug: string;
  planId: string;
}) {
  const summary = await getCateringPlanPriceReviewSummary(tenantSlug, planId);

  return (
    <section className="rounded-[var(--radius-base)] border border-border bg-surface p-4">
      <h2 className="text-sm font-semibold text-foreground">Revisión de precios del servicio</h2>
      <p className="mt-1 text-xs text-muted">
        Paso previo a requisición para validar que los insumos requeridos tienen precio vigente revisado. En esta fase es informativo; no modifica precios ni genera compra.
      </p>
      {summary.required_items_count === 0 ? (
        <p className="mt-3 text-xs text-muted">Pendiente de implementar cuando el servicio tenga requerimientos calculados.</p>
      ) : (
        <>
          <div className="mt-3">
            <EventCateringBadge
              label={
                summary.items_without_current_price_count > 0
                  ? "Faltan precios"
                  : summary.items_with_current_price_count > 0
                    ? "Precios vigentes disponibles"
                    : "Informativo"
              }
              tone={
                summary.items_without_current_price_count > 0
                  ? "warning"
                  : summary.items_with_current_price_count > 0
                    ? "success"
                    : "info"
              }
            />
          </div>
          <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
            <KitchenMetricCard label="Insumos requeridos" value={summary.required_items_count} />
            <KitchenMetricCard label="Con precio vigente" value={summary.items_with_current_price_count} />
            <KitchenMetricCard label="Sin precio vigente" value={summary.items_without_current_price_count} tone={summary.items_without_current_price_count > 0 ? "warning" : "default"} />
            <KitchenMetricCard
              label="Última vigencia detectada"
              value={summary.latest_valid_from ? new Date(summary.latest_valid_from).toLocaleDateString("es-MX") : "—"}
            />
          </div>
          <p className="mt-3 text-xs text-muted">
            Fuentes detectadas: {summary.source_types.length > 0 ? summary.source_types.join(", ") : "Sin fuente visible"}.
          </p>
          {summary.items_without_current_price_count > 0 ? (
            <div className="mt-3 rounded border border-amber-300/40 bg-amber-500/10 p-3">
              <p className="text-xs font-medium text-amber-700">Advertencia: faltan precios vigentes para algunos insumos.</p>
              <ul className="mt-2 space-y-1 text-xs text-amber-700">
                {summary.missing_price_items.slice(0, 8).map((item: (typeof summary.missing_price_items)[number]) => (
                  <li key={item.item_id}>
                    {item.item_name ?? item.item_id.slice(0, 8)} {item.unit_code ? `· ${item.unit_code}` : ""}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </>
      )}
    </section>
  );
}

async function PlanRequirementsSection({
  uiTenantSlug,
  planId,
  requirementsPromise,
}: {
  uiTenantSlug: string;
  planId: string;
  requirementsPromise: ReturnType<typeof listCateringRequirements>;
}) {
  const [requirements, draftRequisition] = await Promise.all([
    requirementsPromise,
    getPlanDraftRequisition(uiTenantSlug, planId),
  ]);
  const shortages = listRequirementShortagesFromRequirements(requirements);
  const reservationSummary = requirements.reduce(
    (acc, row) => {
      const availability = (row.source_payload as {
        availability_breakdown?: {
          reserved_this_plan?: number;
        };
      }).availability_breakdown;
      const required = Number(row.required_quantity ?? 0);
      const reservedThisPlan = Number(availability?.reserved_this_plan ?? 0);
      return {
        required: acc.required + required,
        reservedThisPlan: acc.reservedThisPlan + reservedThisPlan,
        fullyReservedLines: acc.fullyReservedLines + (required > 0 && reservedThisPlan >= required ? 1 : 0),
      };
    },
    { required: 0, reservedThisPlan: 0, fullyReservedLines: 0 },
  );
  const hasRequirements = requirements.length > 0;
  const isFullyReserved =
    hasRequirements &&
    reservationSummary.fullyReservedLines === requirements.length &&
    reservationSummary.reservedThisPlan >= reservationSummary.required;
  const isPartiallyReserved = hasRequirements && reservationSummary.reservedThisPlan > 0 && !isFullyReserved;

  return (
    <section className="rounded-[var(--radius-base)] border border-border bg-surface p-4">
      <div>
        <h2 className="text-sm font-semibold text-foreground">Requerimientos y faltantes</h2>
        <p className="text-xs text-muted">Insumos calculados a partir de las recetas del servicio. Las cantidades se muestran por insumo y unidad.</p>
        <p className="mt-1 text-xs text-muted">Apartar inventario reserva stock disponible para este servicio. Generar requisición compra solo el faltante real.</p>
        {hasRequirements ? (
          <p className="mt-1 text-xs text-muted">
            Estado:{" "}
            {isFullyReserved
              ? "Inventario apartado para este servicio."
              : isPartiallyReserved
                ? "Inventario parcialmente apartado."
                : "Requerimientos calculados, inventario aún no apartado."}
          </p>
        ) : null}
      </div>
      {requirements.length === 0 ? (
        <div className="mt-3">
          <StatePanel kind="empty" title="Sin requerimientos calculados" message="Ejecuta recálculo para generar insumos requeridos, disponibilidad y faltantes." />
        </div>
      ) : (
        <div className="mt-3 overflow-x-auto">
          <table className="min-w-full text-xs">
            <thead>
              <tr className="text-left text-muted">
                <th className="px-2 py-1">Insumo</th>
                <th className="px-2 py-1">Requerido</th>
                <th className="px-2 py-1">Disponible</th>
                <th className="px-2 py-1">Reservado</th>
                <th className="px-2 py-1">Faltante</th>
                <th className="px-2 py-1">Costo estimado</th>
                <th className="px-2 py-1">Estado</th>
              </tr>
            </thead>
            <tbody>
              {requirements.map((row) => (
                <tr key={row.id} className="border-t border-border transition-colors hover:bg-surface-2/50">
                  {(() => {
                    const availability = ((row.source_payload as { availability_breakdown?: {
                      physical_balance?: number;
                      reserved_other_plans?: number;
                      reserved_this_plan?: number;
                      available_for_plan?: number;
                    } }).availability_breakdown) ?? {};
                    const reservedThisPlan = Number(availability.reserved_this_plan ?? 0);
                    const availableForPlan = Number(availability.available_for_plan ?? row.available_quantity ?? 0);
                    return (
                      <>
                  <td className="px-2 py-1 text-foreground">{row.kitchen_inventory_items?.name ?? row.item_id.slice(0, 8)}</td>
                  <td className="px-2 py-1 text-foreground">
                    {Number(row.required_quantity).toLocaleString("es-MX", { minimumFractionDigits: 2, maximumFractionDigits: 4 })} {row.kitchen_inventory_units?.code ?? "ud"}
                  </td>
                  <td className="px-2 py-1 text-foreground">
                    {availableForPlan.toLocaleString("es-MX", { minimumFractionDigits: 2, maximumFractionDigits: 4 })} {row.kitchen_inventory_units?.code ?? "ud"}
                  </td>
                  <td className="px-2 py-1 text-foreground">
                    {reservedThisPlan.toLocaleString("es-MX", { minimumFractionDigits: 2, maximumFractionDigits: 4 })} {row.kitchen_inventory_units?.code ?? "ud"}
                  </td>
                  <td className={`px-2 py-1 ${Number(row.shortage_quantity) > 0 ? "text-amber-600" : "text-foreground"}`}>
                    {Number(row.shortage_quantity).toLocaleString("es-MX", { minimumFractionDigits: 2, maximumFractionDigits: 4 })} {row.kitchen_inventory_units?.code ?? "ud"}
                  </td>
                  <td className="px-2 py-1 text-foreground">${Number(row.estimated_total_cost).toLocaleString("es-MX", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                  <td className="px-2 py-1 text-foreground">
                    {Number(row.shortage_quantity) > 0 ? <EventCateringBadge label="Con faltantes" tone="warning" /> : reservedThisPlan >= Number(row.required_quantity) ? <EventCateringBadge label="Listo" tone="success" /> : <EventCateringBadge label="Pendiente" tone="info" />}
                  </td>
                      </>
                    );
                  })()}
                </tr>
              ))}
            </tbody>
          </table>
          {shortages.length > 0 ? (
            <div className="mt-2 flex flex-wrap items-center gap-2">
            <p className="text-xs text-amber-600">Hay {shortages.length} insumos con faltante.</p>
              {draftRequisition ? (
                <Link
                  href={`/${uiTenantSlug}/kitchen/events/requisitions/${draftRequisition.id}`}
                  className="text-xs underline underline-offset-2"
                >
                  Ver requisición draft
                </Link>
              ) : null}
            </div>
          ) : (
            <div className="mt-2 space-y-1 text-xs">
              <p className={isFullyReserved ? "text-emerald-600" : "text-muted"}>
                {isFullyReserved
                  ? "Sin faltantes. Inventario apartado para este servicio."
                  : "Sin faltantes calculados. Puedes apartar inventario para este servicio antes de planear otro servicio."}
              </p>
            </div>
          )}
        </div>
      )}
    </section>
  );
}

function PlanActionsSection({
  uiTenantSlug,
  planId,
  canManageRequirements,
  canManageRequisitions,
  isServiceClosed,
  requirementsPromise,
  planRecipesPromise,
}: {
  uiTenantSlug: string;
  planId: string;
  canManageRequirements: boolean;
  canManageRequisitions: boolean;
  isServiceClosed: boolean;
  requirementsPromise: ReturnType<typeof listCateringRequirements>;
  planRecipesPromise: ReturnType<typeof listPlanRecipes>;
}) {
  if (isServiceClosed || (!canManageRequirements && !canManageRequisitions)) {
    return null;
  }

  return <PlanActionsSectionContent
    uiTenantSlug={uiTenantSlug}
    planId={planId}
    canManageRequirements={canManageRequirements}
    canManageRequisitions={canManageRequisitions}
    requirementsPromise={requirementsPromise}
    planRecipesPromise={planRecipesPromise}
  />;
}

async function PlanActionsSectionContent({
  uiTenantSlug,
  planId,
  canManageRequirements,
  canManageRequisitions,
  requirementsPromise,
  planRecipesPromise,
}: {
  uiTenantSlug: string;
  planId: string;
  canManageRequirements: boolean;
  canManageRequisitions: boolean;
  requirementsPromise: ReturnType<typeof listCateringRequirements>;
  planRecipesPromise: ReturnType<typeof listPlanRecipes>;
}) {
  const [requirements, planRecipes] = await Promise.all([requirementsPromise, planRecipesPromise]);
  const primaryAction = getRequirementActionPriority({
    hasRecipes: planRecipes.length > 0,
    requirementsCount: requirements.length,
    shortageCount: requirements.filter((row) => Number(row.shortage_quantity ?? 0) > 0).length,
  });

  const getVariant = (action: string) => (primaryAction === action ? "primary" : "secondary");

  return (
    <section className="rounded-[var(--radius-base)] border border-border bg-surface p-4">
      <h2 className="text-sm font-semibold text-foreground">Acciones operativas</h2>
      <p className="mt-1 text-xs text-muted">Usa estas acciones para actualizar requerimientos, apartar inventario o generar la requisición sugerida del servicio.</p>
      <div className="mt-3 flex flex-wrap gap-2">
        {canManageRequirements ? (
          <form action={recalculateCateringRequirementsAction}>
            <input type="hidden" name="tenantSlug" value={uiTenantSlug} />
            <input type="hidden" name="planId" value={planId} />
            <KitchenSubmitButton pendingLabel="Recalculando..." variant={getVariant("refresh_requirements")} className="px-3 py-2 text-xs">
              Actualizar requerimientos
            </KitchenSubmitButton>
          </form>
        ) : null}
        {canManageRequirements ? (
          <form action={reserveInventoryForCateringPlanAction}>
            <input type="hidden" name="tenantSlug" value={uiTenantSlug} />
            <input type="hidden" name="planId" value={planId} />
            <KitchenSubmitButton pendingLabel="Apartando..." variant={getVariant("reserve_inventory")} className="px-3 py-2 text-xs">
              Apartar inventario para este servicio
            </KitchenSubmitButton>
          </form>
        ) : null}
        {canManageRequisitions ? (
          <form action={generateCateringRequisitionFromShortagesAction}>
            <input type="hidden" name="tenantSlug" value={uiTenantSlug} />
            <input type="hidden" name="planId" value={planId} />
            <KitchenSubmitButton pendingLabel="Generando..." variant={getVariant("generate_requisition")} className="px-3 py-2 text-xs">
              Generar requisición sugerida
            </KitchenSubmitButton>
          </form>
        ) : null}
      </div>
    </section>
  );
}

async function PlanItemFlowSection({
  itemFlowPromise,
}: {
  itemFlowPromise: ReturnType<typeof listCateringPlanItemFlow>;
}) {
  const itemFlow = await itemFlowPromise;

  return (
    <section className="rounded-[var(--radius-base)] border border-border bg-surface p-4">
      <h2 className="text-sm font-semibold text-foreground">Detalle operativo por insumo</h2>
      <p className="mt-1 text-xs text-muted">Seguimiento por insumo: requerido, faltante, requisicionado, recibido, consumido y pendiente.</p>
      {itemFlow.length === 0 ? (
        <p className="mt-2 text-xs text-muted">Sin flujo consolidado para este plan.</p>
      ) : (
        <div className="mt-3 overflow-x-auto">
          <table className="min-w-full text-xs">
            <thead>
              <tr className="text-left text-muted">
                <th className="px-2 py-1">Insumo</th>
                <th className="px-2 py-1">Unidad</th>
                <th className="px-2 py-1">Requerido</th>
                <th className="px-2 py-1">Faltante</th>
                <th className="px-2 py-1">Pedido</th>
                <th className="px-2 py-1">Recibido</th>
                <th className="px-2 py-1">Consumido</th>
                <th className="px-2 py-1">Merma</th>
                <th className="px-2 py-1">Pendiente recibir</th>
                <th className="px-2 py-1">Pendiente consumir</th>
                <th className="px-2 py-1">Sobrante</th>
                <th className="px-2 py-1">Costo requerido</th>
                <th className="px-2 py-1">Balance actual</th>
                <th className="px-2 py-1">Estado</th>
              </tr>
            </thead>
            <tbody>
              {itemFlow.map((row) => {
                const pendingReceive = Math.max(row.required_quantity - row.received_quantity, 0);
                const pendingConsume = Math.max(row.received_quantity - (row.consumed_quantity + row.waste_quantity), 0);
                return (
                  <tr key={`${row.item_id}:${row.unit_id}`} className="border-t border-border transition-colors hover:bg-surface-2/50">
                    <td className="px-2 py-1 text-foreground">{row.item_name ?? row.item_id.slice(0, 8)}</td>
                    <td className="px-2 py-1 text-muted">{row.unit_code ?? "ud"}</td>
                    <td className="px-2 py-1 text-foreground">{row.required_quantity.toLocaleString("es-MX",{minimumFractionDigits:2,maximumFractionDigits:4})}</td>
                    <td className="px-2 py-1 text-warning">{row.shortage_quantity.toLocaleString("es-MX",{minimumFractionDigits:2,maximumFractionDigits:4})}</td>
                    <td className="px-2 py-1 text-foreground">{row.requisition_requested_quantity.toLocaleString("es-MX",{minimumFractionDigits:2,maximumFractionDigits:4})}</td>
                    <td className="px-2 py-1 text-foreground">{row.received_quantity.toLocaleString("es-MX",{minimumFractionDigits:2,maximumFractionDigits:4})}</td>
                    <td className="px-2 py-1 text-foreground">{row.consumed_quantity.toLocaleString("es-MX",{minimumFractionDigits:2,maximumFractionDigits:4})}</td>
                    <td className="px-2 py-1 text-warning">{row.waste_quantity.toLocaleString("es-MX",{minimumFractionDigits:2,maximumFractionDigits:4})}</td>
                    <td className="px-2 py-1 text-warning">{pendingReceive.toLocaleString("es-MX",{minimumFractionDigits:2,maximumFractionDigits:4})}</td>
                    <td className="px-2 py-1 text-foreground">{pendingConsume.toLocaleString("es-MX",{minimumFractionDigits:2,maximumFractionDigits:4})}</td>
                    <td className="px-2 py-1 text-foreground">{row.leftover_quantity.toLocaleString("es-MX",{minimumFractionDigits:2,maximumFractionDigits:4})}</td>
                    <td className="px-2 py-1 text-foreground">${row.estimated_required_cost.toLocaleString("es-MX",{minimumFractionDigits:2,maximumFractionDigits:2})}</td>
                    <td className="px-2 py-1 text-muted">{row.current_balance.toLocaleString("es-MX",{minimumFractionDigits:2,maximumFractionDigits:4})}</td>
                    <td className="px-2 py-1 text-muted"><KitchenStatusBadge status={row.status} /></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <p className="mt-2 text-xs text-muted">
            Las diferencias y pendientes se muestran por insumo y unidad. No se agregan kg, litros y piezas en una sola cifra.
          </p>
        </div>
      )}
    </section>
  );
}

async function PlanWarningsSection({
  warningsPromise,
}: {
  warningsPromise: ReturnType<typeof listCateringPlanWarnings>;
}) {
  const warnings = await warningsPromise;

  return (
    <section className="rounded-[var(--radius-base)] border border-border bg-surface p-4">
      <h2 className="text-sm font-semibold text-foreground">Alertas operativas</h2>
      {warnings.length === 0 ? (
        <p className="mt-2 text-xs text-muted">Estado limpio. No hay alertas operativas relevantes.</p>
      ) : (
        <ul className="mt-2 space-y-1 text-xs">
          {warnings.map((warning) => (
            <li key={warning.code} className={warning.severity === "warning" ? "text-warning" : "text-muted"}>
              [{warning.code}] {warning.message}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
