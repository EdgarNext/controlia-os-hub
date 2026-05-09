import { getSupabaseServerClient } from "@/lib/supabase/server";
import { listKitchenRecipeLines, getKitchenRecipeVersionById } from "./queries";
import type { KitchenRecipeCostResult, KitchenRecipeCostWarning } from "./types";

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
    const warnings: KitchenRecipeCostWarning[] = [];
    const breakdown: KitchenRecipeCostResult["lines"] = [];

    if (lines.length === 0) {
      warnings.push({ type: "empty_recipe", message: "La receta no tiene líneas de ingredientes." });
    }

    let totalCost = 0;

    for (const line of lines) {
      const lineUnit = line.kitchen_inventory_units?.code ?? "ud";
      let lineCost = 0;
      let warning: string | undefined;

      if (line.line_type === "inventory_item") {
        const item = line.kitchen_inventory_items;
        if (!item) {
          warnings.push({ type: "missing_cost", lineId: line.id, message: "La línea no tiene insumo asociado." });
          warning = "Insumo no disponible";
        } else {
          const itemCost = Number(item.current_unit_cost ?? 0);
          const convertedQuantity = convertQuantity(Number(line.quantity), line.unit_id, item.default_unit_id, conversions);

          if (convertedQuantity == null) {
            warnings.push({
              type: "missing_conversion",
              lineId: line.id,
              message: `No hay conversión de unidad para ${item.name}.`,
            });
            warning = "Falta conversión de unidad";
          } else if (itemCost <= 0) {
            warnings.push({
              type: "missing_cost",
              lineId: line.id,
              message: `El insumo ${item.name} no tiene costo unitario vigente.`,
            });
            warning = "Sin costo unitario";
          } else {
            lineCost = convertedQuantity * itemCost * (1 + Number(line.waste_percent) / 100);
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
