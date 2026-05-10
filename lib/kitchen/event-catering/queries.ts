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
  CateringPlanItemFlowRow,
  CateringPlanWarning,
  EventCateringInventoryReversal,
  EventCateringInventoryReversalLine,
  EventCateringInventoryReversalTargetType,
  EventCateringReversalTargetSummary,
  ReadyRecipeForCatering,
  RequisitionLinePurchaseOptionAlternative,
} from "./types";

function round4(value: number): number {
  return Number(value.toFixed(4));
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
      lines_without_quote: 0,
      lines_without_purchase_option: 0,
      lines_without_supplier: 0,
      status_summary: "complete",
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
    grouped.set(key, current);
  }

  return Array.from(grouped.values()).map((row) => {
    let statusSummary: CateringRequisitionSupplierSummary["status_summary"] = "complete";
    if (row.lines_without_supplier > 0) statusSummary = "missing_supplier";
    else if (row.lines_without_purchase_option > 0) statusSummary = "missing_purchase_option";
    else if (row.lines_without_quote > 0) statusSummary = "missing_quote";
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

  return summary;
}

export async function listCateringPlanSummaries(tenantSlug: string): Promise<CateringPlanSummary[]> {
  const tenant = await resolveTenantModulePageContext(tenantSlug, "event_catering", "plans", "read");
  const supabase = await getSupabaseServerClient();
  const [plans, events, planRecipes, requirements, requisitions] = await Promise.all([
    supabase
      .from("event_catering_plans")
      .select("id,event_id,name,status,estimated_total_cost")
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
        .select("plan_id,shortage_quantity,source_payload")
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
    const receiptStatus = statusFromSet(receiptStatusesByPlan.get(plan.plan_id), "draft", "received");
    const consumptionStatus = statusFromSet(consumptionStatusesByPlan.get(plan.plan_id), "draft", "confirmed");
    const operationalStatus: CateringPlanOperationalIndexRow["operational_status"] =
      plan.recipe_count === 0
        ? "Sin recetas"
        : req.requirements === 0
          ? "Requerimientos pendientes"
          : req.shortages > 0
            ? "Con faltantes"
            : !plan.requisition_id
              ? "Requisición pendiente"
              : receiptStatus === "none" || receiptStatus === "draft" || receiptStatus === "mixed"
                ? "Compra por recibir"
                : consumptionStatus === "draft"
                  ? "Consumo en borrador"
                  : consumptionStatus === "confirmed"
                    ? "Consumo confirmado"
                    : "Listo para consumo";

    return {
      plan_id: plan.plan_id,
      plan_name: plan.plan_name,
      event_id: plan.event_id,
      event_name: plan.event_name,
      event_date: plan.event_starts_at,
      expected_attendance: null,
      planned_guest_count: null,
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
      operational_status: operationalStatus,
    } satisfies CateringPlanOperationalIndexRow;
  });
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
    .select("requisition_id,item_id,unit_id,requested_quantity,requested_purchase_quantity,expected_inventory_quantity,approved_unit_price,approved_total_cost,quoted_unit_price,quoted_total_cost,preliminary_unit_price,preliminary_total_cost,estimated_unit_cost,estimated_total_cost")
    .eq("tenant_id", tenant.tenantId)
    .in("requisition_id", requisitionIds);
  if (lineRowsError) throw new Error(`No fue posible contar líneas de requisiciones: ${lineRowsError.message}`);
  const lineCountByReq = new Map<string, number>();
  const receivableLineCountByReq = new Map<string, number>();
  const expectedTotalByReq = new Map<string, number>();
  for (const row of lineRows ?? []) {
    lineCountByReq.set(row.requisition_id, (lineCountByReq.get(row.requisition_id) ?? 0) + 1);
    const requestedQuantity = Number(row.requested_quantity ?? 0);
    const expectedInventoryQuantity = Number(row.expected_inventory_quantity ?? requestedQuantity);
    const explicitTotal = Number(row.approved_total_cost ?? 0) > 0
      ? Number(row.approved_total_cost)
      : Number(row.quoted_total_cost ?? 0) > 0
        ? Number(row.quoted_total_cost)
        : Number(row.preliminary_total_cost ?? 0) > 0
          ? Number(row.preliminary_total_cost)
          : Number(row.estimated_total_cost ?? 0);
    const effectivePrice = Number(row.approved_unit_price ?? row.quoted_unit_price ?? row.preliminary_unit_price ?? row.estimated_unit_cost ?? 0);
    const fallbackPurchaseQuantity = Number(row.requested_purchase_quantity ?? 0);
    const fallbackTotal = fallbackPurchaseQuantity > 0 ? fallbackPurchaseQuantity * effectivePrice : 0;
    const lineExpectedTotal = explicitTotal > 0 ? explicitTotal : fallbackTotal;
    const isReceivable =
      row.item_id != null &&
      row.unit_id != null &&
      requestedQuantity > 0 &&
      expectedInventoryQuantity > 0 &&
      lineExpectedTotal > 0;
    if (isReceivable) {
      receivableLineCountByReq.set(row.requisition_id, (receivableLineCountByReq.get(row.requisition_id) ?? 0) + 1);
      expectedTotalByReq.set(
        row.requisition_id,
        (expectedTotalByReq.get(row.requisition_id) ?? 0) + lineExpectedTotal,
      );
    }
  }

  return approvedWithoutReceipt.map((row) => {
    const plan = Array.isArray(row.event_catering_plans) ? row.event_catering_plans[0] : row.event_catering_plans;
    const lineCount = lineCountByReq.get(row.id) ?? 0;
    const receivableLineCount = receivableLineCountByReq.get(row.id) ?? 0;
    const expectedReceiptTotal = Number((expectedTotalByReq.get(row.id) ?? 0).toFixed(4));
    const canCreateReceipt = lineCount > 0 && receivableLineCount === lineCount && expectedReceiptTotal > 0;
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
        : lineCount === 0
          ? "Sin líneas recibibles"
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
      } else if (plan.receipt_status_summary === "none") {
        blockingReason = "Compra autorizada pendiente de recepción";
      } else if (plan.receipt_status_summary === "draft") {
        blockingReason = "Recepción en borrador";
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
    const totalOutQuantity = Number((Number(line.consumed_quantity ?? 0) + Number(line.waste_quantity ?? 0)).toFixed(4));
    const currentBreakdown = line.location_id
      ? summarize(line.item_id, line.location_id, planId)
      : summarizeAggregate(line.item_id, planId);
    const missingLocation = totalOutQuantity > 0 && !line.location_id;
    const hasSufficientBalance = totalOutQuantity <= 0 || currentBreakdown.available_quantity >= totalOutQuantity;

    let warningMessage: string | null = null;
    if (!hasSufficientBalance) warningMessage = "Stock insuficiente";
    else if (missingLocation) warningMessage = "Falta ubicación";

    const locationOptions = (locations.data ?? [])
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
      ...currentBreakdown,
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

  const positiveOutput = availability.filter((line) => line.total_out_quantity > 0);
  const missingLocationCount = positiveOutput.filter((line) => line.missing_location).length;
  const insufficientStockCount = positiveOutput.filter((line) => !line.has_sufficient_balance).length;
  const invalidQuantityCount = availability.filter((line) => line.total_out_quantity < 0).length;

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

export async function getCateringPlanOperationalSummary(
  tenantSlug: string,
  planId: string,
): Promise<CateringPlanOperationalSummary> {
  const tenant = await resolveTenantModulePageContext(tenantSlug, "event_catering", "plans", "read");
  const supabase = await getSupabaseServerClient();
  const [plan, recipes, requirements, requisitions, receipts, consumptionRecords, consumptionLines] = await Promise.all([
    supabase.from("event_catering_plans").select("id,event_id,status,estimated_total_cost").eq("tenant_id", tenant.tenantId).eq("id", planId).maybeSingle(),
    supabase.from("event_catering_plan_recipes").select("id").eq("tenant_id", tenant.tenantId).eq("plan_id", planId),
    supabase.from("event_catering_requirements").select("required_quantity,shortage_quantity").eq("tenant_id", tenant.tenantId).eq("plan_id", planId),
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
        "consumed_quantity,waste_quantity,unit_cost,event_catering_consumption_records:event_catering_consumption_records!event_catering_consumption_lines_tenant_record_fkey!inner(plan_id)",
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
  const consumptionRows = consumptionRecords.data ?? [];
  const consumptionLineRows = consumptionLines.data ?? [];

  const totalRequired = requirementRows.reduce((acc, row) => acc + Number(row.required_quantity ?? 0), 0);
  const totalReceivedQty = 0;
  const totalConsumedQty = consumptionLineRows.reduce((acc, row) => acc + Number(row.consumed_quantity ?? 0), 0);
  const totalWasteQty = consumptionLineRows.reduce((acc, row) => acc + Number(row.waste_quantity ?? 0), 0);

  return {
    plan_id: plan.data.id,
    event_id: plan.data.event_id,
    event_name: event.data?.name ?? null,
    event_starts_at: event.data?.starts_at ?? null,
    plan_status: plan.data.status,
    recipe_count: (recipes.data ?? []).length,
    requirement_count: requirementRows.length,
    shortage_count: requirementRows.filter((row) => Number(row.shortage_quantity ?? 0) > 0).length,
    requisition_count: requisitionRows.length,
    approved_requisition_count: requisitionRows.filter((row) => row.status === "approved").length,
    receipt_count: receiptRows.length,
    draft_receipt_count: receiptRows.filter((row) => row.status === "draft").length,
    received_receipt_count: receivedReceiptRows.length,
    canceled_receipt_count: receiptRows.filter((row) => row.status === "canceled").length,
    consumption_count: consumptionRows.length,
    confirmed_consumption_count: consumptionRows.filter((row) => row.status === "confirmed").length,
    estimated_plan_cost: Number(plan.data.estimated_total_cost ?? 0),
    requisition_total: requisitionRows.reduce((acc, row) => acc + Number(row.estimated_total_cost ?? 0), 0),
    received_total_cost: receivedReceiptRows.reduce((acc, row) => acc + Number(row.total_received_cost ?? 0), 0),
    consumed_total_cost: consumptionLineRows.reduce(
      (acc, row) => acc + Number(row.consumed_quantity ?? 0) * Number(row.unit_cost ?? 0),
      0,
    ),
    waste_total_cost: consumptionLineRows.reduce(
      (acc, row) => acc + Number(row.waste_quantity ?? 0) * Number(row.unit_cost ?? 0),
      0,
    ),
    variance_received_vs_required: Number((totalReceivedQty - totalRequired).toFixed(4)),
    variance_consumed_vs_received: Number((totalConsumedQty + totalWasteQty - totalReceivedQty).toFixed(4)),
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
