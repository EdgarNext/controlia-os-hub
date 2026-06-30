import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { StatePanel } from "@/components/ui/state-panel";
import { getCurrentTenantModulePageAccessMap, hasModulePageAccess } from "@/lib/auth/module-page-access";
import { resolveRetailPosTypePageContext } from "@/lib/auth/tenant-pos-access";
import { searchRetailPosBackofficeCatalogProducts } from "@/lib/retail-pos/catalog";
import { CatalogSectionHeader } from "@/components/pos/catalog/CatalogSectionHeader";

type RetailProductsPageProps = {
  params: Promise<{ tenantSlug: string }>;
  searchParams: Promise<{ q?: string; cursor?: string }>;
};

type RetailProductsPageResult =
  | {
      ok: true;
      tenantSlug: string;
      tenantName: string;
      query: string;
      canManage: boolean;
      cursor: string | null;
      previousCursor: string | null;
      nextCursor: string | null;
      pageSize: number;
      items: Awaited<ReturnType<typeof searchRetailPosBackofficeCatalogProducts>>["items"];
    }
  | {
      ok: false;
      message: string;
      hint: string;
    };

const PAGE_SIZE = 25;

function normalizeQueryParam(value: string | undefined): string {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeCursor(value: string | undefined): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const normalized = value.trim();
  if (!normalized) {
    return null;
  }

  return /^\d+$/.test(normalized) ? normalized : null;
}

function buildProductsHref(
  tenantSlug: string,
  input: {
    q?: string;
    cursor?: string | null;
  },
) {
  const searchParams = new URLSearchParams();
  if (input.q && input.q.trim()) {
    searchParams.set("q", input.q.trim());
  }
  if (input.cursor) {
    searchParams.set("cursor", input.cursor);
  }

  const query = searchParams.toString();
  return `/${tenantSlug}/retail/products${query ? `?${query}` : ""}`;
}

function computePreviousCursor(currentCursor: string | null, pageSize: number): string | null {
  if (!currentCursor) {
    return null;
  }

  const parsed = Number(currentCursor);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return null;
  }

  const nextValue = Math.max(parsed - pageSize, 0);
  return nextValue === 0 ? null : String(nextValue);
}

async function loadRetailProductsPage(
  tenantSlug: string,
  searchParams: { q?: string; cursor?: string },
): Promise<RetailProductsPageResult> {
  try {
    const tenant = await resolveRetailPosTypePageContext(tenantSlug, "catalog", "read");
    const query = normalizeQueryParam(searchParams.q);
    const cursor = normalizeCursor(searchParams.cursor);
    const [payload, accessMap] = await Promise.all([
      searchRetailPosBackofficeCatalogProducts({
        tenantSlug: tenant.tenantSlug,
        q: query || null,
        cursor,
        limit: PAGE_SIZE,
      }),
      getCurrentTenantModulePageAccessMap(tenant.tenantId, "retail_pos"),
    ]);

    return {
      ok: true,
      tenantSlug: tenant.tenantSlug,
      tenantName: tenant.tenantName,
      query,
      canManage: hasModulePageAccess(accessMap.catalog ?? "none", "manage"),
      cursor,
      previousCursor: computePreviousCursor(cursor, PAGE_SIZE),
      nextCursor: payload.next_cursor,
      pageSize: PAGE_SIZE,
      items: payload.items,
    };
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error ? error.message : "No fue posible resolver productos retail.",
      hint: "Valida el acceso retail_pos.catalog y el tenantSlug solicitado.",
    };
  }
}

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

export default async function RetailProductsPage({ params, searchParams }: RetailProductsPageProps) {
  const { tenantSlug } = await params;
  const resolvedSearchParams = await searchParams;
  const result = await loadRetailProductsPage(tenantSlug, resolvedSearchParams);

  return (
    <div className="space-y-4">
      <CatalogSectionHeader
        title="Productos retail"
        description="Consulta del catalogo operativo usado por las terminales POS retail."
      />

      {result.ok ? (
        <>
          <Card className="space-y-3 border-border/80 bg-surface">
            <div className="space-y-1">
              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-muted">Tenant</p>
              <h2 className="text-lg font-semibold text-foreground">{result.tenantName}</h2>
              <p className="max-w-2xl text-sm text-muted">
                Vista operativa del catalogo retail sobre `retail_pos`, con tenant isolation para `las-quintas`.
              </p>
            </div>
            <div className="grid gap-3 md:grid-cols-4">
              <div className="rounded-[var(--radius-base)] border border-border bg-surface-2 p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.12em] text-muted">Vista</p>
                <p className="mt-2 text-2xl font-semibold text-foreground">{result.items.length}</p>
                <p className="text-sm text-muted">Productos cargados en esta pagina.</p>
              </div>
              <div className="rounded-[var(--radius-base)] border border-border bg-surface-2 p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.12em] text-muted">Modo</p>
                <p className="mt-2 text-2xl font-semibold text-foreground">
                  {result.canManage ? "Gestion" : "Solo lectura"}
                </p>
                <p className="text-sm text-muted">
                  {result.canManage ? "Con acceso a alta y detalle editable." : "Sin acceso funcional de alta."}
                </p>
              </div>
              <div className="rounded-[var(--radius-base)] border border-border bg-surface-2 p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.12em] text-muted">Dominio</p>
                <p className="mt-2 text-2xl font-semibold text-foreground">retail_pos</p>
                <p className="text-sm text-muted">Sin tablas ni rutas de `sales_pos`.</p>
              </div>
              <div className="rounded-[var(--radius-base)] border border-border bg-surface-2 p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.12em] text-muted">Busqueda</p>
                <p className="mt-2 text-lg font-semibold text-foreground">
                  {result.query ? `"${result.query}"` : "Sin filtro"}
                </p>
                <p className="text-sm text-muted">Nombre, SKU, marca, proveedor y barcode si existe.</p>
              </div>
            </div>
          </Card>

          <Card className="space-y-4 border-border/80 bg-surface">
            <form method="get" className="grid gap-3 lg:grid-cols-[1fr_auto_auto_auto]">
              <div className="space-y-1">
                <label htmlFor="retail-products-query" className="text-sm font-medium text-foreground">
                  Buscar productos
                </label>
                <input
                  id="retail-products-query"
                  name="q"
                  type="search"
                  defaultValue={result.query}
                  placeholder="Nombre, SKU, marca, proveedor o barcode"
                  className="h-10 w-full rounded-[var(--radius-base)] border border-border bg-background px-3 text-sm text-foreground outline-none transition-colors placeholder:text-muted focus:border-primary"
                />
              </div>
              <div className="flex items-end">
                <button
                  type="submit"
                  className="inline-flex h-10 items-center justify-center rounded-[var(--radius-base)] border border-border bg-primary px-4 text-sm font-medium text-primary-foreground transition-opacity duration-200 hover:opacity-90"
                >
                  Buscar
                </button>
              </div>
              <div className="flex items-end">
                <Link
                  href={buildProductsHref(result.tenantSlug, {})}
                  className="inline-flex h-10 items-center justify-center rounded-[var(--radius-base)] border border-border bg-surface-2 px-4 text-sm font-medium text-foreground transition-colors hover:bg-surface"
                >
                  Limpiar
                </Link>
              </div>
              {result.canManage ? (
                <div className="flex items-end">
                  <Link
                    href={`/${result.tenantSlug}/retail/products/new`}
                    className="inline-flex h-10 items-center justify-center rounded-[var(--radius-base)] border border-border bg-primary px-4 text-sm font-medium text-primary-foreground transition-opacity duration-200 hover:opacity-90"
                  >
                    Agregar producto
                  </Link>
                </div>
              ) : null}
              <div className="flex items-end justify-start lg:justify-end">
                <Link
                  href={`/${result.tenantSlug}/retail`}
                  className="inline-flex h-10 items-center justify-center rounded-[var(--radius-base)] border border-border bg-surface-2 px-4 text-sm font-medium text-foreground transition-colors hover:bg-surface"
                >
                  Volver a retail
                </Link>
              </div>
            </form>

            {!result.canManage ? (
              <StatePanel
                kind="empty"
                title="Modo lectura"
                message="El acceso de alta solo aparece para usuarios con manage sobre retail_pos.catalog."
              />
            ) : null}
          </Card>

          {result.items.length > 0 ? (
            <Card className="overflow-hidden border-border/80 bg-surface p-0">
              <div className="border-b border-border px-5 py-4">
                <h2 className="text-base font-semibold text-foreground">Consulta operativa de productos retail</h2>
                <p className="mt-1 text-sm text-muted">
                  Lectura limitada a {result.pageSize} filas por pagina. No se carga el catalogo completo.
                </p>
              </div>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-border text-sm">
                  <thead className="bg-surface-2">
                    <tr>
                      <th className="px-4 py-3 text-left font-medium text-muted">Producto</th>
                      <th className="px-4 py-3 text-left font-medium text-muted">SKU</th>
                      <th className="px-4 py-3 text-left font-medium text-muted">Marca</th>
                      <th className="px-4 py-3 text-left font-medium text-muted">Proveedor</th>
                      <th className="px-4 py-3 text-left font-medium text-muted">Precio venta</th>
                      <th className="px-4 py-3 text-left font-medium text-muted">Costo</th>
                      <th className="px-4 py-3 text-left font-medium text-muted">Margen</th>
                      <th className="px-4 py-3 text-left font-medium text-muted">Estado</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {result.items.map((item) => (
                      <tr key={item.product_id}>
                        <td className="px-4 py-3">
                          <div className="space-y-1">
                            <Link
                              href={`/${result.tenantSlug}/retail/products/${item.product_id}`}
                              className="font-medium text-foreground underline-offset-4 hover:underline"
                            >
                              {item.name}
                            </Link>
                            <p className="text-xs text-muted">{item.sales_unit_label}</p>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-muted">{formatFallbackText(item.sku, "Sin SKU")}</td>
                        <td className="px-4 py-3 text-muted">{formatFallbackText(item.brand, "Sin marca")}</td>
                        <td className="px-4 py-3 text-muted">
                          {formatFallbackText(item.supplier_name, "Sin proveedor")}
                        </td>
                        <td className="px-4 py-3 text-muted">{formatMoneyFromCents(item.price_cents)}</td>
                        <td className="px-4 py-3 text-muted">{formatMoneyFromCents(item.cost_cents)}</td>
                        <td className="px-4 py-3 text-muted">{formatMargin(item.price_cents, item.cost_cents)}</td>
                        <td className="px-4 py-3">
                          <div className="flex flex-wrap items-center gap-2">
                            <Badge variant={item.is_active ? "success" : "warning"}>
                              {item.is_active ? "Activo" : "Inactivo"}
                            </Badge>
                            <Link
                              href={`/${result.tenantSlug}/retail/products/${item.product_id}`}
                              className="text-xs font-medium text-foreground underline-offset-4 hover:underline"
                            >
                              Ver detalle
                            </Link>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border px-5 py-4">
                <p className="text-sm text-muted">
                  {result.query
                    ? `Resultados para "${result.query}".`
                    : "Listado inicial del catalogo retail."}
                </p>
                <div className="flex flex-wrap gap-2">
                  {result.previousCursor !== null ? (
                    <Link
                      href={buildProductsHref(result.tenantSlug, {
                        q: result.query,
                        cursor: result.previousCursor,
                      })}
                      className="inline-flex h-10 items-center justify-center rounded-[var(--radius-base)] border border-border bg-surface-2 px-4 text-sm font-medium text-foreground transition-colors hover:bg-surface"
                    >
                      Anterior
                    </Link>
                  ) : null}
                  {result.nextCursor ? (
                    <Link
                      href={buildProductsHref(result.tenantSlug, {
                        q: result.query,
                        cursor: result.nextCursor,
                      })}
                      className="inline-flex h-10 items-center justify-center rounded-[var(--radius-base)] border border-border bg-surface-2 px-4 text-sm font-medium text-foreground transition-colors hover:bg-surface"
                    >
                      Siguiente
                    </Link>
                  ) : null}
                </div>
              </div>
            </Card>
          ) : result.query ? (
            <StatePanel
              kind="empty"
              title="No encontramos productos con esa busqueda."
              message="Prueba otro termino por nombre, SKU, marca, proveedor o barcode."
            />
          ) : (
            <StatePanel
              kind="empty"
              title="No hay productos para mostrar."
              message="La ruta ya usa el guard retail correcto, pero esta lectura no devolvio filas."
            />
          )}
        </>
      ) : (
        <StatePanel kind="permission" title="Sin acceso a productos retail" message={result.message}>
          <p className="text-xs text-muted">{result.hint}</p>
        </StatePanel>
      )}
    </div>
  );
}
