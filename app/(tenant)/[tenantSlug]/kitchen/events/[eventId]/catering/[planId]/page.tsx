import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { StatePanel } from "@/components/ui/state-panel";
import { getCurrentTenantModulePageAccessMap, hasModulePageAccess } from "@/lib/auth/module-page-access";
import {
  createInitialEventCostingSnapshotWithFeedbackAction,
  removeRecipeFromCateringPlanWithFeedbackAction,
  updateCateringPlanWithFeedbackAction,
  updatePlanRecipeServingsWithFeedbackAction,
} from "@/lib/kitchen/event-catering/actions";
import { ActionFeedbackForm } from "@/app/(tenant)/[tenantSlug]/kitchen/events/_components/action-feedback-form";
import { getChefServiceDetail } from "@/lib/kitchen/event-catering/chef-costing";
import { KitchenPageHeader } from "@/app/(tenant)/[tenantSlug]/kitchen/_components/kitchen-page-header";
import { KitchenSubmitButton } from "@/app/(tenant)/[tenantSlug]/kitchen/_components/kitchen-submit-button";
import { EventCateringBadge } from "@/app/(tenant)/[tenantSlug]/kitchen/events/_components/event-catering-badge";
import { resolveKitchenPage } from "../../../../_lib/page-access";
import { ConfirmDestructiveAction } from "../_components/confirm-destructive-action";
import { AddReadyRecipeToPlanForm } from "./_components/plan-forms";
import { ServiceCostingSummary } from "./_components/service-costing-summary";

type KitchenEventCateringPlanPageProps = {
  params: Promise<{ tenantSlug: string; eventId: string; planId: string }>;
};

function formatMoney(value: number | null): string {
  if (value == null) return "—";
  return `$${value.toLocaleString("es-MX", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export default async function KitchenEventCateringPlanPage({ params }: KitchenEventCateringPlanPageProps) {
  const { tenantSlug, eventId, planId } = await params;
  const result = await resolveKitchenPage(tenantSlug, "event_catering", "plans");

  if (!result.ok) {
    return <StatePanel kind="permission" title="Sin permisos" message="No tienes acceso a servicios de catering." />;
  }

  const [detail, accessMap] = await Promise.all([
    getChefServiceDetail(result.tenant.tenantSlug, eventId, planId),
    getCurrentTenantModulePageAccessMap(result.tenant.tenantId, "event_catering"),
  ]);
  if (!detail) {
    return <StatePanel kind="empty" title="Servicio no encontrado" message="El servicio no existe o no pertenece a este evento." />;
  }

  const canManage = hasModulePageAccess(accessMap.plans ?? "none", "manage");

  return (
    <div className="space-y-4">
      <KitchenPageHeader
        eyebrow="Servicio"
        title={detail.plan.name?.trim() || "Servicio sin nombre"}
        description="Ajusta personas, agrega recetas y completa el costeo de este servicio dentro del flujo del evento."
        metadata={
          <>
            <span>
              Evento: {detail.event.name}
              {detail.dateContext.relativeLabel ? ` · ${detail.dateContext.relativeLabel}` : ""}
            </span>
            <span className="mx-2">·</span>
            <span>
              Personas del servicio:{" "}
              {detail.plan.planned_guest_count != null
                ? Number(detail.plan.planned_guest_count).toLocaleString("es-MX")
                : "Sin definir"}
            </span>
            <span className="mx-2">·</span>
            <span>Recetas: {detail.recipes.length.toLocaleString("es-MX")}</span>
            <span className="mx-2">·</span>
            <span>Estado del evento: {detail.costingLabel}</span>
          </>
        }
        actions={
          <Link
            href={`/${tenantSlug}/kitchen/events/${eventId}/catering`}
            className="inline-flex rounded-[var(--radius-base)] border border-border bg-surface-2 px-3 py-2 text-sm"
          >
            <ChevronLeft className="mr-2 h-4 w-4" aria-hidden="true" />
            Volver al evento
          </Link>
        }
      />

      {detail.nextStep ? (
        <section className="rounded-[var(--radius-base)] border border-border bg-surface p-4">
          <p className="text-xs font-medium uppercase tracking-[0.08em] text-muted">Siguiente paso</p>
          <p className="mt-2 text-base font-semibold text-foreground">{detail.nextStep.message}</p>
          <Link
            href={detail.nextStep.action.href}
            className="mt-4 inline-flex rounded-[var(--radius-base)] border border-border bg-surface-2 px-3 py-2 text-sm"
          >
            {detail.nextStep.action.label}
          </Link>
        </section>
      ) : null}

      <ServiceCostingSummary detail={detail} />

      {canManage ? (
        <details className="rounded-[var(--radius-base)] border border-border bg-surface p-4">
          <summary className="cursor-pointer list-none text-sm font-semibold text-foreground">
            Editar servicio
          </summary>
          <div className="mt-4 grid gap-4 xl:grid-cols-[1.2fr_auto]">
            <ActionFeedbackForm action={updateCateringPlanWithFeedbackAction} className="grid gap-3 lg:grid-cols-[1fr_220px_auto]">
              <input type="hidden" name="tenantSlug" value={tenantSlug} />
              <input type="hidden" name="planId" value={planId} />
              <input
                name="name"
                defaultValue={detail.plan.name ?? ""}
                placeholder="Nombre del servicio"
                className="h-11 rounded-[var(--radius-base)] border border-border bg-surface-2 px-3 text-sm text-foreground"
              />
              <input
                name="plannedGuestCount"
                type="number"
                min="1"
                step="1"
                defaultValue={detail.plan.planned_guest_count != null ? String(detail.plan.planned_guest_count) : ""}
                placeholder="Personas del servicio"
                className="h-11 rounded-[var(--radius-base)] border border-border bg-surface-2 px-3 text-sm text-foreground"
              />
              <KitchenSubmitButton variant="secondary" pendingLabel="Guardando...">
                Guardar servicio
              </KitchenSubmitButton>
            </ActionFeedbackForm>

            <div className="space-y-3">
              <ActionFeedbackForm action={createInitialEventCostingSnapshotWithFeedbackAction}>
                <input type="hidden" name="tenantSlug" value={tenantSlug} />
                <input type="hidden" name="eventId" value={eventId} />
                <KitchenSubmitButton pendingLabel="Guardando costo inicial..." className="w-full">
                  {detail.configurationChanged || detail.latestInitialSnapshot
                    ? "Generar nuevo costo inicial"
                    : "Calcular costo inicial"}
                </KitchenSubmitButton>
              </ActionFeedbackForm>

              <ConfirmDestructiveAction
                title={`Quitar ${detail.plan.name?.trim() || "servicio"}`}
                description={
                  detail.recipes.length > 0
                    ? `Este servicio contiene ${detail.recipes.length.toLocaleString("es-MX")} recetas. Se quitará de la configuración actual del evento, pero las recetas seguirán disponibles en el catálogo y los costos históricos permanecerán intactos.`
                    : "Se quitará de la configuración actual del evento. Los costos históricos permanecerán disponibles."
                }
                triggerLabel="Quitar servicio del evento"
                confirmLabel="Quitar del evento"
                pendingLabel="Quitando..."
                action={updateCateringPlanWithFeedbackAction}
                hiddenFields={[
                  { name: "tenantSlug", value: tenantSlug },
                  { name: "planId", value: planId },
                  { name: "status", value: "canceled" },
                ]}
              />
            </div>
          </div>
        </details>
      ) : null}

      {canManage ? (
        <details className="rounded-[var(--radius-base)] border border-border bg-surface p-4" open={detail.recipes.length === 0}>
          <summary className="cursor-pointer list-none text-sm font-semibold text-foreground">
            Agregar receta
          </summary>
          <div className="mt-4">
            <AddReadyRecipeToPlanForm
              tenantSlug={tenantSlug}
              planId={planId}
              suggestedServings={detail.plan.planned_guest_count != null ? Number(detail.plan.planned_guest_count) : null}
              recipes={detail.readyRecipes.map((recipe) => ({
                recipe_id: recipe.recipe_id,
                recipe_name: recipe.recipe_name,
                snapshot_total_cost: recipe.snapshot_total_cost,
              }))}
            />
          </div>
        </details>
      ) : null}

      {detail.recipes.length === 0 ? (
        <StatePanel
          kind="empty"
          title="Sin recetas"
          message="Agrega la primera receta para este servicio y luego calcula el costo inicial."
        />
      ) : (
        <section className="space-y-3">
          <div>
            <h2 className="text-sm font-semibold text-foreground">Recetas del servicio</h2>
            <p className="mt-1 text-sm text-muted">
              Prioriza qué recetas están agregadas, cuántas porciones usan y cuál es su costo aplicable.
            </p>
          </div>

          <div className="grid gap-3">
            {detail.recipes.map((recipe) => (
              <article key={recipe.planRecipe.id} className="rounded-[var(--radius-base)] border border-border bg-surface p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h3 className="text-base font-semibold text-foreground">{recipe.recipeName}</h3>
                    <p className="mt-1 text-sm text-muted">
                      Versión {recipe.planRecipe.recipe_version_id.slice(0, 8)} · {recipe.plannedServings.toLocaleString("es-MX", { minimumFractionDigits: 0, maximumFractionDigits: 2 })} porciones
                      {recipe.serviceGuestCount != null
                        ? ` · Personas del servicio: ${Number(recipe.serviceGuestCount).toLocaleString("es-MX", { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`
                        : ""}
                    </p>
                    <p className="mt-2 text-sm text-muted">{recipe.stateMessage}</p>
                  </div>
                  {recipe.isServingOverride ? (
                    <EventCateringBadge label="Usa una cantidad distinta al servicio" tone="info" />
                  ) : (
                    <EventCateringBadge label="Usa la misma base del servicio" tone="success" />
                  )}
                </div>

                <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                  <MetricMini
                    label={detail.configurationChanged ? "Último costo guardado" : "Costo inicial"}
                    value={formatMoney(recipe.initialCostTotal)}
                  />
                  <MetricMini
                    label={detail.configurationChanged ? "Configuración anterior" : "Costo actualizado vigente"}
                    value={detail.configurationChanged ? "—" : formatMoney(recipe.updatedCostTotal)}
                  />
                  <MetricMini
                    label={detail.configurationChanged ? "Costo por porción guardado" : "Costo por porción"}
                    value={formatMoney(detail.configurationChanged ? recipe.initialCostPerPortion : recipe.updatedCostPerPortion)}
                  />
                </div>

                {!detail.configurationChanged ? (
                  <div className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-2">
                    <MetricMini label="Variación" value={formatMoney(recipe.priceVariationAmount)} />
                    <MetricMini
                      label="Contribución al servicio"
                      value={
                        recipe.shareOfServiceCost != null
                          ? `${recipe.shareOfServiceCost.toLocaleString("es-MX", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%`
                          : "—"
                      }
                    />
                  </div>
                ) : null}

                {canManage ? (
                  <div className="mt-4 grid gap-3 xl:grid-cols-[320px_auto]">
                    <ActionFeedbackForm action={updatePlanRecipeServingsWithFeedbackAction} className="flex flex-wrap items-end gap-3">
                      <input type="hidden" name="tenantSlug" value={tenantSlug} />
                      <input type="hidden" name="planId" value={planId} />
                      <input type="hidden" name="planRecipeId" value={recipe.planRecipe.id} />
                      <div className="min-w-[220px]">
                        <label htmlFor={`planned-servings-${recipe.planRecipe.id}`} className="text-xs text-muted">
                          Porciones para esta receta
                        </label>
                        <input
                          id={`planned-servings-${recipe.planRecipe.id}`}
                          name="plannedServings"
                          type="number"
                          min="0.0001"
                          step="0.0001"
                          defaultValue={String(recipe.planRecipe.planned_servings)}
                          className="mt-1 h-11 w-full rounded-[var(--radius-base)] border border-border bg-surface-2 px-3 text-sm text-foreground"
                        />
                      </div>
                      <KitchenSubmitButton variant="secondary" pendingLabel="Guardando...">
                        Guardar porciones
                      </KitchenSubmitButton>
                    </ActionFeedbackForm>

                    <div className="flex items-end">
                      <ConfirmDestructiveAction
                        title={`Quitar “${recipe.recipeName}” del servicio`}
                        description={`La receta seguirá disponible en el catálogo. El costo del evento deberá calcularse nuevamente.`}
                        triggerLabel="Quitar del servicio"
                        confirmLabel="Quitar del servicio"
                        pendingLabel="Quitando..."
                        action={removeRecipeFromCateringPlanWithFeedbackAction}
                        hiddenFields={[
                          { name: "tenantSlug", value: tenantSlug },
                          { name: "planId", value: planId },
                          { name: "planRecipeId", value: recipe.planRecipe.id },
                        ]}
                      />
                    </div>
                  </div>
                ) : null}
              </article>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

function MetricMini({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[var(--radius-base)] border border-border bg-surface-2 p-3">
      <p className="text-xs text-muted">{label}</p>
      <p className="mt-1 text-sm font-semibold text-foreground">{value}</p>
    </div>
  );
}
