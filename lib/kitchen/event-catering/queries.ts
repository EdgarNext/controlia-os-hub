import { getSupabaseServerClient } from "@/lib/supabase/server";
import { getCurrentTenantModulePageAccessMap, hasModulePageAccess, resolveTenantModulePageContext } from "@/lib/auth/module-page-access";
import { getEvents } from "@/lib/events/event.queries";
import { listKitchenRecipeReadiness } from "@/lib/kitchen/recipes/readiness";
import type {
  CateringOverviewSummary,
  CateringPlanSummary,
  CateringPlanOperationalIndexRow,
  CateringRequisitionOperationalIndexRow,
  PurchaseReceiptOperationalOverviewRow,
  ConsumptionOperationalCandidateRow,
  CateringShortageSummaryRow,
  CateringEventLite,
  EventCateringPlan,
  EventCateringPlanRecipe,
  EventCateringRequirement,
  EventCateringRequisition,
  EventCateringRequisitionLine,
  CateringRequisitionSupplierSummary,
  EventCateringPurchaseReceipt,
  EventCateringPurchaseReceiptLine,
  EventCateringConsumptionRecord,
  EventCateringConsumptionLine,
  EventCateringConsumptionLineAvailability,
  EventCateringConsumptionDraftReadiness,
  CateringPlanOperationalSummary,
  CateringPlanPriceReviewSummary,
  CateringPlanItemFlowRow,
  CateringPlanWarning,
  EventCateringInventoryReversal,
  EventCateringInventoryReversalLine,
  EventCateringInventoryReversalTargetType,
  EventCateringReversalTargetSummary,
  CateringPlanFinancialLine,
  CateringPlanFinancialReport,
  CateringFinancialDashboard,
  CateringFinancialDashboardAlert,
  CateringFinancialDashboardRow,
  CateringFinancialDashboardStatus,
  CateringFinancialDashboardSummary,
  CateringFinancialEventReadModel,
  CateringFinancialServiceReadModel,
  CateringPlanFinancialStatus,
  CateringPlanFinancialSummary,
  CateringPlanFinancialPricing,
  CateringPlanFinancialVarianceReason,
  ReadyRecipeForCatering,
  RequisitionLinePurchaseOptionAlternative,
} from "./types";
import { getCateringPlanPricingPreview, getCateringPlanPricingSnapshots } from "./pricing-queries";
import { calculateCateringServicePricing } from "./financial-model";
import { resolveSingleServiceCostingStatus, serviceRequiresManagerialAttention } from "./costing-status";
import { aggregateFinancialPricing, calculateServiceCostPerPerson, resolveCateringPricingSource, resolveCurrentServiceFoodCost, selectPreferredV1Snapshot } from "./financial-reporting";
import { calculateOperationalExecutionCosts, calculateOperationalQuantityMetrics } from "./operational-metrics";
import {
  classifyConsumptionItemStockBehavior,
  isOperationalZeroCostWaterItemName,
  classifyRequisitionLineProcurement,
  resolveRequisitionLineFinancialTotal,
} from "./procurement-classification";

function round4(value: number): number {
  return Number(value.toFixed(4));
}

function isPositive(value: number | null | undefined): boolean {
  return Number(value ?? 0) > 0.0001;
}

function nearlyEqual(left: number, right: number): boolean {
  return Math.abs(left - right) <= 0.0001;
}

async function resolvePlanFinancialPricing(
  tenantSlug: string,
  plan: EventCateringPlan,
): Promise<CateringPlanFinancialPricing> {
  if (resolveCateringPricingSource(plan.status, false) === "current_preview") {
    const [preview, snapshots] = await Promise.all([
      getCateringPlanPricingPreview(tenantSlug, plan.id),
      getCateringPlanPricingSnapshots(tenantSlug, plan.id),
    ]);
    const latestUpdated = snapshots
      .filter((snapshot) => snapshot.snapshotKind === "updated")
      .sort((left, right) => right.createdAt.localeCompare(left.createdAt))[0];
    const latestInitial = snapshots
      .filter((snapshot) => snapshot.snapshotKind === "initial")
      .sort((left, right) => right.createdAt.localeCompare(left.createdAt))[0];
    const currentFoodCost = resolveCurrentServiceFoodCost({
      updatedCost: latestUpdated?.foodCost ?? null,
      initialCost: latestInitial?.foodCost ?? null,
      previewCost: preview.result.foodCost,
      estimatedCost: Number(plan.estimated_total_cost ?? 0),
    });
    if (currentFoodCost.amount == null) {
      return {
        source: "current_preview",
        status: "unavailable",
        pricingModelVersion: null,
        foodCost: null,
        currentFoodCostSource: currentFoodCost.source,
        extraStaffCount: preview.result.extraStaffCount,
        extraStaffUnitCost: preview.result.extraStaffUnitCost,
        extraLaborCost: null,
        serviceCostBasis: null,
        targetMarginPct: preview.result.targetMarginPct,
        suggestedProfit: null,
        suggestedServicePrice: null,
        suggestedPricePerGuest: null,
        currency: preview.result.currency,
        warnings: preview.result.warnings,
      };
    }
    const result = calculateCateringServicePricing({
      foodCost: currentFoodCost.amount,
      extraStaffCount: preview.result.extraStaffCount,
      extraStaffUnitCost: preview.result.extraStaffUnitCost,
      targetMarginPct: preview.result.targetMarginPct,
      plannedGuestCount: preview.result.plannedGuestCount,
      currency: preview.result.currency,
    });
    return {
      source: "current_preview",
      status: result.status,
      pricingModelVersion: null,
      foodCost: result.foodCost,
      currentFoodCostSource: currentFoodCost.source,
      extraStaffCount: result.extraStaffCount,
      extraStaffUnitCost: result.extraStaffUnitCost,
      extraLaborCost: result.extraLaborCost,
      serviceCostBasis: result.serviceCostBasis,
      targetMarginPct: result.targetMarginPct,
      suggestedProfit: result.suggestedProfit,
      suggestedServicePrice: result.suggestedServicePrice,
      suggestedPricePerGuest: result.suggestedPricePerGuest,
      currency: result.currency,
      warnings: result.warnings,
    };
  }

  const snapshots = await getCateringPlanPricingSnapshots(tenantSlug, plan.id);
  const historical = selectPreferredV1Snapshot(snapshots);

  if (historical) {
    return {
      source: "snapshot_v1",
      status: historical.suggestedServicePrice == null ? "unavailable" : "ready",
      pricingModelVersion: historical.pricingModelVersion,
      foodCost: historical.foodCost,
      currentFoodCostSource: historical.snapshotKind === "updated" ? "updated_snapshot" : "initial_snapshot",
      extraStaffCount: historical.extraStaffCount,
      extraStaffUnitCost: historical.extraStaffUnitCost,
      extraLaborCost: historical.extraStaffCost,
      serviceCostBasis: historical.serviceCostBasis,
      targetMarginPct: historical.targetMarginPct,
      suggestedProfit: historical.suggestedProfit,
      suggestedServicePrice: historical.suggestedServicePrice,
      suggestedPricePerGuest: historical.suggestedServicePrice != null && historical.plannedGuestCount != null && historical.plannedGuestCount > 0
        ? historical.suggestedServicePrice / historical.plannedGuestCount
        : null,
      currency: "MXN",
      warnings: [],
    };
  }

  return {
    source: "legacy_unavailable",
    status: "unavailable",
    pricingModelVersion: null,
    foodCost: null,
    currentFoodCostSource: "unavailable",
    extraStaffCount: null,
    extraStaffUnitCost: null,
    extraLaborCost: null,
    serviceCostBasis: null,
    targetMarginPct: null,
    suggestedProfit: null,
    suggestedServicePrice: null,
    suggestedPricePerGuest: null,
    currency: "MXN",
    warnings: [],
  };
}

function isMaterialVariance(value: number, reference: number): boolean {
  const absoluteValue = Math.abs(value);
  const threshold = Math.max(100, Math.abs(reference) * 0.05);
  return absoluteValue > threshold;
}

function ceilToMultiple(value: number, multiple: number): number {
  if (multiple <= 0) return value;
  return Math.ceil(value / multiple) * multiple;
}

export async function listEventsForCatering(tenantSlug: string): Promise<CateringEventLite[]> {
  const tenant = await resolveTenantModulePageContext(tenantSlug, "event_catering", "overview", "read");
  const events = await getEvents(tenant.tenantId, { limit: 200 });
  return events;
}

export async function getEventForCatering(
  tenantSlug: string,
  eventId: string,
): Promise<CateringEventLite | null> {
  const tenant = await resolveTenantModulePageContext(tenantSlug, "event_catering", "plans", "read");
  const supabase = await getSupabaseServerClient();
  const { data, error } = await supabase
    .from("events")
    .select("id,name,status,starts_at,ends_at,expected_attendance")
    .eq("tenant_id", tenant.tenantId)
    .eq("id", eventId)
    .maybeSingle();
  if (error) throw new Error(`No fue posible cargar evento de catering: ${error.message}`);
  return (data as CateringEventLite | null) ?? null;
}

export async function listCateringPlans(tenantSlug: string, eventId?: string): Promise<EventCateringPlan[]> {
  const tenant = await resolveTenantModulePageContext(tenantSlug, "event_catering", "plans", "read");
  const supabase = await getSupabaseServerClient();
  let query = supabase
    .from("event_catering_plans")
    .select("id, tenant_id, event_id, name, status, planned_guest_count, estimated_total_cost, notes, created_at, updated_at")
    .eq("tenant_id", tenant.tenantId)
    .order("created_at", { ascending: false });
  if (eventId) query = query.eq("event_id", eventId);
  const { data, error } = await query;
  if (error) throw new Error(`No fue posible listar planes de catering: ${error.message}`);
  return (data ?? []) as EventCateringPlan[];
}

export async function getCateringPlan(tenantSlug: string, planId: string): Promise<EventCateringPlan | null> {
  const tenant = await resolveTenantModulePageContext(tenantSlug, "event_catering", "plans", "read");
  const supabase = await getSupabaseServerClient();
  const { data, error } = await supabase
    .from("event_catering_plans")
    .select("id, tenant_id, event_id, name, status, planned_guest_count, estimated_total_cost, notes, created_at, updated_at")
    .eq("tenant_id", tenant.tenantId)
    .eq("id", planId)
    .maybeSingle();
  if (error) throw new Error(`No fue posible cargar plan de catering: ${error.message}`);
  return (data as EventCateringPlan | null) ?? null;
}

export async function listPlanRecipes(tenantSlug: string, planId: string): Promise<EventCateringPlanRecipe[]> {
  const tenant = await resolveTenantModulePageContext(tenantSlug, "event_catering", "plans", "read");
  const supabase = await getSupabaseServerClient();
  const { data, error } = await supabase
    .from("event_catering_plan_recipes")
    .select(
      "id, tenant_id, plan_id, recipe_id, recipe_version_id, snapshot_id, planned_servings, multiplier, estimated_cost, notes, sort_order, created_at, updated_at, kitchen_recipe_recipes:kitchen_recipe_recipes!event_catering_plan_recipes_tenant_recipe_fkey(id,name,category,status)",
    )
    .eq("tenant_id", tenant.tenantId)
    .eq("plan_id", planId)
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true });
  if (error) throw new Error(`No fue posible listar recetas del plan: ${error.message}`);
  return ((data ?? []) as Array<Record<string, unknown>>).map((row) => ({
    ...(row as unknown as EventCateringPlanRecipe),
    kitchen_recipe_recipes: Array.isArray(row.kitchen_recipe_recipes)
      ? ((row.kitchen_recipe_recipes[0] ?? null) as EventCateringPlanRecipe["kitchen_recipe_recipes"])
      : ((row.kitchen_recipe_recipes ?? null) as EventCateringPlanRecipe["kitchen_recipe_recipes"]),
  }));
}

export async function listReadyRecipesForCatering(tenantSlug: string): Promise<ReadyRecipeForCatering[]> {
  const tenant = await resolveTenantModulePageContext(tenantSlug, "event_catering", "plans", "read");
  const supabase = await getSupabaseServerClient();
  const readiness = await listKitchenRecipeReadiness(tenant.tenantId);
  const ready = readiness.filter((recipe) => recipe.readiness_status === "ready" && !/^test\b/i.test(recipe.recipe_name));
  if (ready.length === 0) return [];

  const recipeIds = ready.map((recipe) => recipe.recipe_id);
  const [{ data: versions, error: versionsError }, { data: snapshots, error: snapshotsError }] = await Promise.all([
    supabase
      .from("kitchen_recipe_versions")
      .select("id, recipe_id, status")
      .eq("tenant_id", tenant.tenantId)
      .in("recipe_id", recipeIds)
      .eq("status", "active"),
    supabase
      .from("kitchen_recipe_cost_snapshots")
      .select("id, recipe_id, total_cost, warnings, created_at, snapshot_type")
      .eq("tenant_id", tenant.tenantId)
      .in("recipe_id", recipeIds)
      .eq("snapshot_type", "current"),
  ]);
  if (versionsError) throw new Error(`No fue posible cargar versiones activas: ${versionsError.message}`);
  if (snapshotsError) throw new Error(`No fue posible cargar snapshots de recetas: ${snapshotsError.message}`);

  const activeVersionByRecipe = new Map((versions ?? []).map((version) => [version.recipe_id, version.id]));
  const latestSnapshotByRecipe = new Map<string, { id: string; total_cost: number; created_at: string }>();
  for (const snapshot of snapshots ?? []) {
    const current = latestSnapshotByRecipe.get(snapshot.recipe_id);
    if (!current || new Date(snapshot.created_at).getTime() > new Date(current.created_at).getTime()) {
      latestSnapshotByRecipe.set(snapshot.recipe_id, {
        id: snapshot.id,
        total_cost: Number(snapshot.total_cost ?? 0),
        created_at: snapshot.created_at,
      });
    }
  }

  return ready
    .filter((recipe) => activeVersionByRecipe.has(recipe.recipe_id))
    .map((recipe) => {
      const snapshot = latestSnapshotByRecipe.get(recipe.recipe_id);
      return {
        ...recipe,
        recipe_version_id: activeVersionByRecipe.get(recipe.recipe_id) as string,
        snapshot_id: snapshot?.id ?? null,
        snapshot_total_cost: snapshot?.total_cost ?? 0,
      };
    });
}

export async function listCateringRequirements(tenantSlug: string, planId: string): Promise<EventCateringRequirement[]> {
  const tenant = await resolveTenantModulePageContext(tenantSlug, "event_catering", "requirements", "read");
  const supabase = await getSupabaseServerClient();
  const { data, error } = await supabase
    .from("event_catering_requirements")
    .select(
      "id, tenant_id, plan_id, plan_recipe_id, item_id, unit_id, required_quantity, available_quantity, shortage_quantity, estimated_unit_cost, estimated_total_cost, source_payload, created_at, updated_at, kitchen_inventory_items:kitchen_inventory_items!event_catering_requirements_tenant_item_fkey(id,name), kitchen_inventory_units:kitchen_inventory_units!event_catering_requirements_tenant_unit_fkey(id,code,name)",
    )
    .eq("tenant_id", tenant.tenantId)
    .eq("plan_id", planId)
    .order("shortage_quantity", { ascending: false })
    .order("estimated_total_cost", { ascending: false });
  if (error) throw new Error(`No fue posible listar requerimientos del plan: ${error.message}`);
  return ((data ?? []) as Array<Record<string, unknown>>).map((row) => ({
    ...(row as unknown as EventCateringRequirement),
    kitchen_inventory_items: Array.isArray(row.kitchen_inventory_items)
      ? ((row.kitchen_inventory_items[0] ?? null) as EventCateringRequirement["kitchen_inventory_items"])
      : ((row.kitchen_inventory_items ?? null) as EventCateringRequirement["kitchen_inventory_items"]),
    kitchen_inventory_units: Array.isArray(row.kitchen_inventory_units)
      ? ((row.kitchen_inventory_units[0] ?? null) as EventCateringRequirement["kitchen_inventory_units"])
      : ((row.kitchen_inventory_units ?? null) as EventCateringRequirement["kitchen_inventory_units"]),
  }));
}

export async function listRequirementShortages(tenantSlug: string, planId: string): Promise<EventCateringRequirement[]> {
  const all = await listCateringRequirements(tenantSlug, planId);
  return listRequirementShortagesFromRequirements(all);
}

export function listRequirementShortagesFromRequirements(
  requirements: EventCateringRequirement[],
): EventCateringRequirement[] {
  return requirements.filter((row) => Number(row.shortage_quantity) > 0);
}

export function summarizeCateringRequirements(requirements: EventCateringRequirement[]) {
  const totalEstimatedCost = requirements.reduce((acc, row) => acc + Number(row.estimated_total_cost ?? 0), 0);
  const totalRequiredLines = requirements.length;
  const shortageCount = requirements.filter((row) => Number(row.shortage_quantity) > 0).length;
  const totalShortageCost = requirements
    .filter((row) => Number(row.shortage_quantity) > 0)
    .reduce((acc, row) => acc + Number(row.shortage_quantity) * Number(row.estimated_unit_cost ?? 0), 0);

  return {
    totalEstimatedCost,
    totalRequiredLines,
    shortageCount,
    totalShortageCost,
  };
}

export async function getCateringPlanSummary(tenantSlug: string, planId: string) {
  const [plan, requirements] = await Promise.all([
    getCateringPlan(tenantSlug, planId),
    listCateringRequirements(tenantSlug, planId),
  ]);
  const summary = summarizeCateringRequirements(requirements);
  return {
    plan,
    ...summary,
  };
}

export async function getPlanDraftRequisition(tenantSlug: string, planId: string): Promise<EventCateringRequisition | null> {
  const tenant = await resolveTenantModulePageContext(tenantSlug, "event_catering", "requisitions", "read");
  const supabase = await getSupabaseServerClient();
  const { data, error } = await supabase
    .from("event_catering_requisitions")
    .select("id, tenant_id, plan_id, status, estimated_total_cost, notes, created_at, updated_at, created_by")
    .eq("tenant_id", tenant.tenantId)
    .eq("plan_id", planId)
    .eq("status", "draft")
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(`No fue posible cargar requisición draft del plan: ${error.message}`);
  return (data as EventCateringRequisition | null) ?? null;
}

export async function listCateringRequisitions(tenantSlug: string): Promise<EventCateringRequisition[]> {
  const tenant = await resolveTenantModulePageContext(tenantSlug, "event_catering", "requisitions", "read");
  const supabase = await getSupabaseServerClient();
  const { data, error } = await supabase
    .from("event_catering_requisitions")
    .select(
      "id, tenant_id, plan_id, status, estimated_total_cost, notes, created_at, updated_at, created_by, event_catering_plans:event_catering_plans!event_catering_requisitions_tenant_plan_fkey(id,event_id,name,events:events!event_catering_plans_tenant_event_fkey(id,name))",
    )
    .eq("tenant_id", tenant.tenantId)
    .order("updated_at", { ascending: false });
  if (error) throw new Error(`No fue posible listar requisiciones de catering: ${error.message}`);
  return ((data ?? []) as Array<Record<string, unknown>>).map((row) => ({
    ...(row as unknown as EventCateringRequisition),
    event_catering_plans: Array.isArray(row.event_catering_plans)
      ? ((row.event_catering_plans[0] ?? null) as EventCateringRequisition["event_catering_plans"])
      : ((row.event_catering_plans ?? null) as EventCateringRequisition["event_catering_plans"]),
  }));
}

export async function getCateringRequisition(tenantSlug: string, requisitionId: string): Promise<EventCateringRequisition | null> {
  const tenant = await resolveTenantModulePageContext(tenantSlug, "event_catering", "requisitions", "read");
  const supabase = await getSupabaseServerClient();
  const { data, error } = await supabase
    .from("event_catering_requisitions")
    .select(
      "id, tenant_id, plan_id, status, estimated_total_cost, notes, created_at, updated_at, created_by, event_catering_plans:event_catering_plans!event_catering_requisitions_tenant_plan_fkey(id,event_id,name,events:events!event_catering_plans_tenant_event_fkey(id,name))",
    )
    .eq("tenant_id", tenant.tenantId)
    .eq("id", requisitionId)
    .maybeSingle();
  if (error) throw new Error(`No fue posible cargar requisición: ${error.message}`);
  if (!data) return null;
  const row = data as Record<string, unknown>;
  return {
    ...(row as unknown as EventCateringRequisition),
    event_catering_plans: Array.isArray(row.event_catering_plans)
      ? ((row.event_catering_plans[0] ?? null) as EventCateringRequisition["event_catering_plans"])
      : ((row.event_catering_plans ?? null) as EventCateringRequisition["event_catering_plans"]),
  };
}

export async function listCateringRequisitionLines(tenantSlug: string, requisitionId: string): Promise<EventCateringRequisitionLine[]> {
  const tenant = await resolveTenantModulePageContext(tenantSlug, "event_catering", "requisitions", "read");
  const supabase = await getSupabaseServerClient();
  const { data, error } = await supabase
    .from("event_catering_requisition_lines")
    .select(
      "id, tenant_id, requisition_id, item_id, unit_id, requested_quantity, purchase_option_id, purchase_unit_id, requested_purchase_quantity, expected_inventory_quantity, expected_surplus_quantity, purchase_warning, preliminary_unit_price, quoted_unit_price, approved_unit_price, preliminary_total_cost, quoted_total_cost, approved_total_cost, price_source, supplier_price_id, quoted_at, quoted_by, estimated_unit_cost, estimated_total_cost, supplier_id, notes, created_at, updated_at, kitchen_inventory_items:kitchen_inventory_items!event_catering_requisition_lines_tenant_item_fkey(id,name), kitchen_inventory_units:kitchen_inventory_units!event_catering_requisition_lines_tenant_unit_fkey(id,code,name), purchase_units:kitchen_inventory_units!event_catering_requisition_lines_tenant_purchase_unit_fkey(id,code,name), kitchen_inventory_suppliers:kitchen_inventory_suppliers!event_catering_requisition_lines_tenant_supplier_fkey(id,name)",
    )
    .eq("tenant_id", tenant.tenantId)
    .eq("requisition_id", requisitionId)
    .order("supplier_id", { ascending: true, nullsFirst: false })
    .order("created_at", { ascending: true })
    .order("id", { ascending: true });
  if (error) throw new Error(`No fue posible listar líneas de requisición: ${error.message}`);
  return ((data ?? []) as Array<Record<string, unknown>>).map((row) => ({
    ...(row as unknown as EventCateringRequisitionLine),
    kitchen_inventory_items: Array.isArray(row.kitchen_inventory_items)
      ? ((row.kitchen_inventory_items[0] ?? null) as EventCateringRequisitionLine["kitchen_inventory_items"])
      : ((row.kitchen_inventory_items ?? null) as EventCateringRequisitionLine["kitchen_inventory_items"]),
    kitchen_inventory_units: Array.isArray(row.kitchen_inventory_units)
      ? ((row.kitchen_inventory_units[0] ?? null) as EventCateringRequisitionLine["kitchen_inventory_units"])
      : ((row.kitchen_inventory_units ?? null) as EventCateringRequisitionLine["kitchen_inventory_units"]),
    purchase_units: Array.isArray(row.purchase_units)
      ? ((row.purchase_units[0] ?? null) as EventCateringRequisitionLine["purchase_units"])
      : ((row.purchase_units ?? null) as EventCateringRequisitionLine["purchase_units"]),
    kitchen_inventory_suppliers: Array.isArray(row.kitchen_inventory_suppliers)
      ? ((row.kitchen_inventory_suppliers[0] ?? null) as EventCateringRequisitionLine["kitchen_inventory_suppliers"])
      : ((row.kitchen_inventory_suppliers ?? null) as EventCateringRequisitionLine["kitchen_inventory_suppliers"]),
    procurement_status: classifyRequisitionLineProcurement(row as unknown as EventCateringRequisitionLine),
    financial_total: resolveRequisitionLineFinancialTotal(row as unknown as EventCateringRequisitionLine),
  }));
}

export async function listCateringRequisitionLineCountsByRequisitionIds(
  tenantSlug: string,
  requisitionIds: string[],
): Promise<Map<string, number>> {
  const counts = new Map<string, number>();
  for (const requisitionId of requisitionIds) counts.set(requisitionId, 0);
  if (requisitionIds.length === 0) return counts;

  const tenant = await resolveTenantModulePageContext(tenantSlug, "event_catering", "requisitions", "read");
  const supabase = await getSupabaseServerClient();
  const { data, error } = await supabase
    .from("event_catering_requisition_lines")
    .select("requisition_id")
    .eq("tenant_id", tenant.tenantId)
    .in("requisition_id", requisitionIds);
  if (error) throw new Error(`No fue posible contar líneas de requisición: ${error.message}`);

  for (const row of data ?? []) {
    counts.set(row.requisition_id, (counts.get(row.requisition_id) ?? 0) + 1);
  }
  return counts;
}

export async function listPurchaseOptionsForRequisitionLine(
  tenantSlug: string,
  requisitionLineId: string,
): Promise<RequisitionLinePurchaseOptionAlternative[]> {
  const tenant = await resolveTenantModulePageContext(tenantSlug, "event_catering", "requisitions", "read");
  const supabase = await getSupabaseServerClient();

  const { data: line, error: lineError } = await supabase
    .from("event_catering_requisition_lines")
    .select("id,item_id,requested_quantity,purchase_option_id,estimated_unit_cost")
    .eq("tenant_id", tenant.tenantId)
    .eq("id", requisitionLineId)
    .maybeSingle();
  if (lineError || !line) throw new Error("Línea de requisición inválida para el tenant.");

  const { data: options, error: optionsError } = await supabase
    .from("kitchen_inventory_purchase_options")
    .select(
      "id,supplier_id,purchase_unit_id,quantity_per_purchase_unit,min_purchase_quantity,purchase_multiple,is_default,is_active,purchase_unit:kitchen_inventory_units!kitchen_inventory_purchase_options_tenant_purchase_unit_fkey(id,code,name),kitchen_inventory_suppliers:kitchen_inventory_suppliers!kitchen_inventory_purchase_options_tenant_supplier_fkey(id,name)",
    )
    .eq("tenant_id", tenant.tenantId)
    .eq("item_id", line.item_id)
    .eq("is_active", true)
    .order("is_default", { ascending: false })
    .order("created_at", { ascending: true });
  if (optionsError) throw new Error(`No fue posible listar opciones de compra para línea: ${optionsError.message}`);

  const optionIds = (options ?? []).map((row) => row.id);
  const { data: prices, error: pricesError } = await supabase
    .from("kitchen_inventory_supplier_prices")
    .select("id,purchase_option_id,price_per_purchase_unit,is_current")
    .eq("tenant_id", tenant.tenantId)
    .eq("item_id", line.item_id)
    .eq("is_current", true)
    .in("purchase_option_id", optionIds);
  if (pricesError) throw new Error(`No fue posible cargar precios actuales de opciones: ${pricesError.message}`);

  const currentPriceByOptionId = new Map(
    (prices ?? [])
      .filter((row) => row.purchase_option_id != null)
      .map((row) => [row.purchase_option_id as string, Number(row.price_per_purchase_unit ?? 0)]),
  );

  const requested = Number(line.requested_quantity ?? 0);
  const estimatedUnitCost = Number(line.estimated_unit_cost ?? 0);

  return ((options ?? []) as Array<Record<string, unknown>>).map((row) => {
    const quantityPerPurchaseUnit = Number(row.quantity_per_purchase_unit ?? 0);
    const minPurchaseQuantity = Number(row.min_purchase_quantity ?? 1);
    const purchaseMultiple = Number(row.purchase_multiple ?? 1);
    let calculatedPurchaseQuantity: number | null = null;
    let expectedInventoryQuantity: number | null = null;
    let expectedSurplusQuantity: number | null = null;

    if (quantityPerPurchaseUnit > 0 && requested > 0) {
      const rawPurchaseQty = requested / quantityPerPurchaseUnit;
      const roundedPurchaseQty = Math.max(ceilToMultiple(rawPurchaseQty, purchaseMultiple), minPurchaseQuantity);
      calculatedPurchaseQuantity = round4(roundedPurchaseQty);
      expectedInventoryQuantity = round4(roundedPurchaseQty * quantityPerPurchaseUnit);
      expectedSurplusQuantity = round4(Math.max(expectedInventoryQuantity - requested, 0));
    }

    const currentSupplierPrice = currentPriceByOptionId.get(String(row.id)) ?? null;
    const priceForEstimation = currentSupplierPrice ?? estimatedUnitCost;
    const estimatedTotalCost =
      calculatedPurchaseQuantity != null ? round4(calculatedPurchaseQuantity * Number(priceForEstimation ?? 0)) : null;

    return {
      purchase_option_id: String(row.id),
      supplier_id: (row.supplier_id as string | null) ?? null,
      supplier_name:
        (Array.isArray(row.kitchen_inventory_suppliers)
          ? row.kitchen_inventory_suppliers[0]?.name
          : (row.kitchen_inventory_suppliers as { name?: string } | null)?.name) ?? "Sin proveedor",
      purchase_unit: (Array.isArray(row.purchase_unit) ? row.purchase_unit[0] : row.purchase_unit) ?? null,
      quantity_per_purchase_unit: quantityPerPurchaseUnit,
      current_supplier_price: currentSupplierPrice,
      calculated_purchase_quantity: calculatedPurchaseQuantity,
      expected_inventory_quantity: expectedInventoryQuantity,
      expected_surplus_quantity: expectedSurplusQuantity,
      estimated_total_cost: estimatedTotalCost,
      is_default: Boolean(row.is_default),
      is_current_selection: String(row.id) === String(line.purchase_option_id ?? ""),
    } satisfies RequisitionLinePurchaseOptionAlternative;
  });
}

export async function getCateringRequisitionSupplierSummary(
  tenantSlug: string,
  requisitionId: string,
): Promise<CateringRequisitionSupplierSummary[]> {
  const lines = await listCateringRequisitionLines(tenantSlug, requisitionId);
  const grouped = new Map<string, CateringRequisitionSupplierSummary>();
  for (const line of lines) {
    const key = line.supplier_id ?? "__no_supplier__";
    const supplierName = line.kitchen_inventory_suppliers?.name ?? "Sin proveedor asignado";
    const current = grouped.get(key) ?? {
      supplier_id: line.supplier_id,
      supplier_name: supplierName,
      line_count: 0,
      preliminary_total: 0,
      quoted_total: 0,
      approved_total: 0,
      receivable_line_count: 0,
      operational_zero_cost_line_count: 0,
      lines_without_quote: 0,
      lines_without_purchase_option: 0,
      lines_without_supplier: 0,
      lines_missing_price: 0,
      status_summary: "mixed",
    };
    current.line_count += 1;
    current.preliminary_total += Number(line.preliminary_total_cost ?? line.estimated_total_cost ?? 0);
    current.quoted_total += Number(
      line.quoted_total_cost ?? line.preliminary_total_cost ?? line.estimated_total_cost ?? 0,
    );
    current.approved_total += Number(
      line.approved_total_cost ?? line.quoted_total_cost ?? line.preliminary_total_cost ?? line.estimated_total_cost ?? 0,
    );
    if (line.quoted_unit_price == null) current.lines_without_quote += 1;
    if (line.purchase_option_id == null) current.lines_without_purchase_option += 1;
    if (line.supplier_id == null) current.lines_without_supplier += 1;
    if (line.procurement_status === "receivable_with_price") current.receivable_line_count += 1;
    if (line.procurement_status === "operational_zero_cost_non_receivable") current.operational_zero_cost_line_count += 1;
    if (line.procurement_status === "missing_price" || line.procurement_status === "review_needed") current.lines_missing_price += 1;
    grouped.set(key, current);
  }

  return Array.from(grouped.values()).map((row) => {
    let statusSummary: CateringRequisitionSupplierSummary["status_summary"] = "mixed";
    if (row.lines_without_supplier > 0) statusSummary = "missing_supplier";
    else if (row.lines_without_purchase_option > 0) statusSummary = "missing_purchase_option";
    else if (row.lines_missing_price > 0) statusSummary = "missing_price";
    else if (row.operational_zero_cost_line_count === row.line_count) statusSummary = "operational_zero_cost";
    else if (row.approved_total > 0) statusSummary = "approved";
    else if (row.quoted_total > 0 && row.lines_without_quote < row.line_count) statusSummary = "quoted";
    else if (row.preliminary_total > 0) statusSummary = "preliminary";
    return {
      ...row,
      preliminary_total: Number(row.preliminary_total.toFixed(4)),
      quoted_total: Number(row.quoted_total.toFixed(4)),
      approved_total: Number(row.approved_total.toFixed(4)),
      status_summary: statusSummary,
    };
  });
}

export async function listPurchaseReceiptsForRequisition(
  tenantSlug: string,
  requisitionId: string,
): Promise<EventCateringPurchaseReceipt[]> {
  const tenant = await resolveTenantModulePageContext(tenantSlug, "event_catering", "requisitions", "read");
  const supabase = await getSupabaseServerClient();
  const { data, error } = await supabase
    .from("event_catering_purchase_receipts")
    .select(
      "id,tenant_id,requisition_id,supplier_id,status,received_at,invoice_ref,supplier_document_ref,total_received_cost,notes,created_at,updated_at,created_by,received_by,kitchen_inventory_suppliers:kitchen_inventory_suppliers!event_catering_purchase_receipts_tenant_supplier_fkey(id,name),event_catering_requisitions:event_catering_requisitions!event_catering_purchase_receipts_tenant_requisition_fkey(id,plan_id,event_catering_plans:event_catering_plans!event_catering_requisitions_tenant_plan_fkey(id,name,event_id,events:events!event_catering_plans_tenant_event_fkey(id,name)))",
    )
    .eq("tenant_id", tenant.tenantId)
    .eq("requisition_id", requisitionId)
    .order("created_at", { ascending: false });
  if (error) throw new Error(`No fue posible listar recepciones: ${error.message}`);
  return ((data ?? []) as Array<Record<string, unknown>>).map((row) => ({
    ...(row as unknown as EventCateringPurchaseReceipt),
    kitchen_inventory_suppliers: Array.isArray(row.kitchen_inventory_suppliers)
      ? ((row.kitchen_inventory_suppliers[0] ?? null) as EventCateringPurchaseReceipt["kitchen_inventory_suppliers"])
      : ((row.kitchen_inventory_suppliers ?? null) as EventCateringPurchaseReceipt["kitchen_inventory_suppliers"]),
  }));
}

export async function getPurchaseReceipt(
  tenantSlug: string,
  receiptId: string,
): Promise<EventCateringPurchaseReceipt | null> {
  const tenant = await resolveTenantModulePageContext(tenantSlug, "event_catering", "requisitions", "read");
  const supabase = await getSupabaseServerClient();
  const { data, error } = await supabase
    .from("event_catering_purchase_receipts")
    .select(
      "id,tenant_id,requisition_id,supplier_id,status,received_at,invoice_ref,supplier_document_ref,total_received_cost,notes,created_at,updated_at,created_by,received_by,kitchen_inventory_suppliers:kitchen_inventory_suppliers!event_catering_purchase_receipts_tenant_supplier_fkey(id,name)",
    )
    .eq("tenant_id", tenant.tenantId)
    .eq("id", receiptId)
    .maybeSingle();
  if (error) throw new Error(`No fue posible cargar recepción: ${error.message}`);
  if (!data) return null;
  const row = data as Record<string, unknown>;
  return {
    ...(row as unknown as EventCateringPurchaseReceipt),
    kitchen_inventory_suppliers: Array.isArray(row.kitchen_inventory_suppliers)
      ? ((row.kitchen_inventory_suppliers[0] ?? null) as EventCateringPurchaseReceipt["kitchen_inventory_suppliers"])
      : ((row.kitchen_inventory_suppliers ?? null) as EventCateringPurchaseReceipt["kitchen_inventory_suppliers"]),
    event_catering_requisitions: Array.isArray(row.event_catering_requisitions)
      ? ((row.event_catering_requisitions[0] ?? null) as EventCateringPurchaseReceipt["event_catering_requisitions"])
      : ((row.event_catering_requisitions ?? null) as EventCateringPurchaseReceipt["event_catering_requisitions"]),
  };
}

export async function listPurchaseReceiptLines(
  tenantSlug: string,
  receiptId: string,
): Promise<EventCateringPurchaseReceiptLine[]> {
  const tenant = await resolveTenantModulePageContext(tenantSlug, "event_catering", "requisitions", "read");
  const supabase = await getSupabaseServerClient();
  const { data, error } = await supabase
    .from("event_catering_purchase_receipt_lines")
    .select(
      "id,tenant_id,receipt_id,requisition_line_id,item_id,location_id,unit_id,received_quantity,received_unit_cost,received_total_cost,purchase_unit_id,received_purchase_quantity,expected_inventory_quantity,variance_quantity,inventory_movement_id,notes,created_at,created_by,kitchen_inventory_items:kitchen_inventory_items!event_catering_purchase_receipt_lines_tenant_item_fkey(id,name),kitchen_inventory_locations:kitchen_inventory_locations!event_catering_purchase_receipt_lines_tenant_location_fkey(id,name),kitchen_inventory_units:kitchen_inventory_units!event_catering_purchase_receipt_lines_tenant_unit_fkey(id,code,name)",
    )
    .eq("tenant_id", tenant.tenantId)
    .eq("receipt_id", receiptId)
    .order("created_at", { ascending: true });
  if (error) throw new Error(`No fue posible listar líneas de recepción: ${error.message}`);
  const rows = (data ?? []) as Array<Record<string, unknown>>;
  const requisitionLineIds = [
    ...new Set(rows.map((row) => String(row.requisition_line_id ?? "")).filter(Boolean)),
  ];
  const requisitionLineById = new Map<string, EventCateringPurchaseReceiptLine["event_catering_requisition_lines"]>();
  if (requisitionLineIds.length > 0) {
    const { data: requisitionLines, error: requisitionLinesError } = await supabase
      .from("event_catering_requisition_lines")
      .select(
        "id,requested_quantity,requested_purchase_quantity,expected_inventory_quantity,approved_unit_price,approved_total_cost,quoted_unit_price,quoted_total_cost,preliminary_unit_price,preliminary_total_cost,estimated_unit_cost,estimated_total_cost,purchase_unit_id,purchase_units:kitchen_inventory_units!event_catering_requisition_lines_tenant_purchase_unit_fkey(id,code,name)",
      )
      .eq("tenant_id", tenant.tenantId)
      .in("id", requisitionLineIds);
    if (requisitionLinesError) {
      throw new Error(`No fue posible cargar líneas de requisición para recepción: ${requisitionLinesError.message}`);
    }
    for (const line of (requisitionLines ?? []) as Array<Record<string, unknown>>) {
      requisitionLineById.set(String(line.id), {
        ...(line as unknown as NonNullable<EventCateringPurchaseReceiptLine["event_catering_requisition_lines"]>),
        purchase_units: Array.isArray(line.purchase_units)
          ? ((line.purchase_units[0] ?? null) as NonNullable<EventCateringPurchaseReceiptLine["event_catering_requisition_lines"]>["purchase_units"])
          : ((line.purchase_units ?? null) as NonNullable<EventCateringPurchaseReceiptLine["event_catering_requisition_lines"]>["purchase_units"]),
      });
    }
  }

  return rows.map((row) => ({
    ...(row as unknown as EventCateringPurchaseReceiptLine),
    kitchen_inventory_items: Array.isArray(row.kitchen_inventory_items)
      ? ((row.kitchen_inventory_items[0] ?? null) as EventCateringPurchaseReceiptLine["kitchen_inventory_items"])
      : ((row.kitchen_inventory_items ?? null) as EventCateringPurchaseReceiptLine["kitchen_inventory_items"]),
    kitchen_inventory_locations: Array.isArray(row.kitchen_inventory_locations)
      ? ((row.kitchen_inventory_locations[0] ?? null) as EventCateringPurchaseReceiptLine["kitchen_inventory_locations"])
      : ((row.kitchen_inventory_locations ?? null) as EventCateringPurchaseReceiptLine["kitchen_inventory_locations"]),
    kitchen_inventory_units: Array.isArray(row.kitchen_inventory_units)
      ? ((row.kitchen_inventory_units[0] ?? null) as EventCateringPurchaseReceiptLine["kitchen_inventory_units"])
      : ((row.kitchen_inventory_units ?? null) as EventCateringPurchaseReceiptLine["kitchen_inventory_units"]),
    event_catering_requisition_lines: requisitionLineById.get(String(row.requisition_line_id)) ?? null,
  }));
}

export async function getReceivableRequisitionLines(
  tenantSlug: string,
  requisitionId: string,
): Promise<EventCateringRequisitionLine[]> {
  const lines = await listCateringRequisitionLines(tenantSlug, requisitionId);
  return lines.filter((line) => Number(line.requested_quantity ?? 0) > 0);
}

export async function getCateringOverviewSummary(tenantSlug: string): Promise<CateringOverviewSummary> {
  const tenant = await resolveTenantModulePageContext(tenantSlug, "event_catering", "overview", "read");
  const accessMap = await getCurrentTenantModulePageAccessMap(tenant.tenantId, "event_catering");
  const canReadPlans = hasModulePageAccess(accessMap.plans ?? "none", "read");
  const canReadRequirements = hasModulePageAccess(accessMap.requirements ?? "none", "read");
  const canReadRequisitions = hasModulePageAccess(accessMap.requisitions ?? "none", "read");
  const supabase = await getSupabaseServerClient();

  const summary: CateringOverviewSummary = {
    total_plans: 0,
    plans_by_status: { draft: 0, planned: 0, approved: 0, canceled: 0 },
    total_estimated_catering_cost: 0,
    total_requirements: 0,
    total_shortages: 0,
    total_shortage_estimated_cost: 0,
    active_services_count: 0,
    services_with_shortages_count: 0,
    services_ready_for_requisition_count: 0,
    services_ready_for_consumption_count: 0,
    requisitions_by_status: { draft: 0, reviewed: 0, approved: 0, canceled: 0 },
    approved_requisition_total: 0,
    draft_requisition_total: 0,
  };

  if (canReadPlans) {
    const { data: plans, error } = await supabase
      .from("event_catering_plans")
      .select("status,estimated_total_cost")
      .eq("tenant_id", tenant.tenantId);
    if (error) throw new Error(`No fue posible resumir planes de catering: ${error.message}`);
    summary.total_plans = (plans ?? []).length;
    for (const plan of plans ?? []) {
      if (plan.status in summary.plans_by_status) {
        summary.plans_by_status[plan.status as keyof typeof summary.plans_by_status] += 1;
      }
      summary.total_estimated_catering_cost += Number(plan.estimated_total_cost ?? 0);
    }
  }

  if (canReadRequirements) {
    const { data: requirements, error } = await supabase
      .from("event_catering_requirements")
      .select("shortage_quantity,estimated_unit_cost")
      .eq("tenant_id", tenant.tenantId);
    if (error) throw new Error(`No fue posible resumir requerimientos de catering: ${error.message}`);
    summary.total_requirements = (requirements ?? []).length;
    for (const row of requirements ?? []) {
      const shortage = Number(row.shortage_quantity ?? 0);
      if (shortage > 0) {
        summary.total_shortages += 1;
        summary.total_shortage_estimated_cost += shortage * Number(row.estimated_unit_cost ?? 0);
      }
    }
  }

  if (canReadRequisitions) {
    const { data: requisitions, error } = await supabase
      .from("event_catering_requisitions")
      .select("status,estimated_total_cost")
      .eq("tenant_id", tenant.tenantId);
    if (error) throw new Error(`No fue posible resumir requisiciones de catering: ${error.message}`);
    for (const req of requisitions ?? []) {
      if (req.status in summary.requisitions_by_status) {
        summary.requisitions_by_status[req.status as keyof typeof summary.requisitions_by_status] += 1;
      }
      const total = Number(req.estimated_total_cost ?? 0);
      if (req.status === "approved") summary.approved_requisition_total += total;
      if (req.status === "draft") summary.draft_requisition_total += total;
    }
  }

  if (canReadPlans) {
    const operationalRows = await listCateringPlanOperationalIndex(tenantSlug);
    summary.active_services_count = operationalRows.filter((row) => row.plan_status === "draft" || row.plan_status === "planned").length;
    summary.services_with_shortages_count = operationalRows.filter((row) => row.shortage_count > 0).length;
    summary.services_ready_for_requisition_count = operationalRows.filter(
      (row) => row.requirements_count > 0 && row.shortage_count > 0 && row.latest_requisition_status == null,
    ).length;
    summary.services_ready_for_consumption_count = operationalRows.filter(
      (row) => row.operational_status === "Listo para consumo",
    ).length;
  }

  return summary;
}

export async function listCateringPlanSummaries(tenantSlug: string): Promise<CateringPlanSummary[]> {
  const tenant = await resolveTenantModulePageContext(tenantSlug, "event_catering", "plans", "read");
  const supabase = await getSupabaseServerClient();
  const [plans, events, planRecipes, requirements, requisitions] = await Promise.all([
    supabase
      .from("event_catering_plans")
      .select("id,event_id,name,status,planned_guest_count,estimated_total_cost")
      .eq("tenant_id", tenant.tenantId)
      .order("updated_at", { ascending: false }),
    supabase
      .from("events")
      .select("id,name,starts_at")
      .eq("tenant_id", tenant.tenantId),
    supabase
      .from("event_catering_plan_recipes")
      .select("plan_id")
      .eq("tenant_id", tenant.tenantId),
    supabase
      .from("event_catering_requirements")
      .select("plan_id,shortage_quantity")
      .eq("tenant_id", tenant.tenantId),
    supabase
      .from("event_catering_requisitions")
      .select("id,plan_id,status,estimated_total_cost,updated_at")
      .eq("tenant_id", tenant.tenantId)
      .order("updated_at", { ascending: false }),
  ]);
  if (plans.error) throw new Error(`No fue posible cargar planes: ${plans.error.message}`);
  if (events.error) throw new Error(`No fue posible cargar eventos: ${events.error.message}`);
  if (planRecipes.error) throw new Error(`No fue posible cargar recetas de planes: ${planRecipes.error.message}`);
  if (requirements.error) throw new Error(`No fue posible cargar requerimientos de planes: ${requirements.error.message}`);
  if (requisitions.error) throw new Error(`No fue posible cargar requisiciones de planes: ${requisitions.error.message}`);

  const eventMap = new Map((events.data ?? []).map((row) => [row.id, row]));
  const recipeCountByPlan = new Map<string, number>();
  for (const row of planRecipes.data ?? []) {
    recipeCountByPlan.set(row.plan_id, (recipeCountByPlan.get(row.plan_id) ?? 0) + 1);
  }
  const reqStatsByPlan = new Map<string, { count: number; shortages: number }>();
  for (const row of requirements.data ?? []) {
    const current = reqStatsByPlan.get(row.plan_id) ?? { count: 0, shortages: 0 };
    current.count += 1;
    if (Number(row.shortage_quantity ?? 0) > 0) current.shortages += 1;
    reqStatsByPlan.set(row.plan_id, current);
  }
  const latestReqByPlan = new Map<string, { id: string; status: EventCateringRequisition["status"]; estimated_total_cost: number }>();
  for (const row of requisitions.data ?? []) {
    if (!latestReqByPlan.has(row.plan_id)) {
      latestReqByPlan.set(row.plan_id, {
        id: row.id,
        status: row.status as EventCateringRequisition["status"],
        estimated_total_cost: Number(row.estimated_total_cost ?? 0),
      });
    }
  }

  return (plans.data ?? []).map((plan) => {
    const event = eventMap.get(plan.event_id);
    const reqStats = reqStatsByPlan.get(plan.id) ?? { count: 0, shortages: 0 };
    const req = latestReqByPlan.get(plan.id);
    return {
      plan_id: plan.id,
      plan_name: plan.name,
      plan_status: plan.status as EventCateringPlan["status"],
      event_id: plan.event_id,
      event_name: event?.name ?? null,
      event_starts_at: event?.starts_at ?? null,
      planned_guest_count: plan.planned_guest_count != null ? Number(plan.planned_guest_count) : null,
      estimated_plan_cost: Number(plan.estimated_total_cost ?? 0),
      recipe_count: recipeCountByPlan.get(plan.id) ?? 0,
      requirements_count: reqStats.count,
      shortages_count: reqStats.shortages,
      requisition_status: req?.status ?? null,
      requisition_total: req?.estimated_total_cost ?? 0,
      requisition_id: req?.id ?? null,
    } satisfies CateringPlanSummary;
  });
}

export async function listCateringPlanOperationalIndex(
  tenantSlug: string,
): Promise<CateringPlanOperationalIndexRow[]> {
  const [planSummaries, receiptsOverview, consumptionOverview, requirements] = await Promise.all([
    listCateringPlanSummaries(tenantSlug),
    listPurchaseReceiptsOverview(tenantSlug),
    listEventConsumptionOverview(tenantSlug),
    (async () => {
      const tenant = await resolveTenantModulePageContext(tenantSlug, "event_catering", "requirements", "read");
      const supabase = await getSupabaseServerClient();
      const { data, error } = await supabase
        .from("event_catering_requirements")
        .select("plan_id,item_id,shortage_quantity,source_payload")
        .eq("tenant_id", tenant.tenantId);
      if (error) throw new Error(`No fue posible cargar requerimientos para índice operativo: ${error.message}`);
      return data ?? [];
    })(),
  ]);

  const receiptStatusesByPlan = new Map<string, Set<"draft" | "received" | "canceled">>();
  for (const row of receiptsOverview) {
    if (!row.plan_id) continue;
    const set = receiptStatusesByPlan.get(row.plan_id) ?? new Set<"draft" | "received" | "canceled">();
    set.add(row.status as "draft" | "received" | "canceled");
    receiptStatusesByPlan.set(row.plan_id, set);
  }

  const consumptionStatusesByPlan = new Map<string, Set<"draft" | "confirmed" | "canceled">>();
  for (const row of consumptionOverview) {
    const set = consumptionStatusesByPlan.get(row.plan_id) ?? new Set<"draft" | "confirmed" | "canceled">();
    set.add(row.status as "draft" | "confirmed" | "canceled");
    consumptionStatusesByPlan.set(row.plan_id, set);
  }

  const reqByPlan = new Map<string, { requirements: number; shortages: number; reservedThisPlanTotal: number }>();
  const requirementItemIdsByPlan = new Map<string, Set<string>>();
  for (const row of requirements) {
    const current = reqByPlan.get(row.plan_id) ?? { requirements: 0, shortages: 0, reservedThisPlanTotal: 0 };
    current.requirements += 1;
    if (Number(row.shortage_quantity ?? 0) > 0) current.shortages += 1;
    const reservedThisPlan = Number(
      ((row.source_payload as { availability_breakdown?: { reserved_this_plan?: number } } | null)?.availability_breakdown
        ?.reserved_this_plan ?? 0),
    );
    current.reservedThisPlanTotal += reservedThisPlan;
    reqByPlan.set(row.plan_id, current);
    const itemIds = requirementItemIdsByPlan.get(row.plan_id) ?? new Set<string>();
    if (typeof (row as { item_id?: string }).item_id === "string") {
      itemIds.add((row as { item_id: string }).item_id);
    }
    requirementItemIdsByPlan.set(row.plan_id, itemIds);
  }

  const allRequirementItemIds = [...new Set(Array.from(requirementItemIdsByPlan.values()).flatMap((itemIds) => [...itemIds]))];
  const pricedItemIds = new Set<string>();
  if (allRequirementItemIds.length > 0) {
    const tenant = await resolveTenantModulePageContext(tenantSlug, "event_catering", "plans", "read");
    const supabase = await getSupabaseServerClient();
    const { data: currentPrices, error: currentPricesError } = await supabase
      .from("kitchen_inventory_supplier_prices")
      .select("item_id")
      .eq("tenant_id", tenant.tenantId)
      .eq("is_current", true)
      .in("item_id", allRequirementItemIds);
    if (currentPricesError) throw new Error(`No fue posible cargar precios vigentes para índice operativo: ${currentPricesError.message}`);
    for (const row of currentPrices ?? []) {
      pricedItemIds.add(row.item_id);
    }
  }

  const statusFromSet = <T extends string>(set: Set<T> | undefined, draft: T, confirmed: T): "none" | "draft" | "received" | "confirmed" | "mixed" => {
    if (!set || set.size === 0) return "none";
    if (set.size > 1) return "mixed";
    const only = Array.from(set)[0];
    if (only === draft) return "draft";
    if (only === confirmed) return confirmed === ("received" as T) ? "received" : "confirmed";
    return "mixed";
  };

  return planSummaries.map((plan) => {
    const req = reqByPlan.get(plan.plan_id) ?? { requirements: plan.requirements_count, shortages: plan.shortages_count, reservedThisPlanTotal: 0 };
    const requirementItemIds = [...(requirementItemIdsByPlan.get(plan.plan_id) ?? new Set<string>())];
    const pricedItemsCount = requirementItemIds.filter((itemId) => pricedItemIds.has(itemId)).length;
    const missingItemsCount = Math.max(requirementItemIds.length - pricedItemsCount, 0);
    const receiptStatus = statusFromSet(receiptStatusesByPlan.get(plan.plan_id), "draft", "received");
    const consumptionStatus = statusFromSet(consumptionStatusesByPlan.get(plan.plan_id), "draft", "confirmed");
    const hasConfirmedConsumption = consumptionStatus === "confirmed" || consumptionStatus === "mixed";
    const hasDraftConsumption = consumptionStatus === "draft";
    const operationalStatus: CateringPlanOperationalIndexRow["operational_status"] =
      hasConfirmedConsumption
        ? "Servicio cerrado"
        : hasDraftConsumption
          ? "Consumo en borrador"
          : plan.recipe_count === 0
            ? "Sin recetas"
            : req.requirements === 0
              ? "Requerimientos pendientes"
              : req.shortages > 0
                ? "Con faltantes"
                : plan.requisition_status === "approved" && (receiptStatus === "none" || receiptStatus === "draft" || receiptStatus === "mixed")
                  ? "Compra por recibir"
                  : receiptStatus === "received"
                    ? "Listo para consumo"
                    : !plan.requisition_id
                      ? "Listo para consumo"
                      : "Requisición pendiente";

    const priceReviewStatus: CateringPlanOperationalIndexRow["price_review_status"] =
      req.requirements === 0
        ? "pending_requirements"
        : missingItemsCount > 0
          ? "missing_prices"
          : requirementItemIds.length > 0
            ? "priced"
            : "ready_to_review";

    const priceReviewLabel: CateringPlanOperationalIndexRow["price_review_label"] =
      priceReviewStatus === "pending_requirements"
        ? "Pendiente"
        : priceReviewStatus === "missing_prices"
          ? "Faltan precios"
          : priceReviewStatus === "priced"
            ? "Precios vigentes disponibles"
            : "Informativo";

    return {
      plan_id: plan.plan_id,
      plan_name: plan.plan_name,
      event_id: plan.event_id,
      event_name: plan.event_name,
      event_date: plan.event_starts_at,
      expected_attendance: null,
      planned_guest_count: plan.planned_guest_count,
      plan_status: plan.plan_status,
      recipes_count: plan.recipe_count,
      requirements_count: req.requirements,
      shortage_count: req.shortages,
      estimated_total_cost: Number(plan.estimated_plan_cost ?? 0),
      requisition_count: plan.requisition_id ? 1 : 0,
      latest_requisition_status: plan.requisition_status,
      receipt_status_summary: receiptStatus as CateringPlanOperationalIndexRow["receipt_status_summary"],
      consumption_status_summary: consumptionStatus as CateringPlanOperationalIndexRow["consumption_status_summary"],
      reserved_this_plan_total: Number(req.reservedThisPlanTotal.toFixed(4)),
      price_review_status: priceReviewStatus,
      price_review_label: priceReviewLabel,
      operational_status: operationalStatus,
    } satisfies CateringPlanOperationalIndexRow;
  });
}

export async function getCateringPlanPriceReviewSummary(
  tenantSlug: string,
  planId: string,
): Promise<CateringPlanPriceReviewSummary> {
  const tenant = await resolveTenantModulePageContext(tenantSlug, "event_catering", "plans", "read");
  const supabase = await getSupabaseServerClient();

  const { data: requirements, error: requirementsError } = await supabase
    .from("event_catering_requirements")
    .select(
      "item_id,kitchen_inventory_items:kitchen_inventory_items!event_catering_requirements_tenant_item_fkey(name),kitchen_inventory_units:kitchen_inventory_units!event_catering_requirements_tenant_unit_fkey(code),unit_id",
    )
    .eq("tenant_id", tenant.tenantId)
    .eq("plan_id", planId);

  if (requirementsError) {
    throw new Error(`No fue posible cargar requerimientos para revisión de precios: ${requirementsError.message}`);
  }

  const requirementRows = requirements ?? [];
  const itemMap = new Map<
    string,
    { item_id: string; item_name: string | null; unit_code: string | null }
  >();

  for (const row of requirementRows) {
    const item = Array.isArray(row.kitchen_inventory_items) ? row.kitchen_inventory_items[0] : row.kitchen_inventory_items;
    const unit = Array.isArray(row.kitchen_inventory_units) ? row.kitchen_inventory_units[0] : row.kitchen_inventory_units;
    itemMap.set(row.item_id, {
      item_id: row.item_id,
      item_name: (item as { name?: string } | null)?.name ?? null,
      unit_code: (unit as { code?: string } | null)?.code ?? null,
    });
  }

  const itemIds = [...itemMap.keys()];
  if (itemIds.length === 0) {
    return {
      required_items_count: 0,
      items_with_current_price_count: 0,
      items_without_current_price_count: 0,
      latest_valid_from: null,
      source_types: [],
      missing_price_items: [],
    };
  }

  const { data: currentPrices, error: currentPricesError } = await supabase
    .from("kitchen_inventory_supplier_prices")
    .select("item_id,valid_from,source_type")
    .eq("tenant_id", tenant.tenantId)
    .eq("is_current", true)
    .in("item_id", itemIds);

  if (currentPricesError) {
    throw new Error(`No fue posible cargar precios vigentes para revisión de precios: ${currentPricesError.message}`);
  }

  const pricedItemIds = new Set<string>();
  const sourceTypes = new Set<string>();
  let latestValidFrom: string | null = null;

  for (const row of currentPrices ?? []) {
    pricedItemIds.add(row.item_id);
    if (row.source_type) sourceTypes.add(row.source_type);
    if (row.valid_from && (!latestValidFrom || row.valid_from > latestValidFrom)) {
      latestValidFrom = row.valid_from;
    }
  }

  const missingPriceItems = itemIds
    .filter((itemId) => !pricedItemIds.has(itemId))
    .map((itemId) => itemMap.get(itemId)!)
    .sort((left, right) => (left.item_name ?? "").localeCompare(right.item_name ?? "", "es-MX"));

  return {
    required_items_count: itemIds.length,
    items_with_current_price_count: pricedItemIds.size,
    items_without_current_price_count: missingPriceItems.length,
    latest_valid_from: latestValidFrom,
    source_types: [...sourceTypes].sort(),
    missing_price_items: missingPriceItems,
  };
}

export async function listCateringRequisitionOperationalIndex(
  tenantSlug: string,
): Promise<CateringRequisitionOperationalIndexRow[]> {
  const tenant = await resolveTenantModulePageContext(tenantSlug, "event_catering", "requisitions", "read");
  const supabase = await getSupabaseServerClient();
  const requisitions = await listCateringRequisitions(tenantSlug);
  if (requisitions.length === 0) return [];

  const requisitionIds = requisitions.map((row) => row.id);
  const [{ data: lines, error: linesError }, { data: receipts, error: receiptsError }] = await Promise.all([
    supabase
      .from("event_catering_requisition_lines")
      .select("requisition_id,preliminary_total_cost,quoted_total_cost,approved_total_cost,estimated_total_cost,quoted_unit_price")
      .eq("tenant_id", tenant.tenantId)
      .in("requisition_id", requisitionIds),
    supabase
      .from("event_catering_purchase_receipts")
      .select("requisition_id,status")
      .eq("tenant_id", tenant.tenantId)
      .in("requisition_id", requisitionIds),
  ]);
  if (linesError) throw new Error(`No fue posible cargar líneas para índice operativo de requisiciones: ${linesError.message}`);
  if (receiptsError) throw new Error(`No fue posible cargar recepciones para índice operativo de requisiciones: ${receiptsError.message}`);

  const statsByReq = new Map<string, { preliminary: number; quoted: number; approved: number; estimated: number; pendingQuotes: number; lines: number }>();
  for (const line of lines ?? []) {
    const current = statsByReq.get(line.requisition_id) ?? { preliminary: 0, quoted: 0, approved: 0, estimated: 0, pendingQuotes: 0, lines: 0 };
    current.preliminary += Number(line.preliminary_total_cost ?? line.estimated_total_cost ?? 0);
    current.quoted += Number(line.quoted_total_cost ?? line.preliminary_total_cost ?? line.estimated_total_cost ?? 0);
    current.approved += Number(line.approved_total_cost ?? line.quoted_total_cost ?? line.preliminary_total_cost ?? line.estimated_total_cost ?? 0);
    current.estimated += Number(line.estimated_total_cost ?? 0);
    current.lines += 1;
    if (line.quoted_unit_price == null) current.pendingQuotes += 1;
    statsByReq.set(line.requisition_id, current);
  }

  const receiptStatusByReq = new Map<string, Set<string>>();
  for (const receipt of receipts ?? []) {
    const current = receiptStatusByReq.get(receipt.requisition_id) ?? new Set<string>();
    current.add(receipt.status);
    receiptStatusByReq.set(receipt.requisition_id, current);
  }

  return requisitions.map((req) => {
    const stats = statsByReq.get(req.id) ?? { preliminary: 0, quoted: 0, approved: 0, estimated: 0, pendingQuotes: 0, lines: 0 };
    const statuses = receiptStatusByReq.get(req.id);
    let receiptSummary: CateringRequisitionOperationalIndexRow["receipt_status_summary"] = "sin recepción";
    if (statuses && statuses.size > 0) {
      if (statuses.has("received")) receiptSummary = "recibida";
      else if (statuses.has("draft")) receiptSummary = "borrador";
      else receiptSummary = "cancelada/historial";
    }
    return {
      requisition_id: req.id,
      event_id: req.event_catering_plans?.event_id ?? null,
      event_name: req.event_catering_plans?.events?.name ?? null,
      event_date: null,
      plan_id: req.plan_id,
      plan_name: req.event_catering_plans?.name ?? null,
      status: req.status,
      preliminary_total: Number(stats.preliminary.toFixed(4)),
      quoted_total: Number(stats.quoted.toFixed(4)),
      approved_total: Number(stats.approved.toFixed(4)),
      estimated_total: Number(stats.estimated.toFixed(4)),
      pending_quote_lines: stats.pendingQuotes,
      line_count: stats.lines,
      receipt_status_summary: receiptSummary,
    } satisfies CateringRequisitionOperationalIndexRow;
  });
}

export async function listCateringShortageSummary(tenantSlug: string): Promise<CateringShortageSummaryRow[]> {
  const tenant = await resolveTenantModulePageContext(tenantSlug, "event_catering", "requirements", "read");
  const supabase = await getSupabaseServerClient();
  const { data, error } = await supabase
    .from("event_catering_requirements")
    .select(
      "plan_id,item_id,unit_id,required_quantity,available_quantity,shortage_quantity,estimated_unit_cost,kitchen_inventory_items:kitchen_inventory_items!event_catering_requirements_tenant_item_fkey(id,name),kitchen_inventory_units:kitchen_inventory_units!event_catering_requirements_tenant_unit_fkey(id,code,name)",
    )
    .eq("tenant_id", tenant.tenantId);
  if (error) throw new Error(`No fue posible consolidar faltantes de catering: ${error.message}`);

  const grouped = new Map<string, CateringShortageSummaryRow & { plans: Set<string> }>();
  for (const row of (data ?? []) as Array<Record<string, unknown>>) {
    const shortage = Number(row.shortage_quantity ?? 0);
    if (shortage <= 0) continue;
    const itemId = String(row.item_id);
    const unitId = String(row.unit_id);
    const key = `${itemId}:${unitId}`;
    const item = Array.isArray(row.kitchen_inventory_items) ? row.kitchen_inventory_items[0] : row.kitchen_inventory_items;
    const unit = Array.isArray(row.kitchen_inventory_units) ? row.kitchen_inventory_units[0] : row.kitchen_inventory_units;
    const current = grouped.get(key) ?? {
      item_id: itemId,
      item_name: (item as { name?: string } | null)?.name ?? null,
      unit_id: unitId,
      unit_code: (unit as { code?: string } | null)?.code ?? null,
      total_required: 0,
      total_available: 0,
      total_shortage: 0,
      estimated_shortage_cost: 0,
      plans_affected: 0,
      plans: new Set<string>(),
    };
    current.total_required += Number(row.required_quantity ?? 0);
    current.total_available += Number(row.available_quantity ?? 0);
    current.total_shortage += shortage;
    current.estimated_shortage_cost += shortage * Number(row.estimated_unit_cost ?? 0);
    current.plans.add(String(row.plan_id));
    grouped.set(key, current);
  }

  return [...grouped.values()]
    .map((row) => ({
      item_id: row.item_id,
      item_name: row.item_name,
      unit_id: row.unit_id,
      unit_code: row.unit_code,
      total_required: row.total_required,
      total_available: row.total_available,
      total_shortage: row.total_shortage,
      estimated_shortage_cost: row.estimated_shortage_cost,
      plans_affected: row.plans.size,
    }))
    .sort((a, b) => b.estimated_shortage_cost - a.estimated_shortage_cost);
}

export async function listApprovedRequisitionsPendingReceipt(tenantSlug: string) {
  const tenant = await resolveTenantModulePageContext(tenantSlug, "event_catering", "requisitions", "read");
  const supabase = await getSupabaseServerClient();

  const [{ data: requisitions, error: requisitionsError }, { data: receipts, error: receiptsError }] = await Promise.all([
    supabase
      .from("event_catering_requisitions")
      .select(
        "id,tenant_id,plan_id,status,estimated_total_cost,created_at,updated_at,event_catering_plans:event_catering_plans!event_catering_requisitions_tenant_plan_fkey(id,event_id,name)",
      )
      .eq("tenant_id", tenant.tenantId)
      .eq("status", "approved")
      .order("updated_at", { ascending: false }),
    supabase
      .from("event_catering_purchase_receipts")
      .select("id,requisition_id,status")
      .eq("tenant_id", tenant.tenantId)
      .in("status", ["draft", "received"]),
  ]);
  if (requisitionsError) throw new Error(`No fue posible listar requisiciones approved: ${requisitionsError.message}`);
  if (receiptsError) throw new Error(`No fue posible listar recepciones: ${receiptsError.message}`);

  const receiptByRequisition = new Set((receipts ?? []).map((row) => row.requisition_id));
  const approvedWithoutReceipt = (requisitions ?? []).filter((row) => !receiptByRequisition.has(row.id));

  const requisitionIds = approvedWithoutReceipt.map((row) => row.id);
  if (requisitionIds.length === 0) return [];

  const { data: lineRows, error: lineRowsError } = await supabase
    .from("event_catering_requisition_lines")
    .select("requisition_id,item_id,unit_id,requested_quantity,requested_purchase_quantity,expected_inventory_quantity,approved_unit_price,approved_total_cost,quoted_unit_price,quoted_total_cost,preliminary_unit_price,preliminary_total_cost,estimated_unit_cost,estimated_total_cost,kitchen_inventory_items:kitchen_inventory_items!event_catering_requisition_lines_tenant_item_fkey(name)")
    .eq("tenant_id", tenant.tenantId)
    .in("requisition_id", requisitionIds);
  if (lineRowsError) throw new Error(`No fue posible contar líneas de requisiciones: ${lineRowsError.message}`);
  const lineCountByReq = new Map<string, number>();
  const receivableLineCountByReq = new Map<string, number>();
  const blockingLineCountByReq = new Map<string, number>();
  const expectedTotalByReq = new Map<string, number>();
  for (const row of lineRows ?? []) {
    lineCountByReq.set(row.requisition_id, (lineCountByReq.get(row.requisition_id) ?? 0) + 1);
    const procurementStatus = classifyRequisitionLineProcurement(row as unknown as EventCateringRequisitionLine);
    if (procurementStatus === "receivable_with_price") {
      const lineExpectedTotal = resolveRequisitionLineFinancialTotal(row as unknown as EventCateringRequisitionLine);
      receivableLineCountByReq.set(row.requisition_id, (receivableLineCountByReq.get(row.requisition_id) ?? 0) + 1);
      expectedTotalByReq.set(
        row.requisition_id,
        (expectedTotalByReq.get(row.requisition_id) ?? 0) + lineExpectedTotal,
      );
    }
    if (procurementStatus === "missing_price" || procurementStatus === "review_needed") {
      blockingLineCountByReq.set(row.requisition_id, (blockingLineCountByReq.get(row.requisition_id) ?? 0) + 1);
    }
  }

  return approvedWithoutReceipt.map((row) => {
    const plan = Array.isArray(row.event_catering_plans) ? row.event_catering_plans[0] : row.event_catering_plans;
    const lineCount = lineCountByReq.get(row.id) ?? 0;
    const receivableLineCount = receivableLineCountByReq.get(row.id) ?? 0;
    const blockingLineCount = blockingLineCountByReq.get(row.id) ?? 0;
    const expectedReceiptTotal = Number((expectedTotalByReq.get(row.id) ?? 0).toFixed(4));
    const canCreateReceipt = receivableLineCount > 0 && blockingLineCount === 0 && expectedReceiptTotal > 0;
    return {
      requisition_id: row.id,
      plan_id: row.plan_id,
      event_id: plan?.event_id ?? null,
      plan_name: plan?.name ?? null,
      estimated_total_cost: Number(row.estimated_total_cost ?? 0),
      line_count: lineCount,
      receivable_line_count: receivableLineCount,
      expected_receipt_total: expectedReceiptTotal,
      can_create_receipt: canCreateReceipt,
      receipt_block_reason: canCreateReceipt
        ? null
        : receivableLineCount === 0
          ? "Sin líneas recibibles"
          : blockingLineCount > 0
            ? "Falta precio para una línea comprable"
            : expectedReceiptTotal <= 0
              ? "Total esperado inválido"
              : "Líneas incompletas para recibir",
      status: row.status,
      updated_at: row.updated_at,
    };
  });
}

export async function listPurchaseReceiptsOverview(tenantSlug: string) {
  const tenant = await resolveTenantModulePageContext(tenantSlug, "event_catering", "requisitions", "read");
  const supabase = await getSupabaseServerClient();

  const { data: receipts, error: receiptsError } = await supabase
    .from("event_catering_purchase_receipts")
    .select(
      "id,tenant_id,requisition_id,status,received_at,total_received_cost,created_at,updated_at,event_catering_requisitions:event_catering_requisitions!event_catering_purchase_receipts_tenant_requisition_fkey(id,plan_id,status,event_catering_plans:event_catering_plans!event_catering_requisitions_tenant_plan_fkey(id,event_id,name))",
    )
    .eq("tenant_id", tenant.tenantId)
    .order("created_at", { ascending: false });
  if (receiptsError) throw new Error(`No fue posible listar resumen de recepciones: ${receiptsError.message}`);

  const receiptIds = (receipts ?? []).map((row) => row.id);
  const lineCountByReceipt = new Map<string, number>();
  if (receiptIds.length > 0) {
    const { data: lines, error: linesError } = await supabase
      .from("event_catering_purchase_receipt_lines")
      .select("receipt_id")
      .eq("tenant_id", tenant.tenantId)
      .in("receipt_id", receiptIds);
    if (linesError) throw new Error(`No fue posible contar líneas de recepciones: ${linesError.message}`);
    for (const row of lines ?? []) {
      lineCountByReceipt.set(row.receipt_id, (lineCountByReceipt.get(row.receipt_id) ?? 0) + 1);
    }
  }

  return (receipts ?? []).map((row) => {
    const requisition = Array.isArray(row.event_catering_requisitions)
      ? row.event_catering_requisitions[0]
      : row.event_catering_requisitions;
    const plan = requisition
      ? Array.isArray(requisition.event_catering_plans)
        ? requisition.event_catering_plans[0]
        : requisition.event_catering_plans
      : null;
    return {
      receipt_id: row.id,
      requisition_id: row.requisition_id,
      status: row.status,
      received_at: row.received_at,
      total_received_cost: Number(row.total_received_cost ?? 0),
      created_at: row.created_at,
      updated_at: row.updated_at,
      requisition_status: requisition?.status ?? null,
      plan_id: requisition?.plan_id ?? null,
      event_id: plan?.event_id ?? null,
      plan_name: plan?.name ?? null,
      line_count: lineCountByReceipt.get(row.id) ?? 0,
    };
  });
}

export async function listPurchaseReceiptsOperationalOverview(
  tenantSlug: string,
): Promise<PurchaseReceiptOperationalOverviewRow[]> {
  const tenant = await resolveTenantModulePageContext(tenantSlug, "event_catering", "requisitions", "read");
  const supabase = await getSupabaseServerClient();

  const { data: receipts, error: receiptsError } = await supabase
    .from("event_catering_purchase_receipts")
    .select(
      "id,status,requisition_id,received_at,total_received_cost,created_at,event_catering_requisitions:event_catering_requisitions!event_catering_purchase_receipts_tenant_requisition_fkey(id,status,plan_id,event_catering_plans:event_catering_plans!event_catering_requisitions_tenant_plan_fkey(id,name,event_id,events:events!event_catering_plans_tenant_event_fkey(id,name,starts_at)))",
    )
    .eq("tenant_id", tenant.tenantId)
    .order("created_at", { ascending: false });
  if (receiptsError) throw new Error(`No fue posible listar recepciones operativas: ${receiptsError.message}`);

  const receiptIds = (receipts ?? []).map((row) => row.id);
  const requisitionIds = [...new Set((receipts ?? []).map((row) => row.requisition_id))];

  const lineCountByReceipt = new Map<string, number>();
  if (receiptIds.length > 0) {
    const { data: lines, error: linesError } = await supabase
      .from("event_catering_purchase_receipt_lines")
      .select("receipt_id")
      .eq("tenant_id", tenant.tenantId)
      .in("receipt_id", receiptIds);
    if (linesError) throw new Error(`No fue posible contar líneas de recepción: ${linesError.message}`);
    for (const line of lines ?? []) {
      lineCountByReceipt.set(line.receipt_id, (lineCountByReceipt.get(line.receipt_id) ?? 0) + 1);
    }
  }

  const expectedByRequisition = new Map<string, number>();
  if (requisitionIds.length > 0) {
    const { data: reqLines, error: reqLinesError } = await supabase
      .from("event_catering_requisition_lines")
      .select("requisition_id,approved_total_cost,quoted_total_cost,preliminary_total_cost,estimated_total_cost")
      .eq("tenant_id", tenant.tenantId)
      .in("requisition_id", requisitionIds);
    if (reqLinesError) throw new Error(`No fue posible cargar totales esperados por requisición: ${reqLinesError.message}`);
    for (const row of reqLines ?? []) {
      const expectedLine =
        Number(row.approved_total_cost ?? 0) ||
        Number(row.quoted_total_cost ?? 0) ||
        Number(row.preliminary_total_cost ?? 0) ||
        Number(row.estimated_total_cost ?? 0);
      expectedByRequisition.set(
        row.requisition_id,
        Number(((expectedByRequisition.get(row.requisition_id) ?? 0) + expectedLine).toFixed(4)),
      );
    }
  }

  return (receipts ?? []).map((receipt) => {
    const req = Array.isArray(receipt.event_catering_requisitions)
      ? receipt.event_catering_requisitions[0]
      : receipt.event_catering_requisitions;
    const plan = req
      ? Array.isArray(req.event_catering_plans)
        ? req.event_catering_plans[0]
        : req.event_catering_plans
      : null;
    const event = plan
      ? Array.isArray(plan.events)
        ? plan.events[0]
        : plan.events
      : null;

    return {
      receipt_id: receipt.id,
      receipt_status: receipt.status as PurchaseReceiptOperationalOverviewRow["receipt_status"],
      requisition_id: receipt.requisition_id,
      requisition_status: (req?.status as PurchaseReceiptOperationalOverviewRow["requisition_status"]) ?? null,
      plan_id: req?.plan_id ?? null,
      plan_name: plan?.name ?? null,
      event_id: plan?.event_id ?? null,
      event_name: event?.name ?? null,
      event_date: event?.starts_at ?? null,
      total_received_cost: Number(receipt.total_received_cost ?? 0),
      total_expected_cost: Number(expectedByRequisition.get(receipt.requisition_id) ?? 0),
      line_count: lineCountByReceipt.get(receipt.id) ?? 0,
      received_at: receipt.received_at,
      created_at: receipt.created_at,
    } satisfies PurchaseReceiptOperationalOverviewRow;
  });
}

export async function listConsumptionRecordsForPlan(
  tenantSlug: string,
  planId: string,
): Promise<EventCateringConsumptionRecord[]> {
  const tenant = await resolveTenantModulePageContext(tenantSlug, "event_catering", "consumption", "read");
  const supabase = await getSupabaseServerClient();
  const { data, error } = await supabase
    .from("event_catering_consumption_records")
    .select(
      "id,tenant_id,plan_id,event_id,status,consumed_at,notes,created_at,updated_at,created_by,confirmed_at,confirmed_by,canceled_at,canceled_by,event_catering_plans:event_catering_plans!event_catering_consumption_records_tenant_plan_fkey(id,event_id,name),events:events!event_catering_consumption_records_tenant_event_fkey(id,name,starts_at)",
    )
    .eq("tenant_id", tenant.tenantId)
    .eq("plan_id", planId)
    .order("created_at", { ascending: false });
  if (error) throw new Error(`No fue posible listar consumos del plan: ${error.message}`);
  return ((data ?? []) as Array<Record<string, unknown>>).map((row) => ({
    ...(row as unknown as EventCateringConsumptionRecord),
    event_catering_plans: Array.isArray(row.event_catering_plans)
      ? ((row.event_catering_plans[0] ?? null) as EventCateringConsumptionRecord["event_catering_plans"])
      : ((row.event_catering_plans ?? null) as EventCateringConsumptionRecord["event_catering_plans"]),
    events: Array.isArray(row.events)
      ? ((row.events[0] ?? null) as EventCateringConsumptionRecord["events"])
      : ((row.events ?? null) as EventCateringConsumptionRecord["events"]),
  }));
}

export async function getConsumptionRecord(
  tenantSlug: string,
  consumptionRecordId: string,
): Promise<EventCateringConsumptionRecord | null> {
  const tenant = await resolveTenantModulePageContext(tenantSlug, "event_catering", "consumption", "read");
  const supabase = await getSupabaseServerClient();
  const { data, error } = await supabase
    .from("event_catering_consumption_records")
    .select(
      "id,tenant_id,plan_id,event_id,status,consumed_at,notes,created_at,updated_at,created_by,confirmed_at,confirmed_by,canceled_at,canceled_by,event_catering_plans:event_catering_plans!event_catering_consumption_records_tenant_plan_fkey(id,event_id,name),events:events!event_catering_consumption_records_tenant_event_fkey(id,name,starts_at)",
    )
    .eq("tenant_id", tenant.tenantId)
    .eq("id", consumptionRecordId)
    .maybeSingle();
  if (error) throw new Error(`No fue posible cargar consumo: ${error.message}`);
  if (!data) return null;
  const row = data as Record<string, unknown>;
  return {
    ...(row as unknown as EventCateringConsumptionRecord),
    event_catering_plans: Array.isArray(row.event_catering_plans)
      ? ((row.event_catering_plans[0] ?? null) as EventCateringConsumptionRecord["event_catering_plans"])
      : ((row.event_catering_plans ?? null) as EventCateringConsumptionRecord["event_catering_plans"]),
    events: Array.isArray(row.events)
      ? ((row.events[0] ?? null) as EventCateringConsumptionRecord["events"])
      : ((row.events ?? null) as EventCateringConsumptionRecord["events"]),
  };
}

export async function listConsumptionLines(
  tenantSlug: string,
  consumptionRecordId: string,
): Promise<EventCateringConsumptionLine[]> {
  const tenant = await resolveTenantModulePageContext(tenantSlug, "event_catering", "consumption", "read");
  const supabase = await getSupabaseServerClient();
  const { data, error } = await supabase
    .from("event_catering_consumption_lines")
    .select(
      "id,tenant_id,consumption_record_id,requirement_id,item_id,location_id,unit_id,planned_quantity,consumed_quantity,waste_quantity,leftover_quantity,available_quantity,unit_cost,total_cost,consumption_movement_id,waste_movement_id,notes,created_at,updated_at,created_by,kitchen_inventory_items:kitchen_inventory_items!event_catering_consumption_lines_tenant_item_fkey(id,name),kitchen_inventory_units:kitchen_inventory_units!event_catering_consumption_lines_tenant_unit_fkey(id,code,name),kitchen_inventory_locations:kitchen_inventory_locations!event_catering_consumption_lines_tenant_location_fkey(id,name)",
    )
    .eq("tenant_id", tenant.tenantId)
    .eq("consumption_record_id", consumptionRecordId)
    .order("created_at", { ascending: true });
  if (error) throw new Error(`No fue posible listar líneas de consumo: ${error.message}`);
  return ((data ?? []) as Array<Record<string, unknown>>).map((row) => ({
    ...(row as unknown as EventCateringConsumptionLine),
    kitchen_inventory_items: Array.isArray(row.kitchen_inventory_items)
      ? ((row.kitchen_inventory_items[0] ?? null) as EventCateringConsumptionLine["kitchen_inventory_items"])
      : ((row.kitchen_inventory_items ?? null) as EventCateringConsumptionLine["kitchen_inventory_items"]),
    kitchen_inventory_units: Array.isArray(row.kitchen_inventory_units)
      ? ((row.kitchen_inventory_units[0] ?? null) as EventCateringConsumptionLine["kitchen_inventory_units"])
      : ((row.kitchen_inventory_units ?? null) as EventCateringConsumptionLine["kitchen_inventory_units"]),
    kitchen_inventory_locations: Array.isArray(row.kitchen_inventory_locations)
      ? ((row.kitchen_inventory_locations[0] ?? null) as EventCateringConsumptionLine["kitchen_inventory_locations"])
      : ((row.kitchen_inventory_locations ?? null) as EventCateringConsumptionLine["kitchen_inventory_locations"]),
    stock_status: classifyConsumptionItemStockBehavior(
      Array.isArray(row.kitchen_inventory_items)
        ? (row.kitchen_inventory_items[0] as { name?: string | null } | undefined)?.name
        : (row.kitchen_inventory_items as { name?: string | null } | null)?.name,
    ),
  }));
}

export async function getConsumptionDraftForPlan(
  tenantSlug: string,
  planId: string,
): Promise<EventCateringConsumptionRecord | null> {
  const records = await listConsumptionRecordsForPlan(tenantSlug, planId);
  return records.find((row) => row.status === "draft") ?? null;
}

export async function listEventConsumptionOverview(tenantSlug: string) {
  const tenant = await resolveTenantModulePageContext(tenantSlug, "event_catering", "consumption", "read");
  const supabase = await getSupabaseServerClient();
  const { data, error } = await supabase
    .from("event_catering_consumption_records")
    .select(
      "id,tenant_id,plan_id,event_id,status,consumed_at,notes,created_at,updated_at,created_by,confirmed_at,confirmed_by,canceled_at,canceled_by,event_catering_plans:event_catering_plans!event_catering_consumption_records_tenant_plan_fkey(id,event_id,name),events:events!event_catering_consumption_records_tenant_event_fkey(id,name,starts_at)",
    )
    .eq("tenant_id", tenant.tenantId)
    .order("updated_at", { ascending: false });
  if (error) throw new Error(`No fue posible listar overview de consumos: ${error.message}`);
  return ((data ?? []) as Array<Record<string, unknown>>).map((row) => ({
    ...(row as unknown as EventCateringConsumptionRecord),
    event_catering_plans: Array.isArray(row.event_catering_plans)
      ? ((row.event_catering_plans[0] ?? null) as EventCateringConsumptionRecord["event_catering_plans"])
      : ((row.event_catering_plans ?? null) as EventCateringConsumptionRecord["event_catering_plans"]),
    events: Array.isArray(row.events)
      ? ((row.events[0] ?? null) as EventCateringConsumptionRecord["events"])
      : ((row.events ?? null) as EventCateringConsumptionRecord["events"]),
  }));
}

export async function listConsumptionOperationalCandidates(
  tenantSlug: string,
): Promise<ConsumptionOperationalCandidateRow[]> {
  const [plansIndex, consumptionRows] = await Promise.all([
    listCateringPlanOperationalIndex(tenantSlug),
    listEventConsumptionOverview(tenantSlug),
  ]);

  const consumptionByPlan = new Map<string, { hasDraft: boolean; hasConfirmed: boolean }>();
  for (const row of consumptionRows) {
    const current = consumptionByPlan.get(row.plan_id) ?? { hasDraft: false, hasConfirmed: false };
    if (row.status === "draft") current.hasDraft = true;
    if (row.status === "confirmed") current.hasConfirmed = true;
    consumptionByPlan.set(row.plan_id, current);
  }

  return plansIndex.map((plan) => {
    const consumption = consumptionByPlan.get(plan.plan_id) ?? { hasDraft: false, hasConfirmed: false };
    const hasRequirements = plan.requirements_count > 0;
    const hasRecipes = plan.recipes_count > 0;
    const isCanceled = plan.plan_status === "canceled";
    const reserveSufficient = plan.shortage_count === 0;
    const readyToPrepare =
      hasRequirements && !consumption.hasDraft && !consumption.hasConfirmed && !isCanceled;
    const readyToConfirm = reserveSufficient && (plan.receipt_status_summary === "received" || plan.receipt_status_summary === "mixed");

    let blockingReason: string | null = null;
    let bucket: ConsumptionOperationalCandidateRow["operational_bucket"] = "blocked";
    if (consumption.hasConfirmed) {
      bucket = "confirmed";
      blockingReason = "Consumo confirmado";
    } else if (consumption.hasDraft) {
      bucket = "draft";
      blockingReason = "Ya tiene consumo en borrador";
    } else if (!hasRecipes) {
      bucket = "blocked";
      blockingReason = "Sin recetas";
    } else if (!hasRequirements) {
      bucket = "blocked";
      blockingReason = "Requerimientos pendientes";
    } else if (isCanceled) {
      bucket = "blocked";
      blockingReason = "Plan cancelado";
    } else if (reserveSufficient) {
      bucket = "ready_to_prepare";
      blockingReason = null;
    } else {
      bucket = "preparable_with_warnings";
      if (plan.latest_requisition_status == null) {
        blockingReason = "Tiene faltantes pendientes";
      } else if (plan.latest_requisition_status === "approved" && (plan.receipt_status_summary === "none" || plan.receipt_status_summary === "draft")) {
        blockingReason = "Compra autorizada pendiente de recepción";
      } else if (plan.receipt_status_summary === "none" || plan.receipt_status_summary === "draft" || plan.receipt_status_summary === "mixed") {
        blockingReason = "Tiene requisición pendiente";
      } else {
        blockingReason = "Stock reservado insuficiente";
      }
    }

    return {
      plan_id: plan.plan_id,
      plan_name: plan.plan_name,
      event_id: plan.event_id,
      event_name: plan.event_name,
      event_date: plan.event_date,
      planned_guest_count: plan.planned_guest_count,
      requirements_count: plan.requirements_count,
      shortage_count: plan.shortage_count,
      requisition_status_summary: plan.latest_requisition_status ?? "none",
      receipt_status_summary: plan.receipt_status_summary,
      has_draft_consumption: consumption.hasDraft,
      has_confirmed_consumption: consumption.hasConfirmed,
      ready_to_prepare: readyToPrepare,
      ready_to_confirm: readyToConfirm,
      reserve_sufficient: reserveSufficient,
      blocking_reason: blockingReason,
      operational_bucket: bucket,
    } satisfies ConsumptionOperationalCandidateRow;
  });
}

async function buildConsumptionLineAvailability(
  tenantSlug: string,
  lines: Array<{
    id: string;
    consumption_record_id: string;
    item_id: string;
    unit_id: string;
    location_id: string | null;
    consumed_quantity: number;
    waste_quantity: number;
    kitchen_inventory_items?: { id?: string; name?: string } | null;
    kitchen_inventory_units?: { id?: string; code?: string; name?: string } | null;
  }>,
): Promise<Map<string, EventCateringConsumptionLineAvailability[]>> {
  const availabilityByRecord = new Map<string, EventCateringConsumptionLineAvailability[]>();
  for (const line of lines) availabilityByRecord.set(line.consumption_record_id, availabilityByRecord.get(line.consumption_record_id) ?? []);
  if (lines.length === 0) return availabilityByRecord;

  const tenant = await resolveTenantModulePageContext(tenantSlug, "event_catering", "consumption", "read");
  const supabase = await getSupabaseServerClient();
  const itemIds = [...new Set(lines.map((line) => line.item_id))];
  const recordIds = [...new Set(lines.map((line) => line.consumption_record_id))];

  const [records, balances, locations, allocations] = await Promise.all([
    supabase
      .from("event_catering_consumption_records")
      .select("id,plan_id")
      .eq("tenant_id", tenant.tenantId)
      .in("id", recordIds),
    supabase
      .from("kitchen_inventory_balances")
      .select("item_id,location_id,quantity")
      .eq("tenant_id", tenant.tenantId)
      .in("item_id", itemIds),
    supabase.from("kitchen_inventory_locations").select("id,name").eq("tenant_id", tenant.tenantId).eq("is_active", true),
    supabase
      .from("event_catering_inventory_allocations")
      .select("plan_id,item_id,location_id,allocated_quantity,consumed_quantity,released_quantity,status")
      .eq("tenant_id", tenant.tenantId)
      .in("item_id", itemIds)
      .eq("status", "reserved"),
  ]);
  if (records.error) throw new Error(`No fue posible cargar planes para disponibilidad de consumo: ${records.error.message}`);
  if (balances.error) throw new Error(`No fue posible cargar balances para disponibilidad de consumo: ${balances.error.message}`);
  if (locations.error) throw new Error(`No fue posible cargar ubicaciones para disponibilidad de consumo: ${locations.error.message}`);
  if (allocations.error && !allocations.error.message.includes("event_catering_inventory_allocations")) {
    throw new Error(`No fue posible cargar reservas para disponibilidad de consumo: ${allocations.error.message}`);
  }

  const planByRecord = new Map((records.data ?? []).map((record) => [record.id, record.plan_id]));
  const physicalByItemLocation = new Map<string, number>();
  const physicalByItem = new Map<string, number>();
  for (const row of balances.data ?? []) {
    physicalByItemLocation.set(`${row.item_id}:${row.location_id}`, Number(row.quantity ?? 0));
    physicalByItem.set(row.item_id, (physicalByItem.get(row.item_id) ?? 0) + Number(row.quantity ?? 0));
  }

  const allocationByItemLocationPlan = new Map<string, number>();
  const globalAllocationByItemPlan = new Map<string, number>();
  for (const allocation of allocations.data ?? []) {
    const remaining = Math.max(
      Number(allocation.allocated_quantity ?? 0) -
        Number(allocation.consumed_quantity ?? 0) -
        Number(allocation.released_quantity ?? 0),
      0,
    );
    if (remaining <= 0) continue;
    if (allocation.location_id) {
      const key = `${allocation.item_id}:${allocation.location_id}:${allocation.plan_id}`;
      allocationByItemLocationPlan.set(key, (allocationByItemLocationPlan.get(key) ?? 0) + remaining);
    } else {
      const key = `${allocation.item_id}:${allocation.plan_id}`;
      globalAllocationByItemPlan.set(key, (globalAllocationByItemPlan.get(key) ?? 0) + remaining);
    }
  }

  const allPlanIds = [...new Set((allocations.data ?? []).map((allocation) => allocation.plan_id))];
  const summarize = (itemId: string, locationId: string, planId: string | null) => {
    const physical = Number((physicalByItemLocation.get(`${itemId}:${locationId}`) ?? 0).toFixed(4));
    let reservedThis = 0;
    let reservedOther = 0;
    for (const candidatePlanId of allPlanIds) {
      const amount = Number((allocationByItemLocationPlan.get(`${itemId}:${locationId}:${candidatePlanId}`) ?? 0).toFixed(4));
      if (candidatePlanId === planId) reservedThis += amount;
      else reservedOther += amount;
    }
    // Location-less allocations are treated as global reservations. They reduce availability everywhere for other plans.
    for (const [key, amount] of globalAllocationByItemPlan.entries()) {
      const [globalItemId, globalPlanId] = key.split(":");
      if (globalItemId !== itemId) continue;
      if (globalPlanId === planId) reservedThis += amount;
      else reservedOther += amount;
    }
    const availableForThisPlan = Number((physical - reservedOther).toFixed(4));
    return {
      physical_balance: Number(physical.toFixed(4)),
      reserved_other_plans: Number(reservedOther.toFixed(4)),
      reserved_this_plan: Number(reservedThis.toFixed(4)),
      available_quantity: availableForThisPlan,
    };
  };
  const summarizeAggregate = (itemId: string, planId: string | null) => {
    const physical = Number((physicalByItem.get(itemId) ?? 0).toFixed(4));
    let reservedThis = 0;
    let reservedOther = 0;
    for (const candidatePlanId of allPlanIds) {
      for (const [key, amount] of allocationByItemLocationPlan.entries()) {
        const [allocationItemId, , allocationPlanId] = key.split(":");
        if (allocationItemId !== itemId || allocationPlanId !== candidatePlanId) continue;
        if (candidatePlanId === planId) reservedThis += amount;
        else reservedOther += amount;
      }
    }
    for (const [key, amount] of globalAllocationByItemPlan.entries()) {
      const [globalItemId, globalPlanId] = key.split(":");
      if (globalItemId !== itemId) continue;
      if (globalPlanId === planId) reservedThis += amount;
      else reservedOther += amount;
    }
    return {
      physical_balance: Number(physical.toFixed(4)),
      reserved_other_plans: Number(reservedOther.toFixed(4)),
      reserved_this_plan: Number(reservedThis.toFixed(4)),
      available_quantity: Number((physical - reservedOther).toFixed(4)),
    };
  };

  for (const line of lines) {
    const planId = planByRecord.get(line.consumption_record_id) ?? null;
    const stockStatus = classifyConsumptionItemStockBehavior(line.kitchen_inventory_items?.name ?? null);
    const totalOutQuantity = Number((Number(line.consumed_quantity ?? 0) + Number(line.waste_quantity ?? 0)).toFixed(4));
    const ignoreForReadiness = stockStatus === "operational_zero_cost_non_consumable";
    const currentBreakdown = line.location_id
      ? summarize(line.item_id, line.location_id, planId)
      : summarizeAggregate(line.item_id, planId);
    const missingLocation = !ignoreForReadiness && totalOutQuantity > 0 && !line.location_id;
    const hasSufficientBalance =
      ignoreForReadiness || totalOutQuantity <= 0 || currentBreakdown.available_quantity >= totalOutQuantity;

    let warningMessage: string | null = null;
    if (!ignoreForReadiness && !hasSufficientBalance) warningMessage = "Stock insuficiente";
    else if (missingLocation) warningMessage = "Falta ubicación";

    const locationOptions = ignoreForReadiness
      ? []
      : (locations.data ?? [])
      .map((location) => {
        const breakdown = summarize(line.item_id, location.id as string, planId);
        return {
          location_id: location.id as string,
          location_name: (location.name as string) ?? "Ubicación",
          ...breakdown,
        };
      })
      .filter((option) => option.available_quantity > 0 || option.location_id === line.location_id)
      .sort((a, b) => b.reserved_this_plan - a.reserved_this_plan || b.available_quantity - a.available_quantity);

    const availability: EventCateringConsumptionLineAvailability = {
      line_id: line.id,
      item_id: line.item_id,
      item_name: line.kitchen_inventory_items?.name ?? line.item_id,
      unit_id: line.unit_id,
      unit_code: line.kitchen_inventory_units?.code ?? "ud",
      location_id: line.location_id,
      stock_status: stockStatus,
      ignore_for_readiness: ignoreForReadiness,
      ...(ignoreForReadiness
        ? {
            available_quantity: 0,
            physical_balance: 0,
            reserved_other_plans: 0,
            reserved_this_plan: 0,
          }
        : currentBreakdown),
      total_out_quantity: totalOutQuantity,
      has_sufficient_balance: hasSufficientBalance,
      missing_location: missingLocation,
      warning_message: warningMessage,
      location_options: locationOptions,
    };
    const bucket = availabilityByRecord.get(line.consumption_record_id) ?? [];
    bucket.push(availability);
    availabilityByRecord.set(line.consumption_record_id, bucket);
  }

  return availabilityByRecord;
}

export async function getConsumptionLineAvailability(
  tenantSlug: string,
  consumptionRecordId: string,
): Promise<EventCateringConsumptionLineAvailability[]> {
  const lines = (await listConsumptionLines(tenantSlug, consumptionRecordId)).map((line) => ({
    id: line.id,
    consumption_record_id: line.consumption_record_id,
    item_id: line.item_id,
    unit_id: line.unit_id,
    location_id: line.location_id,
    consumed_quantity: Number(line.consumed_quantity ?? 0),
    waste_quantity: Number(line.waste_quantity ?? 0),
    kitchen_inventory_items: line.kitchen_inventory_items,
    kitchen_inventory_units: line.kitchen_inventory_units,
  }));
  const availabilityByRecord = await buildConsumptionLineAvailability(tenantSlug, lines);
  return availabilityByRecord.get(consumptionRecordId) ?? [];
}

export async function getConsumptionLineAvailabilityByRecordIds(
  tenantSlug: string,
  consumptionRecordIds: string[],
): Promise<Map<string, EventCateringConsumptionLineAvailability[]>> {
  const availabilityByRecord = new Map<string, EventCateringConsumptionLineAvailability[]>();
  for (const id of consumptionRecordIds) availabilityByRecord.set(id, []);
  if (consumptionRecordIds.length === 0) return availabilityByRecord;

  const tenant = await resolveTenantModulePageContext(tenantSlug, "event_catering", "consumption", "read");
  const supabase = await getSupabaseServerClient();

  const { data: linesRaw, error: linesError } = await supabase
    .from("event_catering_consumption_lines")
    .select(
      "id,consumption_record_id,item_id,unit_id,location_id,consumed_quantity,waste_quantity,kitchen_inventory_items:kitchen_inventory_items!event_catering_consumption_lines_tenant_item_fkey(id,name),kitchen_inventory_units:kitchen_inventory_units!event_catering_consumption_lines_tenant_unit_fkey(id,code,name)",
    )
    .eq("tenant_id", tenant.tenantId)
    .in("consumption_record_id", consumptionRecordIds);
  if (linesError) throw new Error(`No fue posible cargar líneas de consumo para disponibilidad: ${linesError.message}`);

  const lines = ((linesRaw ?? []) as Array<Record<string, unknown>>).map((row) => ({
    id: String(row.id),
    consumption_record_id: String(row.consumption_record_id),
    item_id: String(row.item_id),
    unit_id: String(row.unit_id),
    location_id: (row.location_id as string | null) ?? null,
    consumed_quantity: Number(row.consumed_quantity ?? 0),
    waste_quantity: Number(row.waste_quantity ?? 0),
    kitchen_inventory_items: Array.isArray(row.kitchen_inventory_items)
      ? ((row.kitchen_inventory_items[0] ?? null) as { id?: string; name?: string } | null)
      : ((row.kitchen_inventory_items ?? null) as { id?: string; name?: string } | null),
    kitchen_inventory_units: Array.isArray(row.kitchen_inventory_units)
      ? ((row.kitchen_inventory_units[0] ?? null) as { id?: string; code?: string; name?: string } | null)
      : ((row.kitchen_inventory_units ?? null) as { id?: string; code?: string; name?: string } | null),
  }));

  const computed = await buildConsumptionLineAvailability(tenantSlug, lines);
  for (const [recordId, rows] of computed.entries()) availabilityByRecord.set(recordId, rows);
  return availabilityByRecord;
}

export function getConsumptionDraftReadiness(
  status: EventCateringConsumptionRecord["status"],
  availability: EventCateringConsumptionLineAvailability[],
): EventCateringConsumptionDraftReadiness {
  if (status !== "draft") {
    return {
      ready_to_confirm: false,
      reason: "no_output",
      missing_location_count: 0,
      insufficient_stock_count: 0,
      invalid_quantity_count: 0,
      positive_output_count: 0,
    };
  }

  const actionableLines = availability.filter((line) => !line.ignore_for_readiness);
  const positiveOutput = actionableLines.filter((line) => line.total_out_quantity > 0);
  const missingLocationCount = positiveOutput.filter((line) => line.missing_location).length;
  const insufficientStockCount = positiveOutput.filter((line) => !line.has_sufficient_balance).length;
  const invalidQuantityCount = actionableLines.filter((line) => line.total_out_quantity < 0).length;

  if (positiveOutput.length === 0) {
    return {
      ready_to_confirm: false,
      reason: "no_output",
      missing_location_count: missingLocationCount,
      insufficient_stock_count: insufficientStockCount,
      invalid_quantity_count: invalidQuantityCount,
      positive_output_count: 0,
    };
  }
  if (invalidQuantityCount > 0) {
    return {
      ready_to_confirm: false,
      reason: "invalid_quantity",
      missing_location_count: missingLocationCount,
      insufficient_stock_count: insufficientStockCount,
      invalid_quantity_count: invalidQuantityCount,
      positive_output_count: positiveOutput.length,
    };
  }
  if (insufficientStockCount > 0) {
    return {
      ready_to_confirm: false,
      reason: "insufficient_stock",
      missing_location_count: missingLocationCount,
      insufficient_stock_count: insufficientStockCount,
      invalid_quantity_count: invalidQuantityCount,
      positive_output_count: positiveOutput.length,
    };
  }
  if (missingLocationCount > 0) {
    return {
      ready_to_confirm: false,
      reason: "pending_location",
      missing_location_count: missingLocationCount,
      insufficient_stock_count: insufficientStockCount,
      invalid_quantity_count: invalidQuantityCount,
      positive_output_count: positiveOutput.length,
    };
  }

  return {
    ready_to_confirm: true,
    reason: "ready",
    missing_location_count: 0,
    insufficient_stock_count: 0,
    invalid_quantity_count: 0,
    positive_output_count: positiveOutput.length,
  };
}

async function buildCateringPlanFinancialReport(
  tenantSlug: string,
  plan: EventCateringPlan,
): Promise<CateringPlanFinancialReport> {
  const planId = plan.id;
  const [event, requirements, requisitions, consumptionRecords, pricing] = await Promise.all([
    getEventForCatering(tenantSlug, plan.event_id),
    listCateringRequirements(tenantSlug, planId),
    listCateringRequisitions(tenantSlug),
    listConsumptionRecordsForPlan(tenantSlug, planId),
    resolvePlanFinancialPricing(tenantSlug, plan),
  ]);
  const planRequisitions = requisitions.filter((requisition) => requisition.plan_id === planId);

  const receiptResults = await Promise.all(planRequisitions.map((requisition) => listPurchaseReceiptsForRequisition(tenantSlug, requisition.id)));
  const receipts = receiptResults.flat();
  const requisitionLinesResults = await Promise.all(
    planRequisitions.map((requisition) => listCateringRequisitionLines(tenantSlug, requisition.id)),
  );
  const requisitionLines = requisitionLinesResults.flat();
  const receivedReceipts = receipts.filter((receipt) => receipt.status === "received");
  const receiptLineResults = await Promise.all(
    receivedReceipts.map((receipt) => listPurchaseReceiptLines(tenantSlug, receipt.id)),
  );
  const receiptLines = receiptLineResults.flat();
  const consumptionLineResults = await Promise.all(
    consumptionRecords.map((record) => listConsumptionLines(tenantSlug, record.id)),
  );
  const consumptionLines = consumptionLineResults.flat();

  const requisitionLineByItemUnit = new Map<string, EventCateringRequisitionLine>();
  for (const line of requisitionLines) {
    requisitionLineByItemUnit.set(`${line.item_id}:${line.unit_id}`, line);
  }

  const receiptLineAggByItemUnit = new Map<
    string,
    {
      receivedQuantity: number;
      receivedCost: number;
      receivedUnitCost: number | null;
      purchasePresentation: string | null;
    }
  >();
  for (const line of receiptLines) {
    const key = `${line.item_id}:${line.unit_id}`;
    const current = receiptLineAggByItemUnit.get(key) ?? {
      receivedQuantity: 0,
      receivedCost: 0,
      receivedUnitCost: null,
      purchasePresentation: line.event_catering_requisition_lines?.purchase_units?.code ?? null,
    };
    current.receivedQuantity += Number(line.received_quantity ?? 0);
    current.receivedCost += Number(line.received_total_cost ?? 0);
    if (Number(line.received_quantity ?? 0) > 0) {
      current.receivedUnitCost = Number(line.received_total_cost ?? 0) / Number(line.received_quantity ?? 1);
    }
    if (!current.purchasePresentation) {
      current.purchasePresentation = line.event_catering_requisition_lines?.purchase_units?.code ?? null;
    }
    receiptLineAggByItemUnit.set(key, current);
  }

  const consumptionLineByRequirementId = new Map<string, EventCateringConsumptionLine>();
  for (const line of consumptionLines) {
    if (line.requirement_id) consumptionLineByRequirementId.set(line.requirement_id, line);
  }

  const lines: CateringPlanFinancialLine[] = requirements.map((requirement) => {
    const key = `${requirement.item_id}:${requirement.unit_id}`;
    const requisitionLine = requisitionLineByItemUnit.get(key) ?? null;
    const receiptAgg = receiptLineAggByItemUnit.get(key) ?? null;
    const consumptionLine = consumptionLineByRequirementId.get(requirement.id) ?? null;
    const itemName = requirement.kitchen_inventory_items?.name ?? null;
    const isOperationalZeroCost = isOperationalZeroCostWaterItemName(itemName);
    const requiredQuantity = Number(requirement.required_quantity ?? 0);
    const estimatedUnitCost = Number(requirement.estimated_unit_cost ?? 0);
    const estimatedCost = Number(requirement.estimated_total_cost ?? 0);
    const requisitionedQuantity = requisitionLine ? Number(requisitionLine.requested_quantity ?? 0) : null;
    const receivedQuantity = receiptAgg ? Number(receiptAgg.receivedQuantity ?? 0) : null;
    const consumedQuantity = consumptionLine && !isOperationalZeroCost ? Number(consumptionLine.consumed_quantity ?? 0) : 0;
    const wasteQuantity = consumptionLine && !isOperationalZeroCost ? Number(consumptionLine.waste_quantity ?? 0) : 0;
    const receivedUnitCost = receiptAgg?.receivedUnitCost ?? null;
    const consumedCost = !isOperationalZeroCost
      ? round4(consumedQuantity * Number(consumptionLine?.unit_cost ?? estimatedUnitCost))
      : 0;
    const wasteCost = !isOperationalZeroCost
      ? round4(wasteQuantity * Number(consumptionLine?.unit_cost ?? estimatedUnitCost))
      : 0;
    const remainingQuantity =
      receiptAgg && !isOperationalZeroCost
        ? round4(Math.max(Number(receiptAgg.receivedQuantity ?? 0) - consumedQuantity - wasteQuantity, 0))
        : 0;
    const remainingValue =
      receiptAgg && !isOperationalZeroCost
        ? round4(remainingQuantity * Number(receiptAgg.receivedUnitCost ?? 0))
        : 0;
    const requisitionedCost = isOperationalZeroCost ? 0 : requisitionLine ? Number(requisitionLine.financial_total ?? 0) : null;
    const receivedCost = isOperationalZeroCost ? 0 : receiptAgg ? round4(receiptAgg.receivedCost) : null;
    const requisitionUnitCost =
      isOperationalZeroCost || !requisitionLine
        ? 0
        : Number(
            requisitionLine.approved_unit_price ??
              requisitionLine.quoted_unit_price ??
              requisitionLine.preliminary_unit_price ??
              requisitionLine.estimated_unit_cost ??
              0,
          );
    const priceVariance =
      receivedUnitCost != null && !isOperationalZeroCost ? round4(receivedUnitCost - estimatedUnitCost) : null;
    const quantityPresentationVariance =
      receivedCost != null && !isOperationalZeroCost ? round4(receivedCost - estimatedCost) : null;

    let primaryVarianceReason: CateringPlanFinancialVarianceReason = "ok";
    if (isOperationalZeroCost) primaryVarianceReason = "operational_zero_cost";
    else if (wasteCost > 0) primaryVarianceReason = "waste";
    else if (remainingValue > 0) primaryVarianceReason = "over_purchase_remaining_inventory";
    else if (
      receivedCost != null &&
      receivedCost > estimatedCost &&
      (Number(requisitionLine?.expected_surplus_quantity ?? 0) > 0 || (receivedQuantity ?? 0) > requiredQuantity)
    ) {
      primaryVarianceReason =
        Number(requisitionLine?.expected_surplus_quantity ?? 0) > 0
          ? "minimum_purchase_or_multiple"
          : "purchase_presentation";
    } else if (
      priceVariance != null &&
      Math.abs(priceVariance) > 0.0001 &&
      receivedQuantity != null &&
      nearlyEqual(receivedQuantity, requiredQuantity)
    ) {
      primaryVarianceReason = "price_change";
    } else if (
      receivedQuantity != null &&
      requisitionedQuantity != null &&
      receivedQuantity + 0.0001 < requisitionedQuantity
    ) {
      primaryVarianceReason = "received_less_than_requisitioned";
    } else if (
      receivedQuantity != null &&
      consumedQuantity + wasteQuantity + 0.0001 < receivedQuantity &&
      remainingValue > 0
    ) {
      primaryVarianceReason = "consumed_less_than_received";
    } else if (!receiptAgg && requisitionLine && requisitionLine.procurement_status !== "operational_zero_cost_non_receivable") {
      primaryVarianceReason = "review_needed";
    }

    let financialStatus: CateringPlanFinancialStatus = "ok";
    if (isOperationalZeroCost) financialStatus = "operational_zero_cost";
    else if (wasteCost > 0) financialStatus = "waste";
    else if (remainingValue > 0 && receivedCost != null && receivedCost > estimatedCost) financialStatus = "over_purchase";
    else if (remainingValue > 0) financialStatus = "remaining_inventory";
    else if (receivedCost == null || consumptionLine == null) financialStatus = "partial";
    else if (primaryVarianceReason === "review_needed") financialStatus = "review_needed";

    return {
      itemId: requirement.item_id,
      itemName,
      unitId: requirement.unit_id,
      unitCode: requirement.kitchen_inventory_units?.code ?? null,
      supplierId: requisitionLine?.supplier_id ?? null,
      supplierName: requisitionLine?.kitchen_inventory_suppliers?.name ?? null,
      purchasePresentation: receiptAgg?.purchasePresentation ?? requisitionLine?.purchase_units?.code ?? null,
      requiredQuantity: round4(requiredQuantity),
      requisitionedQuantity: requisitionedQuantity != null ? round4(requisitionedQuantity) : null,
      receivedQuantity: receivedQuantity != null ? round4(receivedQuantity) : null,
      consumedQuantity: round4(consumedQuantity),
      wasteQuantity: round4(wasteQuantity),
      remainingQuantity: round4(remainingQuantity),
      estimatedUnitCost: round4(estimatedUnitCost),
      requisitionUnitCost: requisitionLine ? round4(requisitionUnitCost) : null,
      receivedUnitCost: receivedUnitCost != null ? round4(receivedUnitCost) : null,
      estimatedCost: round4(estimatedCost),
      requisitionedCost: requisitionedCost != null ? round4(requisitionedCost) : null,
      receivedCost: receivedCost != null ? round4(receivedCost) : null,
      consumedCost,
      wasteCost,
      remainingValue,
      priceVariance: priceVariance != null ? round4(priceVariance) : null,
      quantityPresentationVariance: quantityPresentationVariance != null ? round4(quantityPresentationVariance) : null,
      financialStatus,
      primaryVarianceReason,
      isOperationalZeroCost,
      isFinanciallyRelevant: !isOperationalZeroCost,
    };
  });

  const estimatedInitialCost = round4(Number(plan.estimated_total_cost ?? 0));
  const requisitionedCost = round4(lines.reduce((acc, line) => acc + Number(line.requisitionedCost ?? 0), 0));
  const executionCosts = calculateOperationalExecutionCosts({
    receivedCosts: lines.map((line) => line.receivedCost),
    consumptionCosts: lines.map((line) => ({ consumedCost: line.consumedCost, wasteCost: line.wasteCost })),
  });
  const receivedCost = round4(executionCosts.receivedCost);
  const consumedCost = round4(executionCosts.consumedCost);
  const wasteCost = round4(executionCosts.wasteCost);
  const remainingInventoryValue = round4(lines.reduce((acc, line) => acc + line.remainingValue, 0));
  const grossPurchaseVariance = round4(receivedCost - estimatedInitialCost);
  const netConsumptionVariance = round4(consumedCost + wasteCost - estimatedInitialCost);
  const plannedGuestCount = plan.planned_guest_count != null ? Number(plan.planned_guest_count) : null;
  const hasPersonBase = isPositive(plannedGuestCount);

  const summary: CateringPlanFinancialSummary = {
    estimatedInitialCost,
    requisitionedCost,
    receivedCost,
    consumedCost,
    wasteCost,
    remainingInventoryValue,
    grossPurchaseVariance,
    netConsumptionVariance,
    recoverableValue: remainingInventoryValue,
    estimatedCostPerPerson: hasPersonBase ? round4(estimatedInitialCost / Number(plannedGuestCount)) : null,
    purchasedCostPerPerson: hasPersonBase ? round4(receivedCost / Number(plannedGuestCount)) : null,
    consumedCostPerPerson: hasPersonBase ? round4(consumedCost / Number(plannedGuestCount)) : null,
    wasteCostPerPerson: hasPersonBase ? round4(wasteCost / Number(plannedGuestCount)) : null,
    requirementsCount: requirements.length,
    requisitionCount: planRequisitions.length,
    receiptCount: receipts.length,
    receivedReceiptCount: receivedReceipts.length,
    consumptionCount: consumptionRecords.length,
    confirmedConsumptionCount: consumptionRecords.filter((record) => record.status === "confirmed").length,
    operationalZeroCostLineCount: lines.filter((line) => line.isOperationalZeroCost).length,
    reportStatus:
      consumptionRecords.some((record) => record.status === "confirmed")
        ? "closed"
        : receivedReceipts.length > 0 || planRequisitions.length > 0
          ? "in_progress"
          : "partial",
    varianceExplainedByRemaining:
      Math.abs(grossPurchaseVariance) > 0.0001 &&
      Math.abs(remainingInventoryValue - grossPurchaseVariance) <= 0.01,
  };

  const narrative = (() => {
    const estimated = estimatedInitialCost.toLocaleString("es-MX", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    const purchased = receivedCost.toLocaleString("es-MX", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    const consumed = consumedCost.toLocaleString("es-MX", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    const waste = wasteCost.toLocaleString("es-MX", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    const remaining = remainingInventoryValue.toLocaleString("es-MX", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    if (summary.reportStatus === "partial") {
      return `El servicio se estimó en $${estimated}. Aún no hay recepción y consumo suficientes para un cierre financiero completo, por lo que el reporte se muestra como parcial.`;
    }
    if (summary.varianceExplainedByRemaining) {
      return `El servicio se estimó en $${estimated}. Se recibió/compró por $${purchased}. El consumo real fue $${consumed} y la merma fue $${waste}. La diferencia de compra contra estimado se explica principalmente por inventario remanente valuado en $${remaining}, por lo que no se observa sobreconsumo relevante del evento.`;
    }
    if (wasteCost > 0 && netConsumptionVariance > 0.0001) {
      return `El servicio se estimó en $${estimated}. Se recibió/compró por $${purchased}. El consumo real fue $${consumed} y la merma fue $${waste}, por lo que la variación neta del evento requiere revisión operativa.`;
    }
    if (netConsumptionVariance > 0.0001) {
      return `El servicio se estimó en $${estimated}. El consumo real fue $${consumed}, por encima del estimado inicial. La compra total fue $${purchased}; conviene revisar precio, cantidad y remanente por insumo.`;
    }
    return `El servicio se estimó en $${estimated}. Se recibió/compró por $${purchased}. El consumo real fue $${consumed} y la merma fue $${waste}. La compra puede ser mayor que el costo real del evento cuando parte del valor queda recuperable como inventario remanente.`;
  })();

  return {
    eventId: plan.event_id,
    eventName: event?.name ?? null,
    eventStartsAt: event?.starts_at ?? null,
    expectedAttendance: event?.expected_attendance == null ? null : Number(event.expected_attendance),
    planId: plan.id,
    planName: plan.name ?? null,
    planStatus: plan.status,
    plannedGuestCount,
    requisitionIds: planRequisitions.map((row) => row.id),
    receiptIds: receipts.map((row) => row.id),
    consumptionIds: consumptionRecords.map((row) => row.id),
    summary,
    pricing,
    lines: lines.sort((left, right) => {
      const difference = Number(right.remainingValue ?? 0) - Number(left.remainingValue ?? 0);
      if (Math.abs(difference) > 0.0001) return difference;
      return String(left.itemName ?? "").localeCompare(String(right.itemName ?? ""), "es-MX");
    }),
    narrative,
  };
}

export async function getCateringPlanFinancialReport(
  tenantSlug: string,
  planId: string,
): Promise<CateringPlanFinancialReport> {
  const plan = await getCateringPlan(tenantSlug, planId);

  if (!plan) {
    throw new Error("No fue posible construir reporte financiero: plan no encontrado.");
  }

  return buildCateringPlanFinancialReport(tenantSlug, plan);
}

async function mapWithConcurrency<T, R>(
  items: T[],
  concurrency: number,
  worker: (item: T) => Promise<R>,
): Promise<R[]> {
  const results = new Array<R>(items.length);
  let nextIndex = 0;

  async function consume() {
    while (true) {
      const index = nextIndex++;
      if (index >= items.length) return;
      results[index] = await worker(items[index]);
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(Math.max(concurrency, 1), items.length) }, () => consume()),
  );
  return results;
}

export async function getCateringFinancialDashboard(
  tenantSlug: string,
): Promise<CateringFinancialDashboard> {
  const plans = await listCateringPlans(tenantSlug);
  if (plans.length === 0) {
    return {
      rows: [],
      historicalRows: [],
      events: [],
      summary: {
        servicesAnalyzed: 0,
        estimatedInitialCostTotal: 0,
        requisitionedCostTotal: 0,
        receivedCostTotal: 0,
        consumedCostTotal: 0,
        wasteCostTotal: 0,
        remainingInventoryValueTotal: 0,
        grossPurchaseVarianceTotal: 0,
        netConsumptionVarianceTotal: 0,
        servicesRequiringReview: 0,
        pricingReadyServices: 0,
        pricingIncompleteServices: 0,
        legacyPricingUnavailableServices: 0,
        serviceCostBasisTotal: 0,
        extraLaborCostTotal: 0,
        suggestedProfitTotal: 0,
        suggestedServicePriceTotal: 0,
        effectiveSuggestedMarginPct: null,
      },
      narrative: "Aún no hay servicios de catering con información financiera suficiente.",
    };
  }

  const reports = await mapWithConcurrency(plans, 4, (plan) =>
    buildCateringPlanFinancialReport(tenantSlug, plan),
  );

  const tenant = await resolveTenantModulePageContext(tenantSlug, "event_catering", "plans", "read");
  const supabase = await getSupabaseServerClient();
  const { data: recipeRows, error: recipeError } = await supabase
    .from("event_catering_plan_recipes")
    .select("plan_id")
    .eq("tenant_id", tenant.tenantId)
    .in("plan_id", plans.map((plan) => plan.id));
  if (recipeError) throw new Error(`No se pudieron cargar recetas del dashboard financiero: ${recipeError.message}`);
  const recipeCountByPlan = new Map<string, number>();
  for (const row of recipeRows ?? []) {
    const planId = String(row.plan_id);
    recipeCountByPlan.set(planId, (recipeCountByPlan.get(planId) ?? 0) + 1);
  }

  const toRow = (report: CateringPlanFinancialReport): CateringFinancialDashboardRow => {
    const { summary } = report;

    const financialStatus: CateringFinancialDashboardStatus = (() => {
      if (
        summary.reportStatus === "partial" ||
        (summary.receivedReceiptCount === 0 && summary.confirmedConsumptionCount === 0)
      ) return "partial";
      if (summary.wasteCost > 0 && isMaterialVariance(summary.wasteCost, summary.receivedCost || summary.estimatedInitialCost)) {
        return "review_required";
      }
      if (isMaterialVariance(summary.netConsumptionVariance, summary.estimatedInitialCost)) {
        return "review_required";
      }
      if (summary.confirmedConsumptionCount > 0) return "closed";
      if (summary.consumptionCount > 0) return "consumed";
      if (summary.receivedReceiptCount > 0) return "received";
      if (summary.requisitionCount > 0) return "requisitioned";
      return "planned";
    })();

    const alerts: CateringFinancialDashboardAlert[] = [];
    if (summary.reportStatus === "partial") alerts.push("partial_report");
    if (isMaterialVariance(summary.grossPurchaseVariance, summary.estimatedInitialCost)) {
      alerts.push("purchase_above_estimate");
    }
    if (
      summary.receivedCost > 0 &&
      summary.remainingInventoryValue > summary.receivedCost * 0.1
    ) {
      alerts.push("high_remaining_inventory");
    }
    if (isMaterialVariance(summary.netConsumptionVariance, summary.estimatedInitialCost) && summary.netConsumptionVariance > 0) {
      alerts.push("over_consumption");
    }
    if (summary.wasteCost > 0 && isMaterialVariance(summary.wasteCost, summary.receivedCost || summary.estimatedInitialCost)) {
      alerts.push("material_waste");
    }
    if (alerts.length === 0) {
      alerts.push("no_material_issue");
    }

    const alertLabel = (() => {
      if (alerts.includes("over_consumption")) return "Sobreconsumo";
      if (alerts.includes("material_waste")) return "Merma relevante";
      if (alerts.includes("high_remaining_inventory")) return "Remanente alto";
      if (alerts.includes("purchase_above_estimate")) return "Compra mayor al estimado";
      if (alerts.includes("partial_report")) return "Reporte parcial";
      return "Sin problema relevante";
    })();

    const operationalStatus = report.planStatus === "canceled"
      ? "Cancelado"
      : financialStatus === "closed"
        ? "Cerrado"
        : financialStatus === "consumed"
          ? "Consumido"
          : financialStatus === "received"
            ? "Recibido"
            : financialStatus === "requisitioned"
              ? "Requisicionado"
              : financialStatus === "review_required"
                ? "Requiere revisión"
                : "Planeado";

    const reading = summary.varianceExplainedByRemaining
      ? "Compra mayor explicada por remanente recuperable."
      : alerts.includes("over_consumption")
        ? "El costo real del evento excede el estimado."
        : alerts.includes("material_waste")
          ? "La merma requiere revisión."
          : alerts.includes("partial_report")
            ? "Falta cierre financiero completo."
            : "Servicio alineado sin hallazgo relevante.";

    return {
      eventId: report.eventId,
      eventName: report.eventName,
      eventDate: report.eventStartsAt,
      planId: report.planId,
      planName: report.planName,
      operationalStatus,
      financialStatus,
      estimatedInitialCost: summary.estimatedInitialCost,
      requisitionedCost: summary.requisitionedCost,
      receivedCost: summary.receivedCost,
      consumedCost: summary.consumedCost,
      wasteCost: summary.wasteCost,
      remainingInventoryValue: summary.remainingInventoryValue,
      grossPurchaseVariance: summary.grossPurchaseVariance,
      netConsumptionVariance: summary.netConsumptionVariance,
      currentCostPerPerson: calculateServiceCostPerPerson(report.pricing.serviceCostBasis, report.plannedGuestCount),
      consumedCostPerPerson: summary.consumedCostPerPerson,
      plannedGuestCount: report.plannedGuestCount,
      lifecycleStatus: report.planStatus,
      pricing: report.pricing,
      alerts,
      alertLabel,
      reading,
      detailHref: `/${tenantSlug}/kitchen/events/${report.eventId}/catering/${report.planId}`,
    };
  };

  const allRows = reports.map(toRow);
  const rows = allRows.filter((row) => row.lifecycleStatus !== "canceled");
  const historicalRows = allRows.filter((row) => row.lifecycleStatus === "canceled");

  rows.sort((left, right) => {
    const reviewScore = Number(right.financialStatus === "review_required") - Number(left.financialStatus === "review_required");
    if (reviewScore !== 0) return reviewScore;
    const varianceScore = Math.abs(right.grossPurchaseVariance) - Math.abs(left.grossPurchaseVariance);
    if (Math.abs(varianceScore) > 0.0001) return varianceScore;
    return new Date(right.eventDate ?? 0).getTime() - new Date(left.eventDate ?? 0).getTime();
  });

  const pricingSummary = aggregateFinancialPricing(rows.map((row) => row.pricing));
  const summary: CateringFinancialDashboardSummary = {
    servicesAnalyzed: rows.length,
    estimatedInitialCostTotal: round4(rows.reduce((acc, row) => acc + row.estimatedInitialCost, 0)),
    requisitionedCostTotal: round4(rows.reduce((acc, row) => acc + row.requisitionedCost, 0)),
    receivedCostTotal: round4(rows.reduce((acc, row) => acc + row.receivedCost, 0)),
    consumedCostTotal: round4(rows.reduce((acc, row) => acc + row.consumedCost, 0)),
    wasteCostTotal: round4(rows.reduce((acc, row) => acc + row.wasteCost, 0)),
    remainingInventoryValueTotal: round4(rows.reduce((acc, row) => acc + row.remainingInventoryValue, 0)),
    grossPurchaseVarianceTotal: round4(rows.reduce((acc, row) => acc + row.grossPurchaseVariance, 0)),
    netConsumptionVarianceTotal: round4(rows.reduce((acc, row) => acc + row.netConsumptionVariance, 0)),
    servicesRequiringReview: rows.filter((row) => row.financialStatus === "review_required").length,
    ...pricingSummary,
  };

  const narrative = rows.length === 0
    ? "Aún no hay servicios de catering con información financiera suficiente."
    : `En el periodo visible se analizaron ${rows.length.toLocaleString("es-MX")} servicios. La compra total fue de $${summary.receivedCostTotal.toLocaleString("es-MX", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}, el consumo real fue de $${summary.consumedCostTotal.toLocaleString("es-MX", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} y quedó remanente valorizado en $${summary.remainingInventoryValueTotal.toLocaleString("es-MX", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}. Los servicios con mayor variación se explican principalmente por presentaciones de compra, remanentes o merma.`;

  const eventGroups = new Map<string, CateringFinancialEventReadModel>();
  for (const report of reports.filter((item) => item.planStatus !== "canceled")) {
    const service: CateringFinancialServiceReadModel = {
      planId: report.planId,
      planName: report.planName,
      lifecycleStatus: report.planStatus,
      plannedCovers: report.plannedGuestCount,
      currentFoodCost: report.pricing.foodCost,
      currentFoodCostSource: report.pricing.currentFoodCostSource,
      currentServiceCostBasis: report.pricing.serviceCostBasis,
      currentCostPerPerson: calculateServiceCostPerPerson(report.pricing.serviceCostBasis, report.plannedGuestCount),
      suggestedServicePrice: report.pricing.suggestedServicePrice,
      suggestedPricePerPerson: report.pricing.suggestedPricePerGuest,
      suggestedProfit: report.pricing.suggestedProfit,
      effectiveSuggestedMarginPct: report.pricing.suggestedServicePrice != null && report.pricing.suggestedServicePrice > 0 && report.pricing.suggestedProfit != null
        ? round4((report.pricing.suggestedProfit / report.pricing.suggestedServicePrice) * 100)
        : null,
      pricingStatus: report.pricing.status,
      costingStatus: resolveSingleServiceCostingStatus({
        recipeCount: recipeCountByPlan.get(report.planId) ?? 0,
        currentFoodCostSource: report.pricing.currentFoodCostSource,
      }),
      requiresManagerialAttention: false,
      pricingAttentionLabel: report.pricing.status === "incomplete"
        ? report.pricing.warnings.includes("missing_extra_staff_unit_cost")
          ? "Falta tarifa de personal"
          : "Falta completar configuración financiera"
        : null,
    };
    service.requiresManagerialAttention = serviceRequiresManagerialAttention({
      costingStatus: service.costingStatus,
      pricingStatus: service.pricingStatus,
    });
    const current = eventGroups.get(report.eventId) ?? {
      eventId: report.eventId,
      eventName: report.eventName,
      eventDate: report.eventStartsAt,
      expectedAttendance: report.expectedAttendance,
      activeServiceCount: 0,
      attentionServiceCount: 0,
      plannedCovers: 0,
      recipeCount: 0,
      currentServiceCostBasisTotal: 0,
      suggestedServicePriceTotal: 0,
      suggestedProfitTotal: 0,
      effectiveSuggestedMarginPct: null,
      services: [],
    };
    current.activeServiceCount += 1;
    if (service.requiresManagerialAttention) current.attentionServiceCount += 1;
    if (report.plannedGuestCount != null && report.plannedGuestCount > 0) current.plannedCovers += report.plannedGuestCount;
    current.recipeCount += recipeCountByPlan.get(report.planId) ?? 0;
    current.currentServiceCostBasisTotal += report.pricing.serviceCostBasis ?? 0;
    current.suggestedServicePriceTotal += report.pricing.suggestedServicePrice ?? 0;
    current.suggestedProfitTotal += report.pricing.suggestedProfit ?? 0;
    current.services.push(service);
    eventGroups.set(report.eventId, current);
  }
  const events = [...eventGroups.values()].map((event) => ({
    ...event,
    currentServiceCostBasisTotal: round4(event.currentServiceCostBasisTotal),
    suggestedServicePriceTotal: round4(event.suggestedServicePriceTotal),
    suggestedProfitTotal: round4(event.suggestedProfitTotal),
    effectiveSuggestedMarginPct: event.suggestedServicePriceTotal > 0
      ? round4((event.suggestedProfitTotal / event.suggestedServicePriceTotal) * 100)
      : null,
  }));

  return {
    rows,
    historicalRows,
    events,
    summary,
    narrative,
  };
}

export async function getCateringPlanOperationalSummary(
  tenantSlug: string,
  planId: string,
): Promise<CateringPlanOperationalSummary> {
  const tenant = await resolveTenantModulePageContext(tenantSlug, "event_catering", "plans", "read");
  const supabase = await getSupabaseServerClient();
  const [plan, recipes, requirements, requisitions, receipts, consumptionRecords, consumptionLines] = await Promise.all([
    supabase.from("event_catering_plans").select("id,event_id,status,estimated_total_cost").eq("tenant_id", tenant.tenantId).eq("id", planId).maybeSingle(),
    supabase.from("event_catering_plan_recipes").select("id").eq("tenant_id", tenant.tenantId).eq("plan_id", planId),
    supabase.from("event_catering_requirements").select("required_quantity,shortage_quantity,estimated_unit_cost,unit_id").eq("tenant_id", tenant.tenantId).eq("plan_id", planId),
    supabase.from("event_catering_requisitions").select("id,status,estimated_total_cost").eq("tenant_id", tenant.tenantId).eq("plan_id", planId),
    supabase
      .from("event_catering_purchase_receipts")
      .select(
        "id,status,total_received_cost,event_catering_requisitions:event_catering_requisitions!event_catering_purchase_receipts_tenant_requisition_fkey!inner(plan_id)",
      )
      .eq("tenant_id", tenant.tenantId)
      .eq("event_catering_requisitions.plan_id", planId),
    supabase.from("event_catering_consumption_records").select("id,status").eq("tenant_id", tenant.tenantId).eq("plan_id", planId),
    supabase
      .from("event_catering_consumption_lines")
      .select(
        "consumed_quantity,waste_quantity,unit_cost,unit_id,event_catering_consumption_records:event_catering_consumption_records!event_catering_consumption_lines_tenant_record_fkey!inner(plan_id)",
      )
      .eq("tenant_id", tenant.tenantId)
      .eq("event_catering_consumption_records.plan_id", planId),
  ]);
  if (plan.error || !plan.data) throw new Error(`No fue posible cargar plan para resumen operativo: ${plan.error?.message ?? "plan no encontrado"}`);
  if (recipes.error) throw new Error(`No fue posible cargar recetas del plan: ${recipes.error.message}`);
  if (requirements.error) throw new Error(`No fue posible cargar requerimientos del plan: ${requirements.error.message}`);
  if (requisitions.error) throw new Error(`No fue posible cargar requisiciones del plan: ${requisitions.error.message}`);
  if (receipts.error) throw new Error(`No fue posible cargar recepciones del plan: ${receipts.error.message}`);
  if (consumptionRecords.error) throw new Error(`No fue posible cargar consumos del plan: ${consumptionRecords.error.message}`);
  if (consumptionLines.error) throw new Error(`No fue posible cargar líneas de consumo del plan: ${consumptionLines.error.message}`);

  const event = await supabase
    .from("events")
    .select("id,name,starts_at")
    .eq("tenant_id", tenant.tenantId)
    .eq("id", plan.data.event_id)
    .maybeSingle();
  if (event.error) throw new Error(`No fue posible cargar evento del plan: ${event.error.message}`);

  const requirementRows = requirements.data ?? [];
  const requisitionRows = requisitions.data ?? [];
  const receiptRows = receipts.data ?? [];
  const receivedReceiptRows = receiptRows.filter((row) => row.status === "received");
  const receiptIds = receivedReceiptRows.map((row) => row.id);
  const receiptLines = receiptIds.length > 0
    ? await supabase
        .from("event_catering_purchase_receipt_lines")
        .select("receipt_id,unit_id,received_quantity")
        .eq("tenant_id", tenant.tenantId)
        .in("receipt_id", receiptIds)
    : { data: [], error: null };
  if (receiptLines.error) throw new Error(`No fue posible cargar cantidades recibidas del plan: ${receiptLines.error.message}`);
  const consumptionRows = consumptionRecords.data ?? [];
  const consumptionLineRows = consumptionLines.data ?? [];

  const operationalQuantities = calculateOperationalQuantityMetrics(
    requirementRows.map((row) => ({ unitId: row.unit_id == null ? null : String(row.unit_id), quantity: Number(row.required_quantity ?? 0) })),
    (receiptLines.data ?? []).map((row) => ({ status: "received", unitId: row.unit_id == null ? null : String(row.unit_id), quantity: Number(row.received_quantity ?? 0) })),
    consumptionLineRows.map((row) => ({ unitId: row.unit_id == null ? null : String(row.unit_id), consumed: Number(row.consumed_quantity ?? 0), waste: Number(row.waste_quantity ?? 0) })),
  );
  const totalRequired = operationalQuantities.totalRequiredQty;
  const shortageCount = requirementRows.filter((row) => Number(row.shortage_quantity ?? 0) > 0).length;
  const estimatedShortageCost = requirementRows.reduce((acc, row) => {
    const shortage = Number(row.shortage_quantity ?? 0);
    const unitCost = Number((row as { estimated_unit_cost?: number | null }).estimated_unit_cost ?? 0);
    return acc + shortage * unitCost;
  }, 0);
  const approvedRequisitionCount = requisitionRows.filter((row) => row.status === "approved").length;
  const draftRequisitionCount = requisitionRows.filter((row) => row.status === "draft").length;
  const receivedReceiptCount = receivedReceiptRows.length;
  const draftReceiptCount = receiptRows.filter((row) => row.status === "draft").length;
  const confirmedConsumptionCount = consumptionRows.filter((row) => row.status === "confirmed").length;

  const operationalStatusLabel = (() => {
    if (confirmedConsumptionCount > 0) return "Consumo registrado";
    if (receivedReceiptCount > 0 && shortageCount <= 0) return "Listo para consumo";
    if (receivedReceiptCount > 0 && shortageCount > 0) return "Recepción pendiente";
    if (approvedRequisitionCount > 0) return "Recepción pendiente";
    if (draftReceiptCount > 0) return "Recepción pendiente";
    if (draftRequisitionCount > 0) return "Requisición en borrador";
    if (shortageCount > 0) return "Pendiente de requisición";
    if (requirementRows.length > 0) return "En planeación";
    return "En planeación";
  })();

  return {
    plan_id: plan.data.id,
    event_id: plan.data.event_id,
    event_name: event.data?.name ?? null,
    event_starts_at: event.data?.starts_at ?? null,
    plan_status: plan.data.status,
    recipe_count: (recipes.data ?? []).length,
    requirement_count: requirementRows.length,
    shortage_count: shortageCount,
    requisition_count: requisitionRows.length,
    approved_requisition_count: approvedRequisitionCount,
    receipt_count: receiptRows.length,
    draft_receipt_count: draftReceiptCount,
    received_receipt_count: receivedReceiptCount,
    canceled_receipt_count: receiptRows.filter((row) => row.status === "canceled").length,
    consumption_count: consumptionRows.length,
    confirmed_consumption_count: confirmedConsumptionCount,
    estimated_plan_cost: Number(plan.data.estimated_total_cost ?? 0),
    requisition_total: requisitionRows.reduce((acc, row) => acc + Number(row.estimated_total_cost ?? 0), 0),
    received_total_cost: calculateOperationalExecutionCosts({
      receivedCosts: receivedReceiptRows.map((row) => Number(row.total_received_cost ?? 0)),
      consumptionCosts: [],
    }).receivedCost,
    consumed_total_cost: calculateOperationalExecutionCosts({
      receivedCosts: [],
      consumptionCosts: consumptionLineRows.map((row) => ({
        consumedCost: Number(row.consumed_quantity ?? 0) * Number(row.unit_cost ?? 0),
        wasteCost: Number(row.waste_quantity ?? 0) * Number(row.unit_cost ?? 0),
      })),
    }).consumedCost,
    waste_total_cost: calculateOperationalExecutionCosts({
      receivedCosts: [],
      consumptionCosts: consumptionLineRows.map((row) => ({
        consumedCost: Number(row.consumed_quantity ?? 0) * Number(row.unit_cost ?? 0),
        wasteCost: Number(row.waste_quantity ?? 0) * Number(row.unit_cost ?? 0),
      })),
    }).wasteCost,
    estimated_shortage_cost: Number(estimatedShortageCost.toFixed(4)),
    operational_status_label: operationalStatusLabel,
    variance_received_vs_required: operationalQuantities.varianceReceivedVsRequired == null ? null : Number(operationalQuantities.varianceReceivedVsRequired.toFixed(4)),
    variance_consumed_vs_received: operationalQuantities.varianceConsumedVsReceived == null ? null : Number(operationalQuantities.varianceConsumedVsReceived.toFixed(4)),
  };
}

export async function listCateringPlanItemFlow(
  tenantSlug: string,
  planId: string,
): Promise<CateringPlanItemFlowRow[]> {
  const tenant = await resolveTenantModulePageContext(tenantSlug, "event_catering", "plans", "read");
  const supabase = await getSupabaseServerClient();
  const [requirements, requisitions, consumptions] = await Promise.all([
    supabase
      .from("event_catering_requirements")
      .select(
        "item_id,unit_id,required_quantity,shortage_quantity,estimated_unit_cost,kitchen_inventory_items:kitchen_inventory_items!event_catering_requirements_tenant_item_fkey(name),kitchen_inventory_units:kitchen_inventory_units!event_catering_requirements_tenant_unit_fkey(code)",
      )
      .eq("tenant_id", tenant.tenantId)
      .eq("plan_id", planId),
    supabase.from("event_catering_requisitions").select("id,status").eq("tenant_id", tenant.tenantId).eq("plan_id", planId),
    supabase.from("event_catering_consumption_records").select("id,status").eq("tenant_id", tenant.tenantId).eq("plan_id", planId),
  ]);
  if (requirements.error) throw new Error(`No fue posible cargar flujo de requerimientos: ${requirements.error.message}`);
  if (requisitions.error) throw new Error(`No fue posible cargar flujo de requisiciones: ${requisitions.error.message}`);
  if (consumptions.error) throw new Error(`No fue posible cargar flujo de consumos: ${consumptions.error.message}`);

  const reqIds = (requisitions.data ?? []).map((row) => row.id);
  const requirementItemIds = [...new Set((requirements.data ?? []).map((row) => row.item_id))];
  const [receipts, balances] = await Promise.all([
    reqIds.length > 0
      ? supabase
          .from("event_catering_purchase_receipts")
          .select("id,status,requisition_id")
          .eq("tenant_id", tenant.tenantId)
          .in("requisition_id", reqIds)
      : Promise.resolve({ data: [], error: null } as const),
    requirementItemIds.length > 0
      ? supabase
          .from("kitchen_inventory_balances")
          .select("item_id,quantity")
          .eq("tenant_id", tenant.tenantId)
          .in("item_id", requirementItemIds)
      : Promise.resolve({ data: [], error: null } as const),
  ]);
  if (receipts.error) throw new Error(`No fue posible cargar flujo de recepciones: ${receipts.error.message}`);
  if (balances.error) throw new Error(`No fue posible cargar balances para flujo: ${balances.error.message}`);

  const receiptIds = (receipts.data ?? []).filter((row) => row.status === "received").map((row) => row.id);
  const consumptionIds = (consumptions.data ?? []).map((row) => row.id);

  const [reqLines, receiptLines, consumptionLines] = await Promise.all([
    reqIds.length
      ? supabase
          .from("event_catering_requisition_lines")
          .select("item_id,unit_id,requested_quantity,requested_purchase_quantity")
          .eq("tenant_id", tenant.tenantId)
          .in("requisition_id", reqIds)
      : Promise.resolve({ data: [], error: null } as const),
    receiptIds.length
      ? supabase
          .from("event_catering_purchase_receipt_lines")
          .select("item_id,unit_id,received_quantity,received_total_cost")
          .eq("tenant_id", tenant.tenantId)
          .in("receipt_id", receiptIds)
      : Promise.resolve({ data: [], error: null } as const),
    consumptionIds.length
      ? supabase
          .from("event_catering_consumption_lines")
          .select("item_id,unit_id,consumed_quantity,waste_quantity,leftover_quantity,unit_cost")
          .eq("tenant_id", tenant.tenantId)
          .in("consumption_record_id", consumptionIds)
      : Promise.resolve({ data: [], error: null } as const),
  ]);
  if (reqLines.error) throw new Error(`No fue posible cargar líneas de requisición para flujo: ${reqLines.error.message}`);
  if (receiptLines.error) throw new Error(`No fue posible cargar líneas de recepción para flujo: ${receiptLines.error.message}`);
  if (consumptionLines.error) throw new Error(`No fue posible cargar líneas de consumo para flujo: ${consumptionLines.error.message}`);

  const currentBalanceByItem = new Map<string, number>();
  for (const bal of balances.data ?? []) {
    currentBalanceByItem.set(bal.item_id, Number((currentBalanceByItem.get(bal.item_id) ?? 0) + Number(bal.quantity ?? 0)));
  }

  const flow = new Map<string, CateringPlanItemFlowRow>();
  for (const row of requirements.data ?? []) {
    const key = `${row.item_id}:${row.unit_id}`;
    const item = Array.isArray(row.kitchen_inventory_items) ? row.kitchen_inventory_items[0] : row.kitchen_inventory_items;
    const unit = Array.isArray(row.kitchen_inventory_units) ? row.kitchen_inventory_units[0] : row.kitchen_inventory_units;
    flow.set(key, {
      item_id: row.item_id,
      item_name: (item as { name?: string } | null)?.name ?? null,
      unit_id: row.unit_id,
      unit_code: (unit as { code?: string } | null)?.code ?? null,
      required_quantity: Number(row.required_quantity ?? 0),
      shortage_quantity: Number(row.shortage_quantity ?? 0),
      requisition_requested_quantity: 0,
      requisition_purchase_quantity: 0,
      received_quantity: 0,
      consumed_quantity: 0,
      waste_quantity: 0,
      leftover_quantity: 0,
      current_balance: Number(currentBalanceByItem.get(row.item_id) ?? 0),
      estimated_required_cost: Number(row.required_quantity ?? 0) * Number(row.estimated_unit_cost ?? 0),
      received_cost: 0,
      consumed_cost: 0,
      waste_cost: 0,
      variance_required_vs_received: 0,
      variance_received_vs_consumed: 0,
      status: "pending_consumption",
    });
  }

  for (const row of reqLines.data ?? []) {
    const key = `${row.item_id}:${row.unit_id}`;
    const current = flow.get(key);
    if (!current) continue;
    current.requisition_requested_quantity += Number(row.requested_quantity ?? 0);
    current.requisition_purchase_quantity += Number(row.requested_purchase_quantity ?? 0);
  }
  for (const row of receiptLines.data ?? []) {
    const key = `${row.item_id}:${row.unit_id}`;
    const current = flow.get(key);
    if (!current) continue;
    current.received_quantity += Number(row.received_quantity ?? 0);
    current.received_cost += Number(row.received_total_cost ?? 0);
  }
  for (const row of consumptionLines.data ?? []) {
    const key = `${row.item_id}:${row.unit_id}`;
    const current = flow.get(key);
    if (!current) continue;
    const consumed = Number(row.consumed_quantity ?? 0);
    const waste = Number(row.waste_quantity ?? 0);
    const unitCost = Number(row.unit_cost ?? 0);
    current.consumed_quantity += consumed;
    current.waste_quantity += waste;
    current.leftover_quantity += Number(row.leftover_quantity ?? 0);
    current.consumed_cost += consumed * unitCost;
    current.waste_cost += waste * unitCost;
  }

  return Array.from(flow.values()).map((row) => {
    row.variance_required_vs_received = Number((row.received_quantity - row.required_quantity).toFixed(4));
    row.variance_received_vs_consumed = Number((row.received_quantity - (row.consumed_quantity + row.waste_quantity)).toFixed(4));
    if (row.received_quantity <= 0) row.status = "not_received";
    else if (row.received_quantity < row.required_quantity) row.status = "under_received";
    else if (row.received_quantity > row.required_quantity) row.status = "over_received";
    if (row.consumed_quantity + row.waste_quantity > row.received_quantity && row.received_quantity > 0) row.status = "over_consumed";
    else if (row.consumed_quantity + row.waste_quantity <= 0 && row.received_quantity > 0) row.status = "pending_consumption";
    else if (row.waste_quantity > 0) row.status = "waste_detected";
    else if (row.status === "pending_consumption") row.status = "pending_consumption";
    else row.status = "ok";
    return row;
  });
}

export async function listCateringPlanWarnings(
  tenantSlug: string,
  planId: string,
  options?: { itemFlow?: CateringPlanItemFlowRow[] },
): Promise<CateringPlanWarning[]> {
  const tenant = await resolveTenantModulePageContext(tenantSlug, "event_catering", "plans", "read");
  const supabase = await getSupabaseServerClient();
  const [requirements, requisitions, consumptions] = await Promise.all([
    supabase.from("event_catering_requirements").select("id,shortage_quantity").eq("tenant_id", tenant.tenantId).eq("plan_id", planId),
    supabase.from("event_catering_requisitions").select("id,status").eq("tenant_id", tenant.tenantId).eq("plan_id", planId),
    supabase.from("event_catering_consumption_records").select("id,status").eq("tenant_id", tenant.tenantId).eq("plan_id", planId),
  ]);
  if (requirements.error) throw new Error(`No fue posible evaluar warnings de requirements: ${requirements.error.message}`);
  if (requisitions.error) throw new Error(`No fue posible evaluar warnings de requisitions: ${requisitions.error.message}`);
  if (consumptions.error) throw new Error(`No fue posible evaluar warnings de consumos: ${consumptions.error.message}`);
  const requisitionIds = (requisitions.data ?? []).map((row) => row.id);
  const receipts = requisitionIds.length
    ? await supabase
        .from("event_catering_purchase_receipts")
        .select("id,status,requisition_id")
        .eq("tenant_id", tenant.tenantId)
        .in("requisition_id", requisitionIds)
    : ({ data: [], error: null } as const);
  if (receipts.error) throw new Error(`No fue posible evaluar warnings de receipts: ${receipts.error.message}`);
  const itemFlow = options?.itemFlow ?? (await listCateringPlanItemFlow(tenantSlug, planId));

  const warnings: CateringPlanWarning[] = [];
  const hasReq = (requirements.data ?? []).length > 0;
  const hasReqWithShortage = (requirements.data ?? []).some((row) => Number(row.shortage_quantity ?? 0) > 0);
  const approvedReq = (requisitions.data ?? []).filter((row) => row.status === "approved");
  const draftReceipts = (receipts.data ?? []).filter((row) => row.status === "draft");
  const receivedReceipts = (receipts.data ?? []).filter((row) => row.status === "received");
  const draftConsumptions = (consumptions.data ?? []).filter((row) => row.status === "draft");
  const confirmedConsumptions = (consumptions.data ?? []).filter((row) => row.status === "confirmed");

  if (hasReq && (requisitions.data ?? []).length === 0) {
    warnings.push({ code: "requirements_without_requisition", severity: "warning", message: "Hay requerimientos sin requisición generada." });
  }
  if (hasReqWithShortage && approvedReq.length === 0) {
    warnings.push({ code: "shortages_without_purchase", severity: "warning", message: "Hay faltantes sin requisición aprobada." });
  }
  if (approvedReq.length > 0 && receivedReceipts.length === 0) {
    warnings.push({ code: "approved_requisition_without_receipt", severity: "warning", message: "Hay requisición approved sin recepción confirmada." });
  }
  if (draftReceipts.length > 0) {
    warnings.push({ code: "receipt_draft_pending", severity: "info", message: `Hay ${draftReceipts.length} recepción(es) en draft pendientes de confirmar.` });
  }
  if (draftConsumptions.length > 0) {
    warnings.push({ code: "consumption_draft_pending", severity: "info", message: `Hay ${draftConsumptions.length} consumo(s) en draft sin confirmar.` });
  }
  const flowWithWaste = itemFlow.filter((row) => row.waste_quantity > 0);
  if (flowWithWaste.length > 0 && confirmedConsumptions.length > 0) {
    warnings.push({ code: "consumption_with_waste", severity: "info", message: `Se detectó merma en ${flowWithWaste.length} insumo(s) consumidos.` });
  }
  if (confirmedConsumptions.length > 0 && receivedReceipts.length === 0) {
    warnings.push({ code: "consumption_without_receipt", severity: "warning", message: "Hay consumo confirmado sin recepción registrada para el plan." });
  }
  const bigGap = itemFlow.filter((row) => Math.abs(row.variance_received_vs_consumed) > 0.0001);
  if (bigGap.length > 0) {
    warnings.push({ code: "received_vs_consumed_gap", severity: "info", message: `Existen ${bigGap.length} diferencias entre recibido y consumido.` });
  }
  return warnings;
}

export async function listInventoryReversals(tenantSlug: string): Promise<EventCateringInventoryReversal[]> {
  const tenant = await resolveTenantModulePageContext(tenantSlug, "event_catering", "requisitions", "read");
  const supabase = await getSupabaseServerClient();
  const { data, error } = await supabase
    .from("event_catering_inventory_reversals")
    .select("id,tenant_id,reversal_type,target_type,target_id,status,reason,notes,created_at,updated_at,created_by,applied_at,applied_by,canceled_at,canceled_by")
    .eq("tenant_id", tenant.tenantId)
    .order("created_at", { ascending: false });
  if (error) throw new Error(`No fue posible listar reversas de inventario: ${error.message}`);
  const reversals = (data ?? []) as EventCateringInventoryReversal[];
  if (reversals.length === 0) return [];

  const reversalIds = reversals.map((row) => row.id);
  const { data: lines, error: linesError } = await supabase
    .from("event_catering_inventory_reversal_lines")
    .select("reversal_id,compensating_movement_id")
    .eq("tenant_id", tenant.tenantId)
    .in("reversal_id", reversalIds);
  if (linesError) throw new Error(`No fue posible cargar líneas de reversa: ${linesError.message}`);

  const counters = new Map<string, { lineCount: number; compensatedCount: number }>();
  for (const row of lines ?? []) {
    const current = counters.get(row.reversal_id) ?? { lineCount: 0, compensatedCount: 0 };
    current.lineCount += 1;
    if (row.compensating_movement_id) current.compensatedCount += 1;
    counters.set(row.reversal_id, current);
  }

  return reversals.map((row) => {
    const stats = counters.get(row.id) ?? { lineCount: 0, compensatedCount: 0 };
    return {
      ...row,
      line_count: stats.lineCount,
      compensated_line_count: stats.compensatedCount,
      has_compensating_movements: stats.compensatedCount > 0,
      target_label: `${row.target_type}:${row.target_id.slice(0, 8)}`,
    };
  });
}

export async function getInventoryReversal(tenantSlug: string, reversalId: string): Promise<EventCateringInventoryReversal | null> {
  const tenant = await resolveTenantModulePageContext(tenantSlug, "event_catering", "requisitions", "read");
  const supabase = await getSupabaseServerClient();
  const { data, error } = await supabase
    .from("event_catering_inventory_reversals")
    .select("id,tenant_id,reversal_type,target_type,target_id,status,reason,notes,created_at,updated_at,created_by,applied_at,applied_by,canceled_at,canceled_by")
    .eq("tenant_id", tenant.tenantId)
    .eq("id", reversalId)
    .maybeSingle();
  if (error) throw new Error(`No fue posible cargar reversa de inventario: ${error.message}`);
  return (data as EventCateringInventoryReversal | null) ?? null;
}

export async function listInventoryReversalLines(tenantSlug: string, reversalId: string): Promise<EventCateringInventoryReversalLine[]> {
  const tenant = await resolveTenantModulePageContext(tenantSlug, "event_catering", "requisitions", "read");
  const supabase = await getSupabaseServerClient();
  const { data, error } = await supabase
    .from("event_catering_inventory_reversal_lines")
    .select(
      "id,tenant_id,reversal_id,original_movement_id,compensating_movement_id,item_id,location_id,unit_id,quantity,unit_cost,total_cost,idempotency_key,notes,created_at,created_by,kitchen_inventory_items:kitchen_inventory_items!event_catering_inventory_reversal_lines_tenant_item_fkey(id,name),kitchen_inventory_locations:kitchen_inventory_locations!event_catering_inventory_reversal_lines_tenant_location_fkey(id,name),kitchen_inventory_units:kitchen_inventory_units!event_catering_inventory_reversal_lines_tenant_unit_fkey(id,code,name),original_movement:kitchen_inventory_movements!event_catering_inventory_reversal_lines_tenant_original_movement_fkey(id,movement_type,source_type,source_id,quantity,unit_cost),compensating_movement:kitchen_inventory_movements!event_catering_inventory_reversal_lines_tenant_compensating_movement_fkey(id,movement_type,source_type,source_id,quantity,unit_cost)",
    )
    .eq("tenant_id", tenant.tenantId)
    .eq("reversal_id", reversalId)
    .order("created_at", { ascending: true });
  if (error) throw new Error(`No fue posible listar líneas de reversa: ${error.message}`);
  return ((data ?? []) as Array<Record<string, unknown>>).map((row) => ({
    ...(row as unknown as EventCateringInventoryReversalLine),
    kitchen_inventory_items: Array.isArray(row.kitchen_inventory_items)
      ? ((row.kitchen_inventory_items[0] ?? null) as EventCateringInventoryReversalLine["kitchen_inventory_items"])
      : ((row.kitchen_inventory_items ?? null) as EventCateringInventoryReversalLine["kitchen_inventory_items"]),
    kitchen_inventory_locations: Array.isArray(row.kitchen_inventory_locations)
      ? ((row.kitchen_inventory_locations[0] ?? null) as EventCateringInventoryReversalLine["kitchen_inventory_locations"])
      : ((row.kitchen_inventory_locations ?? null) as EventCateringInventoryReversalLine["kitchen_inventory_locations"]),
    kitchen_inventory_units: Array.isArray(row.kitchen_inventory_units)
      ? ((row.kitchen_inventory_units[0] ?? null) as EventCateringInventoryReversalLine["kitchen_inventory_units"])
      : ((row.kitchen_inventory_units ?? null) as EventCateringInventoryReversalLine["kitchen_inventory_units"]),
    original_movement: Array.isArray(row.original_movement)
      ? ((row.original_movement[0] ?? null) as EventCateringInventoryReversalLine["original_movement"])
      : ((row.original_movement ?? null) as EventCateringInventoryReversalLine["original_movement"]),
    compensating_movement: Array.isArray(row.compensating_movement)
      ? ((row.compensating_movement[0] ?? null) as EventCateringInventoryReversalLine["compensating_movement"])
      : ((row.compensating_movement ?? null) as EventCateringInventoryReversalLine["compensating_movement"]),
  }));
}

export async function getReversalTargetSummary(
  tenantSlug: string,
  targetType: EventCateringInventoryReversalTargetType,
  targetId: string,
): Promise<EventCateringReversalTargetSummary | null> {
  const tenant = await resolveTenantModulePageContext(tenantSlug, "event_catering", "requisitions", "read");
  const supabase = await getSupabaseServerClient();

  if (targetType === "receipt_line") {
    const { data, error } = await supabase
      .from("event_catering_purchase_receipt_lines")
      .select("tenant_id,inventory_movement_id")
      .eq("tenant_id", tenant.tenantId)
      .eq("id", targetId)
      .maybeSingle();
    if (error) throw new Error(`No fue posible cargar resumen de target de reversa: ${error.message}`);
    if (!data) return null;
    const movementIds = data.inventory_movement_id ? [String(data.inventory_movement_id)] : [];
    return {
      tenant_id: data.tenant_id,
      target_type: targetType,
      target_id: targetId,
      source_kind: "receipt_line",
      movement_ids: movementIds,
      movement_count: movementIds.length,
    };
  }

  if (targetType === "consumption_line") {
    const { data, error } = await supabase
      .from("event_catering_consumption_lines")
      .select("tenant_id,consumption_movement_id,waste_movement_id")
      .eq("tenant_id", tenant.tenantId)
      .eq("id", targetId)
      .maybeSingle();
    if (error) throw new Error(`No fue posible cargar resumen de target de reversa: ${error.message}`);
    if (!data) return null;
    const movementIds = [data.consumption_movement_id, data.waste_movement_id].filter((value): value is string => Boolean(value)).map(String);
    return {
      tenant_id: data.tenant_id,
      target_type: targetType,
      target_id: targetId,
      source_kind: "consumption_line",
      movement_ids: movementIds,
      movement_count: movementIds.length,
    };
  }

  return null;
}
