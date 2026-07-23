export type KitchenCatalogStatus =
  | "ready"
  | "price_pending"
  | "no_purchase_option"
  | "requires_review"
  | "retired"
  | "zero_cost_configured";

export const KITCHEN_CATALOG_STATUS_META: Record<
  KitchenCatalogStatus,
  { label: string; description: string; tone: "success" | "warning" | "danger" | "neutral" }
> = {
  ready: { label: "Listo", description: "Configurado para operación y costeo.", tone: "success" },
  price_pending: { label: "Precio pendiente", description: "Falta un precio vigente o costo operativo.", tone: "warning" },
  no_purchase_option: { label: "Sin presentación", description: "Requiere una presentación de compra activa.", tone: "warning" },
  requires_review: { label: "Requiere revisión", description: "Tiene una inconsistencia que debe revisarse.", tone: "danger" },
  retired: { label: "Retirado", description: "El insumo está inactivo.", tone: "neutral" },
  zero_cost_configured: { label: "Costo cero permitido", description: "El costo cero está permitido para este insumo.", tone: "neutral" },
};

export function getKitchenCatalogStatusMeta(status: KitchenCatalogStatus) {
  return KITCHEN_CATALOG_STATUS_META[status];
}
