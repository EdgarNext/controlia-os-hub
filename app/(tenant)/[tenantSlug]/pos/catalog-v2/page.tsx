import Link from "next/link";
import { isTenantAccessDeniedError } from "@/app/(tenant)/lib/access-errors";
import { CatalogSectionHeader } from "@/components/pos/catalog/CatalogSectionHeader";
import { Card } from "@/components/ui/card";
import { StatePanel } from "@/components/ui/state-panel";
import { getCurrentTenantModulePageAccessMap, hasModulePageAccess, resolveSalesPosPageContext } from "@/lib/auth/module-page-access";
import { listCatalogCategories } from "@/lib/pos/catalog/queries";
import { listCatalogV2ModifierGroups, listCatalogV2ModifierOptions, listCatalogV2Products } from "@/lib/pos/catalog-v2/queries";
import {
  getCatalogV2CategoriesPath,
  getCatalogV2CategoryNewPath,
  getCatalogV2ModifiersPath,
  getCatalogV2ProductNewPath,
  getCatalogV2ProductsPath,
} from "@/lib/pos/catalog-v2/paths";

type CatalogV2LandingPageProps = {
  params: Promise<{ tenantSlug: string }>;
};

type CatalogV2LandingPageResult =
  | {
      ok: true;
      tenantSlug: string;
      tenantName: string;
      categories: Awaited<ReturnType<typeof listCatalogCategories>>;
      modifierGroups: Awaited<ReturnType<typeof listCatalogV2ModifierGroups>>;
      modifierOptions: Awaited<ReturnType<typeof listCatalogV2ModifierOptions>>;
      products: Awaited<ReturnType<typeof listCatalogV2Products>>;
      canManageCategories: boolean;
      canManageModifiers: boolean;
      canManageProducts: boolean;
    }
  | {
      ok: false;
      message: string;
      hint: string;
    };

async function loadCatalogV2LandingPage(tenantSlug: string): Promise<CatalogV2LandingPageResult> {
  try {
    const tenant = await resolveSalesPosPageContext(tenantSlug, "products", "read");
    const accessMap = await getCurrentTenantModulePageAccessMap(tenant.tenantId, "sales_pos");
    const [categories, modifierGroups, modifierOptions, products] = await Promise.all([
      listCatalogCategories({ tenantId: tenant.tenantId }),
      listCatalogV2ModifierGroups(tenant.tenantId),
      listCatalogV2ModifierOptions(tenant.tenantId),
      listCatalogV2Products(tenant.tenantId),
    ]);

    return {
      ok: true,
      tenantSlug: tenant.tenantSlug,
      tenantName: tenant.tenantName,
      categories,
      modifierGroups,
      modifierOptions,
      products,
      canManageCategories: hasModulePageAccess(accessMap.categories ?? "none", "manage"),
      canManageModifiers: hasModulePageAccess(accessMap.products ?? "none", "manage"),
      canManageProducts: hasModulePageAccess(accessMap.products ?? "none", "manage"),
    };
  } catch (error) {
    if (isTenantAccessDeniedError(error)) {
      return {
        ok: false,
        message: "No tienes permisos para ver POS en este tenant.",
        hint: "Solicita acceso al módulo sales_pos.",
      };
    }

    throw error;
  }
}

function buildMetricCard(title: string, value: string, description: string) {
  return (
    <Card className="space-y-2 border-border/80 bg-surface">
      <p className="text-xs font-semibold uppercase tracking-[0.12em] text-muted">{title}</p>
      <p className="text-2xl font-semibold text-foreground">{value}</p>
      <p className="text-sm text-muted">{description}</p>
    </Card>
  );
}

export default async function CatalogV2LandingPage({ params }: CatalogV2LandingPageProps) {
  const { tenantSlug } = await params;
  const result = await loadCatalogV2LandingPage(tenantSlug);

  if (!result.ok) {
    return (
      <div className="space-y-4">
        <CatalogSectionHeader
          title="POS · Catálogo V2"
          description="Punto de entrada nuevo, separado del catálogo legacy."
        />
        <StatePanel kind="permission" title="Sin permisos" message={result.message}>
          <p className="text-xs text-muted">{result.hint}</p>
        </StatePanel>
      </div>
    );
  }

  const activeCategories = result.categories.filter((category) => category.deleted_at == null);
  const activeModifierGroups = result.modifierGroups.filter((group) => group.deleted_at == null);
  const activeModifierOptions = result.modifierOptions.filter((option) => option.deleted_at == null);
  const activeProducts = result.products.filter((product) => product.deleted_at == null);
  const hasCategories = activeCategories.length > 0;
  const hasModifiers = activeModifierGroups.length > 0;
  const hasProducts = activeProducts.length > 0;

  return (
    <div className="space-y-6">
      <CatalogSectionHeader
        title="POS · Catálogo V2"
        description={`Organización: ${result.tenantName}. Empieza por categorías, luego define modifiers y después crea productos.`}
      />

      <div className="grid gap-4 md:grid-cols-3">
        {buildMetricCard("Categorías", String(activeCategories.length), "Master data base para organizar el catálogo.")}
        {buildMetricCard("Modificadores", String(activeModifierGroups.length), `${activeModifierOptions.length} opciones listas para reutilizar.`)}
        {buildMetricCard("Productos", String(activeProducts.length), "Productos ya listos para detalle operativo.")}
      </div>

      <Card className="space-y-2 border-border/80 bg-surface p-4">
        <p className="text-xs font-semibold uppercase tracking-[0.12em] text-muted">Siguiente paso</p>
        <p className="text-lg font-semibold text-foreground">
          {!hasCategories ? "Crear categoría" : !hasModifiers ? "Crear grupo de modifiers" : !hasProducts ? "Crear producto" : "Abrir detalle operativo"}
        </p>
        <p className="text-sm text-muted">
          {hasCategories
            ? hasModifiers
              ? hasProducts
                ? "Ya puedes entrar al detalle de un producto para variantes, asignaciones y combos."
                : "Con categorías y modificadores listos, el siguiente paso es crear productos."
              : "Después de categorías, define los grupos de modificadores y luego entra a productos."
            : "Las categorías siguen siendo la base del orden del catálogo."}
        </p>
      </Card>

      <Card className="space-y-4 border-border/80 bg-surface p-4">
        <div className="space-y-1">
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-muted">Onboarding</p>
          <h2 className="text-lg font-semibold text-foreground">
            {hasCategories ? (hasModifiers ? "La base está lista para crear productos" : "Ahora define modificadores maestros") : "Comienza creando tu primera categoría"}
          </h2>
          <p className="max-w-3xl text-sm text-muted">
            Esta experiencia es paralela y aislada. Todo lo nuevo vive aquí y no depende de rutas legacy ni de
            redirects silenciosos.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <Link
            href={getCatalogV2CategoriesPath(result.tenantSlug)}
            className="inline-flex items-center justify-center rounded-[var(--radius-base)] border border-border bg-surface-2 px-4 py-2 text-sm font-medium text-foreground transition-opacity duration-200 hover:opacity-90"
          >
            Ir a categorías
          </Link>
          <Link
            href={getCatalogV2ModifiersPath(result.tenantSlug)}
            className="inline-flex items-center justify-center rounded-[var(--radius-base)] border border-border bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-opacity duration-200 hover:opacity-90"
          >
            Ir a modificadores
          </Link>
          <Link
            href={getCatalogV2ProductsPath(result.tenantSlug)}
            className="inline-flex items-center justify-center rounded-[var(--radius-base)] border border-border bg-surface-2 px-4 py-2 text-sm font-medium text-foreground transition-opacity duration-200 hover:opacity-90"
          >
            Ir a productos
          </Link>
          {result.canManageCategories ? (
            <Link
              href={getCatalogV2CategoryNewPath(result.tenantSlug)}
              className="inline-flex items-center justify-center rounded-[var(--radius-base)] border border-border bg-surface-2 px-4 py-2 text-sm font-medium text-foreground transition-opacity duration-200 hover:opacity-90"
            >
              Crear categoría
            </Link>
          ) : null}
          {result.canManageProducts ? (
            <Link
              href={getCatalogV2ProductNewPath(result.tenantSlug)}
              className="inline-flex items-center justify-center rounded-[var(--radius-base)] border border-border bg-surface-2 px-4 py-2 text-sm font-medium text-foreground transition-opacity duration-200 hover:opacity-90"
            >
              Crear producto
            </Link>
          ) : null}
        </div>
      </Card>

      {!hasCategories ? (
        <StatePanel
          kind="empty"
          title="Todavía no hay categorías"
          message="Crea la primera categoría para empezar a ordenar el catálogo."
        >
          <div className="mt-3 flex flex-wrap gap-2">
            <Link
              href={getCatalogV2CategoriesPath(result.tenantSlug)}
              className="inline-flex items-center justify-center rounded-[var(--radius-base)] border border-border bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-opacity duration-200 hover:opacity-90"
            >
              Crear categoría
            </Link>
          </div>
        </StatePanel>
      ) : null}

      {!hasModifiers ? (
        <StatePanel
          kind="empty"
          title="Todavía no hay modificadores"
          message="Crea el primer grupo de modificadores para poder agregar opciones y luego asignarlo a productos."
        >
          <div className="mt-3 flex flex-wrap gap-2">
            <Link
              href={getCatalogV2ModifiersPath(result.tenantSlug)}
              className="inline-flex items-center justify-center rounded-[var(--radius-base)] border border-border bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-opacity duration-200 hover:opacity-90"
            >
              Crear grupo de modificadores
            </Link>
          </div>
        </StatePanel>
      ) : null}

      {!hasProducts ? (
        <StatePanel
          kind="empty"
          title="Todavía no hay productos"
          message="Después de crear categorías, el siguiente paso es crear el primer producto y abrir su detalle operativo."
        >
          <div className="mt-3 flex flex-wrap gap-2">
            <Link
              href={getCatalogV2ProductNewPath(result.tenantSlug)}
              className="inline-flex items-center justify-center rounded-[var(--radius-base)] border border-border bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-opacity duration-200 hover:opacity-90"
            >
              Crear producto
            </Link>
          </div>
        </StatePanel>
      ) : null}
    </div>
  );
}
