import Link from "next/link";
import { notFound } from "next/navigation";
import { CatalogSectionHeader } from "@/components/pos/catalog/CatalogSectionHeader";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { StatePanel } from "@/components/ui/state-panel";
import { getCurrentTenantModulePageAccessMap, hasModulePageAccess } from "@/lib/auth/module-page-access";
import { resolveRetailPosTypePageContext } from "@/lib/auth/tenant-pos-access";
import { getRetailPosBackofficeCatalogProduct } from "@/lib/retail-pos/catalog";

type RetailProductDetailPageProps = {
  params: Promise<{ tenantSlug: string; productId: string }>;
  searchParams?: Promise<{ updated?: string; created?: string }>;
};

type RetailProductDetailPageResult =
  | {
      ok: true;
      tenantSlug: string;
      tenantName: string;
      canManage: boolean;
      product: Awaited<ReturnType<typeof getRetailPosBackofficeCatalogProduct>>["product"];
    }
  | {
      ok: false;
      message: string;
      hint: string;
    };

function formatMoneyFromCents(cents: number | null): string {
  if (typeof cents !== "number") {
    return "-";
  }

  return new Intl.NumberFormat("es-MX", {
    style: "currency",
    currency: "MXN",
    minimumFractionDigits: 2,
  }).format(cents / 100);
}

function formatMargin(priceCents: number, costCents: number | null): string {
  if (typeof costCents !== "number") {
    return "-";
  }

  return formatMoneyFromCents(priceCents - costCents);
}

function formatFallbackText(value: string | null, fallback: string): string {
  return value && value.trim() ? value.trim() : fallback;
}

function formatDateTime(value: string | null): string {
  if (!value) {
    return "-";
  }

  return new Intl.DateTimeFormat("es-MX", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "America/Mexico_City",
  }).format(new Date(value));
}

async function loadRetailProductDetailPage(
  tenantSlug: string,
  productId: string,
): Promise<RetailProductDetailPageResult> {
  try {
    const tenant = await resolveRetailPosTypePageContext(tenantSlug, "catalog", "read");
    const [payload, accessMap] = await Promise.all([
      getRetailPosBackofficeCatalogProduct({
        tenantSlug: tenant.tenantSlug,
        productId,
      }),
      getCurrentTenantModulePageAccessMap(tenant.tenantId, "retail_pos"),
    ]);

    return {
      ok: true,
      tenantSlug: tenant.tenantSlug,
      tenantName: tenant.tenantName,
      canManage: hasModulePageAccess(accessMap.catalog ?? "none", "manage"),
      product: payload.product,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "No fue posible resolver el producto retail.";

    if (message.toLowerCase().includes("not found")) {
      notFound();
    }

    return {
      ok: false,
      message,
      hint: "Valida el acceso retail_pos.catalog y que el producto pertenezca al tenant solicitado.",
    };
  }
}

function DetailField({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="space-y-1">
      <p className="text-xs font-semibold uppercase tracking-[0.12em] text-muted">{label}</p>
      <p className="text-sm text-foreground">{value}</p>
    </div>
  );
}

export default async function RetailProductDetailPage({ params, searchParams }: RetailProductDetailPageProps) {
  const { tenantSlug, productId } = await params;
  const query = searchParams ? await searchParams : undefined;
  const result = await loadRetailProductDetailPage(tenantSlug, productId);

  if (!result.ok) {
    return (
      <div className="space-y-4">
        <CatalogSectionHeader
          title="Detalle de producto retail"
          description="Detalle readonly del catalogo POS retail."
        />
        <StatePanel kind="permission" title="Sin acceso al producto retail" message={result.message}>
          <p className="text-xs text-muted">{result.hint}</p>
        </StatePanel>
      </div>
    );
  }

  const { product } = result;

  return (
    <div className="space-y-4">
      <CatalogSectionHeader
        title={product.name}
        description="Detalle readonly del catalogo POS retail."
      />

      {query?.created === "1" ? (
        <Card className="border-success/40 bg-success/10 text-sm text-foreground">
          Producto retail creado correctamente.
        </Card>
      ) : null}

      {query?.updated === "1" ? (
        <Card className="border-success/40 bg-success/10 text-sm text-foreground">
          Cambios guardados correctamente en el producto retail.
        </Card>
      ) : null}

      <div className="flex flex-wrap gap-2">
        <Link
          href={`/${result.tenantSlug}/retail/products`}
          className="inline-flex h-10 items-center justify-center rounded-[var(--radius-base)] border border-border bg-surface-2 px-4 text-sm font-medium text-foreground transition-colors hover:bg-surface"
        >
          Volver a productos
        </Link>
        {result.canManage ? (
          <Link
            href={`/${result.tenantSlug}/retail/products/${product.product_id}/edit`}
            className="inline-flex h-10 items-center justify-center rounded-[var(--radius-base)] border border-border bg-surface px-4 text-sm font-medium text-foreground transition-colors hover:bg-surface-2"
          >
            Editar producto
          </Link>
        ) : null}
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <Card className="space-y-4 border-border/80 bg-surface">
          <div className="space-y-1">
            <h2 className="text-base font-semibold text-foreground">Informacion principal</h2>
            <p className="text-sm text-muted">Datos base del producto usado por las terminales retail.</p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <DetailField label="Nombre" value={product.name} />
            <DetailField label="Marca" value={formatFallbackText(product.brand, "Sin marca")} />
            <DetailField label="SKU" value={formatFallbackText(product.sku, "Sin SKU")} />
            <DetailField label="Codigo de barras" value={formatFallbackText(product.barcode, "Sin codigo de barras")} />
            <DetailField label="ID interno" value={product.product_id} />
            <DetailField label="Tenant" value={result.tenantName} />
          </div>
        </Card>

        <Card className="space-y-4 border-border/80 bg-surface">
          <div className="space-y-1">
            <h2 className="text-base font-semibold text-foreground">Precios y margen</h2>
            <p className="text-sm text-muted">Referencia operativa solo lectura para soporte y backoffice.</p>
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            <DetailField label="Precio venta" value={formatMoneyFromCents(product.price_cents)} />
            <DetailField label="Costo" value={formatMoneyFromCents(product.cost_cents)} />
            <DetailField label="Margen estimado" value={formatMargin(product.price_cents, product.cost_cents)} />
          </div>
        </Card>

        <Card className="space-y-4 border-border/80 bg-surface">
          <div className="space-y-1">
            <h2 className="text-base font-semibold text-foreground">Clasificacion y proveedor</h2>
            <p className="text-sm text-muted">Contexto comercial del producto dentro del catalogo retail.</p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <DetailField label="Proveedor" value={formatFallbackText(product.supplier_name, "Sin proveedor")} />
            <DetailField label="Categoria" value={formatFallbackText(product.category_name, "Sin categoria")} />
          </div>
        </Card>

        <Card className="space-y-4 border-border/80 bg-surface">
          <div className="space-y-1">
            <h2 className="text-base font-semibold text-foreground">Unidad de venta</h2>
            <p className="text-sm text-muted">Configuracion operativa usada por la terminal POS retail.</p>
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            <DetailField label="Codigo unidad" value={product.sales_unit_code} />
            <DetailField label="Etiqueta unidad" value={product.sales_unit_label} />
            <DetailField
              label="Cantidad decimal"
              value={product.allow_decimal_quantity ? "Permitida" : "No permitida"}
            />
          </div>
        </Card>

        <Card className="space-y-4 border-border/80 bg-surface xl:col-span-2">
          <div className="space-y-1">
            <h2 className="text-base font-semibold text-foreground">Estado y auditoria</h2>
            <p className="text-sm text-muted">Estado actual y marcas temporales del registro.</p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="space-y-1">
              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-muted">Estado</p>
              <div>
                <Badge variant={product.is_active ? "success" : "warning"}>
                  {product.is_active ? "Activo" : "Inactivo"}
                </Badge>
              </div>
            </div>
            <DetailField label="Variantes" value={product.has_variants ? "Si" : "No"} />
            <DetailField label="Creado" value={formatDateTime(product.created_at)} />
            <DetailField label="Ultima actualizacion" value={formatDateTime(product.updated_at)} />
          </div>
        </Card>
      </div>
    </div>
  );
}
