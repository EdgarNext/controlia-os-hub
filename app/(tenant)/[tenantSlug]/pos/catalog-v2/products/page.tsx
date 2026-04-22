import Link from "next/link";
import { isTenantAccessDeniedError } from "@/app/(tenant)/lib/access-errors";
import { CatalogSectionHeader } from "@/components/pos/catalog/CatalogSectionHeader";
import { CatalogV2ProductImageManager } from "@/components/pos/catalog-v2/CatalogV2ProductImageManager";
import { Card } from "@/components/ui/card";
import { StatePanel } from "@/components/ui/state-panel";
import { getCurrentTenantModulePageAccessMap, hasModulePageAccess, resolveSalesPosPageContext } from "@/lib/auth/module-page-access";
import { listCatalogCategories } from "@/lib/pos/catalog/queries";
import { listCatalogV2Products } from "@/lib/pos/catalog-v2/queries";
import {
  getCatalogV2CategoryNewPath,
  getCatalogV2ProductNewPath,
} from "@/lib/pos/catalog-v2/paths";

type ProductsPageProps = {
  params: Promise<{ tenantSlug: string }>;
};

type CatalogV2ProductsPageResult =
  | {
      ok: true;
      tenantSlug: string;
      tenantName: string;
      categories: Awaited<ReturnType<typeof listCatalogCategories>>;
      products: Awaited<ReturnType<typeof listCatalogV2Products>>;
      canManage: boolean;
    }
  | {
      ok: false;
      message: string;
      hint: string;
    };

async function loadCatalogV2ProductsPage(tenantSlug: string): Promise<CatalogV2ProductsPageResult> {
  try {
    const tenant = await resolveSalesPosPageContext(tenantSlug, "products", "read");
    const [categories, products] = await Promise.all([
      listCatalogCategories({ tenantId: tenant.tenantId }),
      listCatalogV2Products(tenant.tenantId),
    ]);
    const accessMap = await getCurrentTenantModulePageAccessMap(tenant.tenantId, "sales_pos");

    return {
      ok: true,
      tenantSlug: tenant.tenantSlug,
      tenantName: tenant.tenantName,
      categories,
      products,
      canManage: hasModulePageAccess(accessMap.products ?? "none", "manage"),
    };
  } catch (error) {
    if (isTenantAccessDeniedError(error)) {
      return {
        ok: false,
        message: "No tienes permisos para consultar productos V2 en este tenant.",
        hint: "Solicita acceso al módulo sales_pos.",
      };
    }

    throw error;
  }
}

export default async function CatalogV2ProductsPage({ params }: ProductsPageProps) {
  const { tenantSlug } = await params;
  const result = await loadCatalogV2ProductsPage(tenantSlug);

  if (!result.ok) {
    return (
      <div className="space-y-4">
        <CatalogSectionHeader
          title="POS · Productos V2"
          description="Punto de entrada operativo del catálogo nuevo."
        />
        <StatePanel kind="permission" title="Sin permisos" message={result.message}>
          <p className="text-xs text-muted">{result.hint}</p>
        </StatePanel>
      </div>
    );
  }

  const activeCategories = result.categories.filter((category) => category.deleted_at == null);
  const activeProducts = result.products.filter((product) => product.deleted_at == null);
  const productsWithImageCount = activeProducts.filter((product) => Boolean(product.image_path)).length;
  const productsWithoutImageCount = Math.max(activeProducts.length - productsWithImageCount, 0);

  return (
    <div className="space-y-4">
      <CatalogSectionHeader
        title="POS · Imágenes de productos"
        description={`Organización: ${result.tenantName}. Lista completa para asignar o reemplazar imágenes desde el web app.`}
      />

      <Card className="space-y-3 border-border/80 bg-surface p-4">
        <div className="space-y-1">
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-muted">Flujo rápido</p>
          <p className="text-sm text-muted">
            Selecciona un producto, carga su imagen y guarda sin salir de esta pantalla.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {result.canManage ? (
            <Link
              href={getCatalogV2ProductNewPath(result.tenantSlug)}
              className="inline-flex items-center justify-center rounded-[var(--radius-base)] border border-border bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-opacity duration-200 hover:opacity-90"
            >
              Crear producto
            </Link>
          ) : null}
          {!activeCategories.length && result.canManage ? (
            <Link
              href={getCatalogV2CategoryNewPath(result.tenantSlug)}
              className="inline-flex items-center justify-center rounded-[var(--radius-base)] border border-border bg-surface-2 px-4 py-2 text-sm font-medium text-foreground transition-opacity duration-200 hover:opacity-90"
            >
              Crear categoría
            </Link>
          ) : null}
        </div>
      </Card>

      {activeProducts.length ? (
        <>
          <div className="grid gap-3 md:grid-cols-3">
            <Card className="border-border/80 bg-surface p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-muted">Productos activos</p>
              <p className="mt-2 text-2xl font-semibold text-foreground">{activeProducts.length}</p>
              <p className="text-sm text-muted">Lista completa disponible para gestión visual.</p>
            </Card>
            <Card className="border-border/80 bg-surface p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-muted">Con imagen</p>
              <p className="mt-2 text-2xl font-semibold text-foreground">{productsWithImageCount}</p>
              <p className="text-sm text-muted">Listos para mostrarse con imagen real.</p>
            </Card>
            <Card className="border-border/80 bg-surface p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-muted">Pendientes</p>
              <p className="mt-2 text-2xl font-semibold text-foreground">{productsWithoutImageCount}</p>
              <p className="text-sm text-muted">Aún necesitan imagen desde esta pantalla.</p>
            </Card>
          </div>

          <CatalogV2ProductImageManager
            tenantSlug={result.tenantSlug}
            canManage={result.canManage}
            categories={result.categories}
            products={activeProducts}
          />
        </>
      ) : (
        <StatePanel
          kind="empty"
          title="Todavía no hay productos"
          message="Crea el primer producto para empezar a asignarle imágenes desde el catálogo V2."
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
      )}
    </div>
  );
}
