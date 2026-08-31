import {
  compareKitchenBusinessDateKeys,
  getKitchenBusinessDateKey,
} from "./business-date";
import type { ChefCostingStatus } from "./costing-status";

export type OverviewEventDateInput = {
  name: string | null;
  starts_at: string | null;
};

export function eventMatchesOverviewQuery(event: Pick<OverviewEventDateInput, "name">, query: string): boolean {
  return query.length === 0 || (event.name ?? "").toLowerCase().includes(query);
}

export function eventMatchesPeriod(
  event: Pick<OverviewEventDateInput, "starts_at">,
  period: "proximos" | "recientes" | "todos",
  todayKey: string,
): boolean {
  if (period === "todos") return true;
  const eventDateKey = event.starts_at ? getKitchenBusinessDateKey(event.starts_at) : null;
  if (period === "proximos") {
    return eventDateKey == null || compareKitchenBusinessDateKeys(eventDateKey, todayKey) >= 0;
  }
  return eventDateKey != null && compareKitchenBusinessDateKeys(eventDateKey, todayKey) < 0;
}

export function resolveStructuralChefCostingStatus(input: {
  servicesCount: number;
  recipesCount: number;
  hasAnyRecipes: boolean;
  hasInitialSnapshot: boolean;
  configurationChanged: boolean;
}): ChefCostingStatus {
  if (input.servicesCount <= 0) return "sin_servicios";
  if (!input.hasAnyRecipes) return "sin_recetas";
  if (input.recipesCount < input.servicesCount) return "configuracion_incompleta";
  if (!input.hasInitialSnapshot) return "pendiente_costeo";
  if (input.configurationChanged) return "configuracion_modificada";
  return "costo_inicial_vigente";
}
