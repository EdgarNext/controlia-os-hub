import Link from "next/link";
import { isTenantAccessDeniedError } from "@/app/(tenant)/lib/access-errors";
import { createProductAction } from "@/actions/pos/catalog/products.actions";
import { saveProductV2Action } from "@/actions/pos/catalog-v2.actions";
import { ProductV2Form } from "@/components/pos/catalog-v2/ProductV2Form";
import { ProductForm } from "@/components/pos/catalog/ProductForm";
import { CatalogSectionHeader } from "@/components/pos/catalog/CatalogSectionHeader";
import { StatePanel } from "@/components/ui/state-panel";
import { resolveSalesPosPageContext } from "@/lib/auth/module-page-access";
import { listCatalogCategoriesForSelect } from "@/lib/pos/catalog/queries";
import {
  listCatalogV2CategoriesForSelect,
  listCatalogV2VariantsForSelect,
} from "@/lib/pos/catalog-v2/queries";

type ProductNewPageProps = {
  params: Promise<{ tenantSlug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

type ProductNewPageResult =
    | {
      ok: true;
      mode: "v2" | "legacy";
      tenantSlug: string;
      tenantName: string;
      categories: Awaited<ReturnType<typeof listCatalogV2CategoriesForSelect>> | Awaited<ReturnType<typeof listCatalogCategoriesForSelect>>;
      defaultVariantOptions: Awaited<ReturnType<typeof listCatalogV2VariantsForSelect>>;
    }
  | {
      ok: false;
      message: string;
      hint: string;
    };

function toSingleQueryParam(value: string | string[] | undefined): string | null {
  if (Array.isArray(value)) {
    return value[0] ?? null;
  }

  return typeof value === "string" && value.length > 0 ? value : null;
}

async function loadProductNewPage(
  tenantSlug: string,
  searchParams: Record<string, string | string[] | undefined>,
): Promise<ProductNewPageResult> {
  try {
    const tenant = await resolveSalesPosPageContext(tenantSlug, "products", "manage");
    const legacyMode = toSingleQueryParam(searchParams.mode) === "legacy";

    if (legacyMode) {
      const categories = await listCatalogCategoriesForSelect({ tenantId: tenant.tenantId });

      return {
        ok: true,
        mode: "legacy",
        tenantSlug: tenant.tenantSlug,
        tenantName: tenant.tenantName,
        categories,
        defaultVariantOptions: [],
      };
    }

    const [categories, variants] = await Promise.all([
      listCatalogV2CategoriesForSelect(tenant.tenantId),
      listCatalogV2VariantsForSelect(tenant.tenantId),
    ]);

    return {
      ok: true,
      mode: "v2",
      tenantSlug: tenant.tenantSlug,
      tenantName: tenant.tenantName,
      categories,
      defaultVariantOptions: variants,
    };
  } catch (error) {
    if (isTenantAccessDeniedError(error)) {
      return {
        ok: false,
        message: "No tienes permisos para crear productos en este tenant.",
        hint: "Solicita acceso de administrador u operador del tenant.",
      };
    }

    throw error;
  }
}

export default async function ProductNewPage({ params, searchParams }: ProductNewPageProps) {
  const { tenantSlug } = await params;
  const query = await searchParams;
  const result = await loadProductNewPage(tenantSlug, query);

  if (!result.ok) {
    return (
      <div className="space-y-4">
        <CatalogSectionHeader
          title="POS · Nuevo producto"
          description="Crea un producto del catálogo operativo POS."
        />
        <StatePanel kind="permission" title="Sin permisos" message={result.message}>
          <p className="text-xs text-muted">{result.hint}</p>
        </StatePanel>
      </div>
    );
  }

  const listPath = `/${result.tenantSlug}/pos/catalog/products`;
  const legacyModeHref = `/${result.tenantSlug}/pos/catalog/products/new?mode=legacy`;

  if (result.mode === "legacy") {
    return (
      <div className="space-y-4">
        <CatalogSectionHeader
          title="POS · Nuevo producto"
          description={`Organizacion: ${result.tenantName}`}
        />

        <StatePanel
          kind="warning"
          title="Modo clásico"
          message="Esta ruta sigue disponible para compatibilidad, pero el flujo nuevo y recomendado es el formulario v2."
        >
          <div className="mt-3 flex flex-wrap gap-2">
            <Link
              href={listPath}
              className="inline-flex items-center justify-center rounded-[var(--radius-base)] border border-border bg-surface-2 px-4 py-2 text-sm font-medium text-foreground transition-opacity duration-200 hover:opacity-90"
            >
              Volver a productos
            </Link>
            <Link
              href={`/${result.tenantSlug}/pos/catalog/products/new`}
              className="inline-flex items-center justify-center rounded-[var(--radius-base)] border border-border bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-opacity duration-200 hover:opacity-90"
            >
              Abrir alta v2
            </Link>
          </div>
        </StatePanel>

        <ProductForm
          action={createProductAction}
          tenantSlug={result.tenantSlug}
          cancelHref={listPath}
          categories={result.categories}
          submitLabel="Guardar producto clásico"
        />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <CatalogSectionHeader
        title="POS · Nuevo producto v2"
        description={`Organizacion: ${result.tenantName}`}
      />

      <StatePanel
        kind="empty"
        title="Alta canónica"
        message="Este es el punto de entrada principal para crear productos en la nueva arquitectura centrada en producto."
      >
        <div className="mt-3 flex flex-wrap gap-2">
          <Link
            href={listPath}
            className="inline-flex items-center justify-center rounded-[var(--radius-base)] border border-border bg-surface-2 px-4 py-2 text-sm font-medium text-foreground transition-opacity duration-200 hover:opacity-90"
          >
            Volver a productos
          </Link>
          <Link
            href={legacyModeHref}
            className="inline-flex items-center justify-center rounded-[var(--radius-base)] border border-border bg-surface-2 px-4 py-2 text-sm font-medium text-foreground transition-opacity duration-200 hover:opacity-90"
          >
            Abrir modo clásico
          </Link>
        </div>
      </StatePanel>

      <ProductV2Form
        action={saveProductV2Action}
        tenantSlug={result.tenantSlug}
        cancelHref={listPath}
        categories={result.categories}
        defaultVariantOptions={[]}
        submitLabel="Crear producto v2"
      />
    </div>
  );
}
