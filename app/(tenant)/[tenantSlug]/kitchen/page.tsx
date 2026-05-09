import Link from "next/link";
import { StatePanel } from "@/components/ui/state-panel";
import { KitchenPageHeader } from "./_components/kitchen-page-header";
import { resolveKitchenPage } from "./_lib/page-access";

type KitchenHomePageProps = {
  params: Promise<{ tenantSlug: string }>;
};

export default async function KitchenHomePage({ params }: KitchenHomePageProps) {
  const { tenantSlug } = await params;
  const [inventory, recipes, catering] = await Promise.all([
    resolveKitchenPage(tenantSlug, "kitchen_inventory", "overview"),
    resolveKitchenPage(tenantSlug, "kitchen_recipes", "overview"),
    resolveKitchenPage(tenantSlug, "event_catering", "overview"),
  ]);

  const links = [
    {
      enabled: inventory.ok,
      href: `/${tenantSlug}/kitchen/inventory`,
      title: "Inventario",
      description: "Configura insumos, ubicaciones, proveedores y movimientos operativos.",
    },
    {
      enabled: recipes.ok,
      href: `/${tenantSlug}/kitchen/recipes`,
      title: "Recetas y Costeo",
      description: "Prepara el espacio para recetas, versionado y costeo estandar/actual.",
    },
    {
      enabled: catering.ok,
      href: `/${tenantSlug}/kitchen/events`,
      title: "Catering por Evento",
      description: "Prepara la planeacion de requerimientos y requisiciones ligadas a eventos.",
    },
  ].filter((link) => link.enabled);

  if (links.length === 0) {
    return (
      <StatePanel
        kind="permission"
        title="Sin acceso a Cocina"
        message="No tienes páginas habilitadas en kitchen-ops para este tenant."
      />
    );
  }

  return (
    <div className="space-y-4">
      <KitchenPageHeader
        eyebrow="Kitchen Ops"
        title="Cocina y Operación de Eventos"
        description="Esta fase habilita estructura modular, permisos y navegación. Inventario, recetas, costeo e importaciones se habilitarán en siguientes fases."
      />

      <section className="grid gap-3 md:grid-cols-3">
        {links.map((link) => (
          <Link
            key={link.href}
            href={link.href}
            className="rounded-[var(--radius-base)] border border-border bg-surface p-4 transition-colors hover:bg-surface-2"
          >
            <p className="text-sm font-semibold text-foreground">{link.title}</p>
            <p className="mt-2 text-sm text-muted">{link.description}</p>
          </Link>
        ))}
      </section>

      <StatePanel
        kind="empty"
        title="Fase 1 activa"
        message="Las rutas base están listas con guards. Las capacidades funcionales se habilitarán en fases posteriores."
      />
    </div>
  );
}
