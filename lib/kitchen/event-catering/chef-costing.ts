import { getSupabaseServerClient } from "@/lib/supabase/server";
import { resolveTenantModulePageContext } from "@/lib/auth/module-page-access";
import { getEvents } from "@/lib/events/event.queries";
import {
  listKitchenRecipeReadinessByRecipes,
  type KitchenRecipeReadiness,
} from "@/lib/kitchen/recipes/readiness";
import {
  previewInitialEventCostingSnapshot,
  previewUpdatedEventCostingSnapshot,
  type EventCostingDraft,
  type EventInitialCostingPreview,
} from "./costing";
import {
  compareKitchenBusinessDateKeys,
  formatKitchenBusinessDate,
  getKitchenBusinessDateKey,
  getKitchenBusinessWeekdayLabel,
  resolveKitchenRelativeDateLabel,
} from "./business-date";
import { listReadyRecipesForCatering } from "./queries";
import { getChefCostingStatusPresentation } from "./costing-status";
import {
  eventMatchesOverviewQuery,
  eventMatchesPeriod,
  resolveStructuralChefCostingStatus,
} from "./overview-performance";
import type {
  CateringEventLite,
  EventCateringPlan,
  EventCateringPlanRecipe,
  ReadyRecipeForCatering,
} from "./types";

export type { ChefCostingStatus } from "./costing-status";
import type { ChefCostingStatus } from "./costing-status";

export type ChefOperationalPriority = "action_required" | "attention" | "current";

export type ChefOverviewPeriod = "proximos" | "recientes" | "todos";

export type ChefEventOverviewFilters = {
  q?: string;
  status?: string;
  period?: string;
  today?: Date;
};

export type ChefEventPrimaryAction = {
  label: string;
  href: string;
};

export type ChefDateContext = {
  dateKey: string | null;
  formattedDate: string;
  weekdayLabel: string | null;
  relativeLabel: "Hoy" | "Mañana" | "Ayer" | null;
  isUpcoming: boolean;
};

export type ChefProgressStage = {
  key: "servicios" | "recetas" | "costo_inicial" | "precios_actualizados";
  label: string;
  state: "completed" | "current" | "pending" | "attention";
  summary: string;
};

export type ChefCostDisplay = {
  kind: "money" | "pending" | "unavailable";
  semantic: "current" | "historical" | "pending" | "unavailable";
  value: number | null;
  label: string;
  detail: string | null;
};

export type ChefPriceUpdateStatus =
  | "no_price_changes"
  | "price_changes_available"
  | "updated_cost_current"
  | "price_resolution_warning";

export type ChefSnapshotLite = {
  id: string;
  eventId: string;
  snapshotKind: "initial" | "updated";
  baseSnapshotId: string | null;
  totalCost: number;
  baseTotalCost: number;
  priceVariationAmount: number;
  priceVariationPercent: number | null;
  serviceCount: number;
  recipeCount: number;
  itemLineCount: number;
  pricingModelVersion: string | null;
  createdAt: string;
  configurationPayload: Record<string, unknown>;
  warnings: Array<Record<string, unknown>>;
};

export type ChefTopPriceImpactItem = {
  itemId: string;
  itemName: string;
  supplierName: string | null;
  purchaseUnitCode: string | null;
  initialUnitCost: number;
  updatedUnitCost: number;
  requiredQuantity: number;
  impactAmount: number;
  impactPercent: number | null;
  direction: "incremento" | "reduccion" | "sin_cambio";
  serviceNames: string[];
  recipeNames: string[];
  priceResolutionWarning: string | null;
};

export type ChefRecipeRow = {
  planRecipe: EventCateringPlanRecipe;
  recipeName: string;
  plannedServings: number;
  serviceGuestCount: number | null;
  initialCostTotal: number | null;
  updatedCostTotal: number | null;
  initialCostPerPortion: number | null;
  updatedCostPerPortion: number | null;
  priceVariationAmount: number | null;
  priceVariationPercent: number | null;
  shareOfServiceCost: number | null;
  readiness: KitchenRecipeReadiness | null;
  stateMessage: string;
  isServingOverride: boolean;
};

export type ChefServiceRow = {
  plan: EventCateringPlan;
  recipesCount: number;
  initialCostTotal: number | null;
  updatedCostTotal: number | null;
  initialCostPerPerson: number | null;
  updatedCostPerPerson: number | null;
  shareOfEventCost: number | null;
  contributionToEventVariation: number | null;
  priceVariationAmount: number | null;
  priceVariationPercent: number | null;
  costingStatus: ChefCostingStatus;
  costingLabel: string;
  costingMessage: string | null;
  configurationChanged: boolean;
  primaryAction: ChefEventPrimaryAction;
  nextStepMessage: string | null;
  initialCostDisplay: ChefCostDisplay;
  updatedCostDisplay: ChefCostDisplay;
  recipes: ChefRecipeRow[];
};

export type ChefEventOverviewRow = {
  event: CateringEventLite;
  dateContext: ChefDateContext;
  servicesCount: number;
  recipesCount: number;
  costingStatus: ChefCostingStatus;
  costingLabel: string;
  costingMessage: string | null;
  priority: ChefOperationalPriority;
  primaryAction: ChefEventPrimaryAction;
  secondaryAction: ChefEventPrimaryAction | null;
  latestInitialSnapshot: ChefSnapshotLite | null;
  latestUpdatedSnapshot: ChefSnapshotLite | null;
  initialCostTotal: number | null;
  updatedCostTotal: number | null;
  currentCostTotal: number | null;
  initialCostPerPerson: number | null;
  currentCostPerPerson: number | null;
  priceVariationAmount: number | null;
  priceVariationPercent: number | null;
  lastCostedAt: string | null;
  configurationChanged: boolean;
  hasAnyRecipes: boolean;
  hasInitialPreview: boolean;
  previewCostTotal: number | null;
  nextStepMessage: string | null;
  initialCostDisplay: ChefCostDisplay;
  currentCostDisplay: ChefCostDisplay;
};

export type ChefEventsOverviewResult = {
  totalEvents: number;
  filters: {
    q: string;
    status: string;
    period: ChefOverviewPeriod;
  };
  metrics: {
    upcomingEvents: number;
    requiresAttention: number;
    withNewPrices: number;
    costed: number;
  };
  rows: ChefEventOverviewRow[];
  groupedRows: {
    futureActionRequired: ChefEventOverviewRow[];
    futureAttention: ChefEventOverviewRow[];
    futureCurrent: ChefEventOverviewRow[];
    recent: ChefEventOverviewRow[];
  };
};

export type ChefEventDetail = {
  event: CateringEventLite;
  dateContext: ChefDateContext;
  services: ChefServiceRow[];
  latestInitialSnapshot: ChefSnapshotLite | null;
  latestHistoricalInitialSnapshot: ChefSnapshotLite | null;
  latestUpdatedSnapshot: ChefSnapshotLite | null;
  initialCostTotal: number | null;
  updatedCostTotal: number | null;
  priceVariationAmount: number | null;
  priceVariationPercent: number | null;
  initialCostPerPerson: number | null;
  updatedCostPerPerson: number | null;
  costingStatus: ChefCostingStatus;
  costingLabel: string;
  costingMessage: string | null;
  priceUpdateStatus: ChefPriceUpdateStatus | null;
  priceUpdateLabel: string | null;
  priceUpdateMessage: string | null;
  configurationChanged: boolean;
  totalRecipesCount: number;
  canCalculateInitialCost: boolean;
  canUpdateCost: boolean;
  nextStep: { message: string; action: ChefEventPrimaryAction } | null;
  progressStages: ChefProgressStage[];
  initialPreview: EventInitialCostingPreview | null;
  missingRecipesByService: Array<{ planId: string; serviceName: string }>;
  recipesNeedingAttention: Array<{ recipeId: string; recipeName: string; issue: string }>;
  initialCostDisplay: ChefCostDisplay;
  updatedCostDisplay: ChefCostDisplay;
  topPriceImpactItems: ChefTopPriceImpactItem[];
  allPriceImpactItems: ChefTopPriceImpactItem[];
};

export type ChefServiceDetail = {
  event: CateringEventLite;
  dateContext: ChefDateContext;
  plan: EventCateringPlan;
  latestInitialSnapshot: ChefSnapshotLite | null;
  latestUpdatedSnapshot: ChefSnapshotLite | null;
  serviceCostTotal: number | null;
  serviceUpdatedCostTotal: number | null;
  serviceCostPerPerson: number | null;
  serviceUpdatedCostPerPerson: number | null;
  priceVariationAmount: number | null;
  priceVariationPercent: number | null;
  costingStatus: ChefCostingStatus;
  costingLabel: string;
  costingMessage: string | null;
  configurationChanged: boolean;
  nextStep: { message: string; action: ChefEventPrimaryAction } | null;
  initialPreview: EventInitialCostingPreview | null;
  initialCostDisplay: ChefCostDisplay;
  updatedCostDisplay: ChefCostDisplay;
  recipes: ChefRecipeRow[];
  readyRecipes: ReadyRecipeForCatering[];
};

type SnapshotServiceSummary = {
  planId: string;
  serviceName: string | null;
  plannedGuestCount: number | null;
  sortOrder: number;
  recipeCount: number;
  totalCost: number;
  baseTotalCost: number;
  priceVariationAmount: number;
  priceVariationPercent: number | null;
};

type SnapshotRecipeSummary = {
  planRecipeId: string;
  planId: string;
  recipeName: string;
  plannedServings: number;
  totalCost: number;
  baseTotalCost: number;
  priceVariationAmount: number;
  priceVariationPercent: number | null;
};

type SnapshotItemLine = {
  id: string;
  comparisonKey: string;
  planId: string;
  planRecipeId: string;
  itemId: string;
  itemName: string;
  supplierName: string | null;
  purchaseUnitCode: string | null;
  requiredQuantity: number;
  operationalUnitCost: number;
  lineTotalCost: number;
  priceVariationAmount: number;
  priceVariationPercent: number | null;
  priceResolutionWarning: string | null;
};

function round4(value: number): number {
  return Number(value.toFixed(4));
}

function stableStringify(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map((entry) => stableStringify(entry)).join(",")}]`;
  }
  if (value && typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>).sort(([left], [right]) =>
      left.localeCompare(right),
    );
    return `{${entries.map(([key, entry]) => `${JSON.stringify(key)}:${stableStringify(entry)}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

function hasSameConfiguration(
  currentPayload: Record<string, unknown>,
  snapshotPayload: Record<string, unknown> | null,
): boolean {
  if (!snapshotPayload) return false;
  return stableStringify(currentPayload) === stableStringify(snapshotPayload);
}

function costPerPerson(totalCost: number | null, people: number | null | undefined): number | null {
  if (totalCost == null) return null;
  const denominator = Number(people ?? 0);
  if (!(denominator > 0)) return null;
  return round4(totalCost / denominator);
}

function toPercentDelta(current: number | null, base: number | null): number | null {
  if (current == null || base == null || !(base > 0)) return null;
  return round4(((current - base) / base) * 100);
}

function buildCurrentEventConfigurationPayload(
  event: CateringEventLite,
  plans: EventCateringPlan[],
  planRecipes: EventCateringPlanRecipe[],
): Record<string, unknown> {
  return {
    event_id: event.id,
    event_name: event.name ?? null,
    services: plans
      .map((plan) => ({
        plan_id: plan.id,
        service_name: plan.name ?? null,
        planned_guest_count: plan.planned_guest_count ?? null,
        status: plan.status,
        recipes: planRecipes
          .filter((planRecipe) => planRecipe.plan_id === plan.id)
          .map((planRecipe) => ({
            plan_recipe_id: planRecipe.id,
            recipe_id: planRecipe.recipe_id,
            recipe_version_id: planRecipe.recipe_version_id,
            recipe_name: planRecipe.kitchen_recipe_recipes?.name ?? null,
            planned_servings: Number(planRecipe.planned_servings ?? 0),
            multiplier: Number(planRecipe.multiplier ?? 0),
          }))
          .sort((left, right) => left.plan_recipe_id.localeCompare(right.plan_recipe_id)),
      }))
      .sort((left, right) => left.plan_id.localeCompare(right.plan_id)),
  };
}

function isActiveCateringPlan(plan: EventCateringPlan): boolean {
  return plan.status !== "canceled";
}

function resolveChefRecipeStateMessage(readiness: KitchenRecipeReadiness | null): string {
  if (!readiness) return "La receta necesita completar su configuración antes de poder costearse.";
  if (readiness.readiness_status === "ready") return "Lista para costear.";
  if (readiness.readiness_status === "missing_cost") return "La receta no tiene un costo vigente.";
  if (readiness.readiness_status === "costing_warnings") {
    return "Uno de los ingredientes necesita una revisión de precio o conversión.";
  }
  if (readiness.readiness_status === "pending_ingredients") {
    return "La receta necesita completar su configuración antes de poder costearse.";
  }
  if (readiness.readiness_status === "draft_only") {
    return "La receta necesita una versión activa antes de poder usarse.";
  }
  return "La receta necesita completar su configuración antes de poder costearse.";
}

function resolvePriceUpdatePresentation(
  status: ChefPriceUpdateStatus | null,
): { label: string | null; message: string | null } {
  if (status === "price_changes_available") {
    return {
      label: "Hay precios nuevos",
      message: "Se detectaron precios vigentes distintos para esta configuración.",
    };
  }
  if (status === "updated_cost_current") {
    return {
      label: "Costo actualizado",
      message: "El costo actualizado ya usa los precios vigentes.",
    };
  }
  if (status === "price_resolution_warning") {
    return {
      label: "Precios por revisar",
      message: "Hay líneas que requirieron fallback o revisión antes de actualizar el costo.",
    };
  }
  if (status === "no_price_changes") {
    return {
      label: "Costo inicial vigente",
      message: "El costo actual coincide con los precios vigentes.",
    };
  }
  return { label: null, message: null };
}

function resolveEventDateContext(
  startsAt: string | null,
  todayKey: string,
): ChefDateContext {
  const dateKey = startsAt ? getKitchenBusinessDateKey(startsAt) : null;

  return {
    dateKey,
    formattedDate: formatKitchenBusinessDate(startsAt),
    weekdayLabel: getKitchenBusinessWeekdayLabel(startsAt),
    relativeLabel: resolveKitchenRelativeDateLabel(dateKey, todayKey),
    isUpcoming: dateKey == null || compareKitchenBusinessDateKeys(dateKey, todayKey) >= 0,
  };
}

function buildCostDisplay(input: {
  value: number | null;
  status: ChefCostingStatus;
  snapshotExists: boolean;
  detail: string | null;
  unavailableDetail?: string | null;
  semantic?: "current" | "historical";
}): ChefCostDisplay {
  if (input.value != null) {
    return {
      kind: "money",
      semantic: input.semantic ?? "current",
      value: input.value,
      label: "Costo disponible",
      detail: input.detail,
    };
  }

  if (!input.snapshotExists && input.status === "pendiente_costeo") {
    return {
      kind: "pending",
      semantic: "pending",
      value: null,
      label: "Pendiente de calcular",
      detail: input.detail,
    };
  }

  return {
    kind: "unavailable",
    semantic: "unavailable",
    value: null,
    label: "No disponible",
    detail: input.unavailableDetail ?? input.detail,
  };
}

function resolveChefCostingStatus(input: {
  servicesCount: number;
  recipesCount: number;
  hasAnyRecipes: boolean;
  currentInitialSnapshot: ChefSnapshotLite | null;
  latestUpdatedSnapshot: ChefSnapshotLite | null;
  configurationChanged: boolean;
  priceUpdateStatus: ChefPriceUpdateStatus | null;
}): { status: ChefCostingStatus; label: string; message: string | null } {
  if (input.servicesCount <= 0) {
    return { status: "sin_servicios", label: getChefCostingStatusPresentation("sin_servicios").label, message: null };
  }
  if (!input.hasAnyRecipes) {
    return { status: "sin_recetas", label: getChefCostingStatusPresentation("sin_recetas").label, message: null };
  }
  if (input.recipesCount < input.servicesCount) {
    return {
      status: "configuracion_incompleta",
      label: getChefCostingStatusPresentation("configuracion_incompleta").label,
      message: "Faltan recetas o configuración suficiente en uno o más servicios.",
    };
  }
  if (!input.currentInitialSnapshot) {
    return { status: "pendiente_costeo", label: getChefCostingStatusPresentation("pendiente_costeo").label, message: null };
  }
  if (input.configurationChanged) {
    return {
      status: "configuracion_modificada",
      label: getChefCostingStatusPresentation("configuracion_modificada").label,
      message:
        "Cambiaste servicios, recetas o cantidades después del último costeo. Genera un nuevo costo inicial para continuar.",
    };
  }
  if (input.priceUpdateStatus === "price_resolution_warning") {
    return {
      status: "precios_necesitan_revision",
      label: getChefCostingStatusPresentation("precios_necesitan_revision").label,
      message: "Revisa los precios vigentes antes de actualizar el costo.",
    };
  }
  if (input.priceUpdateStatus === "price_changes_available") {
    return {
      status: "hay_precios_nuevos",
      label: getChefCostingStatusPresentation("hay_precios_nuevos").label,
      message: "Puedes actualizar el costo con los precios vigentes.",
    };
  }
  if (input.latestUpdatedSnapshot && input.priceUpdateStatus === "updated_cost_current") {
    return {
      status: "costo_actualizado",
      label: getChefCostingStatusPresentation("costo_actualizado").label,
      message: "El costo actualizado ya está al día con los precios vigentes.",
    };
  }
  return {
    status: "costo_inicial_vigente",
    label: getChefCostingStatusPresentation("costo_inicial_vigente").label,
    message: "El costo inicial sigue alineado con los precios vigentes.",
  };
}

async function listPlansAndRecipes(
  tenantId: string,
  eventIds?: string[],
  options: { includePresentationDetails?: boolean } = {},
): Promise<{ plans: EventCateringPlan[]; planRecipes: EventCateringPlanRecipe[] }> {
  const supabase = await getSupabaseServerClient();
  const includePresentationDetails = options.includePresentationDetails ?? true;
  const planSelect: string = includePresentationDetails
    ? "id, tenant_id, event_id, name, status, planned_guest_count, estimated_total_cost, notes, created_at, updated_at"
    : "id, tenant_id, event_id, name, status, planned_guest_count, estimated_total_cost";
  const recipeSelect: string = includePresentationDetails
    ? "id, tenant_id, plan_id, recipe_id, recipe_version_id, snapshot_id, planned_servings, multiplier, estimated_cost, notes, sort_order, created_at, updated_at, kitchen_recipe_recipes:kitchen_recipe_recipes!event_catering_plan_recipes_tenant_recipe_fkey(id,name,category,status)"
    : "id, tenant_id, plan_id, recipe_id, recipe_version_id, snapshot_id, planned_servings, multiplier, estimated_cost, sort_order, kitchen_recipe_recipes:kitchen_recipe_recipes!event_catering_plan_recipes_tenant_recipe_fkey(id,name)";
  let plansQuery = supabase
    .from("event_catering_plans")
    .select(planSelect)
    .eq("tenant_id", tenantId)
    .order("created_at", { ascending: true });
  if (eventIds && eventIds.length > 0) {
    plansQuery = plansQuery.in("event_id", eventIds);
  }

  const { data: planRows, error: planError } = await plansQuery;
  if (planError) throw new Error(`No fue posible cargar servicios de catering: ${planError.message}`);
  const plans = (planRows ?? []) as unknown as EventCateringPlan[];

  const planIds = plans.map((plan) => plan.id);
  if (planIds.length === 0) return { plans, planRecipes: [] };

  const { data: recipeRows, error: recipeError } = await supabase
    .from("event_catering_plan_recipes")
    .select(recipeSelect)
    .eq("tenant_id", tenantId)
    .in("plan_id", planIds)
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true });
  if (recipeError) throw new Error(`No fue posible cargar recetas de servicios: ${recipeError.message}`);

  const planRecipes = ((recipeRows ?? []) as unknown as Array<Record<string, unknown>>).map((row) => ({
    ...(row as unknown as EventCateringPlanRecipe),
    kitchen_recipe_recipes: Array.isArray(row.kitchen_recipe_recipes)
      ? ((row.kitchen_recipe_recipes[0] ?? null) as EventCateringPlanRecipe["kitchen_recipe_recipes"])
      : ((row.kitchen_recipe_recipes ?? null) as EventCateringPlanRecipe["kitchen_recipe_recipes"]),
  }));

  return { plans, planRecipes };
}

async function listCompletedSnapshots(
  tenantId: string,
  eventIds: string[],
  options: { includeWarnings?: boolean } = {},
): Promise<Map<string, ChefSnapshotLite[]>> {
  if (eventIds.length === 0) return new Map();
  const supabase = await getSupabaseServerClient();
  const snapshotSelect: string = options.includeWarnings
    ? "id,event_id,base_snapshot_id,snapshot_kind,total_cost,base_total_cost,price_variation_amount,price_variation_percent,service_count,recipe_count,item_line_count,pricing_model_version,created_at,configuration_payload,warnings"
    : "id,event_id,base_snapshot_id,snapshot_kind,total_cost,base_total_cost,price_variation_amount,price_variation_percent,service_count,recipe_count,item_line_count,pricing_model_version,created_at,configuration_payload";
  const { data, error } = await supabase
    .from("event_catering_costing_snapshots")
    .select(snapshotSelect)
    .eq("tenant_id", tenantId)
    .eq("snapshot_status", "completed")
    .in("event_id", eventIds)
    .order("created_at", { ascending: false });
  if (error) throw new Error(`No fue posible cargar snapshots de costeo: ${error.message}`);

  const byEventId = new Map<string, ChefSnapshotLite[]>();
  for (const row of (data ?? []) as unknown as Array<Record<string, unknown>>) {
    const snapshot: ChefSnapshotLite = {
      id: String(row.id),
      eventId: String(row.event_id),
      snapshotKind: row.snapshot_kind as "initial" | "updated",
      baseSnapshotId: row.base_snapshot_id ? String(row.base_snapshot_id) : null,
      totalCost: Number(row.total_cost ?? 0),
      baseTotalCost: Number(row.base_total_cost ?? 0),
      priceVariationAmount: Number(row.price_variation_amount ?? 0),
      priceVariationPercent:
        row.price_variation_percent == null ? null : Number(row.price_variation_percent),
      serviceCount: Number(row.service_count ?? 0),
      recipeCount: Number(row.recipe_count ?? 0),
      itemLineCount: Number(row.item_line_count ?? 0),
      pricingModelVersion: row.pricing_model_version ? String(row.pricing_model_version) : null,
      createdAt: String(row.created_at),
      configurationPayload:
        ((row.configuration_payload as Record<string, unknown> | null) ?? {}) as Record<string, unknown>,
      warnings: Array.isArray(row.warnings)
        ? (row.warnings as Array<Record<string, unknown>>)
        : [],
    };
    const bucket = byEventId.get(snapshot.eventId) ?? [];
    bucket.push(snapshot);
    byEventId.set(snapshot.eventId, bucket);
  }
  return byEventId;
}

async function listSnapshotServiceSummaries(
  tenantId: string,
  snapshotId: string | null,
): Promise<Map<string, SnapshotServiceSummary>> {
  if (!snapshotId) return new Map();
  const supabase = await getSupabaseServerClient();
  const { data, error } = await supabase
    .from("event_catering_costing_service_summaries")
    .select(
      "plan_id,service_name_snapshot,planned_guest_count_snapshot,sort_order,recipe_count,total_cost,base_total_cost,price_variation_amount,price_variation_percent",
    )
    .eq("tenant_id", tenantId)
    .eq("snapshot_id", snapshotId)
    .order("sort_order", { ascending: true });
  if (error) throw new Error(`No fue posible cargar resúmenes de servicio del snapshot: ${error.message}`);

  return new Map(
    (data ?? []).map((row) => [
      String(row.plan_id),
      {
        planId: String(row.plan_id),
        serviceName: (row.service_name_snapshot as string | null) ?? null,
        plannedGuestCount:
          row.planned_guest_count_snapshot == null ? null : Number(row.planned_guest_count_snapshot),
        sortOrder: Number(row.sort_order ?? 0),
        recipeCount: Number(row.recipe_count ?? 0),
        totalCost: Number(row.total_cost ?? 0),
        baseTotalCost: Number(row.base_total_cost ?? 0),
        priceVariationAmount: Number(row.price_variation_amount ?? 0),
        priceVariationPercent:
          row.price_variation_percent == null ? null : Number(row.price_variation_percent),
      },
    ]),
  );
}

async function listSnapshotRecipeSummaries(
  tenantId: string,
  snapshotId: string | null,
): Promise<Map<string, SnapshotRecipeSummary>> {
  if (!snapshotId) return new Map();
  const supabase = await getSupabaseServerClient();
  const { data, error } = await supabase
    .from("event_catering_costing_recipe_summaries")
    .select(
      "plan_recipe_id,plan_id,recipe_name_snapshot,planned_servings_snapshot,total_cost,base_total_cost,price_variation_amount,price_variation_percent",
    )
    .eq("tenant_id", tenantId)
    .eq("snapshot_id", snapshotId);
  if (error) throw new Error(`No fue posible cargar resúmenes de receta del snapshot: ${error.message}`);

  return new Map(
    (data ?? []).map((row) => [
      String(row.plan_recipe_id),
      {
        planRecipeId: String(row.plan_recipe_id),
        planId: String(row.plan_id),
        recipeName: String(row.recipe_name_snapshot),
        plannedServings: Number(row.planned_servings_snapshot ?? 0),
        totalCost: Number(row.total_cost ?? 0),
        baseTotalCost: Number(row.base_total_cost ?? 0),
        priceVariationAmount: Number(row.price_variation_amount ?? 0),
        priceVariationPercent:
          row.price_variation_percent == null ? null : Number(row.price_variation_percent),
      },
    ]),
  );
}

async function listSnapshotItemLines(
  tenantId: string,
  snapshotId: string | null,
): Promise<SnapshotItemLine[]> {
  if (!snapshotId) return [];
  const supabase = await getSupabaseServerClient();
  const { data, error } = await supabase
    .from("event_catering_costing_item_lines")
    .select(
      "id,plan_id,plan_recipe_id,item_id,item_name_snapshot,purchase_unit_code_snapshot,required_quantity,operational_unit_cost,line_total_cost,price_variation_amount,price_variation_percent,price_resolution_warning,source_payload,kitchen_inventory_suppliers:kitchen_inventory_suppliers!event_catering_costing_item_lines_tenant_supplier_fkey(name)",
    )
    .eq("tenant_id", tenantId)
    .eq("snapshot_id", snapshotId);
  if (error) throw new Error(`No fue posible cargar líneas de snapshot: ${error.message}`);

  return ((data ?? []) as Array<Record<string, unknown>>).map((row) => {
    const supplier = Array.isArray(row.kitchen_inventory_suppliers)
      ? row.kitchen_inventory_suppliers[0]
      : row.kitchen_inventory_suppliers;
    const sourcePayload = ((row.source_payload as Record<string, unknown> | null) ?? {}) as Record<
      string,
      unknown
    >;
    const initialLineId =
      sourcePayload.initial_line_id != null ? String(sourcePayload.initial_line_id) : null;
    return {
      id: String(row.id),
      comparisonKey: initialLineId ?? `${String(row.plan_recipe_id)}:${String(row.item_id)}`,
      planId: String(row.plan_id),
      planRecipeId: String(row.plan_recipe_id),
      itemId: String(row.item_id),
      itemName: String(row.item_name_snapshot),
      supplierName:
        supplier && typeof supplier === "object" && "name" in supplier
          ? (supplier.name as string | null)
          : null,
      purchaseUnitCode: (row.purchase_unit_code_snapshot as string | null) ?? null,
      requiredQuantity: Number(row.required_quantity ?? 0),
      operationalUnitCost: Number(row.operational_unit_cost ?? 0),
      lineTotalCost: Number(row.line_total_cost ?? 0),
      priceVariationAmount: Number(row.price_variation_amount ?? 0),
      priceVariationPercent:
        row.price_variation_percent == null ? null : Number(row.price_variation_percent),
      priceResolutionWarning: (row.price_resolution_warning as string | null) ?? null,
    };
  });
}

function buildDraftServiceSummaryMap(draft: EventCostingDraft): Map<string, SnapshotServiceSummary> {
  return new Map(
    draft.serviceRows.map((row) => [
      row.planId,
      {
        planId: row.planId,
        serviceName: row.serviceName,
        plannedGuestCount: row.plannedGuestCount,
        sortOrder: row.sortOrder,
        recipeCount: row.recipeCount,
        totalCost: row.totalCost,
        baseTotalCost: row.baseTotalCost,
        priceVariationAmount: row.priceVariationAmount,
        priceVariationPercent: row.priceVariationPercent,
      },
    ]),
  );
}

function buildDraftRecipeSummaryMap(draft: EventCostingDraft): Map<string, SnapshotRecipeSummary> {
  return new Map(
    draft.recipeRows.map((row) => [
      row.planRecipeId,
      {
        planRecipeId: row.planRecipeId,
        planId: row.planId,
        recipeName: row.recipeName,
        plannedServings: row.plannedServings,
        totalCost: row.totalCost,
        baseTotalCost: row.baseTotalCost,
        priceVariationAmount: row.priceVariationAmount,
        priceVariationPercent: row.priceVariationPercent,
      },
    ]),
  );
}

function buildDraftItemLines(draft: EventCostingDraft): SnapshotItemLine[] {
  return draft.itemRows.map((row) => {
    const sourcePayload = row.sourcePayload as Record<string, unknown>;
    return {
      id: String(sourcePayload.initial_line_id ?? `${row.planRecipeId}:${row.itemId}`),
      comparisonKey: String(sourcePayload.initial_line_id ?? `${row.planRecipeId}:${row.itemId}`),
      planId: row.planId,
      planRecipeId: row.planRecipeId,
      itemId: row.itemId,
      itemName: row.itemName,
      supplierName: null,
      purchaseUnitCode: row.purchaseUnitCode,
      requiredQuantity: row.requiredQuantity,
      operationalUnitCost: row.operationalUnitCost,
      lineTotalCost: row.lineTotalCost,
      priceVariationAmount: row.priceVariationAmount,
      priceVariationPercent: row.priceVariationPercent,
      priceResolutionWarning: row.priceResolutionWarning,
    };
  });
}

function resolvePriceUpdateStatus(input: {
  draft: EventCostingDraft | null;
  latestUpdatedSnapshot: ChefSnapshotLite | null;
  comparisonLines: SnapshotItemLine[];
}): ChefPriceUpdateStatus | null {
  if (!input.draft) return null;
  if (input.draft.itemRows.some((row) => row.priceResolutionWarning)) {
    return "price_resolution_warning";
  }

  const comparisonByKey = new Map(input.comparisonLines.map((row) => [row.comparisonKey, row]));
  const changed = input.draft.itemRows.some((row) => {
    const sourcePayload = row.sourcePayload as Record<string, unknown>;
    const comparisonKey = String(sourcePayload.initial_line_id ?? `${row.planRecipeId}:${row.itemId}`);
    const previous = comparisonByKey.get(comparisonKey);
    if (!previous) return true;
    return (
      round4(previous.operationalUnitCost) !== round4(row.operationalUnitCost) ||
      round4(previous.lineTotalCost) !== round4(row.lineTotalCost)
    );
  });

  if (changed) return "price_changes_available";
  return input.latestUpdatedSnapshot ? "updated_cost_current" : "no_price_changes";
}

function resolveDirection(amount: number): "incremento" | "reduccion" | "sin_cambio" {
  if (amount > 0) return "incremento";
  if (amount < 0) return "reduccion";
  return "sin_cambio";
}

function normalizeOverviewFilters(input?: ChefEventOverviewFilters): {
  q: string;
  status: string;
  period: ChefOverviewPeriod;
  todayKey: string;
} {
  const normalizedPeriod =
    input?.period === "recientes" || input?.period === "todos" ? input.period : "proximos";
  return {
    q: input?.q?.trim().toLowerCase() ?? "",
    status: input?.status?.trim() ?? "",
    period: normalizedPeriod,
    todayKey: getKitchenBusinessDateKey(input?.today ?? new Date()),
  };
}

function resolveOverviewPriority(status: ChefCostingStatus): ChefOperationalPriority {
  if (
    status === "sin_servicios" ||
    status === "sin_recetas" ||
    status === "configuracion_incompleta" ||
    status === "pendiente_costeo" ||
    status === "configuracion_modificada" ||
    status === "precios_necesitan_revision"
  ) {
    return "action_required";
  }
  if (status === "hay_precios_nuevos") return "attention";
  return "current";
}

function resolveOverviewPrimaryAction(
  tenantSlug: string,
  eventId: string,
  status: ChefCostingStatus,
  hasInitialPreview = false,
  missingRecipesByService?: Array<{ planId: string; serviceName: string }>,
): ChefEventPrimaryAction {
  const firstIncompleteServiceId = missingRecipesByService?.[0]?.planId ?? null;
  if (status === "precios_necesitan_revision") {
    return {
      label: "Revisar precios",
      href: `/${tenantSlug}/kitchen/inventory/price-updates`,
    };
  }
  if (status === "hay_precios_nuevos") {
    return {
      label: "Actualizar costo",
      href: `/${tenantSlug}/kitchen/events/${eventId}/catering`,
    };
  }
  if (status === "costo_actualizado") {
    return {
      label: "Ver comparativo",
      href: `/${tenantSlug}/kitchen/events/${eventId}/catering`,
    };
  }
  if (status === "costo_inicial_vigente") {
    return {
      label: "Ver costeo",
      href: `/${tenantSlug}/kitchen/events/${eventId}/catering`,
    };
  }
  if (status === "sin_servicios") {
    return {
      label: "Agregar servicio",
      href: `/${tenantSlug}/kitchen/events/${eventId}/catering`,
    };
  }
  if (status === "sin_recetas" || status === "configuracion_incompleta") {
    return {
      label: "Agregar recetas",
      href: firstIncompleteServiceId
        ? `/${tenantSlug}/kitchen/events/${eventId}/catering#service-${firstIncompleteServiceId}`
        : `/${tenantSlug}/kitchen/events/${eventId}/catering`,
    };
  }
  if (status === "pendiente_costeo") {
    return {
      label: hasInitialPreview ? "Guardar costo inicial" : "Calcular costo inicial",
      href: hasInitialPreview
        ? `/${tenantSlug}/kitchen/events/${eventId}/catering#vista-previa-costo`
        : `/${tenantSlug}/kitchen/events/${eventId}/catering`,
    };
  }
  return {
    label: "Generar nuevo costo inicial",
    href: `/${tenantSlug}/kitchen/events/${eventId}/catering`,
  };
}

function resolveOverviewSecondaryAction(
  tenantSlug: string,
  eventId: string,
  status: ChefCostingStatus,
): ChefEventPrimaryAction | null {
  if (status === "costo_actualizado") {
    return {
      label: "Editar evento",
      href: `/${tenantSlug}/events/${eventId}`,
    };
  }
  if (status === "costo_inicial_vigente") {
    return {
      label: "Editar evento",
      href: `/${tenantSlug}/events/${eventId}`,
    };
  }
  return null;
}

function listMissingRecipesByService(
  plans: EventCateringPlan[],
  planRecipes: EventCateringPlanRecipe[],
): Array<{ planId: string; serviceName: string }> {
  return plans
    .filter((plan) => !planRecipes.some((recipe) => recipe.plan_id === plan.id))
    .map((plan) => ({
      planId: plan.id,
      serviceName: plan.name?.trim() || "Servicio sin nombre",
    }));
}

function buildMissingRecipesMessage(missingRecipesByService: Array<{ serviceName: string }>): string | null {
  if (missingRecipesByService.length === 0) return null;
  if (missingRecipesByService.length === 1) {
    return `Falta agregar recetas al servicio ${missingRecipesByService[0].serviceName}.`;
  }
  return `Falta agregar recetas a ${missingRecipesByService.length.toLocaleString("es-MX")} servicios: ${missingRecipesByService.map((service) => service.serviceName).join(", ")}.`;
}

function resolveOverviewMessage(input: {
  status: ChefCostingStatus;
  missingRecipesByService: Array<{ serviceName: string }>;
  recipeIssueCount: number;
  recipeIssueSummary: string | null;
  configurationChanged: boolean;
  hasInitialPreview: boolean;
  priceUpdateMessage: string | null;
}): string | null {
  if (input.status === "sin_servicios") {
    return "Este evento todavía no tiene servicios.";
  }
  if (input.status === "sin_recetas" || input.status === "configuracion_incompleta") {
    return buildMissingRecipesMessage(input.missingRecipesByService);
  }
  if (input.status === "precios_necesitan_revision") {
    return input.recipeIssueSummary ?? "Hay recetas o insumos que necesitan revisión de costo.";
  }
  if (input.status === "pendiente_costeo" && input.hasInitialPreview) {
    return "La configuración ya tiene una vista previa lista. Guarda el costo inicial para congelar el resultado.";
  }
  if (input.status === "configuracion_modificada" && input.configurationChanged) {
    return "Cambiaste servicios, recetas o cantidades después del último costeo. Genera un nuevo costo inicial para actualizar los resultados.";
  }
  if (input.status === "hay_precios_nuevos") {
    return input.priceUpdateMessage ?? "Puedes actualizar el costo con los precios vigentes.";
  }
  if (input.recipeIssueCount > 0) {
    return input.recipeIssueSummary;
  }
  return null;
}

function resolveCostDisplayDetail(status: ChefCostingStatus, fallback: string | null): string | null {
  if (status === "pendiente_costeo") {
    return "La configuración es válida, pero todavía no has guardado el costo inicial.";
  }
  if (status === "sin_servicios") {
    return "Primero agrega el primer servicio del evento.";
  }
  if (status === "sin_recetas" || status === "configuracion_incompleta") {
    return fallback ?? "Falta completar servicios y recetas antes de calcular el costo.";
  }
  if (status === "precios_necesitan_revision") {
    return fallback ?? "Hay recetas con insumos sin precio vigente o con warnings de costeo.";
  }
  if (status === "configuracion_modificada") {
    return "La configuración cambió después del último costeo; genera un nuevo costo inicial.";
  }
  return fallback;
}

function buildProgressStages(input: {
  servicesCount: number;
  missingRecipesByService: Array<{ serviceName: string }>;
  hasInitialSnapshot: boolean;
  configurationChanged: boolean;
  canPreviewInitial: boolean;
  canUpdateCost: boolean;
  priceUpdateStatus: ChefPriceUpdateStatus | null;
}): ChefProgressStage[] {
  return [
    {
      key: "servicios",
      label: "Servicios",
      state: input.servicesCount > 0 ? "completed" : "current",
      summary:
        input.servicesCount > 0
          ? `✓ ${input.servicesCount.toLocaleString("es-MX")} servicios creados`
          : "○ Este evento todavía no tiene servicios",
    },
    {
      key: "recetas",
      label: "Recetas",
      state:
        input.servicesCount === 0
          ? "pending"
          : input.missingRecipesByService.length > 0
            ? "attention"
            : "completed",
      summary:
        input.servicesCount === 0
          ? "○ Agrega un servicio para empezar a capturar recetas"
          : input.missingRecipesByService.length > 0
            ? `! Falta agregar recetas a ${input.missingRecipesByService.length.toLocaleString("es-MX")} servicio(s)`
            : "✓ Todas las recetas necesarias ya están cargadas",
    },
    {
      key: "costo_inicial",
      label: "Costo inicial",
      state:
        input.servicesCount === 0 || input.missingRecipesByService.length > 0
          ? "pending"
          : input.configurationChanged
            ? "attention"
            : input.hasInitialSnapshot
              ? "completed"
              : "current",
      summary:
        input.servicesCount === 0 || input.missingRecipesByService.length > 0
          ? "○ Completa servicios y recetas para calcular el costo inicial"
          : input.configurationChanged
            ? "! Genera un nuevo costo inicial para actualizar los resultados"
            : input.hasInitialSnapshot
              ? "✓ El costo inicial ya quedó guardado"
              : input.canPreviewInitial
                ? "✓ Vista previa lista para guardar como costo inicial"
                : "○ Costo inicial pendiente",
    },
    {
      key: "precios_actualizados",
      label: "Precios actualizados",
      state:
        !input.hasInitialSnapshot
          ? "pending"
          : input.priceUpdateStatus === "price_resolution_warning"
            ? "attention"
            : input.canUpdateCost
              ? "current"
              : input.priceUpdateStatus === "updated_cost_current"
                ? "completed"
                : "pending",
      summary:
        !input.hasInitialSnapshot
          ? "○ Primero guarda el costo inicial"
          : input.priceUpdateStatus === "price_resolution_warning"
            ? "! Hay precios por revisar antes de actualizar el costo"
            : input.canUpdateCost
              ? "○ Hay precios nuevos listos para actualizar"
              : input.priceUpdateStatus === "updated_cost_current"
                ? "✓ El costo actualizado ya usa precios vigentes"
                : "○ Sin actualización de precios",
    },
  ];
}

type ChefOverviewBaseRow = {
  event: CateringEventLite;
  servicesCount: number;
  recipesCount: number;
  hasAnyRecipes: boolean;
  latestHistoricalInitialSnapshot: ChefSnapshotLite | null;
  latestInitialSnapshot: ChefSnapshotLite | null;
  latestUpdatedSnapshot: ChefSnapshotLite | null;
  configurationChanged: boolean;
};

const STRUCTURAL_COSTING_STATUSES = new Set<ChefCostingStatus>([
  "sin_servicios",
  "sin_recetas",
  "configuracion_incompleta",
  "pendiente_costeo",
  "configuracion_modificada",
]);

function compareOverviewRows(
  left: ChefEventOverviewRow,
  right: ChefEventOverviewRow,
  todayKey: string,
): number {
  const leftKey = left.dateContext.dateKey;
  const rightKey = right.dateContext.dateKey;
  const leftFuture = leftKey == null || compareKitchenBusinessDateKeys(leftKey, todayKey) >= 0;
  const rightFuture = rightKey == null || compareKitchenBusinessDateKeys(rightKey, todayKey) >= 0;
  if (leftFuture && rightFuture) {
    if (leftKey == null && rightKey == null) return 0;
    if (leftKey == null) return 1;
    if (rightKey == null) return -1;
    return compareKitchenBusinessDateKeys(leftKey, rightKey);
  }
  if (!leftFuture && !rightFuture) {
    if (leftKey == null && rightKey == null) return 0;
    if (leftKey == null) return 1;
    if (rightKey == null) return -1;
    return compareKitchenBusinessDateKeys(rightKey, leftKey);
  }
  return leftFuture ? -1 : 1;
}

async function buildChefEventOverviewRows(
  tenantSlug: string,
  tenantId: string,
  input?: ChefEventOverviewFilters,
): Promise<ChefEventsOverviewResult> {
  const filters = normalizeOverviewFilters(input);
  const allEvents = await getEvents(tenantId, { limit: 200 });
  const events = allEvents.filter((event) => {
    return eventMatchesOverviewQuery(event, filters.q) && eventMatchesPeriod(event, filters.period, filters.todayKey);
  });
  const eventIds = events.map((event) => event.id);
  const [{ plans, planRecipes }, snapshotsByEvent] = await Promise.all([
    listPlansAndRecipes(tenantId, eventIds, { includePresentationDetails: false }),
    listCompletedSnapshots(tenantId, eventIds, { includeWarnings: false }),
  ]);

  const plansByEventId = new Map<string, EventCateringPlan[]>();
  for (const plan of plans) {
    const bucket = plansByEventId.get(plan.event_id) ?? [];
    bucket.push(plan);
    plansByEventId.set(plan.event_id, bucket);
  }

  const baseRows = events
    .map<ChefOverviewBaseRow>((event) => {
      const eventPlans = (plansByEventId.get(event.id) ?? []).filter(isActiveCateringPlan);
      const eventPlanIdSet = new Set(eventPlans.map((plan) => plan.id));
      const eventRecipes = planRecipes.filter((row) => eventPlanIdSet.has(row.plan_id));
      const currentPayload = buildCurrentEventConfigurationPayload(event, eventPlans, eventRecipes);
      const snapshots = snapshotsByEvent.get(event.id) ?? [];
      const initialSnapshots = snapshots.filter((row) => row.snapshotKind === "initial");
      const latestHistoricalInitialSnapshot = initialSnapshots[0] ?? null;
      const latestInitialSnapshot =
        initialSnapshots.find((snapshot) =>
          hasSameConfiguration(currentPayload, snapshot.configurationPayload),
        ) ?? null;
      const latestUpdatedSnapshot =
        snapshots.find(
          (snapshot) =>
            snapshot.snapshotKind === "updated" &&
            snapshot.baseSnapshotId === latestInitialSnapshot?.id,
        ) ?? null;
      return {
        event,
        servicesCount: eventPlans.length,
        recipesCount: eventRecipes.length,
        hasAnyRecipes: eventRecipes.length > 0,
        latestHistoricalInitialSnapshot,
        latestInitialSnapshot,
        latestUpdatedSnapshot,
        configurationChanged: initialSnapshots.length > 0 && latestInitialSnapshot == null,
      };
    })
    .filter((row) => {
      if (!filters.status || !STRUCTURAL_COSTING_STATUSES.has(filters.status as ChefCostingStatus)) {
        return true;
      }

      const structuralStatus = resolveStructuralChefCostingStatus({
        servicesCount: row.servicesCount,
        recipesCount: row.recipesCount,
        hasAnyRecipes: row.hasAnyRecipes,
        hasInitialSnapshot: row.latestInitialSnapshot != null,
        configurationChanged: row.configurationChanged,
      });
      return structuralStatus === filters.status;
    });

  const previewByEventId = new Map<string, EventCostingDraft | null>();
  const comparisonLinesByEventId = new Map<string, SnapshotItemLine[]>();
  await Promise.all(
    baseRows.map(async (row) => {
      if (
        !row.latestInitialSnapshot ||
        row.configurationChanged ||
        !row.hasAnyRecipes ||
        row.recipesCount < row.servicesCount
      ) {
        previewByEventId.set(row.event.id, null);
        comparisonLinesByEventId.set(row.event.id, []);
        return;
      }
      const [draft, comparisonLines] = await Promise.all([
        previewUpdatedEventCostingSnapshot(tenantId, row.latestInitialSnapshot.id),
        row.latestUpdatedSnapshot
          ? listSnapshotItemLines(tenantId, row.latestUpdatedSnapshot.id)
          : Promise.resolve<SnapshotItemLine[]>([]),
      ]);
      previewByEventId.set(row.event.id, draft);
      comparisonLinesByEventId.set(
        row.event.id,
        row.latestUpdatedSnapshot ? comparisonLines : buildDraftItemLines(draft),
      );
    }),
  );

  const rows = baseRows
    .map<ChefEventOverviewRow>((row) => {
      const eventPlans = plansByEventId.get(row.event.id) ?? [];
      const activeEventPlans = eventPlans.filter(isActiveCateringPlan);
      const eventPlanIds = new Set(activeEventPlans.map((plan) => plan.id));
      const eventRecipes = planRecipes.filter((recipe) => eventPlanIds.has(recipe.plan_id));
      const missingRecipesByService = listMissingRecipesByService(activeEventPlans, eventRecipes);
      const preview = previewByEventId.get(row.event.id) ?? null;
      const comparisonLines = comparisonLinesByEventId.get(row.event.id) ?? [];
      const priceUpdateStatus = resolvePriceUpdateStatus({
        draft: preview,
        latestUpdatedSnapshot: row.latestUpdatedSnapshot,
        comparisonLines,
      });
      const resolvedStatus = resolveChefCostingStatus({
        servicesCount: activeEventPlans.length,
        recipesCount: row.recipesCount,
        hasAnyRecipes: row.hasAnyRecipes,
        currentInitialSnapshot: row.latestInitialSnapshot,
        latestUpdatedSnapshot: row.latestUpdatedSnapshot,
        configurationChanged: row.configurationChanged,
        priceUpdateStatus,
      });
      const priority = resolveOverviewPriority(resolvedStatus.status);
      const updatedCostTotal = row.latestUpdatedSnapshot?.totalCost ?? (preview
        ? round4(preview.itemRows.reduce((acc, item) => acc + item.lineTotalCost, 0))
        : null);
      const currentCostTotal = row.latestUpdatedSnapshot?.totalCost ?? row.latestInitialSnapshot?.totalCost ?? null;
      const dateContext = resolveEventDateContext(row.event.starts_at, filters.todayKey);
      const costingMessage = resolveOverviewMessage({
        status: resolvedStatus.status,
        missingRecipesByService,
        recipeIssueCount: 0,
        recipeIssueSummary: null,
        configurationChanged: row.configurationChanged,
        hasInitialPreview: false,
        priceUpdateMessage: resolvePriceUpdatePresentation(priceUpdateStatus).message,
      });
      const currentCostDetail = resolveCostDisplayDetail(resolvedStatus.status, costingMessage);
      return {
        event: row.event,
        dateContext,
        servicesCount: row.servicesCount,
        recipesCount: row.recipesCount,
        costingStatus: resolvedStatus.status,
        costingLabel: resolvedStatus.label,
        costingMessage,
        priority,
        primaryAction: resolveOverviewPrimaryAction(
          tenantSlug,
          row.event.id,
          resolvedStatus.status,
          preview != null,
          missingRecipesByService,
        ),
        secondaryAction: resolveOverviewSecondaryAction(tenantSlug, row.event.id, resolvedStatus.status),
        latestInitialSnapshot: row.latestInitialSnapshot,
        latestUpdatedSnapshot: row.latestUpdatedSnapshot,
        initialCostTotal:
          row.latestInitialSnapshot?.totalCost ??
          (row.configurationChanged ? row.latestHistoricalInitialSnapshot?.totalCost ?? null : null),
        updatedCostTotal,
        currentCostTotal,
        initialCostPerPerson: costPerPerson(
          row.latestInitialSnapshot?.totalCost ??
            (row.configurationChanged ? row.latestHistoricalInitialSnapshot?.totalCost ?? null : null),
          row.event.expected_attendance,
        ),
        currentCostPerPerson: costPerPerson(
          row.configurationChanged ? null : currentCostTotal,
          row.event.expected_attendance,
        ),
        priceVariationAmount: row.configurationChanged ? null : row.latestUpdatedSnapshot?.priceVariationAmount ?? null,
        priceVariationPercent: row.configurationChanged ? null : row.latestUpdatedSnapshot?.priceVariationPercent ?? null,
        lastCostedAt:
          row.latestUpdatedSnapshot?.createdAt ??
          row.latestInitialSnapshot?.createdAt ??
          row.latestHistoricalInitialSnapshot?.createdAt ??
          null,
        configurationChanged: row.configurationChanged,
        hasAnyRecipes: row.hasAnyRecipes,
        hasInitialPreview: preview != null,
        previewCostTotal: preview
          ? round4(preview.itemRows.reduce((acc, item) => acc + item.lineTotalCost, 0))
          : null,
        nextStepMessage: costingMessage,
        initialCostDisplay: buildCostDisplay({
          value:
            row.latestInitialSnapshot?.totalCost ??
            (row.configurationChanged ? row.latestHistoricalInitialSnapshot?.totalCost ?? null : null),
          status: resolvedStatus.status,
          snapshotExists: row.latestInitialSnapshot != null || row.latestHistoricalInitialSnapshot != null,
          detail: resolveCostDisplayDetail(resolvedStatus.status, costingMessage),
          semantic: row.configurationChanged ? "historical" : "current",
        }),
        currentCostDisplay: buildCostDisplay({
          value: row.configurationChanged ? null : currentCostTotal,
          status: resolvedStatus.status,
          snapshotExists: row.latestInitialSnapshot != null,
          detail: currentCostDetail,
          semantic: "current",
        }),
      };
    })
    .filter((row) => (filters.status ? row.costingStatus === filters.status : true))
    .sort((left, right) => compareOverviewRows(left, right, filters.todayKey));

  const groupedRows = {
    futureActionRequired: rows.filter((row) => row.dateContext.isUpcoming && row.priority === "action_required"),
    futureAttention: rows.filter((row) => row.dateContext.isUpcoming && row.priority === "attention"),
    futureCurrent: rows.filter((row) => row.dateContext.isUpcoming && row.priority === "current"),
    recent: rows.filter((row) => !row.dateContext.isUpcoming && row.dateContext.dateKey != null),
  };

  return {
    totalEvents: events.length,
    filters: {
      q: filters.q,
      status: filters.status,
      period: filters.period,
    },
    metrics: {
      upcomingEvents: rows.filter((row) => row.dateContext.isUpcoming).length,
      requiresAttention: rows.filter((row) => row.priority === "action_required").length,
      withNewPrices: rows.filter((row) => row.costingStatus === "hay_precios_nuevos").length,
      costed: rows.filter((row) =>
        row.costingStatus === "costo_inicial_vigente" || row.costingStatus === "costo_actualizado",
      ).length,
    },
    rows,
    groupedRows,
  };
}

function buildTopPriceImpactItems(input: {
  draft: EventCostingDraft | null;
  initialItemLines: SnapshotItemLine[];
  plansById: Map<string, EventCateringPlan>;
  recipesByPlanRecipeId: Map<string, EventCateringPlanRecipe>;
}): ChefTopPriceImpactItem[] {
  if (!input.draft) return [];

  const initialByKey = new Map(input.initialItemLines.map((row) => [row.comparisonKey, row]));
  const grouped = new Map<string, ChefTopPriceImpactItem>();

  for (const row of input.draft.itemRows) {
    const sourcePayload = row.sourcePayload as Record<string, unknown>;
    const comparisonKey = String(sourcePayload.initial_line_id ?? `${row.planRecipeId}:${row.itemId}`);
    const initialLine = initialByKey.get(comparisonKey);
    if (!initialLine) continue;

    const existing = grouped.get(row.itemId);
    const impactAmount = round4(row.lineTotalCost - initialLine.lineTotalCost);
    const serviceName = input.plansById.get(row.planId)?.name?.trim() || "Servicio sin nombre";
    const recipeName =
      input.recipesByPlanRecipeId.get(row.planRecipeId)?.kitchen_recipe_recipes?.name ??
      `Receta ${row.recipeId.slice(0, 8)}`;

    if (!existing) {
      grouped.set(row.itemId, {
        itemId: row.itemId,
        itemName: row.itemName,
        supplierName: null,
        purchaseUnitCode: row.purchaseUnitCode,
        initialUnitCost: round4(initialLine.operationalUnitCost),
        updatedUnitCost: round4(row.operationalUnitCost),
        requiredQuantity: round4(row.requiredQuantity),
        impactAmount,
        impactPercent: toPercentDelta(row.lineTotalCost, initialLine.lineTotalCost),
        direction: resolveDirection(impactAmount),
        serviceNames: [serviceName],
        recipeNames: [recipeName],
        priceResolutionWarning: row.priceResolutionWarning,
      });
      continue;
    }

    existing.updatedUnitCost = round4(row.operationalUnitCost);
    existing.requiredQuantity = round4(existing.requiredQuantity + row.requiredQuantity);
    existing.impactAmount = round4(existing.impactAmount + impactAmount);
    existing.impactPercent = toPercentDelta(
      round4(existing.initialUnitCost + existing.impactAmount),
      existing.initialUnitCost,
    );
    existing.direction = resolveDirection(existing.impactAmount);
    if (!existing.serviceNames.includes(serviceName)) existing.serviceNames.push(serviceName);
    if (!existing.recipeNames.includes(recipeName)) existing.recipeNames.push(recipeName);
    if (!existing.priceResolutionWarning && row.priceResolutionWarning) {
      existing.priceResolutionWarning = row.priceResolutionWarning;
    }
  }

  return Array.from(grouped.values()).sort(
    (left, right) => Math.abs(right.impactAmount) - Math.abs(left.impactAmount),
  );
}

export async function listChefEventsOverviewForTenant(
  tenantSlug: string,
  tenantId: string,
  filters?: ChefEventOverviewFilters,
): Promise<ChefEventsOverviewResult> {
  return buildChefEventOverviewRows(tenantSlug, tenantId, filters);
}

export async function listChefEventsOverview(
  tenantSlug: string,
  filters?: ChefEventOverviewFilters,
): Promise<ChefEventsOverviewResult> {
  const tenant = await resolveTenantModulePageContext(tenantSlug, "event_catering", "overview", "read");
  return listChefEventsOverviewForTenant(tenantSlug, tenant.tenantId, filters);
}

export async function listChefEventOverview(tenantSlug: string): Promise<ChefEventOverviewRow[]> {
  const result = await listChefEventsOverview(tenantSlug, {
    period: "todos",
  });
  return result.rows;
}

export async function getChefEventDetail(
  tenantSlug: string,
  eventId: string,
): Promise<ChefEventDetail | null> {
  const tenant = await resolveTenantModulePageContext(tenantSlug, "event_catering", "plans", "read");
  const events = await getEvents(tenant.tenantId, { limit: 400 });
  const event = events.find((row) => row.id === eventId) ?? null;
  if (!event) return null;

  const [{ plans, planRecipes }, snapshotsByEvent] = await Promise.all([
    listPlansAndRecipes(tenant.tenantId, [eventId]),
    listCompletedSnapshots(tenant.tenantId, [eventId]),
  ]);
  const activePlans = plans.filter(isActiveCateringPlan);
  const activePlanIds = new Set(activePlans.map((plan) => plan.id));
  const activePlanRecipes = planRecipes.filter((planRecipe) => activePlanIds.has(planRecipe.plan_id));
  const currentPayload = buildCurrentEventConfigurationPayload(event, activePlans, activePlanRecipes);
  const snapshots = snapshotsByEvent.get(eventId) ?? [];
  const initialSnapshots = snapshots.filter((row) => row.snapshotKind === "initial");
  const latestHistoricalInitialSnapshot = initialSnapshots[0] ?? null;
  const latestInitialSnapshot =
    initialSnapshots.find((snapshot) =>
      hasSameConfiguration(currentPayload, snapshot.configurationPayload),
    ) ?? null;
  const configurationChanged = initialSnapshots.length > 0 && latestInitialSnapshot == null;
  const latestUpdatedSnapshot =
    snapshots.find(
      (snapshot) =>
        snapshot.snapshotKind === "updated" &&
        snapshot.baseSnapshotId === latestInitialSnapshot?.id,
    ) ?? null;

  const todayKey = getKitchenBusinessDateKey();
  const dateContext = resolveEventDateContext(event.starts_at, todayKey);
  const missingRecipesByService = listMissingRecipesByService(activePlans, activePlanRecipes);

  const [
    initialServiceSummaries,
    historicalServiceSummaries,
    initialRecipeSummaries,
    historicalRecipeSummaries,
    initialItemLines,
    updatedDraft,
    initialPreview,
    readiness,
  ] =
    await Promise.all([
      listSnapshotServiceSummaries(tenant.tenantId, latestInitialSnapshot?.id ?? null),
      listSnapshotServiceSummaries(tenant.tenantId, latestHistoricalInitialSnapshot?.id ?? null),
      listSnapshotRecipeSummaries(tenant.tenantId, latestInitialSnapshot?.id ?? null),
      listSnapshotRecipeSummaries(tenant.tenantId, latestHistoricalInitialSnapshot?.id ?? null),
      listSnapshotItemLines(tenant.tenantId, latestInitialSnapshot?.id ?? null),
      latestInitialSnapshot && !configurationChanged
        ? previewUpdatedEventCostingSnapshot(tenant.tenantId, latestInitialSnapshot.id)
        : Promise.resolve(null),
      !latestInitialSnapshot && activePlans.length > 0 && activePlanRecipes.length > 0
        ? previewInitialEventCostingSnapshot(tenant.tenantId, eventId).catch(() => null)
        : Promise.resolve(null),
      activePlanRecipes.length > 0
        ? listKitchenRecipeReadinessByRecipes(
            tenant.tenantId,
            activePlanRecipes.map((row) => ({
              id: row.recipe_id,
              name: row.kitchen_recipe_recipes?.name ?? row.recipe_id,
            })),
          )
        : Promise.resolve([]),
    ]);

  const comparisonLines = latestUpdatedSnapshot
    ? await listSnapshotItemLines(tenant.tenantId, latestUpdatedSnapshot.id)
    : initialItemLines;
  const priceUpdateStatus = resolvePriceUpdateStatus({
    draft: updatedDraft,
    latestUpdatedSnapshot,
    comparisonLines,
  });
  const priceUpdatePresentation = resolvePriceUpdatePresentation(priceUpdateStatus);
  const resolvedStatus = resolveChefCostingStatus({
    servicesCount: activePlans.length,
    recipesCount: activePlanRecipes.length,
    hasAnyRecipes: activePlanRecipes.length > 0,
    currentInitialSnapshot: latestInitialSnapshot,
    latestUpdatedSnapshot,
    configurationChanged,
    priceUpdateStatus,
  });
  const readinessByRecipeId = new Map(readiness.map((row) => [row.recipe_id, row]));
  const recipesNeedingAttention = activePlanRecipes
    .map((planRecipe) => {
      const readinessRow = readinessByRecipeId.get(planRecipe.recipe_id) ?? null;
      if (!readinessRow || readinessRow.readiness_status === "ready") return null;
      return {
        recipeId: planRecipe.recipe_id,
        recipeName: planRecipe.kitchen_recipe_recipes?.name ?? `Receta ${planRecipe.recipe_id.slice(0, 8)}`,
        issue: resolveChefRecipeStateMessage(readinessRow),
      };
    })
    .filter((row): row is { recipeId: string; recipeName: string; issue: string } => row != null);
  const recipeIssueSummary =
    recipesNeedingAttention.length > 0
      ? recipesNeedingAttention.length === 1
        ? `La receta ${recipesNeedingAttention[0].recipeName} necesita completar su costo o revisar un precio vigente.`
        : `${recipesNeedingAttention.length.toLocaleString("es-MX")} recetas necesitan completar su información de costo o revisar precios vigentes.`
      : null;
  const costingMessage = resolveOverviewMessage({
    status: resolvedStatus.status,
    missingRecipesByService,
    recipeIssueCount: recipesNeedingAttention.length,
    recipeIssueSummary,
    configurationChanged,
    hasInitialPreview: initialPreview != null,
    priceUpdateMessage: priceUpdatePresentation.message,
  });

  const previewServiceSummaries = updatedDraft ? buildDraftServiceSummaryMap(updatedDraft) : new Map();
  const previewRecipeSummaries = updatedDraft ? buildDraftRecipeSummaryMap(updatedDraft) : new Map();
  const plansById = new Map(activePlans.map((plan) => [plan.id, plan]));
  const recipesByPlanRecipeId = new Map(activePlanRecipes.map((planRecipe) => [planRecipe.id, planRecipe]));

  const services: ChefServiceRow[] = activePlans.map((plan) => {
    const serviceRecipes = activePlanRecipes.filter((row) => row.plan_id === plan.id);
    const previewReady = initialPreview != null && latestInitialSnapshot == null && !configurationChanged;
    const initialSummary =
      initialServiceSummaries.get(plan.id) ??
      (configurationChanged ? historicalServiceSummaries.get(plan.id) ?? null : null);
    const updatedSummary = previewServiceSummaries.get(plan.id) ?? null;
    const servicePriceUpdateStatus =
      updatedDraft == null
        ? null
        : updatedDraft.itemRows.some(
              (row) => row.planId === plan.id && row.priceResolutionWarning,
            )
          ? "price_resolution_warning"
          : updatedSummary && initialSummary && round4(updatedSummary.totalCost) !== round4(initialSummary.totalCost)
            ? "price_changes_available"
            : latestUpdatedSnapshot
              ? "updated_cost_current"
              : "no_price_changes";
    const serviceStatus = resolveChefCostingStatus({
      servicesCount: 1,
      recipesCount: serviceRecipes.length,
      hasAnyRecipes: serviceRecipes.length > 0,
      currentInitialSnapshot: initialSummary && latestInitialSnapshot ? latestInitialSnapshot : null,
      latestUpdatedSnapshot,
      configurationChanged,
      priceUpdateStatus: servicePriceUpdateStatus,
    });

    const recipes: ChefRecipeRow[] = serviceRecipes.map((planRecipe) => {
      const initialRecipeSummary =
        initialRecipeSummaries.get(planRecipe.id) ??
        (configurationChanged ? historicalRecipeSummaries.get(planRecipe.id) ?? null : null);
      const updatedRecipeSummary = previewRecipeSummaries.get(planRecipe.id) ?? null;
      return {
        planRecipe,
        recipeName:
          planRecipe.kitchen_recipe_recipes?.name ?? `Receta ${planRecipe.recipe_id.slice(0, 8)}`,
        plannedServings: Number(planRecipe.planned_servings ?? 0),
        serviceGuestCount: plan.planned_guest_count ?? null,
        initialCostTotal: initialRecipeSummary?.totalCost ?? null,
        updatedCostTotal: updatedRecipeSummary?.totalCost ?? null,
        initialCostPerPortion: costPerPerson(
          initialRecipeSummary?.totalCost ?? null,
          Number(planRecipe.planned_servings ?? 0),
        ),
        updatedCostPerPortion: costPerPerson(
          updatedRecipeSummary?.totalCost ?? null,
          Number(planRecipe.planned_servings ?? 0),
        ),
        priceVariationAmount:
          updatedRecipeSummary != null && initialRecipeSummary != null
            ? round4(updatedRecipeSummary.totalCost - initialRecipeSummary.totalCost)
            : null,
        priceVariationPercent:
          updatedRecipeSummary != null && initialRecipeSummary != null
            ? toPercentDelta(updatedRecipeSummary.totalCost, initialRecipeSummary.totalCost)
            : null,
        shareOfServiceCost:
          updatedRecipeSummary != null && updatedSummary && updatedSummary.totalCost > 0
            ? round4((updatedRecipeSummary.totalCost / updatedSummary.totalCost) * 100)
            : null,
        readiness: readinessByRecipeId.get(planRecipe.recipe_id) ?? null,
        stateMessage: resolveChefRecipeStateMessage(readinessByRecipeId.get(planRecipe.recipe_id) ?? null),
        isServingOverride:
          plan.planned_guest_count != null &&
          Number(planRecipe.planned_servings ?? 0) !== Number(plan.planned_guest_count ?? 0),
      };
    });

    const serviceCostingLabel =
      serviceRecipes.length === 0
        ? "Sin recetas"
        : configurationChanged
          ? "Costo anterior"
          : previewReady
            ? "Incluido en la vista previa"
            : latestInitialSnapshot != null
              ? "Costo vigente"
              : serviceStatus.label;
    const serviceCostingMessage =
      serviceRecipes.length === 0
        ? "Este servicio todavía no tiene recetas."
        : configurationChanged
          ? "El último costo guardado corresponde a una configuración anterior."
          : previewReady
            ? "Este servicio ya está incluido en la vista previa actual."
            : recipesNeedingAttention.find((recipe) =>
                  serviceRecipes.some((planRecipe) => planRecipe.recipe_id === recipe.recipeId),
                )?.issue ?? null;

    return {
      plan,
      recipesCount: serviceRecipes.length,
      initialCostTotal: initialSummary?.totalCost ?? null,
      updatedCostTotal: updatedSummary?.totalCost ?? null,
      initialCostPerPerson: costPerPerson(initialSummary?.totalCost ?? null, plan.planned_guest_count),
      updatedCostPerPerson: costPerPerson(updatedSummary?.totalCost ?? null, plan.planned_guest_count),
      shareOfEventCost:
        updatedSummary && updatedDraft
          ? round4(
              (updatedSummary.totalCost /
                round4(updatedDraft.itemRows.reduce((acc, row) => acc + row.lineTotalCost, 0))) *
                100,
            )
          : null,
      contributionToEventVariation:
        updatedSummary != null && initialSummary != null && updatedDraft
          ? round4(
              ((updatedSummary.totalCost - initialSummary.totalCost) /
                Math.max(
                  1,
                  Math.abs(
                    round4(
                      updatedDraft.itemRows.reduce(
                        (acc, row) => acc + row.priceVariationAmount,
                        0,
                      ),
                    ),
                  ),
                )) *
                100,
            )
          : null,
      priceVariationAmount:
        updatedSummary != null && initialSummary != null
          ? round4(updatedSummary.totalCost - initialSummary.totalCost)
          : null,
      priceVariationPercent:
        updatedSummary != null && initialSummary != null
          ? toPercentDelta(updatedSummary.totalCost, initialSummary.totalCost)
          : null,
      costingStatus: serviceStatus.status,
      costingLabel: serviceCostingLabel,
      costingMessage: serviceCostingMessage,
      configurationChanged,
      primaryAction:
        serviceRecipes.length === 0
          ? {
              label: "Agregar receta",
              href: `/${tenantSlug}/kitchen/events/${eventId}/catering/${plan.id}`,
            }
          : {
              label: previewReady ? "Ver recetas" : "Ver y editar recetas",
              href: `/${tenantSlug}/kitchen/events/${eventId}/catering/${plan.id}`,
            },
      nextStepMessage:
        serviceRecipes.length === 0
          ? `Falta agregar recetas al servicio ${plan.name?.trim() || "Servicio sin nombre"}.`
          : configurationChanged
            ? "El último costo guardado de este servicio corresponde a una configuración anterior."
            : null,
      initialCostDisplay: buildCostDisplay({
        value: initialSummary?.totalCost ?? null,
        status: serviceStatus.status,
        snapshotExists: initialSummary != null,
        detail: resolveCostDisplayDetail(
          serviceStatus.status,
          serviceRecipes.length === 0
            ? `Falta agregar recetas al servicio ${plan.name?.trim() || "Servicio sin nombre"}.`
            : null,
        ),
        semantic: configurationChanged ? "historical" : "current",
      }),
      updatedCostDisplay: buildCostDisplay({
        value: configurationChanged ? null : updatedSummary?.totalCost ?? null,
        status: serviceStatus.status,
        snapshotExists: initialSummary != null,
        detail: resolveCostDisplayDetail(serviceStatus.status, null),
        semantic: "current",
      }),
      recipes,
    };
  });

  const topPriceImpactItems = buildTopPriceImpactItems({
    draft: updatedDraft,
    initialItemLines,
    plansById,
    recipesByPlanRecipeId,
  });

  const nextStep =
    initialPreview && !latestInitialSnapshot
      ? {
          message:
            "La configuración está lista. Revisa la vista previa y guarda el costo inicial para conservar esta configuración y sus precios.",
          action: {
            label: "Revisar vista previa",
            href: `/${tenantSlug}/kitchen/events/${eventId}/catering#vista-previa-costo`,
          },
        }
      : {
          message:
            costingMessage ??
            (resolvedStatus.status === "costo_actualizado"
              ? "El costo del evento ya está al día."
              : "Revisa el detalle del costeo."),
          action: resolveOverviewPrimaryAction(
            tenantSlug,
            eventId,
            resolvedStatus.status,
            initialPreview != null,
            missingRecipesByService,
          ),
        };

  return {
    event,
    dateContext,
    services,
    latestInitialSnapshot,
    latestHistoricalInitialSnapshot,
    latestUpdatedSnapshot,
    initialCostTotal:
      latestInitialSnapshot?.totalCost ??
      (configurationChanged ? latestHistoricalInitialSnapshot?.totalCost ?? null : null),
    updatedCostTotal: configurationChanged
      ? null
      : updatedDraft
      ? round4(updatedDraft.itemRows.reduce((acc, row) => acc + row.lineTotalCost, 0))
      : latestUpdatedSnapshot?.totalCost ?? null,
    priceVariationAmount: configurationChanged
      ? null
      : updatedDraft
      ? round4(updatedDraft.itemRows.reduce((acc, row) => acc + row.priceVariationAmount, 0))
      : latestUpdatedSnapshot?.priceVariationAmount ?? null,
    priceVariationPercent: configurationChanged
      ? null
      : updatedDraft
      ? toPercentDelta(
          round4(updatedDraft.itemRows.reduce((acc, row) => acc + row.lineTotalCost, 0)),
          round4(updatedDraft.itemRows.reduce((acc, row) => acc + row.baseLineTotalCost, 0)),
        )
      : latestUpdatedSnapshot?.priceVariationPercent ?? null,
    initialCostPerPerson: costPerPerson(
      latestInitialSnapshot?.totalCost ??
        (configurationChanged ? latestHistoricalInitialSnapshot?.totalCost ?? null : null),
      event.expected_attendance,
    ),
    updatedCostPerPerson: costPerPerson(
      configurationChanged
        ? null
        : updatedDraft
        ? round4(updatedDraft.itemRows.reduce((acc, row) => acc + row.lineTotalCost, 0))
        : latestUpdatedSnapshot?.totalCost ?? null,
      event.expected_attendance,
    ),
    costingStatus: resolvedStatus.status,
    costingLabel: resolvedStatus.label,
    costingMessage,
    priceUpdateStatus,
    priceUpdateLabel: priceUpdatePresentation.label,
    priceUpdateMessage: priceUpdatePresentation.message,
    configurationChanged,
    totalRecipesCount: activePlanRecipes.length,
    canCalculateInitialCost: activePlans.length > 0 && activePlanRecipes.length > 0,
    canUpdateCost:
      latestInitialSnapshot != null &&
      !configurationChanged &&
      priceUpdateStatus === "price_changes_available",
    nextStep,
    progressStages: buildProgressStages({
      servicesCount: activePlans.length,
      missingRecipesByService,
      hasInitialSnapshot: latestInitialSnapshot != null,
      configurationChanged,
      canPreviewInitial: initialPreview != null,
      canUpdateCost:
        latestInitialSnapshot != null &&
        !configurationChanged &&
        priceUpdateStatus === "price_changes_available",
      priceUpdateStatus,
    }),
    initialPreview,
    missingRecipesByService,
    recipesNeedingAttention,
    initialCostDisplay: buildCostDisplay({
      value:
        latestInitialSnapshot?.totalCost ??
        (configurationChanged ? latestHistoricalInitialSnapshot?.totalCost ?? null : null),
      status: resolvedStatus.status,
      snapshotExists: latestInitialSnapshot != null || latestHistoricalInitialSnapshot != null,
      detail: resolveCostDisplayDetail(resolvedStatus.status, costingMessage),
      semantic: configurationChanged ? "historical" : "current",
    }),
    updatedCostDisplay: buildCostDisplay({
      value: configurationChanged
        ? null
        : updatedDraft
        ? round4(updatedDraft.itemRows.reduce((acc, row) => acc + row.lineTotalCost, 0))
        : latestUpdatedSnapshot?.totalCost ?? null,
      status: resolvedStatus.status,
      snapshotExists: latestInitialSnapshot != null,
      detail: resolveCostDisplayDetail(resolvedStatus.status, priceUpdatePresentation.message),
      semantic: "current",
    }),
    topPriceImpactItems: topPriceImpactItems.slice(0, 5),
    allPriceImpactItems: topPriceImpactItems,
  };
}

export async function getChefServiceDetail(
  tenantSlug: string,
  eventId: string,
  planId: string,
): Promise<ChefServiceDetail | null> {
  const tenant = await resolveTenantModulePageContext(tenantSlug, "event_catering", "plans", "read");
  const eventDetail = await getChefEventDetail(tenantSlug, eventId);
  if (!eventDetail) return null;
  const service = eventDetail.services.find((row) => row.plan.id === planId) ?? null;
  if (!service) return null;

  const { planRecipes } = await listPlansAndRecipes(tenant.tenantId, [eventId]);
  const servicePlanRecipes = planRecipes.filter((row) => row.plan_id === planId);
  const readiness = await listKitchenRecipeReadinessByRecipes(
    tenant.tenantId,
    servicePlanRecipes.map((row) => ({
      id: row.recipe_id,
      name: row.kitchen_recipe_recipes?.name ?? row.recipe_id,
    })),
  );
  const readinessByRecipeId = new Map(readiness.map((row) => [row.recipe_id, row]));

  const recipes = service.recipes.map((recipe) => {
    const readinessRow = readinessByRecipeId.get(recipe.planRecipe.recipe_id) ?? null;
    return {
      ...recipe,
      readiness: readinessRow,
      stateMessage: resolveChefRecipeStateMessage(readinessRow),
    };
  });

  const readyRecipes = await listReadyRecipesForCatering(tenantSlug);

  return {
    event: eventDetail.event,
    dateContext: eventDetail.dateContext,
    plan: service.plan,
    latestInitialSnapshot: eventDetail.latestInitialSnapshot,
    latestUpdatedSnapshot: eventDetail.latestUpdatedSnapshot,
    serviceCostTotal: service.initialCostTotal,
    serviceUpdatedCostTotal: service.updatedCostTotal,
    serviceCostPerPerson: service.initialCostPerPerson,
    serviceUpdatedCostPerPerson: service.updatedCostPerPerson,
    priceVariationAmount: service.priceVariationAmount,
    priceVariationPercent: service.priceVariationPercent,
    costingStatus: service.costingStatus,
    costingLabel: service.costingLabel,
    costingMessage: service.costingMessage,
    configurationChanged: service.configurationChanged,
    nextStep:
      service.nextStepMessage != null
        ? {
            message: service.nextStepMessage,
            action: service.primaryAction,
          }
        : null,
    initialPreview: eventDetail.initialPreview,
    initialCostDisplay: service.initialCostDisplay,
    updatedCostDisplay: service.updatedCostDisplay,
    recipes,
    readyRecipes,
  };
}
