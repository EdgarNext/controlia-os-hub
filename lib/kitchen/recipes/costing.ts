import { getSupabaseServerClient } from "@/lib/supabase/server";
import { listKitchenRecipeLines, getKitchenRecipeVersionById } from "./queries";
import type { KitchenRecipeCostResult, KitchenRecipeCostWarning } from "./types";
import { classifyKitchenRecipeUnitCost } from "./cost-classification";
import { loadKitchenRecipeItemCostSupport } from "./costing-support";

type ConversionMap = Map<string, number>;

async function loadConversionMap(tenantId: string): Promise<ConversionMap> {
  const supabase = await getSupabaseServerClient();
  const { data, error } = await supabase
    .from("kitchen_inventory_unit_conversions")
    .select("from_unit_id, to_unit_id, factor")
    .eq("tenant_id", tenantId)
    .eq("is_active", true);
  if (error) throw new Error(`No fue posible listar conversiones de unidades: ${error.message}`);

  const map = new Map<string, number>();
  for (const row of data ?? []) {
    map.set(`${row.from_unit_id}:${row.to_unit_id}`, Number(row.factor));
  }
  return map;
}

function formatRecipeContext(recipeName: string | null | undefined): string {
  return recipeName ? ` en la receta ${recipeName}` : "";
}

function buildMissingCostMessage(input: {
  itemName: string;
  recipeName?: string | null;
  reason: "missing_current_cost" | "undocumented_zero_cost" | "negative_cost";
  hasActivePurchaseOption: boolean;
  hasCurrentSupplierPrice: boolean;
}): string {
  const recipeContext = formatRecipeContext(input.recipeName);

  if (input.reason === "undocumented_zero_cost") {
    return `El insumo ${input.itemName}${recipeContext} tiene costo 0 pero no está documentado como zero-cost operativo.`;
  }

  if (input.reason === "negative_cost") {
    return `El insumo ${input.itemName}${recipeContext} tiene un costo unitario negativo y debe corregirse.`;
  }

  const details: string[] = ["falta current_unit_cost"];
  if (!input.hasActivePurchaseOption) details.push("falta purchase option activa");
  if (!input.hasCurrentSupplierPrice) details.push("falta supplier price current");
  return `El insumo ${input.itemName}${recipeContext} no tiene costo unitario vigente: ${details.join("; ")}.`;
}

function convertQuantity(
  quantity: number,
  fromUnitId: string,
  toUnitId: string,
  conversions: ConversionMap,
): number | null {
  if (fromUnitId === toUnitId) return quantity;
  const direct = conversions.get(`${fromUnitId}:${toUnitId}`);
  if (direct && direct > 0) return quantity * direct;
  const reverse = conversions.get(`${toUnitId}:${fromUnitId}`);
  if (reverse && reverse > 0) return quantity / reverse;
  return null;
}

export async function calculateKitchenRecipeVersionCost(
  tenantId: string,
  recipeVersionId: string,
): Promise<KitchenRecipeCostResult> {
  const conversions = await loadConversionMap(tenantId);
  const visited = new Set<string>();

  async function compute(versionId: string): Promise<KitchenRecipeCostResult> {
    if (visited.has(versionId)) {
      return {
        totalCost: 0,
        costPerServing: null,
        costPerYieldUnit: null,
        warnings: [{ type: "cycle", message: "Se detectó ciclo de sub-recetas." }],
        lines: [],
      };
    }

    visited.add(versionId);
    const version = await getKitchenRecipeVersionById(tenantId, versionId);
    if (!version) {
      return {
        totalCost: 0,
        costPerServing: null,
        costPerYieldUnit: null,
        warnings: [{ type: "missing_sub_recipe", message: "Versión de receta no encontrada." }],
        lines: [],
      };
    }

    const lines = await listKitchenRecipeLines(tenantId, versionId);
    const itemCostSupport = await loadKitchenRecipeItemCostSupport(
      tenantId,
      lines
        .filter((line) => line.line_type === "inventory_item")
        .map((line) => line.item_id ?? "")
        .filter(Boolean),
    );
    const warnings: KitchenRecipeCostWarning[] = [];
    const breakdown: KitchenRecipeCostResult["lines"] = [];
    const recipeName = version.kitchen_recipe_recipes?.name ?? null;

    if (lines.length === 0) {
      warnings.push({ type: "empty_recipe", message: "La receta no tiene líneas de ingredientes." });
    }

    let totalCost = 0;

    for (const line of lines) {
      const lineUnit = line.kitchen_inventory_units?.code ?? "ud";
      let lineCost = 0;
      let unitCostApplied: number | null = null;
      let warning: string | undefined;

      if (line.line_type === "inventory_item") {
        const item = line.kitchen_inventory_items;
        if (!item) {
          warnings.push({
            type: "missing_cost",
            lineId: line.id,
            message: `La línea no tiene insumo asociado${formatRecipeContext(recipeName)}.`,
          });
          warning = "Insumo no disponible";
        } else {
          const itemCost = item.current_unit_cost == null ? null : Number(item.current_unit_cost);
          const convertedQuantity = convertQuantity(Number(line.quantity), line.unit_id, item.default_unit_id, conversions);
          const costClassification = classifyKitchenRecipeUnitCost({
            itemName: item.name,
            currentUnitCost: item.current_unit_cost,
          });
          const costSupport = itemCostSupport.get(item.id) ?? {
            hasActivePurchaseOption: false,
            hasCurrentSupplierPrice: false,
            hasZeroSupplierPrice: false,
          };
          const singleLineUnitInDefaultUnit = convertQuantity(1, line.unit_id, item.default_unit_id, conversions);

          if (convertedQuantity == null) {
            warnings.push({
              type: "missing_conversion",
              lineId: line.id,
              message: `No hay conversión de unidad para ${item.name}${formatRecipeContext(recipeName)}.`,
            });
            warning = "Falta conversión de unidad";
          } else if (costClassification === "missing_current_cost") {
            warnings.push({
              type: "missing_cost",
              lineId: line.id,
              message: buildMissingCostMessage({
                itemName: item.name,
                recipeName,
                reason: "missing_current_cost",
                hasActivePurchaseOption: costSupport.hasActivePurchaseOption,
                hasCurrentSupplierPrice: costSupport.hasCurrentSupplierPrice,
              }),
            });
            warning = "Sin costo unitario";
          } else if (costClassification === "negative_cost") {
            warnings.push({
              type: "missing_cost",
              lineId: line.id,
              message: buildMissingCostMessage({
                itemName: item.name,
                recipeName,
                reason: "negative_cost",
                hasActivePurchaseOption: costSupport.hasActivePurchaseOption,
                hasCurrentSupplierPrice: costSupport.hasCurrentSupplierPrice,
              }),
            });
            warning = "Costo unitario inválido";
          } else if (costClassification === "undocumented_zero_cost") {
            warnings.push({
              type: "missing_cost",
              lineId: line.id,
              message: buildMissingCostMessage({
                itemName: item.name,
                recipeName,
                reason: "undocumented_zero_cost",
                hasActivePurchaseOption: costSupport.hasActivePurchaseOption,
                hasCurrentSupplierPrice: costSupport.hasCurrentSupplierPrice,
              }),
            });
            warning = "Costo 0 sin documentación";
          } else if (costClassification === "documented_zero_cost") {
            lineCost = 0;
            unitCostApplied = singleLineUnitInDefaultUnit == null ? null : 0;
          } else {
            lineCost = convertedQuantity * Number(itemCost) * (1 + Number(line.waste_percent) / 100);
            unitCostApplied =
              singleLineUnitInDefaultUnit == null || itemCost == null ? null : singleLineUnitInDefaultUnit * Number(itemCost);
          }
        }
      }

      if (line.line_type === "sub_recipe") {
        if (!line.sub_recipe_version_id) {
          warnings.push({ type: "missing_sub_recipe", lineId: line.id, message: "Sub-receta no seleccionada." });
          warning = "Sub-receta faltante";
        } else {
          const subVersion = await getKitchenRecipeVersionById(tenantId, line.sub_recipe_version_id);
          if (!subVersion) {
            warnings.push({ type: "missing_sub_recipe", lineId: line.id, message: "Sub-receta no encontrada." });
            warning = "Sub-receta no encontrada";
          } else {
            const subCost = await compute(line.sub_recipe_version_id);
            warnings.push(...subCost.warnings);
            const subCostPerYield = Number(subVersion.yield_quantity) > 0 ? subCost.totalCost / Number(subVersion.yield_quantity) : 0;
            const convertedQuantity = subVersion.yield_unit_id
              ? convertQuantity(Number(line.quantity), line.unit_id, subVersion.yield_unit_id, conversions)
              : Number(line.quantity);

            if (convertedQuantity == null) {
              warnings.push({
                type: "missing_conversion",
                lineId: line.id,
                message: "No hay conversión de unidad para sub-receta.",
              });
              warning = "Falta conversión de sub-receta";
            } else {
              lineCost = convertedQuantity * subCostPerYield * (1 + Number(line.waste_percent) / 100);
              const singleLineUnitInYieldUnit = subVersion.yield_unit_id
                ? convertQuantity(1, line.unit_id, subVersion.yield_unit_id, conversions)
                : 1;
              unitCostApplied = singleLineUnitInYieldUnit == null ? null : singleLineUnitInYieldUnit * subCostPerYield;
            }
          }
        }
      }

      totalCost += lineCost;
      breakdown.push({
        lineId: line.id,
        lineType: line.line_type,
        label:
          line.line_type === "inventory_item"
            ? (line.kitchen_inventory_items?.name ?? "Insumo")
            : (line.sub_recipe_version?.kitchen_recipe_recipes?.name ?? "Sub-receta"),
        quantity: Number(line.quantity),
        unitCode: lineUnit,
        lineCost,
        unitCostApplied,
        unitCostUnitCode: lineUnit,
        warning,
      });
    }

    const costPerServing = version.servings ? totalCost / Number(version.servings) : null;
    const costPerYieldUnit = Number(version.yield_quantity) > 0 ? totalCost / Number(version.yield_quantity) : null;

    visited.delete(versionId);

    return {
      totalCost,
      costPerServing,
      costPerYieldUnit,
      warnings,
      lines: breakdown,
    };
  }

  return compute(recipeVersionId);
}
