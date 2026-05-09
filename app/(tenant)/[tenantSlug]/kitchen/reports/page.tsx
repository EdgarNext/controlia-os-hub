import { StatePanel } from "@/components/ui/state-panel";
import { resolveKitchenPage } from "../_lib/page-access";

type KitchenReportsPageProps = {
  params: Promise<{ tenantSlug: string }>;
};

export default async function KitchenReportsPage({ params }: KitchenReportsPageProps) {
  const { tenantSlug } = await params;

  const [inventory, recipes, catering] = await Promise.all([
    resolveKitchenPage(tenantSlug, "kitchen_inventory", "reports"),
    resolveKitchenPage(tenantSlug, "kitchen_recipes", "reports"),
    resolveKitchenPage(tenantSlug, "event_catering", "reports"),
  ]);

  if (!inventory.ok && !recipes.ok && !catering.ok) {
    return (
      <StatePanel
        kind="permission"
        title="Sin permisos para reportes"
        message="No tienes acceso de lectura a reportes de kitchen-ops en este tenant."
      />
    );
  }

  return (
    <StatePanel
      kind="empty"
      title="Reportes de kitchen-ops en preparación"
      message="Los reportes se habilitarán cuando entren inventario, recetas y catering funcionales."
    />
  );
}
