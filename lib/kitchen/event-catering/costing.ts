import { createHash } from "node:crypto";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { calculateCateringServicePricing } from "./financial-model";
import { ensureCateringPlanPricingForTenant } from "./pricing-actions";
import { getCateringPlanPricingBatchForTenant } from "./pricing-queries";
import type { CateringEffectivePlanPricing } from "./pricing-types";

type ConversionMap = Map<string, number>;

type EventLite = {
  id: string;
  name: string | null;
};

type PlanLite = {
  id: string;
  name: string | null;
  planned_guest_count: number | null;
  status: string;
};

type PlanRecipeLite = {
  id: string;
  plan_id: string;
  recipe_id: string;
  recipe_version_id: string;
  snapshot_id: string | null;
  planned_servings: number;
  multiplier: number;
  estimated_cost: number;
  sort_order: number;
  kitchen_recipe_recipes?: { id: string; name: string } | null;
};

type RecipeVersionLite = {
  id: string;
  recipe_id: string;
  servings: number | null;
  yield_quantity: number;
};

type RecipeLineLite = {
  id: string;
  recipe_version_id: string;
  line_type: "inventory_item" | "sub_recipe";
  item_id: string | null;
  sub_recipe_version_id: string | null;
  quantity: number;
  unit_id: string;
  waste_percent: number;
  kitchen_inventory_items?: {
    id: string;
    name: string;
    default_unit_id: string;
    current_unit_cost: number;
  } | null;
};

type DetailedRequirementLine = {
  eventId: string;
  planId: string;
  planName: string | null;
  planRecipeId: string;
  recipeId: string;
  recipeVersionId: string;
  recipeCostSnapshotId: string | null;
  recipeName: string;
  plannedServings: number;
  multiplier: number;
  itemId: string;
  itemName: string;
  operationalUnitId: string;
  requiredQuantity: number;
  estimatedUnitCost: number;
  sourcePayload: Record<string, unknown>;
};

type CostingWarning = {
  scope:
    | "configuration"
    | "recipe_version"
    | "recipe_line"
    | "price_resolution"
    | "snapshot_validation";
  plan_id?: string;
  plan_recipe_id?: string;
  item_id?: string;
  message: string;
};

type PriceResolution = {
  supplierId: string | null;
  purchaseOptionId: string | null;
  supplierPriceId: string | null;
  purchaseUnitId: string | null;
  purchaseUnitCode: string | null;
  quantityPerPurchaseUnit: number | null;
  pricePerPurchaseUnit: number | null;
  operationalUnitCost: number;
  currency: string;
  priceSource: "supplier_price_current" | "current_unit_cost_fallback";
  warning: string | null;
};

type ServicePricingSnapshotFields = {
  extraStaffCount: number;
  extraStaffUnitCost: number | null;
  extraStaffTotalCost: number;
  serviceCostBasis: number;
  targetMarginPct: number;
  suggestedProfit: number;
  suggestedServicePrice: number;
  pricingModelVersion: "service_margin_v1";
  pricingPayload: Record<string, unknown>;
};

export type EventCostingDraft = {
  eventId: string;
  eventName: string | null;
  snapshotKind: "updated";
  baseSnapshotId: string;
  configFingerprint: string;
  configurationPayload: Record<string, unknown>;
  warnings: CostingWarning[];
  serviceRows: Array<{
    planId: string;
    serviceName: string | null;
    plannedGuestCount: number | null;
    sortOrder: number;
    totalCost: number;
    baseTotalCost: number;
    priceVariationAmount: number;
    priceVariationPercent: number | null;
    recipeCount: number;
  } & ServicePricingSnapshotFields>;
  recipeRows: Array<{
    planId: string;
    planRecipeId: string;
    serviceKey: string;
    recipeId: string;
    recipeVersionId: string;
    recipeCostSnapshotId: string | null;
    recipeName: string;
    plannedServings: number;
    multiplier: number;
    totalCost: number;
    baseTotalCost: number;
    priceVariationAmount: number;
    priceVariationPercent: number | null;
    lineCount: number;
    sourcePayload: Record<string, unknown>;
  }>;
  itemRows: Array<{
    planId: string;
    planRecipeId: string;
    recipeSummaryKey: string;
    serviceKey: string;
    recipeId: string;
    recipeVersionId: string;
    itemId: string;
    itemName: string;
    operationalUnitId: string;
    operationalUnitCode: string;
    supplierId: string | null;
    purchaseOptionId: string | null;
    supplierPriceId: string | null;
    purchaseUnitId: string | null;
    purchaseUnitCode: string | null;
    requiredQuantity: number;
    quantityPerPurchaseUnit: number | null;
    pricePerPurchaseUnit: number | null;
    operationalUnitCost: number;
    lineTotalCost: number;
    baseOperationalUnitCost: number;
    baseLineTotalCost: number;
    priceVariationAmount: number;
    priceVariationPercent: number | null;
    currency: string;
    priceSource: string;
    priceResolutionWarning: string | null;
    sourcePayload: Record<string, unknown>;
  }>;
};

export type EventInitialCostingPreview = {
  eventId: string;
  eventName: string | null;
  configFingerprint: string;
  configurationPayload: Record<string, unknown>;
  warnings: CostingWarning[];
  serviceRows: EventCostingDraft["serviceRows"];
  recipeRows: EventCostingDraft["recipeRows"];
  itemRows: EventCostingDraft["itemRows"];
};

type BaseSnapshotLine = {
  id: string;
  snapshot_id: string;
  service_summary_id: string;
  recipe_summary_id: string;
  event_id: string;
  plan_id: string;
  plan_recipe_id: string;
  recipe_id: string;
  recipe_version_id: string;
  item_id: string;
  item_name_snapshot: string;
  operational_unit_id: string;
  operational_unit_code_snapshot: string;
  supplier_id: string | null;
  purchase_option_id: string | null;
  purchase_unit_id: string | null;
  required_quantity: number;
  base_operational_unit_cost: number;
  base_line_total_cost: number;
  currency: string;
  source_payload: Record<string, unknown> | null;
  service_summary?: { id: string; service_name_snapshot: string | null; planned_guest_count_snapshot: number | null } | null;
  recipe_summary?: {
    id: string;
    recipe_name_snapshot: string;
    planned_servings_snapshot: number;
    multiplier_snapshot: number;
    recipe_cost_snapshot_id: string | null;
  } | null;
};

export type EventCostingSnapshotResult = {
  snapshotId: string;
  eventId: string;
  snapshotKind: "initial" | "updated";
  totalCost: number;
  baseTotalCost: number;
  priceVariationAmount: number;
  priceVariationPercent: number | null;
  serviceCount: number;
  recipeCount: number;
  itemLineCount: number;
  configFingerprint: string;
  warnings: CostingWarning[];
};

function round4(value: number): number {
  return Number(value.toFixed(4));
}

function toPercentDelta(current: number, base: number): number | null {
  if (base <= 0) return null;
  return round4(((current - base) / base) * 100);
}

function convertQuantity(quantity: number, fromUnitId: string, toUnitId: string, conversions: ConversionMap): number | null {
  if (fromUnitId === toUnitId) return quantity;
  const direct = conversions.get(`${fromUnitId}:${toUnitId}`);
  if (direct && direct > 0) return quantity * direct;
  const reverse = conversions.get(`${toUnitId}:${fromUnitId}`);
  if (reverse && reverse > 0) return quantity / reverse;
  return null;
}

function stableStringify(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map((entry) => stableStringify(entry)).join(",")}]`;
  }
  if (value && typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>).sort(([left], [right]) => left.localeCompare(right));
    return `{${entries.map(([key, entry]) => `${JSON.stringify(key)}:${stableStringify(entry)}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

function buildFingerprint(payload: unknown): string {
  return createHash("sha256").update(stableStringify(payload)).digest("hex");
}

type DirectServiceRow = {
  planId: string;
  serviceName: string | null;
  plannedGuestCount: number | null;
  sortOrder: number;
  totalCost: number;
  baseTotalCost: number;
  priceVariationAmount: number;
  priceVariationPercent: number | null;
  recipeCount: number;
};

async function addFinancialPricingToServices(
  tenantId: string,
  serviceRows: DirectServiceRow[],
): Promise<{ serviceRows: Array<DirectServiceRow & ServicePricingSnapshotFields>; pricingPayload: Array<Record<string, unknown>> }> {
  const supabase = await getSupabaseServerClient();
  const pricingByPlanId = await getCateringPlanPricingBatchForTenant(
    supabase,
    tenantId,
    serviceRows.map((row) => row.planId),
  );
  const enriched = serviceRows.map((row) => {
    const pricing = pricingByPlanId.get(row.planId) as CateringEffectivePlanPricing;
    const result = calculateCateringServicePricing({
      foodCost: row.totalCost,
      extraStaffCount: pricing.extra_staff_count,
      extraStaffUnitCost: pricing.extra_staff_unit_cost,
      targetMarginPct: pricing.target_margin_pct,
      plannedGuestCount: row.plannedGuestCount,
      currency: pricing.currency,
    });
    if (result.status === "incomplete") {
      throw new Error(`Falta configurar la tarifa de personal extra para completar el costeo del servicio ${row.serviceName ?? row.planId}.`);
    }
    const pricingPayload = {
      model: "service_margin_v1",
      extraStaffCount: pricing.extra_staff_count,
      extraStaffUnitCost: pricing.extra_staff_unit_cost,
      staffRateSource: pricing.staff_rate_source,
      targetMarginPct: pricing.target_margin_pct,
      marginSource: pricing.margin_source,
      currency: pricing.currency,
    };
    return {
      ...row,
      extraStaffCount: pricing.extra_staff_count,
      extraStaffUnitCost: pricing.extra_staff_unit_cost,
      extraStaffTotalCost: result.extraLaborCost,
      serviceCostBasis: result.serviceCostBasis,
      targetMarginPct: pricing.target_margin_pct,
      suggestedProfit: result.suggestedProfit!,
      suggestedServicePrice: result.suggestedServicePrice!,
      pricingModelVersion: "service_margin_v1" as const,
      pricingPayload,
    };
  });
  return {
    serviceRows: enriched,
    pricingPayload: enriched.map((row) => ({ plan_id: row.planId, ...row.pricingPayload })),
  };
}

function isActivePlanLite(plan: Pick<PlanLite, "status">): boolean {
  return plan.status !== "canceled";
}

async function loadConversionMap(tenantId: string): Promise<ConversionMap> {
  const supabase = await getSupabaseServerClient();
  const { data, error } = await supabase
    .from("kitchen_inventory_unit_conversions")
    .select("from_unit_id,to_unit_id,factor")
    .eq("tenant_id", tenantId)
    .eq("is_active", true);
  if (error) throw new Error(`No fue posible cargar conversiones de unidades: ${error.message}`);
  const conversions = new Map<string, number>();
  for (const row of data ?? []) {
    conversions.set(`${row.from_unit_id}:${row.to_unit_id}`, Number(row.factor));
  }
  return conversions;
}

async function loadEventCostingContext(tenantId: string, eventId: string) {
  const supabase = await getSupabaseServerClient();
  const [{ data: eventRow, error: eventError }, { data: planRows, error: planError }, { data: planRecipeRows, error: planRecipeError }] =
    await Promise.all([
      supabase.from("events").select("id,name").eq("tenant_id", tenantId).eq("id", eventId).maybeSingle(),
      supabase
        .from("event_catering_plans")
        .select("id,name,planned_guest_count,status")
        .eq("tenant_id", tenantId)
        .eq("event_id", eventId)
        .order("created_at", { ascending: true }),
      supabase
        .from("event_catering_plan_recipes")
        .select(
          "id,plan_id,recipe_id,recipe_version_id,snapshot_id,planned_servings,multiplier,estimated_cost,sort_order,kitchen_recipe_recipes:kitchen_recipe_recipes!event_catering_plan_recipes_tenant_recipe_fkey(id,name)",
        )
        .eq("tenant_id", tenantId)
        .in(
          "plan_id",
          (
            await supabase
              .from("event_catering_plans")
              .select("id")
              .eq("tenant_id", tenantId)
              .eq("event_id", eventId)
          ).data?.map((row) => row.id) ?? [],
        ),
    ]);

  if (eventError || !eventRow) throw new Error("Evento inválido para costeo.");
  if (planError) throw new Error(`No fue posible cargar servicios del evento: ${planError.message}`);
  if (planRecipeError) throw new Error(`No fue posible cargar recetas de servicios: ${planRecipeError.message}`);

  const event = eventRow as EventLite;
  const plans = ((planRows ?? []) as PlanLite[]).filter(isActivePlanLite);
  const activePlanIds = new Set(plans.map((plan) => plan.id));
  const planRecipes = ((planRecipeRows ?? []) as Array<Record<string, unknown>>).map((row) => ({
    ...(row as unknown as PlanRecipeLite),
    kitchen_recipe_recipes: Array.isArray(row.kitchen_recipe_recipes)
      ? ((row.kitchen_recipe_recipes[0] ?? null) as PlanRecipeLite["kitchen_recipe_recipes"])
      : ((row.kitchen_recipe_recipes ?? null) as PlanRecipeLite["kitchen_recipe_recipes"]),
  })).filter((row) => activePlanIds.has(row.plan_id));

  return { event, plans, planRecipes };
}

async function buildDetailedRequirementsForEvent(
  tenantId: string,
  eventId: string,
): Promise<{
  event: EventLite;
  plans: PlanLite[];
  planRecipes: PlanRecipeLite[];
  lines: DetailedRequirementLine[];
  warnings: CostingWarning[];
  configPayload: Record<string, unknown>;
  configFingerprint: string;
}> {
  const supabase = await getSupabaseServerClient();
  const context = await loadEventCostingContext(tenantId, eventId);
  const warnings: CostingWarning[] = [];

  if (context.plans.length === 0) {
    throw new Error("El evento no tiene servicios (`event_catering_plans`) para costear.");
  }
  if (context.planRecipes.length === 0) {
    throw new Error("El evento no tiene recetas agregadas a sus servicios para costear.");
  }

  const [versionsRes, linesRes, conversions] = await Promise.all([
    supabase
      .from("kitchen_recipe_versions")
      .select("id,recipe_id,servings,yield_quantity")
      .eq("tenant_id", tenantId),
    supabase
      .from("kitchen_recipe_lines")
      .select(
        "id,recipe_version_id,line_type,item_id,sub_recipe_version_id,quantity,unit_id,waste_percent,kitchen_inventory_items:kitchen_inventory_items!kitchen_recipe_lines_tenant_item_fkey(id,name,default_unit_id,current_unit_cost)",
      )
      .eq("tenant_id", tenantId),
    loadConversionMap(tenantId),
  ]);

  if (versionsRes.error) throw new Error(`No fue posible cargar versiones de receta: ${versionsRes.error.message}`);
  if (linesRes.error) throw new Error(`No fue posible cargar líneas de receta: ${linesRes.error.message}`);

  const versionById = new Map(((versionsRes.data ?? []) as RecipeVersionLite[]).map((row) => [row.id, row]));
  const linesByVersion = new Map<string, RecipeLineLite[]>();
  for (const raw of (linesRes.data ?? []) as Array<Record<string, unknown>>) {
    const row = {
      ...(raw as unknown as RecipeLineLite),
      kitchen_inventory_items: Array.isArray(raw.kitchen_inventory_items)
        ? ((raw.kitchen_inventory_items[0] ?? null) as RecipeLineLite["kitchen_inventory_items"])
        : ((raw.kitchen_inventory_items ?? null) as RecipeLineLite["kitchen_inventory_items"]),
    } as RecipeLineLite;
    const bucket = linesByVersion.get(row.recipe_version_id) ?? [];
    bucket.push(row);
    linesByVersion.set(row.recipe_version_id, bucket);
  }

  const planById = new Map(context.plans.map((plan) => [plan.id, plan]));
  const rawLines: DetailedRequirementLine[] = [];
  const recursionGuard = new Set<string>();

  const explodeVersion = (
    planRecipe: PlanRecipeLite,
    versionId: string,
    localMultiplier: number,
    path: string[],
  ) => {
    if (localMultiplier <= 0) return;
    const cycleKey = `${planRecipe.id}:${versionId}`;
    if (recursionGuard.has(cycleKey)) {
      warnings.push({
        scope: "recipe_version",
        plan_id: planRecipe.plan_id,
        plan_recipe_id: planRecipe.id,
        message: `Se detectó ciclo de sub-recetas (${path.join(" -> ")}).`,
      });
      return;
    }

    const plan = planById.get(planRecipe.plan_id);
    if (!plan) {
      warnings.push({
        scope: "configuration",
        plan_recipe_id: planRecipe.id,
        message: "La receta está asociada a un servicio inexistente.",
      });
      return;
    }

    recursionGuard.add(cycleKey);
    for (const line of linesByVersion.get(versionId) ?? []) {
      if (line.line_type === "inventory_item") {
        const item = line.kitchen_inventory_items;
        if (!line.item_id || !item) {
          warnings.push({
            scope: "recipe_line",
            plan_id: planRecipe.plan_id,
            plan_recipe_id: planRecipe.id,
            message: "Línea sin insumo asociado; se omitió del costeo.",
          });
          continue;
        }

        const convertedQuantity = convertQuantity(Number(line.quantity), line.unit_id, item.default_unit_id, conversions);
        if (convertedQuantity == null) {
          warnings.push({
            scope: "recipe_line",
            plan_id: planRecipe.plan_id,
            plan_recipe_id: planRecipe.id,
            item_id: line.item_id,
            message: `Falta conversión de unidad para ${item.name}.`,
          });
          continue;
        }

        const wasteFactor = 1 + Number(line.waste_percent ?? 0) / 100;
        rawLines.push({
          eventId,
          planId: planRecipe.plan_id,
          planName: plan.name ?? null,
          planRecipeId: planRecipe.id,
          recipeId: planRecipe.recipe_id,
          recipeVersionId: planRecipe.recipe_version_id,
          recipeCostSnapshotId: planRecipe.snapshot_id,
          recipeName: planRecipe.kitchen_recipe_recipes?.name ?? `Receta ${planRecipe.recipe_id.slice(0, 8)}`,
          plannedServings: Number(planRecipe.planned_servings ?? 0),
          multiplier: localMultiplier,
          itemId: line.item_id,
          itemName: item.name,
          operationalUnitId: item.default_unit_id,
          requiredQuantity: round4(convertedQuantity * localMultiplier * wasteFactor),
          estimatedUnitCost: Number(item.current_unit_cost ?? 0),
          sourcePayload: {
            recipe_line_id: line.id,
            recipe_version_id: versionId,
            plan_recipe_id: planRecipe.id,
            plan_id: planRecipe.plan_id,
            original_unit_id: line.unit_id,
            operational_unit_id: item.default_unit_id,
            waste_percent: Number(line.waste_percent ?? 0),
            local_multiplier: localMultiplier,
          },
        });
        continue;
      }

      if (!line.sub_recipe_version_id) {
        warnings.push({
          scope: "recipe_line",
          plan_id: planRecipe.plan_id,
          plan_recipe_id: planRecipe.id,
          message: "Sub-receta sin versión asociada; se omitió del costeo.",
        });
        continue;
      }

      const subVersion = versionById.get(line.sub_recipe_version_id);
      if (!subVersion || Number(subVersion.yield_quantity ?? 0) <= 0) {
        warnings.push({
          scope: "recipe_version",
          plan_id: planRecipe.plan_id,
          plan_recipe_id: planRecipe.id,
          message: "Sub-receta sin yield válido; se omitió del costeo.",
        });
        continue;
      }

      const nestedMultiplier =
        (localMultiplier * Number(line.quantity ?? 0) * (1 + Number(line.waste_percent ?? 0) / 100)) /
        Number(subVersion.yield_quantity ?? 0);
      explodeVersion(planRecipe, line.sub_recipe_version_id, nestedMultiplier, [...path, line.sub_recipe_version_id]);
    }

    recursionGuard.delete(cycleKey);
  };

  for (const planRecipe of context.planRecipes) {
    const version = versionById.get(planRecipe.recipe_version_id);
    if (!version) {
      warnings.push({
        scope: "recipe_version",
        plan_id: planRecipe.plan_id,
        plan_recipe_id: planRecipe.id,
        message: "La versión de receta del servicio ya no existe.",
      });
      continue;
    }

    const servings = Number(version.servings ?? 0);
    const yieldQuantity = Number(version.yield_quantity ?? 0);
    const plannedServings = Number(planRecipe.planned_servings ?? 0);
    const multiplier = servings > 0 ? plannedServings / servings : yieldQuantity > 0 ? plannedServings / yieldQuantity : 0;

    if (!(multiplier > 0)) {
      warnings.push({
        scope: "recipe_version",
        plan_id: planRecipe.plan_id,
        plan_recipe_id: planRecipe.id,
        message: "La receta no tiene base válida de servings o yield para costeo.",
      });
      continue;
    }

    explodeVersion(planRecipe, planRecipe.recipe_version_id, multiplier, [planRecipe.recipe_version_id]);
  }

  const consolidated = new Map<string, DetailedRequirementLine>();
  for (const row of rawLines) {
    const key = `${row.planRecipeId}:${row.itemId}:${row.operationalUnitId}`;
    const previous = consolidated.get(key);
    if (!previous) {
      consolidated.set(key, {
        ...row,
        requiredQuantity: round4(row.requiredQuantity),
        sourcePayload: { lines: [row.sourcePayload] },
      });
      continue;
    }

    previous.requiredQuantity = round4(previous.requiredQuantity + row.requiredQuantity);
    const lines = Array.isArray(previous.sourcePayload.lines) ? previous.sourcePayload.lines : [];
    previous.sourcePayload = { ...previous.sourcePayload, lines: [...lines, row.sourcePayload] };
    consolidated.set(key, previous);
  }

  const configPayload = {
    event_id: context.event.id,
    event_name: context.event.name ?? null,
    services: context.plans
      .map((plan) => ({
        plan_id: plan.id,
        service_name: plan.name ?? null,
        planned_guest_count: plan.planned_guest_count ?? null,
        status: plan.status,
        recipes: context.planRecipes
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

  return {
    ...context,
    lines: [...consolidated.values()].sort((left, right) =>
      left.planId.localeCompare(right.planId) ||
      left.planRecipeId.localeCompare(right.planRecipeId) ||
      left.itemName.localeCompare(right.itemName),
    ),
    warnings,
    configPayload,
    configFingerprint: buildFingerprint(configPayload),
  };
}

async function loadCurrentPriceResolutionContext(tenantId: string, itemIds: string[]) {
  const supabase = await getSupabaseServerClient();
  const uniqueItemIds = Array.from(new Set(itemIds));
  const [{ data: itemsData, error: itemsError }, { data: purchaseOptionsData, error: purchaseOptionsError }, { data: supplierPricesData, error: supplierPricesError }, { data: unitsData, error: unitsError }, conversions] =
    await Promise.all([
      supabase
        .from("kitchen_inventory_items")
        .select("id,name,default_unit_id,default_supplier_id,current_unit_cost")
        .eq("tenant_id", tenantId)
        .in("id", uniqueItemIds),
      supabase
        .from("kitchen_inventory_purchase_options")
        .select("id,item_id,supplier_id,purchase_unit_id,inventory_unit_id,quantity_per_purchase_unit,is_default,is_active")
        .eq("tenant_id", tenantId)
        .eq("is_active", true)
        .eq("is_default", true)
        .in("item_id", uniqueItemIds),
      supabase
        .from("kitchen_inventory_supplier_prices")
        .select("id,item_id,supplier_id,purchase_option_id,purchase_unit_id,price_per_purchase_unit,currency,is_current,valid_from,created_at")
        .eq("tenant_id", tenantId)
        .eq("is_current", true)
        .in("item_id", uniqueItemIds),
      supabase
        .from("kitchen_inventory_units")
        .select("id,code")
        .eq("tenant_id", tenantId),
      loadConversionMap(tenantId),
    ]);

  if (itemsError) throw new Error(`No fue posible cargar insumos para costeo: ${itemsError.message}`);
  if (purchaseOptionsError) throw new Error(`No fue posible cargar opciones de compra para costeo: ${purchaseOptionsError.message}`);
  if (supplierPricesError) throw new Error(`No fue posible cargar precios proveedor vigentes: ${supplierPricesError.message}`);
  if (unitsError) throw new Error(`No fue posible cargar unidades para costeo: ${unitsError.message}`);

  return {
    items: itemsData ?? [],
    purchaseOptions: purchaseOptionsData ?? [],
    supplierPrices: supplierPricesData ?? [],
    unitCodeById: new Map((unitsData ?? []).map((row) => [row.id, row.code])),
    conversions,
  };
}

function resolvePriceForOperationalUnit(
  input: {
    itemId: string;
    operationalUnitId: string;
    itemName: string;
    fallbackOperationalUnitCost: number;
  },
  context: Awaited<ReturnType<typeof loadCurrentPriceResolutionContext>>,
): PriceResolution {
  const item = context.items.find((row) => row.id === input.itemId);
  if (!item) {
    return {
      supplierId: null,
      purchaseOptionId: null,
      supplierPriceId: null,
      purchaseUnitId: null,
      purchaseUnitCode: null,
      quantityPerPurchaseUnit: null,
      pricePerPurchaseUnit: null,
      operationalUnitCost: round4(input.fallbackOperationalUnitCost),
      currency: "MXN",
      priceSource: "current_unit_cost_fallback",
      warning: `No se encontró el insumo ${input.itemName}; se usó current_unit_cost congelado.`,
    };
  }

  const candidateOptions = context.purchaseOptions
    .filter((row) => row.item_id === input.itemId)
    .sort((left, right) => {
      const leftPriority = left.supplier_id === item.default_supplier_id ? 0 : left.supplier_id ? 1 : 2;
      const rightPriority = right.supplier_id === item.default_supplier_id ? 0 : right.supplier_id ? 1 : 2;
      return leftPriority - rightPriority || String(left.id).localeCompare(String(right.id));
    });

  const selectedOption = candidateOptions[0] ?? null;
  if (!selectedOption || Number(selectedOption.quantity_per_purchase_unit ?? 0) <= 0) {
    return {
      supplierId: null,
      purchaseOptionId: null,
      supplierPriceId: null,
      purchaseUnitId: null,
      purchaseUnitCode: null,
      quantityPerPurchaseUnit: null,
      pricePerPurchaseUnit: null,
      operationalUnitCost: round4(Number(item.current_unit_cost ?? input.fallbackOperationalUnitCost)),
      currency: "MXN",
      priceSource: "current_unit_cost_fallback",
      warning: `Sin combinación proveedor/presentación default válida para ${item.name}; se usó current_unit_cost.`,
    };
  }

  const selectedPrice =
    context.supplierPrices
      .filter((row) => row.item_id === input.itemId && row.purchase_option_id === selectedOption.id)
      .sort((left, right) => {
        const leftDate = left.valid_from ?? "0000-00-00";
        const rightDate = right.valid_from ?? "0000-00-00";
        return rightDate.localeCompare(leftDate) || String(right.created_at ?? "").localeCompare(String(left.created_at ?? ""));
      })[0] ?? null;

  if (!selectedPrice) {
    return {
      supplierId: null,
      purchaseOptionId: null,
      supplierPriceId: null,
      purchaseUnitId: null,
      purchaseUnitCode: null,
      quantityPerPurchaseUnit: null,
      pricePerPurchaseUnit: null,
      operationalUnitCost: round4(Number(item.current_unit_cost ?? input.fallbackOperationalUnitCost)),
      currency: "MXN",
      priceSource: "current_unit_cost_fallback",
      warning: `Sin precio proveedor current para ${item.name}; se usó current_unit_cost.`,
    };
  }

  const quantityPerPurchaseUnit = Number(selectedOption.quantity_per_purchase_unit ?? 0);
  const inventoryUnitCost = Number(selectedPrice.price_per_purchase_unit ?? 0) / quantityPerPurchaseUnit;
  const operationalUnitsInInventory =
    selectedOption.inventory_unit_id === input.operationalUnitId
      ? 1
      : convertQuantity(1, input.operationalUnitId, selectedOption.inventory_unit_id, context.conversions);

  if (operationalUnitsInInventory == null || operationalUnitsInInventory <= 0) {
    return {
      supplierId: null,
      purchaseOptionId: null,
      supplierPriceId: null,
      purchaseUnitId: null,
      purchaseUnitCode: null,
      quantityPerPurchaseUnit: null,
      pricePerPurchaseUnit: null,
      operationalUnitCost: round4(Number(item.current_unit_cost ?? input.fallbackOperationalUnitCost)),
      currency: String(selectedPrice.currency ?? "MXN"),
      priceSource: "current_unit_cost_fallback",
      warning: `Sin conversión válida de presentación a unidad operativa para ${item.name}; se usó current_unit_cost.`,
    };
  }

  return {
    supplierId: selectedOption.supplier_id ?? item.default_supplier_id ?? null,
    purchaseOptionId: selectedOption.id,
    supplierPriceId: selectedPrice.id,
    purchaseUnitId: selectedOption.purchase_unit_id,
    purchaseUnitCode: context.unitCodeById.get(selectedOption.purchase_unit_id) ?? null,
    quantityPerPurchaseUnit: round4(quantityPerPurchaseUnit),
    pricePerPurchaseUnit: round4(Number(selectedPrice.price_per_purchase_unit ?? 0)),
    operationalUnitCost: round4(inventoryUnitCost * operationalUnitsInInventory),
    currency: String(selectedPrice.currency ?? "MXN"),
    priceSource: "supplier_price_current",
    warning: null,
  };
}

function resolvePriceForFrozenOperationalUnit(
  input: {
    itemId: string;
    operationalUnitId: string;
    itemName: string;
    fallbackOperationalUnitCost: number;
    supplierId: string | null;
    purchaseOptionId: string | null;
    purchaseUnitId: string | null;
  },
  context: Awaited<ReturnType<typeof loadCurrentPriceResolutionContext>>,
): PriceResolution {
  const item = context.items.find((row) => row.id === input.itemId);
  const fallback = resolvePriceForOperationalUnit(
    {
      itemId: input.itemId,
      operationalUnitId: input.operationalUnitId,
      itemName: input.itemName,
      fallbackOperationalUnitCost: input.fallbackOperationalUnitCost,
    },
    context,
  );
  if (!item || !input.purchaseOptionId) {
    return fallback;
  }

  const preferredOption =
    context.purchaseOptions.find(
      (row) => row.item_id === input.itemId && row.id === input.purchaseOptionId,
    ) ??
    context.purchaseOptions.find(
      (row) =>
        row.item_id === input.itemId &&
        row.supplier_id === input.supplierId &&
        row.purchase_unit_id === input.purchaseUnitId,
    ) ??
    null;

  if (!preferredOption || Number(preferredOption.quantity_per_purchase_unit ?? 0) <= 0) {
    return {
      ...fallback,
      warning:
        `La combinación congelada de proveedor/presentación ya no está disponible para ${input.itemName}; ` +
        `${fallback.warning ?? "se usó la resolución vigente disponible."}`,
    };
  }

  const preferredPrice =
    context.supplierPrices
      .filter(
        (row) =>
          row.item_id === input.itemId &&
          row.purchase_option_id === preferredOption.id,
      )
      .sort((left, right) => {
        const leftDate = left.valid_from ?? "0000-00-00";
        const rightDate = right.valid_from ?? "0000-00-00";
        return (
          rightDate.localeCompare(leftDate) ||
          String(right.created_at ?? "").localeCompare(String(left.created_at ?? ""))
        );
      })[0] ?? null;

  if (!preferredPrice) {
    return {
      ...fallback,
      warning:
        `La combinación congelada de proveedor/presentación ya no tiene precio vigente para ${input.itemName}; ` +
        `${fallback.warning ?? "se usó la resolución vigente disponible."}`,
    };
  }

  const quantityPerPurchaseUnit = Number(preferredOption.quantity_per_purchase_unit ?? 0);
  const inventoryUnitCost = Number(preferredPrice.price_per_purchase_unit ?? 0) / quantityPerPurchaseUnit;
  const operationalUnitsInInventory =
    preferredOption.inventory_unit_id === input.operationalUnitId
      ? 1
      : convertQuantity(1, input.operationalUnitId, preferredOption.inventory_unit_id, context.conversions);

  if (operationalUnitsInInventory == null || operationalUnitsInInventory <= 0) {
    return {
      ...fallback,
      warning:
        `La combinación congelada perdió una conversión válida para ${input.itemName}; ` +
        `${fallback.warning ?? "se usó la resolución vigente disponible."}`,
    };
  }

  return {
    supplierId: preferredOption.supplier_id ?? item.default_supplier_id ?? null,
    purchaseOptionId: preferredOption.id,
    supplierPriceId: preferredPrice.id,
    purchaseUnitId: preferredOption.purchase_unit_id,
    purchaseUnitCode: context.unitCodeById.get(preferredOption.purchase_unit_id) ?? null,
    quantityPerPurchaseUnit: round4(quantityPerPurchaseUnit),
    pricePerPurchaseUnit: round4(Number(preferredPrice.price_per_purchase_unit ?? 0)),
    operationalUnitCost: round4(inventoryUnitCost * operationalUnitsInInventory),
    currency: String(preferredPrice.currency ?? "MXN"),
    priceSource: "supplier_price_current",
    warning: null,
  };
}

async function insertCompletedSnapshot(
  input: {
    tenantId: string;
    userId: string;
    eventId: string;
    eventName: string | null;
    snapshotKind: "initial" | "updated";
    baseSnapshotId: string | null;
    configFingerprint: string;
    configurationPayload: Record<string, unknown>;
    warnings: CostingWarning[];
    serviceRows: Array<{
      planId: string;
      serviceName: string | null;
      plannedGuestCount: number | null;
      sortOrder: number;
      totalCost: number;
      baseTotalCost: number;
      priceVariationAmount: number;
    priceVariationPercent: number | null;
    recipeCount: number;
  } & ServicePricingSnapshotFields>;
    recipeRows: Array<{
      planId: string;
      planRecipeId: string;
      serviceKey: string;
      recipeId: string;
      recipeVersionId: string;
      recipeCostSnapshotId: string | null;
      recipeName: string;
      plannedServings: number;
      multiplier: number;
      totalCost: number;
      baseTotalCost: number;
      priceVariationAmount: number;
      priceVariationPercent: number | null;
      lineCount: number;
      sourcePayload: Record<string, unknown>;
    }>;
    itemRows: Array<{
      planId: string;
      planRecipeId: string;
      recipeSummaryKey: string;
      serviceKey: string;
      recipeId: string;
      recipeVersionId: string;
      itemId: string;
      itemName: string;
      operationalUnitId: string;
      operationalUnitCode: string;
      supplierId: string | null;
      purchaseOptionId: string | null;
      supplierPriceId: string | null;
      purchaseUnitId: string | null;
      purchaseUnitCode: string | null;
      requiredQuantity: number;
      quantityPerPurchaseUnit: number | null;
      pricePerPurchaseUnit: number | null;
      operationalUnitCost: number;
      lineTotalCost: number;
      baseOperationalUnitCost: number;
      baseLineTotalCost: number;
      priceVariationAmount: number;
      priceVariationPercent: number | null;
      currency: string;
      priceSource: string;
      priceResolutionWarning: string | null;
      sourcePayload: Record<string, unknown>;
    }>;
  },
): Promise<EventCostingSnapshotResult> {
  const supabase = await getSupabaseServerClient();
  const totalCost = round4(input.itemRows.reduce((acc, row) => acc + row.lineTotalCost, 0));
  const baseTotalCost = round4(input.itemRows.reduce((acc, row) => acc + row.baseLineTotalCost, 0));
  const priceVariationAmount = round4(totalCost - baseTotalCost);
  const priceVariationPercent = toPercentDelta(totalCost, baseTotalCost);
  const totalExtraStaffCost = round4(input.serviceRows.reduce((acc, row) => acc + row.extraStaffTotalCost, 0));
  const totalServiceCostBasis = round4(input.serviceRows.reduce((acc, row) => acc + row.serviceCostBasis, 0));
  const totalSuggestedProfit = round4(input.serviceRows.reduce((acc, row) => acc + row.suggestedProfit, 0));
  const totalSuggestedServicePrice = round4(input.serviceRows.reduce((acc, row) => acc + row.suggestedServicePrice, 0));

  const { data: snapshotRow, error: snapshotError } = await supabase
    .from("event_catering_costing_snapshots")
    .insert({
      tenant_id: input.tenantId,
      event_id: input.eventId,
      base_snapshot_id: input.baseSnapshotId,
      snapshot_kind: input.snapshotKind,
      snapshot_status: "pending",
      event_name_snapshot: input.eventName,
      currency: input.itemRows[0]?.currency ?? "MXN",
      service_count: input.serviceRows.length,
      recipe_count: input.recipeRows.length,
      item_line_count: input.itemRows.length,
      total_cost: totalCost,
      base_total_cost: baseTotalCost,
      price_variation_amount: priceVariationAmount,
      price_variation_percent: priceVariationPercent,
      total_extra_staff_cost: totalExtraStaffCost,
      total_service_cost_basis: totalServiceCostBasis,
      total_suggested_profit: totalSuggestedProfit,
      total_suggested_service_price: totalSuggestedServicePrice,
      pricing_model_version: "service_margin_v1",
      config_fingerprint: input.configFingerprint,
      configuration_payload: input.configurationPayload,
      warnings: input.warnings,
      created_by: input.userId,
    })
    .select("id")
    .single();
  if (snapshotError || !snapshotRow) throw new Error(`No se pudo crear snapshot de costeo: ${snapshotError?.message ?? "error"}`);

  const serviceInserts = input.serviceRows.map((row) => ({
    tenant_id: input.tenantId,
    snapshot_id: snapshotRow.id,
    plan_id: row.planId,
    service_name_snapshot: row.serviceName,
    planned_guest_count_snapshot: row.plannedGuestCount,
    sort_order: row.sortOrder,
    recipe_count: row.recipeCount,
    total_cost: row.totalCost,
    base_total_cost: row.baseTotalCost,
    price_variation_amount: row.priceVariationAmount,
    price_variation_percent: row.priceVariationPercent,
    extra_staff_count: row.extraStaffCount,
    extra_staff_unit_cost: row.extraStaffUnitCost,
    extra_staff_total_cost: row.extraStaffTotalCost,
    service_cost_basis: row.serviceCostBasis,
    target_margin_pct: row.targetMarginPct,
    suggested_profit: row.suggestedProfit,
    suggested_service_price: row.suggestedServicePrice,
    pricing_model_version: row.pricingModelVersion,
    pricing_payload: row.pricingPayload,
    created_by: input.userId,
  }));
  const { data: insertedServices, error: serviceError } = await supabase
    .from("event_catering_costing_service_summaries")
    .insert(serviceInserts)
    .select("id,plan_id");
  if (serviceError) throw new Error(`No se pudo guardar resumen por servicio: ${serviceError.message}`);
  const serviceIdByPlanId = new Map((insertedServices ?? []).map((row) => [String(row.plan_id), String(row.id)]));

  const recipeInserts = input.recipeRows.map((row) => ({
    tenant_id: input.tenantId,
    snapshot_id: snapshotRow.id,
    service_summary_id: serviceIdByPlanId.get(row.planId),
    plan_id: row.planId,
    plan_recipe_id: row.planRecipeId,
    recipe_id: row.recipeId,
    recipe_version_id: row.recipeVersionId,
    recipe_cost_snapshot_id: row.recipeCostSnapshotId,
    recipe_name_snapshot: row.recipeName,
    planned_servings_snapshot: row.plannedServings,
    multiplier_snapshot: row.multiplier,
    line_count: row.lineCount,
    total_cost: row.totalCost,
    base_total_cost: row.baseTotalCost,
    price_variation_amount: row.priceVariationAmount,
    price_variation_percent: row.priceVariationPercent,
    source_payload: row.sourcePayload,
    created_by: input.userId,
  }));
  const { data: insertedRecipes, error: recipeError } = await supabase
    .from("event_catering_costing_recipe_summaries")
    .insert(recipeInserts)
    .select("id,plan_recipe_id");
  if (recipeError) throw new Error(`No se pudo guardar resumen por receta: ${recipeError.message}`);
  const recipeSummaryIdByPlanRecipeId = new Map((insertedRecipes ?? []).map((row) => [String(row.plan_recipe_id), String(row.id)]));

  const itemInserts = input.itemRows.map((row) => ({
    tenant_id: input.tenantId,
    snapshot_id: snapshotRow.id,
    service_summary_id: serviceIdByPlanId.get(row.planId),
    recipe_summary_id: recipeSummaryIdByPlanRecipeId.get(row.planRecipeId),
    event_id: input.eventId,
    plan_id: row.planId,
    plan_recipe_id: row.planRecipeId,
    recipe_id: row.recipeId,
    recipe_version_id: row.recipeVersionId,
    item_id: row.itemId,
    operational_unit_id: row.operationalUnitId,
    supplier_id: row.supplierId,
    purchase_option_id: row.purchaseOptionId,
    supplier_price_id: row.supplierPriceId,
    purchase_unit_id: row.purchaseUnitId,
    item_name_snapshot: row.itemName,
    operational_unit_code_snapshot: row.operationalUnitCode,
    purchase_unit_code_snapshot: row.purchaseUnitCode,
    required_quantity: row.requiredQuantity,
    quantity_per_purchase_unit_snapshot: row.quantityPerPurchaseUnit,
    price_per_purchase_unit_snapshot: row.pricePerPurchaseUnit,
    operational_unit_cost: row.operationalUnitCost,
    line_total_cost: row.lineTotalCost,
    base_operational_unit_cost: row.baseOperationalUnitCost,
    base_line_total_cost: row.baseLineTotalCost,
    price_variation_amount: row.priceVariationAmount,
    price_variation_percent: row.priceVariationPercent,
    currency: row.currency,
    price_source: row.priceSource,
    price_resolution_warning: row.priceResolutionWarning,
    source_payload: row.sourcePayload,
    created_by: input.userId,
  }));
  const { error: itemError } = await supabase.from("event_catering_costing_item_lines").insert(itemInserts);
  if (itemError) throw new Error(`No se pudo guardar detalle por insumo: ${itemError.message}`);

  const { error: completeError } = await supabase
    .from("event_catering_costing_snapshots")
    .update({ snapshot_status: "completed" })
    .eq("tenant_id", input.tenantId)
    .eq("id", snapshotRow.id)
    .eq("snapshot_status", "pending");
  if (completeError) throw new Error(`No se pudo cerrar snapshot de costeo: ${completeError.message}`);

  return {
    snapshotId: snapshotRow.id,
    eventId: input.eventId,
    snapshotKind: input.snapshotKind,
    totalCost,
    baseTotalCost,
    priceVariationAmount,
    priceVariationPercent,
    serviceCount: input.serviceRows.length,
    recipeCount: input.recipeRows.length,
    itemLineCount: input.itemRows.length,
    configFingerprint: input.configFingerprint,
    warnings: input.warnings,
  };
}

export async function calculateCurrentEventCateringCostingFingerprint(tenantId: string, eventId: string): Promise<string> {
  const result = await buildDetailedRequirementsForEvent(tenantId, eventId);
  return result.configFingerprint;
}

export async function previewInitialEventCostingSnapshot(
  tenantId: string,
  eventId: string,
): Promise<EventInitialCostingPreview> {
  const requirements = await buildDetailedRequirementsForEvent(tenantId, eventId);
  const priceContext = await loadCurrentPriceResolutionContext(
    tenantId,
    requirements.lines.map((row) => row.itemId),
  );

  const unitCodeById = priceContext.unitCodeById;
  const itemRows = requirements.lines.map((row) => {
    const resolved = resolvePriceForOperationalUnit(
      {
        itemId: row.itemId,
        operationalUnitId: row.operationalUnitId,
        itemName: row.itemName,
        fallbackOperationalUnitCost: row.estimatedUnitCost,
      },
      priceContext,
    );
    if (resolved.warning) {
      requirements.warnings.push({
        scope: "price_resolution",
        plan_id: row.planId,
        plan_recipe_id: row.planRecipeId,
        item_id: row.itemId,
        message: resolved.warning,
      });
    }
    const lineTotalCost = round4(row.requiredQuantity * resolved.operationalUnitCost);
    return {
      planId: row.planId,
      planRecipeId: row.planRecipeId,
      recipeSummaryKey: row.planRecipeId,
      serviceKey: row.planId,
      recipeId: row.recipeId,
      recipeVersionId: row.recipeVersionId,
      itemId: row.itemId,
      itemName: row.itemName,
      operationalUnitId: row.operationalUnitId,
      operationalUnitCode: unitCodeById.get(row.operationalUnitId) ?? "ud",
      supplierId: resolved.supplierId,
      purchaseOptionId: resolved.purchaseOptionId,
      supplierPriceId: resolved.supplierPriceId,
      purchaseUnitId: resolved.purchaseUnitId,
      purchaseUnitCode: resolved.purchaseUnitCode,
      requiredQuantity: round4(row.requiredQuantity),
      quantityPerPurchaseUnit: resolved.quantityPerPurchaseUnit,
      pricePerPurchaseUnit: resolved.pricePerPurchaseUnit,
      operationalUnitCost: resolved.operationalUnitCost,
      lineTotalCost,
      baseOperationalUnitCost: resolved.operationalUnitCost,
      baseLineTotalCost: lineTotalCost,
      priceVariationAmount: 0,
      priceVariationPercent: 0,
      currency: resolved.currency,
      priceSource: resolved.priceSource,
      priceResolutionWarning: resolved.warning,
      sourcePayload: {
        ...row.sourcePayload,
        plan_name_snapshot: row.planName,
        recipe_name_snapshot: row.recipeName,
        planned_servings_snapshot: row.plannedServings,
        multiplier_snapshot: row.multiplier,
      },
    };
  });

  const serviceRows = requirements.plans.map((plan, index) => {
    const planItemRows = itemRows.filter((row) => row.planId === plan.id);
    return {
      planId: plan.id,
      serviceName: plan.name ?? null,
      plannedGuestCount: plan.planned_guest_count ?? null,
      sortOrder: index,
      recipeCount: requirements.planRecipes.filter((row) => row.plan_id === plan.id).length,
      totalCost: round4(planItemRows.reduce((acc, row) => acc + row.lineTotalCost, 0)),
      baseTotalCost: round4(planItemRows.reduce((acc, row) => acc + row.baseLineTotalCost, 0)),
      priceVariationAmount: 0,
      priceVariationPercent: 0,
    };
  });

  const recipeRows = requirements.planRecipes.map((planRecipe) => {
    const recipeItemRows = itemRows.filter((row) => row.planRecipeId === planRecipe.id);
    const plan = requirements.plans.find((row) => row.id === planRecipe.plan_id);
    return {
      planId: planRecipe.plan_id,
      planRecipeId: planRecipe.id,
      serviceKey: planRecipe.plan_id,
      recipeId: planRecipe.recipe_id,
      recipeVersionId: planRecipe.recipe_version_id,
      recipeCostSnapshotId: planRecipe.snapshot_id,
      recipeName: planRecipe.kitchen_recipe_recipes?.name ?? `Receta ${planRecipe.recipe_id.slice(0, 8)}`,
      plannedServings: Number(planRecipe.planned_servings ?? plan?.planned_guest_count ?? 0),
      multiplier: Number(planRecipe.multiplier ?? 0),
      totalCost: round4(recipeItemRows.reduce((acc, row) => acc + row.lineTotalCost, 0)),
      baseTotalCost: round4(recipeItemRows.reduce((acc, row) => acc + row.baseLineTotalCost, 0)),
      priceVariationAmount: 0,
      priceVariationPercent: 0,
      lineCount: recipeItemRows.length,
      sourcePayload: {
        service_name_snapshot: plan?.name ?? null,
        lines_count: recipeItemRows.length,
      },
    };
  });

  const financialPricing = await addFinancialPricingToServices(tenantId, serviceRows);
  const configurationPayload = {
    ...requirements.configPayload,
    pricing_model_version: "service_margin_v1",
    pricing: financialPricing.pricingPayload,
  };

  return {
    eventName: requirements.event.name ?? null,
    eventId,
    configFingerprint: buildFingerprint(configurationPayload),
    configurationPayload,
    warnings: requirements.warnings,
    serviceRows: financialPricing.serviceRows,
    recipeRows,
    itemRows,
  };
}

export async function createInitialEventCostingSnapshot(
  tenantId: string,
  userId: string,
  eventId: string,
): Promise<EventCostingSnapshotResult> {
  const supabase = await getSupabaseServerClient();
  const { data: plans, error: plansError } = await supabase
    .from("event_catering_plans")
    .select("id")
    .eq("tenant_id", tenantId)
    .eq("event_id", eventId)
    .neq("status", "canceled");
  if (plansError) throw new Error(`No se pudieron validar servicios para pricing histórico: ${plansError.message}`);
  await Promise.all((plans ?? []).map((plan) => ensureCateringPlanPricingForTenant(tenantId, plan.id, userId)));
  const preview = await previewInitialEventCostingSnapshot(tenantId, eventId);
  const { data: existingSnapshot, error: existingSnapshotError } = await supabase
    .from("event_catering_costing_snapshots")
    .select(
      "id,event_id,snapshot_kind,total_cost,base_total_cost,price_variation_amount,price_variation_percent,service_count,recipe_count,item_line_count,config_fingerprint,warnings",
    )
    .eq("tenant_id", tenantId)
    .eq("event_id", eventId)
    .eq("snapshot_kind", "initial")
    .eq("snapshot_status", "completed")
    .eq("config_fingerprint", preview.configFingerprint)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (existingSnapshotError) {
    throw new Error(
      `No se pudo validar si ya existía un costo inicial vigente: ${existingSnapshotError.message}`,
    );
  }
  if (existingSnapshot) {
    return {
      snapshotId: String(existingSnapshot.id),
      eventId: String(existingSnapshot.event_id),
      snapshotKind: existingSnapshot.snapshot_kind as "initial" | "updated",
      totalCost: Number(existingSnapshot.total_cost ?? 0),
      baseTotalCost: Number(existingSnapshot.base_total_cost ?? 0),
      priceVariationAmount: Number(existingSnapshot.price_variation_amount ?? 0),
      priceVariationPercent:
        existingSnapshot.price_variation_percent == null
          ? null
          : Number(existingSnapshot.price_variation_percent),
      serviceCount: Number(existingSnapshot.service_count ?? 0),
      recipeCount: Number(existingSnapshot.recipe_count ?? 0),
      itemLineCount: Number(existingSnapshot.item_line_count ?? 0),
      configFingerprint: String(existingSnapshot.config_fingerprint ?? preview.configFingerprint),
      warnings: Array.isArray(existingSnapshot.warnings)
        ? (existingSnapshot.warnings as CostingWarning[])
        : [],
    };
  }

  return insertCompletedSnapshot({
    tenantId,
    userId,
    eventId,
    eventName: preview.eventName,
    snapshotKind: "initial",
    baseSnapshotId: null,
    configFingerprint: preview.configFingerprint,
    configurationPayload: preview.configurationPayload,
    warnings: preview.warnings,
    serviceRows: preview.serviceRows,
    recipeRows: preview.recipeRows,
    itemRows: preview.itemRows,
  });
}

export async function createUpdatedEventCostingSnapshot(
  tenantId: string,
  userId: string,
  baseSnapshotId: string,
): Promise<EventCostingSnapshotResult> {
  const supabase = await getSupabaseServerClient();
  const { data: lines, error: linesError } = await supabase
    .from("event_catering_costing_item_lines")
    .select("plan_id")
    .eq("tenant_id", tenantId)
    .eq("snapshot_id", baseSnapshotId);
  if (linesError) throw new Error(`No se pudieron validar servicios para pricing histórico: ${linesError.message}`);
  const planIds = [...new Set((lines ?? []).map((line) => String(line.plan_id)))];
  await Promise.all(planIds.map((planId) => ensureCateringPlanPricingForTenant(tenantId, planId, userId)));
  const draft = await previewUpdatedEventCostingSnapshot(tenantId, baseSnapshotId);

  return insertCompletedSnapshot({
    tenantId,
    userId,
    eventId: draft.eventId,
    eventName: draft.eventName,
    snapshotKind: draft.snapshotKind,
    baseSnapshotId: draft.baseSnapshotId,
    configFingerprint: draft.configFingerprint,
    configurationPayload: draft.configurationPayload,
    warnings: draft.warnings,
    serviceRows: draft.serviceRows,
    recipeRows: draft.recipeRows,
    itemRows: draft.itemRows,
  });
}

export async function previewUpdatedEventCostingSnapshot(
  tenantId: string,
  baseSnapshotId: string,
): Promise<EventCostingDraft> {
  const supabase = await getSupabaseServerClient();
  const { data: baseSnapshot, error: baseSnapshotError } = await supabase
    .from("event_catering_costing_snapshots")
    .select("id,event_id,event_name_snapshot,snapshot_kind,config_fingerprint,configuration_payload")
    .eq("tenant_id", tenantId)
    .eq("id", baseSnapshotId)
    .maybeSingle();
  if (baseSnapshotError || !baseSnapshot) throw new Error("Snapshot initial inválido para recosteo.");
  if (baseSnapshot.snapshot_kind !== "initial") {
    throw new Error("El recosteo solo puede partir de un snapshot `initial`.");
  }

  const { data: baseLineRows, error: baseLineError } = await supabase
    .from("event_catering_costing_item_lines")
    .select(
      "id,snapshot_id,service_summary_id,recipe_summary_id,event_id,plan_id,plan_recipe_id,recipe_id,recipe_version_id,item_id,item_name_snapshot,operational_unit_id,operational_unit_code_snapshot,supplier_id,purchase_option_id,purchase_unit_id,required_quantity,base_operational_unit_cost,base_line_total_cost,currency,source_payload,service_summary:event_catering_costing_service_summaries!event_catering_costing_item_lines_tenant_service_fkey(id,service_name_snapshot,planned_guest_count_snapshot),recipe_summary:event_catering_costing_recipe_summaries!event_catering_costing_item_lines_tenant_recipe_summary_fkey(id,recipe_name_snapshot,planned_servings_snapshot,multiplier_snapshot,recipe_cost_snapshot_id)",
    )
    .eq("tenant_id", tenantId)
    .eq("snapshot_id", baseSnapshotId);
  if (baseLineError) throw new Error(`No fue posible cargar líneas congeladas del snapshot initial: ${baseLineError.message}`);

  const baseLines = ((baseLineRows ?? []) as Array<Record<string, unknown>>).map((row) => ({
    ...(row as unknown as BaseSnapshotLine),
    service_summary: Array.isArray(row.service_summary)
      ? ((row.service_summary[0] ?? null) as BaseSnapshotLine["service_summary"])
      : ((row.service_summary ?? null) as BaseSnapshotLine["service_summary"]),
    recipe_summary: Array.isArray(row.recipe_summary)
      ? ((row.recipe_summary[0] ?? null) as BaseSnapshotLine["recipe_summary"])
      : ((row.recipe_summary ?? null) as BaseSnapshotLine["recipe_summary"]),
  }));
  if (baseLines.length === 0) throw new Error("El snapshot initial no tiene detalle congelado para recostear.");

  const priceContext = await loadCurrentPriceResolutionContext(
    tenantId,
    baseLines.map((row) => row.item_id),
  );

  const warnings: CostingWarning[] = [];
  const itemRows = baseLines.map((row) => {
    const resolved = resolvePriceForFrozenOperationalUnit(
      {
        itemId: row.item_id,
        operationalUnitId: row.operational_unit_id,
        itemName: row.item_name_snapshot,
        fallbackOperationalUnitCost: 0,
        supplierId: row.supplier_id,
        purchaseOptionId: row.purchase_option_id,
        purchaseUnitId: row.purchase_unit_id,
      },
      priceContext,
    );
    if (resolved.warning) {
      warnings.push({
        scope: "price_resolution",
        plan_id: row.plan_id,
        plan_recipe_id: row.plan_recipe_id,
        item_id: row.item_id,
        message: resolved.warning,
      });
    }

    const baseOperationalUnitCost = round4(Number(row.base_operational_unit_cost ?? 0));
    const currentLineTotal = round4(Number(row.required_quantity ?? 0) * resolved.operationalUnitCost);
    const baseLineTotalCost = round4(Number(row.base_line_total_cost ?? 0));
    const safeBaseUnitCost = baseOperationalUnitCost > 0 ? baseOperationalUnitCost : 0;
    const safeBaseLineCost = baseLineTotalCost > 0 ? baseLineTotalCost : 0;

    return {
      planId: row.plan_id,
      planRecipeId: row.plan_recipe_id,
      recipeSummaryKey: row.plan_recipe_id,
      serviceKey: row.plan_id,
      recipeId: row.recipe_id,
      recipeVersionId: row.recipe_version_id,
      itemId: row.item_id,
      itemName: row.item_name_snapshot,
      operationalUnitId: row.operational_unit_id,
      operationalUnitCode: row.operational_unit_code_snapshot,
      supplierId: resolved.supplierId,
      purchaseOptionId: resolved.purchaseOptionId,
      supplierPriceId: resolved.supplierPriceId,
      purchaseUnitId: resolved.purchaseUnitId,
      purchaseUnitCode: resolved.purchaseUnitCode,
      requiredQuantity: round4(Number(row.required_quantity ?? 0)),
      quantityPerPurchaseUnit: resolved.quantityPerPurchaseUnit,
      pricePerPurchaseUnit: resolved.pricePerPurchaseUnit,
      operationalUnitCost: resolved.operationalUnitCost,
      lineTotalCost: currentLineTotal,
      baseOperationalUnitCost: safeBaseUnitCost,
      baseLineTotalCost: safeBaseLineCost,
      priceVariationAmount: round4(currentLineTotal - safeBaseLineCost),
      priceVariationPercent: toPercentDelta(currentLineTotal, safeBaseLineCost),
      currency: resolved.currency || row.currency,
      priceSource: resolved.priceSource,
      priceResolutionWarning: resolved.warning,
      sourcePayload: {
        ...(row.source_payload ?? {}),
        frozen_from_snapshot_id: baseSnapshotId,
        initial_line_id: row.id,
        initial_service_summary_id: row.service_summary_id,
        initial_recipe_summary_id: row.recipe_summary_id,
      },
    };
  });

  const serviceRows = Array.from(
    new Map(
      baseLines.map((row) => [
        row.plan_id,
        {
          planId: row.plan_id,
          serviceName: row.service_summary?.service_name_snapshot ?? null,
          plannedGuestCount: row.service_summary?.planned_guest_count_snapshot ?? null,
        },
      ]),
    ).values(),
  ).map((row, index) => {
    const planItemRows = itemRows.filter((entry) => entry.planId === row.planId);
    return {
      planId: row.planId,
      serviceName: row.serviceName,
      plannedGuestCount: row.plannedGuestCount,
      sortOrder: index,
      recipeCount: new Set(baseLines.filter((entry) => entry.plan_id === row.planId).map((entry) => entry.plan_recipe_id)).size,
      totalCost: round4(planItemRows.reduce((acc, entry) => acc + entry.lineTotalCost, 0)),
      baseTotalCost: round4(planItemRows.reduce((acc, entry) => acc + entry.baseLineTotalCost, 0)),
      priceVariationAmount: round4(
        planItemRows.reduce((acc, entry) => acc + entry.lineTotalCost, 0) -
          planItemRows.reduce((acc, entry) => acc + entry.baseLineTotalCost, 0),
      ),
      priceVariationPercent: toPercentDelta(
        planItemRows.reduce((acc, entry) => acc + entry.lineTotalCost, 0),
        planItemRows.reduce((acc, entry) => acc + entry.baseLineTotalCost, 0),
      ),
    };
  });

  const financialPricing = await addFinancialPricingToServices(tenantId, serviceRows);
  const configurationPayload = {
    ...((baseSnapshot.configuration_payload as Record<string, unknown>) ?? {}),
    pricing_model_version: "service_margin_v1",
    pricing: financialPricing.pricingPayload,
  };

  const recipeRows = Array.from(
    new Map(
      baseLines.map((row) => [
        row.plan_recipe_id,
        {
          planId: row.plan_id,
          planRecipeId: row.plan_recipe_id,
          recipeId: row.recipe_id,
          recipeVersionId: row.recipe_version_id,
          recipeCostSnapshotId: row.recipe_summary?.recipe_cost_snapshot_id ?? null,
          recipeName: row.recipe_summary?.recipe_name_snapshot ?? `Receta ${row.recipe_id.slice(0, 8)}`,
          plannedServings: Number(row.recipe_summary?.planned_servings_snapshot ?? 0),
          multiplier: Number(row.recipe_summary?.multiplier_snapshot ?? 0),
        },
      ]),
    ).values(),
  ).map((row) => {
    const recipeItemRows = itemRows.filter((entry) => entry.planRecipeId === row.planRecipeId);
    return {
      planId: row.planId,
      planRecipeId: row.planRecipeId,
      serviceKey: row.planId,
      recipeId: row.recipeId,
      recipeVersionId: row.recipeVersionId,
      recipeCostSnapshotId: row.recipeCostSnapshotId,
      recipeName: row.recipeName,
      plannedServings: row.plannedServings,
      multiplier: row.multiplier,
      totalCost: round4(recipeItemRows.reduce((acc, entry) => acc + entry.lineTotalCost, 0)),
      baseTotalCost: round4(recipeItemRows.reduce((acc, entry) => acc + entry.baseLineTotalCost, 0)),
      priceVariationAmount: round4(
        recipeItemRows.reduce((acc, entry) => acc + entry.lineTotalCost, 0) -
          recipeItemRows.reduce((acc, entry) => acc + entry.baseLineTotalCost, 0),
      ),
      priceVariationPercent: toPercentDelta(
        recipeItemRows.reduce((acc, entry) => acc + entry.lineTotalCost, 0),
        recipeItemRows.reduce((acc, entry) => acc + entry.baseLineTotalCost, 0),
      ),
      lineCount: recipeItemRows.length,
      sourcePayload: {
        frozen_from_snapshot_id: baseSnapshotId,
        lines_count: recipeItemRows.length,
      },
    };
  });

  return {
    eventId: String(baseSnapshot.event_id),
    eventName: (baseSnapshot.event_name_snapshot as string | null) ?? null,
    snapshotKind: "updated",
    baseSnapshotId,
    configFingerprint: buildFingerprint(configurationPayload),
    configurationPayload,
    warnings,
    serviceRows: financialPricing.serviceRows,
    recipeRows,
    itemRows,
  };
}
