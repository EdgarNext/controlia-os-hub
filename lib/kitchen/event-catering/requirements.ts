import { getSupabaseServerClient } from "@/lib/supabase/server";

type ConversionMap = Map<string, number>;

type PlanRecipeLite = {
  id: string;
  recipe_id: string;
  recipe_version_id: string;
  planned_servings: number;
};

type RecipeVersionLite = {
  id: string;
  recipe_id: string;
  servings: number | null;
  yield_quantity: number;
};

type RecipeLineLite = {
  id: string;
  line_type: "inventory_item" | "sub_recipe";
  item_id: string | null;
  sub_recipe_version_id: string | null;
  quantity: number;
  unit_id: string;
  waste_percent: number;
  kitchen_inventory_items?: { id: string; name: string; default_unit_id: string; current_unit_cost: number } | null;
};

type ExplodedLine = {
  planRecipeId: string;
  recipeVersionId: string;
  recipeLineId: string;
  itemId: string;
  requiredQuantityInDefaultUnit: number;
  defaultUnitId: string;
  estimatedUnitCost: number;
  warning: string | null;
  source: Record<string, unknown>;
};

export type CateringRequirementWarning = {
  planRecipeId: string;
  recipeVersionId: string;
  recipeLineId: string;
  message: string;
};

export type CateringRequirementRowInput = {
  item_id: string;
  unit_id: string;
  required_quantity: number;
  available_quantity: number;
  shortage_quantity: number;
  estimated_unit_cost: number;
  estimated_total_cost: number;
  source_payload: Record<string, unknown>;
};

export type CateringRequirementsResult = {
  rows: CateringRequirementRowInput[];
  warnings: CateringRequirementWarning[];
  estimatedTotalCost: number;
  shortageCount: number;
};

function convertQuantity(quantity: number, fromUnitId: string, toUnitId: string, conversions: ConversionMap): number | null {
  if (fromUnitId === toUnitId) return quantity;
  const direct = conversions.get(`${fromUnitId}:${toUnitId}`);
  if (direct && direct > 0) return quantity * direct;
  const reverse = conversions.get(`${toUnitId}:${fromUnitId}`);
  if (reverse && reverse > 0) return quantity / reverse;
  return null;
}

function isAllocationsTableMissing(errorMessage: string): boolean {
  return (
    errorMessage.includes("event_catering_inventory_allocations") &&
    (errorMessage.includes("schema cache") ||
      errorMessage.includes("does not exist") ||
      errorMessage.includes("Could not find the table"))
  );
}

async function loadConversionMap(tenantId: string): Promise<ConversionMap> {
  const supabase = await getSupabaseServerClient();
  const { data, error } = await supabase
    .from("kitchen_inventory_unit_conversions")
    .select("from_unit_id,to_unit_id,factor")
    .eq("tenant_id", tenantId)
    .eq("is_active", true);
  if (error) throw new Error(`No fue posible cargar conversiones de unidades: ${error.message}`);
  const map = new Map<string, number>();
  for (const row of data ?? []) {
    map.set(`${row.from_unit_id}:${row.to_unit_id}`, Number(row.factor));
  }
  return map;
}

export async function calculateCateringRequirements(tenantId: string, planId: string): Promise<CateringRequirementsResult> {
  const supabase = await getSupabaseServerClient();
  const [planRecipesRes, versionsRes, conversions] = await Promise.all([
    supabase
      .from("event_catering_plan_recipes")
      .select("id,recipe_id,recipe_version_id,planned_servings")
      .eq("tenant_id", tenantId)
      .eq("plan_id", planId),
    supabase
      .from("kitchen_recipe_versions")
      .select("id,recipe_id,servings,yield_quantity")
      .eq("tenant_id", tenantId),
    loadConversionMap(tenantId),
  ]);

  if (planRecipesRes.error) throw new Error(`No fue posible cargar recetas del plan: ${planRecipesRes.error.message}`);
  if (versionsRes.error) throw new Error(`No fue posible cargar versiones de receta: ${versionsRes.error.message}`);

  const planRecipes = (planRecipesRes.data ?? []) as PlanRecipeLite[];
  const versions = (versionsRes.data ?? []) as RecipeVersionLite[];
  const versionById = new Map(versions.map((version) => [version.id, version]));
  const linesByVersion = new Map<string, RecipeLineLite[]>();
  const warnings: CateringRequirementWarning[] = [];

  const versionIds = [...new Set(planRecipes.map((row) => row.recipe_version_id))];
  if (versionIds.length > 0) {
    const { data: linesData, error: linesError } = await supabase
      .from("kitchen_recipe_lines")
      .select(
        "id,recipe_version_id,line_type,item_id,sub_recipe_version_id,quantity,unit_id,waste_percent,kitchen_inventory_items:kitchen_inventory_items!kitchen_recipe_lines_tenant_item_fkey(id,name,default_unit_id,current_unit_cost)",
      )
      .eq("tenant_id", tenantId)
      .in("recipe_version_id", versionIds);
    if (linesError) throw new Error(`No fue posible cargar líneas de recetas: ${linesError.message}`);
    for (const raw of (linesData ?? []) as Array<Record<string, unknown>>) {
      const row = {
        ...(raw as unknown as RecipeLineLite),
        kitchen_inventory_items: Array.isArray(raw.kitchen_inventory_items)
          ? ((raw.kitchen_inventory_items[0] ?? null) as RecipeLineLite["kitchen_inventory_items"])
          : ((raw.kitchen_inventory_items ?? null) as RecipeLineLite["kitchen_inventory_items"]),
      } as RecipeLineLite;
      const arr = linesByVersion.get((raw.recipe_version_id as string) ?? "") ?? [];
      arr.push(row);
      linesByVersion.set((raw.recipe_version_id as string) ?? "", arr);
    }
  }

  const exploded: ExplodedLine[] = [];
  const recursionGuard = new Set<string>();

  const explodeVersion = (
    planRecipe: PlanRecipeLite,
    versionId: string,
    localMultiplier: number,
    trail: string[],
  ) => {
    if (localMultiplier <= 0) return;
    const cycleKey = `${planRecipe.id}:${versionId}`;
    if (recursionGuard.has(cycleKey)) {
      warnings.push({
        planRecipeId: planRecipe.id,
        recipeVersionId: versionId,
        recipeLineId: "sub_recipe_cycle",
        message: `Se detectó ciclo en sub-recetas (${trail.join(" -> ")}).`,
      });
      return;
    }
    recursionGuard.add(cycleKey);
    const lines = linesByVersion.get(versionId) ?? [];
    for (const line of lines) {
      if (line.line_type === "inventory_item") {
        const item = line.kitchen_inventory_items;
        if (!item || !line.item_id) {
          warnings.push({
            planRecipeId: planRecipe.id,
            recipeVersionId: versionId,
            recipeLineId: line.id,
            message: "Línea sin item asociado; no se calcula requerimiento.",
          });
          continue;
        }
        const converted = convertQuantity(Number(line.quantity), line.unit_id, item.default_unit_id, conversions);
        if (converted == null) {
          warnings.push({
            planRecipeId: planRecipe.id,
            recipeVersionId: versionId,
            recipeLineId: line.id,
            message: `Falta conversión de unidad para ${item.name}.`,
          });
          continue;
        }
        const wasteFactor = 1 + Number(line.waste_percent ?? 0) / 100;
        const required = converted * localMultiplier * wasteFactor;
        exploded.push({
          planRecipeId: planRecipe.id,
          recipeVersionId: versionId,
          recipeLineId: line.id,
          itemId: line.item_id,
          requiredQuantityInDefaultUnit: required,
          defaultUnitId: item.default_unit_id,
          estimatedUnitCost: Number(item.current_unit_cost ?? 0),
          warning: null,
          source: {
            plan_recipe_id: planRecipe.id,
            recipe_version_id: versionId,
            recipe_line_id: line.id,
            multiplier: localMultiplier,
            conversion: { from_unit_id: line.unit_id, to_unit_id: item.default_unit_id },
            waste_percent: Number(line.waste_percent ?? 0),
          },
        });
        continue;
      }

      if (line.line_type === "sub_recipe") {
        if (!line.sub_recipe_version_id) {
          warnings.push({
            planRecipeId: planRecipe.id,
            recipeVersionId: versionId,
            recipeLineId: line.id,
            message: "Línea sub-receta sin versión asociada.",
          });
          continue;
        }
        const subVersion = versionById.get(line.sub_recipe_version_id);
        if (!subVersion) {
          warnings.push({
            planRecipeId: planRecipe.id,
            recipeVersionId: versionId,
            recipeLineId: line.id,
            message: "Sub-receta no encontrada.",
          });
          continue;
        }
        const subBaseYield = Number(subVersion.yield_quantity ?? 0);
        if (subBaseYield <= 0) {
          warnings.push({
            planRecipeId: planRecipe.id,
            recipeVersionId: versionId,
            recipeLineId: line.id,
            message: "Sub-receta sin yield_quantity válido.",
          });
          continue;
        }
        const nestedMultiplier = localMultiplier * Number(line.quantity) * (1 + Number(line.waste_percent ?? 0) / 100) / subBaseYield;
        explodeVersion(planRecipe, line.sub_recipe_version_id, nestedMultiplier, [...trail, line.sub_recipe_version_id]);
      }
    }
    recursionGuard.delete(cycleKey);
  };

  for (const planRecipe of planRecipes) {
    const version = versionById.get(planRecipe.recipe_version_id);
    if (!version) {
      warnings.push({
        planRecipeId: planRecipe.id,
        recipeVersionId: planRecipe.recipe_version_id,
        recipeLineId: "version_missing",
        message: "La versión de receta del plan no existe.",
      });
      continue;
    }
    const servings = Number(version.servings ?? 0);
    const yieldQuantity = Number(version.yield_quantity ?? 0);
    const plannedServings = Number(planRecipe.planned_servings ?? 0);
    let multiplier = 0;
    if (servings > 0) multiplier = plannedServings / servings;
    else if (yieldQuantity > 0) multiplier = plannedServings / yieldQuantity;
    else {
      warnings.push({
        planRecipeId: planRecipe.id,
        recipeVersionId: planRecipe.recipe_version_id,
        recipeLineId: "base_missing",
        message: "La receta no tiene servings ni yield_quantity válidos.",
      });
      continue;
    }
    explodeVersion(planRecipe, planRecipe.recipe_version_id, multiplier, [planRecipe.recipe_version_id]);
  }

  const consolidated = new Map<string, CateringRequirementRowInput>();
  for (const row of exploded) {
    const key = `${row.itemId}:${row.defaultUnitId}`;
    const prev = consolidated.get(key);
    if (!prev) {
      const required = Number(row.requiredQuantityInDefaultUnit.toFixed(4));
      const estUnitCost = Number(row.estimatedUnitCost ?? 0);
      const estTotal = Number((required * estUnitCost).toFixed(4));
      consolidated.set(key, {
        item_id: row.itemId,
        unit_id: row.defaultUnitId,
        required_quantity: required,
        available_quantity: 0,
        shortage_quantity: 0,
        estimated_unit_cost: estUnitCost,
        estimated_total_cost: estTotal,
        source_payload: {
          lines: [row.source],
          warnings: [],
        },
      });
      continue;
    }
    const required = Number((prev.required_quantity + row.requiredQuantityInDefaultUnit).toFixed(4));
    prev.required_quantity = required;
    prev.shortage_quantity = Math.max(Number((required - prev.available_quantity).toFixed(4)), 0);
    prev.estimated_total_cost = Number((required * prev.estimated_unit_cost).toFixed(4));
    const lines = Array.isArray(prev.source_payload.lines) ? prev.source_payload.lines : [];
    prev.source_payload.lines = [...lines, row.source];
    consolidated.set(key, prev);
  }

  const itemIds = [...new Set(exploded.map((row) => row.itemId))];
  const [balancesRes, allocationsRes] = await Promise.all([
    supabase
      .from("kitchen_inventory_balances")
      .select("item_id,quantity")
      .eq("tenant_id", tenantId)
      .in("item_id", itemIds),
    supabase
      .from("event_catering_inventory_allocations")
      .select("item_id,plan_id,allocated_quantity,consumed_quantity,released_quantity,status")
      .eq("tenant_id", tenantId)
      .in("item_id", itemIds)
      .in("status", ["reserved", "consumed"]),
  ]);
  if (balancesRes.error) throw new Error(`No fue posible cargar balances de inventario: ${balancesRes.error.message}`);
  if (allocationsRes.error && !isAllocationsTableMissing(allocationsRes.error.message)) {
    throw new Error(`No fue posible cargar reservas de inventario por evento: ${allocationsRes.error.message}`);
  }

  const physicalByItem = new Map<string, number>();
  for (const bal of balancesRes.data ?? []) {
    const itemId = String(bal.item_id);
    physicalByItem.set(itemId, (physicalByItem.get(itemId) ?? 0) + Number(bal.quantity ?? 0));
  }

  const reservedThisPlanByItem = new Map<string, number>();
  const reservedOtherPlansByItem = new Map<string, number>();
  for (const allocation of allocationsRes.error ? [] : (allocationsRes.data ?? [])) {
    const remaining = Math.max(
      Number(allocation.allocated_quantity ?? 0) -
        Number(allocation.consumed_quantity ?? 0) -
        Number(allocation.released_quantity ?? 0),
      0,
    );
    if (remaining <= 0) continue;
    const itemId = String(allocation.item_id);
    if (String(allocation.plan_id) === planId) {
      reservedThisPlanByItem.set(itemId, (reservedThisPlanByItem.get(itemId) ?? 0) + remaining);
    } else {
      reservedOtherPlansByItem.set(itemId, (reservedOtherPlansByItem.get(itemId) ?? 0) + remaining);
    }
  }

  for (const row of consolidated.values()) {
    const physical = Number((physicalByItem.get(row.item_id) ?? 0).toFixed(4));
    const reservedByThisPlan = Number((reservedThisPlanByItem.get(row.item_id) ?? 0).toFixed(4));
    const reservedByOthers = Number((reservedOtherPlansByItem.get(row.item_id) ?? 0).toFixed(4));
    const availableForPlan = Number((physical - reservedByOthers).toFixed(4));
    row.available_quantity = Math.max(availableForPlan, 0);
    row.shortage_quantity = Math.max(Number((row.required_quantity - row.available_quantity).toFixed(4)), 0);
    row.source_payload = {
      ...row.source_payload,
      availability_breakdown: {
        physical_balance: physical,
        reserved_other_plans: reservedByOthers,
        reserved_this_plan: reservedByThisPlan,
        available_for_plan: row.available_quantity,
      },
    };
  }

  const rows = [...consolidated.values()];
  const warningByPlanRecipe = new Map<string, string[]>();
  for (const warning of warnings) {
    const prev = warningByPlanRecipe.get(warning.planRecipeId) ?? [];
    prev.push(warning.message);
    warningByPlanRecipe.set(warning.planRecipeId, prev);
  }
  for (const row of rows) {
    row.source_payload.warnings = warnings.filter((warning) =>
      ((row.source_payload.lines as Array<Record<string, unknown>> | undefined) ?? []).some(
        (line) => String(line.plan_recipe_id ?? "") === warning.planRecipeId,
      ),
    );
  }

  const estimatedTotalCost = Number(rows.reduce((acc, row) => acc + Number(row.estimated_total_cost ?? 0), 0).toFixed(4));
  const shortageCount = rows.filter((row) => Number(row.shortage_quantity) > 0).length;
  return { rows, warnings, estimatedTotalCost, shortageCount };
}
