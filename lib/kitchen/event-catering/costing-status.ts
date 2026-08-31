export type ChefCostingStatus =
  | "sin_servicios"
  | "sin_recetas"
  | "configuracion_incompleta"
  | "pendiente_costeo"
  | "costo_inicial_vigente"
  | "hay_precios_nuevos"
  | "costo_actualizado"
  | "configuracion_modificada"
  | "precios_necesitan_revision";

export type ChefCostingStatusSeverity = "informational" | "attention" | "action_required";

export type ChefCostingStatusPresentation = {
  label: string;
  meaning: string;
  suggestedAction: string;
  severity: ChefCostingStatusSeverity;
};

const STATUS_PRESENTATIONS: Record<ChefCostingStatus, ChefCostingStatusPresentation> = {
  sin_servicios: {
    label: "Sin servicios",
    meaning: "El evento todavía no tiene servicios de catering configurados.",
    suggestedAction: "Agregar el primer servicio.",
    severity: "action_required",
  },
  sin_recetas: {
    label: "Sin recetas",
    meaning: "Existe al menos un servicio, pero todavía no tiene recetas configuradas.",
    suggestedAction: "Agregar las recetas del servicio.",
    severity: "action_required",
  },
  configuracion_incompleta: {
    label: "Configuración incompleta",
    meaning: "Uno o más servicios requieren información o configuración para poder costearse correctamente.",
    suggestedAction: "Completar la configuración pendiente.",
    severity: "action_required",
  },
  pendiente_costeo: {
    label: "Pendiente de costeo",
    meaning: "El servicio ya está configurado, pero todavía no tiene un costo inicial guardado.",
    suggestedAction: "Calcular y guardar el costo inicial.",
    severity: "action_required",
  },
  configuracion_modificada: {
    label: "Configuración modificada",
    meaning: "Después del último costeo guardado cambiaron servicios, recetas, cantidades u otra configuración relevante.",
    suggestedAction: "Recalcular el costo con la nueva configuración.",
    severity: "attention",
  },
  precios_necesitan_revision: {
    label: "Precios por revisar",
    meaning: "Uno o más insumos tienen un precio faltante, ambiguo o no resoluble de forma confiable.",
    suggestedAction: "Revisar y corregir los precios de los insumos indicados.",
    severity: "action_required",
  },
  hay_precios_nuevos: {
    label: "Hay precios nuevos",
    meaning: "Uno o más insumos tienen precios vigentes diferentes a los utilizados en el último costeo guardado.",
    suggestedAction: "Revisar las diferencias y actualizar el costo si corresponde.",
    severity: "attention",
  },
  costo_actualizado: {
    label: "Costo actualizado",
    meaning: "El costo guardado ya fue actualizado con la información de precios revisada.",
    suggestedAction: "No requiere acción inmediata. Puede consultarse el comparativo.",
    severity: "informational",
  },
  costo_inicial_vigente: {
    label: "Costo inicial vigente",
    meaning: "El costo inicial guardado continúa siendo válido y no se han detectado cambios que requieran actualizarlo.",
    suggestedAction: "No requiere acción inmediata. Consultar el costeo si se necesita detalle.",
    severity: "informational",
  },
};

export function getChefCostingStatusPresentation(status: ChefCostingStatus): ChefCostingStatusPresentation {
  return STATUS_PRESENTATIONS[status];
}

export function costingStatusRequiresAttention(status: ChefCostingStatus): boolean {
  return getChefCostingStatusPresentation(status).severity !== "informational";
}

export function serviceRequiresManagerialAttention(input: {
  costingStatus: ChefCostingStatus;
  pricingStatus: "ready" | "incomplete" | "unavailable";
}): boolean {
  return costingStatusRequiresAttention(input.costingStatus) || input.pricingStatus !== "ready";
}

export function resolveSingleServiceCostingStatus(input: {
  recipeCount: number;
  currentFoodCostSource: "updated_snapshot" | "initial_snapshot" | "current_preview" | "unavailable";
}): ChefCostingStatus {
  if (input.recipeCount <= 0) return "sin_recetas";
  if (input.currentFoodCostSource === "updated_snapshot") return "costo_actualizado";
  if (input.currentFoodCostSource === "initial_snapshot") return "costo_inicial_vigente";
  return "pendiente_costeo";
}

export function listChefCostingStatusPresentations(): ChefCostingStatusPresentation[] {
  return Object.values(STATUS_PRESENTATIONS);
}
