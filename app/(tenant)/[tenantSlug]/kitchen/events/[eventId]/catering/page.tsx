import Link from "next/link";
import { StatePanel } from "@/components/ui/state-panel";
import {
  getCurrentTenantModulePageAccessMap,
  hasModulePageAccess,
} from "@/lib/auth/module-page-access";
import {
  ChevronLeft,
  ClipboardList,
  MoreHorizontal,
  Users,
} from "lucide-react";
import {
  createCateringPlanWithFeedbackAction,
  createInitialEventCostingSnapshotWithFeedbackAction,
  updateCateringPlanWithFeedbackAction,
} from "@/lib/kitchen/event-catering/actions";
import { getChefEventDetail, type ChefServiceRow } from "@/lib/kitchen/event-catering/chef-costing";
import { ActionFeedbackForm } from "@/app/(tenant)/[tenantSlug]/kitchen/events/_components/action-feedback-form";
import { KitchenPageHeader } from "@/app/(tenant)/[tenantSlug]/kitchen/_components/kitchen-page-header";
import { KitchenSubmitButton } from "@/app/(tenant)/[tenantSlug]/kitchen/_components/kitchen-submit-button";
import { Collapsible } from "@/components/ui/Collapsible";
import { resolveKitchenPage } from "../../../_lib/page-access";
import { EventNextStep } from "./_components/event-next-step";
import { EventProgressStepper } from "./_components/event-progress-stepper";
import { ConfirmDestructiveAction } from "./_components/confirm-destructive-action";
import { EventCostingComparison } from "./_components/event-costing-comparison";
import { ServiceCostingComparison } from "./_components/service-costing-comparison";
import { TopPriceImpactItems } from "./_components/top-price-impact-items";

type KitchenEventCateringPageProps = {
  params: Promise<{ tenantSlug: string; eventId: string }>;
};

function formatEventDate(value: string | null): string {
  if (!value) return "Sin fecha";
  return new Date(value).toLocaleDateString("es-MX", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "America/Mexico_City",
  });
}

function formatMoney(value: number | null): string {
  if (value == null) return "—";
  return `$${value.toLocaleString("es-MX", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function resolveServiceCostBlock(service: ChefServiceRow) {
  if (service.recipesCount === 0) {
    return {
      label: "Costo no disponible",
      value: "Agrega al menos una receta",
      detail: "Este servicio todavía no tiene recetas.",
    };
  }

  if (service.initialCostDisplay.semantic === "historical") {
    return {
      label: "Último costo guardado",
      value:
        service.initialCostDisplay.kind === "money"
          ? formatMoney(service.initialCostDisplay.value)
          : service.initialCostDisplay.label,
      detail: "Configuración anterior",
    };
  }

  if (service.updatedCostDisplay.kind === "money") {
    return {
      label: "Costo actualizado vigente",
      value: formatMoney(service.updatedCostDisplay.value),
      detail: service.updatedCostDisplay.detail,
    };
  }

  return {
    label: "Costo inicial vigente",
    value:
      service.initialCostDisplay.kind === "money"
        ? formatMoney(service.initialCostDisplay.value)
        : service.initialCostDisplay.label,
    detail: service.initialCostDisplay.detail,
  };
}

function resolveServiceStageLabel(service: ChefServiceRow) {
  if (service.recipesCount === 0) return "Sin recetas";
  if (service.initialCostDisplay.semantic === "historical") return "Costo anterior";
  if (service.costingLabel === "Incluido en la vista previa") return "Listo para costear";
  return service.costingLabel;
}

export default async function KitchenEventCateringPage({ params }: KitchenEventCateringPageProps) {
  const { tenantSlug, eventId } = await params;
  const result = await resolveKitchenPage(tenantSlug, "event_catering", "plans");

  if (!result.ok) {
    return (
      <StatePanel
        kind="permission"
        title="Sin permisos"
        message="No tienes acceso a servicios de catering."
      />
    );
  }

  const [detail, accessMap] = await Promise.all([
    getChefEventDetail(result.tenant.tenantSlug, eventId),
    getCurrentTenantModulePageAccessMap(result.tenant.tenantId, "event_catering"),
  ]);
  if (!detail) {
    return (
      <StatePanel
        kind="empty"
        title="Evento no encontrado"
        message="El evento no existe o no pertenece a este tenant."
      />
    );
  }

  const canManage = hasModulePageAccess(accessMap.plans ?? "none", "manage");

  return (
    <div className="space-y-4">
      <KitchenPageHeader
        eyebrow="Evento"
        title={detail.event.name}
        description="Sigue el flujo guiado para configurar servicios, agregar recetas y guardar el costeo del evento."
        metadata={
          <>
            <span>
              Fecha: {detail.dateContext.relativeLabel ? `${detail.dateContext.relativeLabel} · ` : ""}
              {detail.dateContext.weekdayLabel ? `${detail.dateContext.weekdayLabel} · ` : ""}
              {formatEventDate(detail.event.starts_at)}
            </span>
            <span className="mx-2">·</span>
            <span>
              Personas del evento:{" "}
              {detail.event.expected_attendance != null
                ? Number(detail.event.expected_attendance).toLocaleString("es-MX")
                : "Sin definir"}
            </span>
            <span className="mx-2">·</span>
            <span>Servicios: {detail.services.length.toLocaleString("es-MX")}</span>
            <span className="mx-2">·</span>
            <span>Recetas: {detail.totalRecipesCount.toLocaleString("es-MX")}</span>
          </>
        }
        actions={
          <>
            <Link
              href={`/${tenantSlug}/kitchen/events`}
              className="inline-flex rounded-[var(--radius-base)] border border-border bg-surface-2 px-3 py-2 text-sm"
            >
              <ChevronLeft className="mr-2 h-4 w-4" aria-hidden="true" />
              Volver a Eventos y costeo
            </Link>
          </>
        }
      />

      <EventProgressStepper stages={detail.progressStages} />

      {detail.nextStep ? (
        <EventNextStep message={detail.nextStep.message} action={detail.nextStep.action} />
      ) : null}

      {canManage ? (
        <details className="rounded-[var(--radius-base)] border border-border bg-surface p-4">
          <summary className="cursor-pointer list-none text-sm font-semibold text-foreground">
            Agregar servicio
          </summary>
          <p className="mt-3 text-sm text-muted">
            Cada servicio reutiliza `event_catering_plans` y sugiere las personas del evento como punto de partida.
          </p>
          <ActionFeedbackForm
            action={createCateringPlanWithFeedbackAction}
            className="mt-4 grid gap-3 lg:grid-cols-[1.2fr_220px_1fr_auto]"
          >
            <input type="hidden" name="tenantSlug" value={tenantSlug} />
            <input type="hidden" name="eventId" value={eventId} />
            <input
              name="name"
              placeholder="Ej. Comida principal"
              className="h-11 rounded-[var(--radius-base)] border border-border bg-surface-2 px-3 text-sm text-foreground"
            />
            <input
              name="plannedGuestCount"
              type="number"
              min="1"
              step="1"
              defaultValue={
                detail.event.expected_attendance != null
                  ? String(detail.event.expected_attendance)
                  : undefined
              }
              placeholder="Personas del servicio"
              className="h-11 rounded-[var(--radius-base)] border border-border bg-surface-2 px-3 text-sm text-foreground"
            />
            <input
              name="notes"
              placeholder="Notas opcionales"
              className="h-11 rounded-[var(--radius-base)] border border-border bg-surface-2 px-3 text-sm text-foreground"
            />
            <KitchenSubmitButton pendingLabel="Agregando servicio...">Agregar servicio</KitchenSubmitButton>
          </ActionFeedbackForm>
        </details>
      ) : null}

      {detail.services.length === 0 ? (
        <StatePanel
          kind="empty"
          title="Sin servicios"
          message="Agrega el primer servicio para comenzar a capturar recetas y calcular el costo del evento."
        />
      ) : (
        <>
          <section className="space-y-3">
            <div>
              <h2 className="text-sm font-semibold text-foreground">Servicios y recetas</h2>
              <p className="mt-1 text-sm text-muted">
                Cada servicio muestra qué ya está listo, qué falta y cuál es la acción principal.
              </p>
            </div>

            <div className="grid gap-3 lg:grid-cols-2 2xl:grid-cols-3">
              {detail.services.map((service) => (
                <article
                  id={`service-${service.plan.id}`}
                  key={service.plan.id}
                  className="rounded-[var(--radius-base)] border border-border bg-surface p-4"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="inline-flex items-center gap-2">
                        <span className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-border bg-surface-2">
                          <ClipboardList className="h-4 w-4 text-primary" aria-hidden="true" />
                        </span>
                        <h3 className="text-base font-semibold text-foreground">
                          {service.plan.name?.trim() || "Servicio sin nombre"}
                        </h3>
                      </div>
                      <p className="mt-1 text-sm text-muted">
                        <Users className="mr-1 inline h-4 w-4" aria-hidden="true" />
                        Personas del servicio:{" "}
                        {service.plan.planned_guest_count != null
                          ? Number(service.plan.planned_guest_count).toLocaleString("es-MX")
                          : "Sin definir"}{" "}
                        · {service.recipesCount > 0 ? `${service.recipesCount.toLocaleString("es-MX")} recetas` : "Sin recetas"}
                      </p>
                      <div className="mt-3 rounded-[var(--radius-base)] border border-border bg-surface-2 p-3">
                        <p className="text-xs font-medium uppercase tracking-[0.08em] text-muted">
                          Recetas incluidas · {service.recipesCount.toLocaleString("es-MX")}
                        </p>
                        {service.recipes.length > 0 ? (
                          <div className="mt-2 space-y-2">
                            {service.recipes.slice(0, 3).map((recipe) => (
                              <div
                                key={recipe.planRecipe.id}
                                className="flex items-start gap-2 rounded-[var(--radius-base)] bg-surface px-2 py-2"
                              >
                                <ClipboardList className="mt-0.5 h-4 w-4 text-primary" aria-hidden="true" />
                                <div>
                                  <p className="text-sm font-medium text-foreground">{recipe.recipeName}</p>
                                  <p className="text-xs text-muted">
                                    {recipe.plannedServings.toLocaleString("es-MX", {
                                      minimumFractionDigits: 0,
                                      maximumFractionDigits: 2,
                                    })}{" "}
                                    porciones
                                  </p>
                                </div>
                              </div>
                            ))}
                            {service.recipes.length > 3 ? (
                              <Collapsible title={`Ver ${service.recipes.length - 3} recetas más`}>
                                <div className="space-y-2">
                                  {service.recipes.slice(3).map((recipe) => (
                                    <div key={recipe.planRecipe.id} className="flex items-start gap-2 rounded-[var(--radius-base)] bg-surface px-2 py-2">
                                      <ClipboardList className="mt-0.5 h-4 w-4 text-primary" aria-hidden="true" />
                                      <div>
                                        <p className="text-sm font-medium text-foreground">{recipe.recipeName}</p>
                                        <p className="text-xs text-muted">
                                          {recipe.plannedServings.toLocaleString("es-MX", {
                                            minimumFractionDigits: 0,
                                            maximumFractionDigits: 2,
                                          })}{" "}
                                          porciones
                                        </p>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              </Collapsible>
                            ) : null}
                          </div>
                        ) : (
                          <p className="mt-2 text-sm text-muted">Sin recetas</p>
                        )}
                      </div>
                      {service.nextStepMessage ? (
                        <p className="mt-2 text-sm text-foreground">{service.nextStepMessage}</p>
                      ) : service.costingMessage ? (
                        <p className="mt-2 text-sm text-muted">{service.costingMessage}</p>
                      ) : null}
                    </div>

                    <div className="flex items-start gap-2">
                      <Link
                        href={`/${tenantSlug}/kitchen/events/${eventId}/catering/${service.plan.id}`}
                        className="inline-flex rounded-[var(--radius-base)] border border-border bg-surface-2 px-3 py-2 text-sm"
                      >
                        {service.primaryAction.label}
                      </Link>
                      {canManage ? (
                        <details className="relative">
                          <summary className="flex h-10 w-10 cursor-pointer list-none items-center justify-center rounded-[var(--radius-base)] border border-border bg-surface-2 text-foreground">
                            <MoreHorizontal className="h-4 w-4" aria-hidden="true" />
                          </summary>
                          <div className="absolute right-0 z-10 mt-2 w-[320px] rounded-[var(--radius-base)] border border-border bg-surface p-3 shadow-[var(--shadow-soft)]">
                            <p className="text-xs font-medium uppercase tracking-[0.08em] text-muted">Editar servicio</p>
                            <ActionFeedbackForm action={updateCateringPlanWithFeedbackAction} className="mt-3 space-y-3">
                              <input type="hidden" name="tenantSlug" value={tenantSlug} />
                              <input type="hidden" name="planId" value={service.plan.id} />
                              <input
                                name="name"
                                defaultValue={service.plan.name ?? ""}
                                placeholder="Nombre del servicio"
                                className="h-11 w-full rounded-[var(--radius-base)] border border-border bg-surface-2 px-3 text-sm text-foreground"
                              />
                              <input
                                name="plannedGuestCount"
                                type="number"
                                min="1"
                                step="1"
                                defaultValue={
                                  service.plan.planned_guest_count != null
                                    ? String(service.plan.planned_guest_count)
                                    : ""
                                }
                                placeholder="Personas del servicio"
                                className="h-11 w-full rounded-[var(--radius-base)] border border-border bg-surface-2 px-3 text-sm text-foreground"
                              />
                              <KitchenSubmitButton variant="secondary" pendingLabel="Guardando..." className="w-full">
                                Guardar servicio
                              </KitchenSubmitButton>
                            </ActionFeedbackForm>

                            <div className="mt-3 border-t border-border pt-3">
                              <ConfirmDestructiveAction
                                title={`Quitar ${service.plan.name?.trim() || "servicio"}`}
                                description={
                                  service.recipesCount > 0
                                    ? `Este servicio contiene ${service.recipesCount.toLocaleString("es-MX")} recetas. Se quitará de la configuración actual del evento, pero las recetas seguirán disponibles en el catálogo y los costos históricos permanecerán intactos.`
                                    : "Se quitará de la configuración actual del evento. Los costos históricos permanecerán disponibles."
                                }
                                triggerLabel="Quitar servicio del evento"
                                confirmLabel="Quitar del evento"
                                pendingLabel="Quitando..."
                                action={updateCateringPlanWithFeedbackAction}
                                hiddenFields={[
                                  { name: "tenantSlug", value: tenantSlug },
                                  { name: "planId", value: service.plan.id },
                                  { name: "status", value: "canceled" },
                                ]}
                              />
                            </div>
                          </div>
                        </details>
                      ) : null}
                    </div>
                  </div>

                  <div className="mt-4 grid gap-3 md:grid-cols-3">
                    {(() => {
                      const costBlock = resolveServiceCostBlock(service);
                      return (
                        <>
                          <MetricCard label={costBlock.label} value={costBlock.value} detail={costBlock.detail} />
                          <MetricCard label="Estado" value={resolveServiceStageLabel(service)} detail={service.costingMessage} />
                          <MetricCard
                            label="Acción secundaria"
                            value={service.primaryAction.label}
                            detail={
                              service.nextStepMessage ??
                              (service.costingLabel === "Incluido en la vista previa"
                                ? "El servicio ya forma parte de la vista previa actual."
                                : "Revisa recetas, porciones y costo del servicio.")
                            }
                          />
                        </>
                      );
                    })()}
                  </div>
                </article>
              ))}
            </div>
          </section>

          <EventCostingComparison
            tenantSlug={tenantSlug}
            eventId={eventId}
            detail={detail}
            canManage={canManage}
            submitInitialCosting={createInitialEventCostingSnapshotWithFeedbackAction}
          />

          <details className="rounded-[var(--radius-base)] border border-border bg-surface p-4">
            <summary className="cursor-pointer list-none text-sm font-semibold text-foreground">
              Ver desglose del último costeo
            </summary>
            <div className="mt-4 space-y-4">
              <ServiceCostingComparison services={detail.services} />
              <TopPriceImpactItems
                items={detail.topPriceImpactItems}
                allItems={detail.allPriceImpactItems}
              />
            </div>
          </details>
        </>
      )}
    </div>
  );
}

function MetricCard({ label, value, detail }: { label: string; value: string; detail?: string | null }) {
  return (
    <div className="rounded-[var(--radius-base)] border border-border bg-surface-2 p-3">
      <p className="text-xs text-muted">{label}</p>
      <p className="mt-1 text-base font-semibold text-foreground">{value}</p>
      {detail ? <p className="mt-1 text-xs text-muted">{detail}</p> : null}
    </div>
  );
}
