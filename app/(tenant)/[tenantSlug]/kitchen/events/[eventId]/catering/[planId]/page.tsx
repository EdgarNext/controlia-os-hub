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
  getEventForCatering,
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
import { resolveKitchenPage } from "../../../../_lib/page-access";
import { AddReadyRecipeToPlanForm } from "./_components/plan-forms";

type KitchenEventCateringPlanPageProps = {
  params: Promise<{ tenantSlug: string; eventId: string; planId: string }>;
};

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
        eyebrow="Plan de catering"
        title={plan.name ?? `Plan ${plan.id.slice(0, 8)}`}
        description={`Costo estimado: $${Number(plan.estimated_total_cost).toLocaleString("es-MX", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
        metadata={
          <>
            <span>Evento: {eventId.slice(0, 8)}</span>
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

      <Suspense fallback={<KitchenTableSkeleton rows={5} columns={4} />}>
        <PlanRecipesSection
          tenantSlug={result.tenant.tenantSlug}
          uiTenantSlug={tenantSlug}
          planId={plan.id}
          canManagePlans={canManagePlans}
          suggestedServings={plan.planned_guest_count != null ? Number(plan.planned_guest_count) : null}
        />
      </Suspense>

      <Suspense fallback={<KitchenTableSkeleton rows={8} columns={7} />}>
        <PlanRequirementsSection
          uiTenantSlug={tenantSlug}
          planId={plan.id}
          requirementsPromise={requirementsPromise}
          canManageRequirements={canManageRequirements}
          canManageRequisitions={canManageRequisitions}
          isServiceClosed={isServiceClosed}
        />
      </Suspense>

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

async function PlanRecipesSection({
  tenantSlug,
  uiTenantSlug,
  planId,
  canManagePlans,
  suggestedServings,
}: {
  tenantSlug: string;
  uiTenantSlug: string;
  planId: string;
  canManagePlans: boolean;
  suggestedServings: number | null;
}) {
  const [planRecipes, readyRecipes] = await Promise.all([
    listPlanRecipes(tenantSlug, planId),
    listReadyRecipesForCatering(tenantSlug),
  ]);

  return (
    <>
      {canManagePlans ? (
        <AddReadyRecipeToPlanForm
          tenantSlug={uiTenantSlug}
          planId={planId}
          suggestedServings={suggestedServings}
          recipes={readyRecipes}
        />
      ) : null}
      {planRecipes.length === 0 ? (
        <StatePanel kind="empty" title="Sin recetas en el plan" message="Agrega recetas ready para estimar el costo del catering." />
      ) : (
        <section className="rounded-[var(--radius-base)] border border-border bg-surface p-4">
          <h2 className="text-sm font-semibold text-foreground">Recetas del plan</h2>
          <div className="mt-2 space-y-2">
            {planRecipes.map((planRecipe) => (
              <div key={planRecipe.id} className="rounded border border-border bg-surface-2 p-3">
                <p className="text-sm text-foreground">
                  {planRecipe.kitchen_recipe_recipes?.name ?? `Receta ${planRecipe.recipe_id.slice(0, 8)}`} ·
                  Categoría: {planRecipe.kitchen_recipe_recipes?.category ?? "Sin categoría"}
                </p>
                <p className="text-xs text-muted">
                  Base de cálculo: {Number(planRecipe.planned_servings).toLocaleString("es-MX", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ·
                  Multiplicador: {Number(planRecipe.multiplier).toLocaleString("es-MX", { minimumFractionDigits: 2, maximumFractionDigits: 4 })} ·
                  Costo base: ${Number(planRecipe.estimated_cost).toLocaleString("es-MX", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ·
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
        </section>
      )}
    </>
  );
}

async function PlanRequirementsSection({
  uiTenantSlug,
  planId,
  requirementsPromise,
  canManageRequirements,
  canManageRequisitions,
  isServiceClosed,
}: {
  uiTenantSlug: string;
  planId: string;
  requirementsPromise: ReturnType<typeof listCateringRequirements>;
  canManageRequirements: boolean;
  canManageRequisitions: boolean;
  isServiceClosed: boolean;
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
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-foreground">Requerimientos y faltantes</h2>
          <p className="text-xs text-muted">
            Actualizar solo calcula. Apartar inventario reserva stock disponible para este servicio y evita que otros planes lo usen.
          </p>
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
        <div className="flex flex-wrap justify-end gap-2">
          {canManageRequirements && !isServiceClosed ? (
            <form action={recalculateCateringRequirementsAction}>
              <input type="hidden" name="tenantSlug" value={uiTenantSlug} />
              <input type="hidden" name="planId" value={planId} />
              <KitchenSubmitButton pendingLabel="Recalculando..." variant="secondary" className="px-3 py-2 text-xs">
                Actualizar requerimientos
              </KitchenSubmitButton>
            </form>
          ) : null}
          {canManageRequirements && !isServiceClosed ? (
            <form action={reserveInventoryForCateringPlanAction}>
              <input type="hidden" name="tenantSlug" value={uiTenantSlug} />
              <input type="hidden" name="planId" value={planId} />
              <KitchenSubmitButton pendingLabel="Apartando..." variant="primary" className="px-3 py-2 text-xs">
                Apartar inventario para este servicio
              </KitchenSubmitButton>
            </form>
          ) : null}
        </div>
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
                <th className="px-2 py-1">Unidad</th>
                <th className="px-2 py-1">Requerido</th>
                <th className="px-2 py-1">Stock físico</th>
                <th className="px-2 py-1">Reservado otros eventos</th>
                <th className="px-2 py-1">Reservado este plan</th>
                <th className="px-2 py-1">Disponible real</th>
                <th className="px-2 py-1">Faltante</th>
                <th className="px-2 py-1">Costo unitario</th>
                <th className="px-2 py-1">Costo total</th>
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
                    const physical = Number(availability.physical_balance ?? row.available_quantity ?? 0);
                    const reservedOthers = Number(availability.reserved_other_plans ?? 0);
                    const reservedThisPlan = Number(availability.reserved_this_plan ?? 0);
                    const availableForPlan = Number(availability.available_for_plan ?? row.available_quantity ?? 0);
                    return (
                      <>
                  <td className="px-2 py-1 text-foreground">{row.kitchen_inventory_items?.name ?? row.item_id.slice(0, 8)}</td>
                  <td className="px-2 py-1 text-muted">{row.kitchen_inventory_units?.code ?? "ud"}</td>
                  <td className="px-2 py-1 text-foreground">{Number(row.required_quantity).toLocaleString("es-MX", { minimumFractionDigits: 2, maximumFractionDigits: 4 })}</td>
                  <td className="px-2 py-1 text-foreground">{physical.toLocaleString("es-MX", { minimumFractionDigits: 2, maximumFractionDigits: 4 })}</td>
                  <td className="px-2 py-1 text-foreground">{reservedOthers.toLocaleString("es-MX", { minimumFractionDigits: 2, maximumFractionDigits: 4 })}</td>
                  <td className="px-2 py-1 text-foreground">{reservedThisPlan.toLocaleString("es-MX", { minimumFractionDigits: 2, maximumFractionDigits: 4 })}</td>
                  <td className="px-2 py-1 text-foreground">{availableForPlan.toLocaleString("es-MX", { minimumFractionDigits: 2, maximumFractionDigits: 4 })}</td>
                  <td className={`px-2 py-1 ${Number(row.shortage_quantity) > 0 ? "text-amber-600" : "text-foreground"}`}>
                    {Number(row.shortage_quantity).toLocaleString("es-MX", { minimumFractionDigits: 2, maximumFractionDigits: 4 })}
                  </td>
                  <td className="px-2 py-1 text-foreground">${Number(row.estimated_unit_cost).toLocaleString("es-MX", { minimumFractionDigits: 2, maximumFractionDigits: 4 })}</td>
                  <td className="px-2 py-1 text-foreground">${Number(row.estimated_total_cost).toLocaleString("es-MX", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
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
            <p className="mt-1 text-xs text-muted">
              Al generar la requisición sugerida se aparta primero el inventario físico disponible para este plan y se compra
              solo el faltante real.
            </p>
            {canManageRequisitions && !isServiceClosed ? (
              <form action={generateCateringRequisitionFromShortagesAction}>
                  <input type="hidden" name="tenantSlug" value={uiTenantSlug} />
                  <input type="hidden" name="planId" value={planId} />
                  <KitchenSubmitButton pendingLabel="Generando..." variant="secondary" className="px-2 py-1 text-xs">
                    Generar requisición sugerida
                  </KitchenSubmitButton>
                </form>
              ) : null}
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

async function PlanItemFlowSection({
  itemFlowPromise,
}: {
  itemFlowPromise: ReturnType<typeof listCateringPlanItemFlow>;
}) {
  const itemFlow = await itemFlowPromise;

  return (
    <section className="rounded-[var(--radius-base)] border border-border bg-surface p-4">
      <h2 className="text-sm font-semibold text-foreground">Flujo por insumo</h2>
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
        <p className="mt-2 text-xs text-emerald-600">Sin alertas operativas relevantes.</p>
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
