import Link from "next/link";
import type { Metadata } from "next";
import { Suspense } from "react";
import { CircleCheck, CircleDollarSign, Package, SearchX, TriangleAlert } from "lucide-react";
import { getCurrentTenantModulePageAccessMap, hasModulePageAccess } from "@/lib/auth/module-page-access";
import { getKitchenCatalogListData, getKitchenCatalogStatusMeta, type KitchenCatalogStatus } from "@/lib/kitchen/inventory/catalog";
import { listKitchenInventoryCategories, listKitchenInventorySuppliers, listKitchenInventoryUnits } from "@/lib/kitchen/inventory/queries";
import { StatePanel } from "@/components/ui/state-panel";
import { KitchenMetricCard } from "../_components/kitchen-metric-card";
import { KitchenPageHeader } from "../_components/kitchen-page-header";
import { resolveKitchenPage } from "../_lib/page-access";
import { CatalogFilters } from "./_components/catalog-filters";
import { CatalogItemDialog } from "./_components/catalog-item-dialog";
import { CatalogPagination } from "./_components/catalog-pagination";
import { CatalogSectionNav } from "./_components/catalog-section-nav";
import { CatalogNavigationShell, CatalogResultsFrame } from "./_components/catalog-navigation-shell";
import { KitchenCatalogContentSkeleton } from "../_components/kitchen-loading-skeletons";

type Props = { params: Promise<{ tenantSlug: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> };
export const metadata: Metadata = { title: "Catálogo de insumos" };
const statuses: KitchenCatalogStatus[] = ["ready", "price_pending", "no_purchase_option", "requires_review", "retired", "zero_cost_configured"];
const text = (value: string | string[] | undefined) => Array.isArray(value) ? value[0] ?? "" : value ?? "";

export default async function KitchenCatalogPage({ params, searchParams }: Props) {
  const { tenantSlug } = await params;
  const raw = await searchParams;
  return <div className="space-y-4">
    <KitchenPageHeader eyebrow="Cocina · Insumos" title="Catálogo de insumos" description="Consulta costos, unidades, proveedores y presentaciones utilizadas para recetas y eventos." icon={<Package className="h-4 w-4" aria-hidden="true" />} />
    <CatalogSectionNav tenantSlug={tenantSlug} activeSection="items" />
    <Suspense fallback={<KitchenCatalogContentSkeleton />}>
      <CatalogContent tenantSlug={tenantSlug} rawSearchParams={raw} />
    </Suspense>
  </div>;
}

async function CatalogContent({ tenantSlug, rawSearchParams }: { tenantSlug: string; rawSearchParams: Record<string, string | string[] | undefined> }) {
  const access = await resolveKitchenPage(tenantSlug, "kitchen_inventory", "items");
  if (!access.ok) return <StatePanel kind="permission" title="Sin permisos para el catálogo" message="No tienes acceso al catálogo de insumos." />;
  const [categories, units, suppliers, accessMap] = await Promise.all([
    listKitchenInventoryCategories(access.tenant.tenantId), listKitchenInventoryUnits(access.tenant.tenantId), listKitchenInventorySuppliers(access.tenant.tenantId), getCurrentTenantModulePageAccessMap(access.tenant.tenantId, "kitchen_inventory"),
  ]);
  const canManage = hasModulePageAccess(accessMap.items ?? "none", "manage");
  const query = text(rawSearchParams.q); const statusValue = text(rawSearchParams.status); const status = statuses.includes(statusValue as KitchenCatalogStatus) ? statusValue as KitchenCatalogStatus : "";
  const rawPageSize = Number(text(rawSearchParams.pageSize)); const pageSize = [25, 50, 100].includes(rawPageSize) ? rawPageSize : 25; const sortValue = text(rawSearchParams.sort); const sort = sortValue === "cost" || sortValue === "updated_at" ? sortValue : "name"; const order = text(rawSearchParams.order) === "desc" ? "desc" : "asc";
  const data = await getKitchenCatalogListData(access.tenant.tenantId, { query, status, supplierId: text(rawSearchParams.supplier), scope: status === "retired" ? "retired" : "active", sort, order }, Number(text(rawSearchParams.page)) || 1, pageSize);
  const money = (value: number | null) => value == null ? "—" : `$${value.toLocaleString("es-MX", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  const statusIcon = (value: KitchenCatalogStatus) => { const Icon = value === "ready" || value === "zero_cost_configured" ? CircleCheck : value === "price_pending" ? CircleDollarSign : TriangleAlert; return <Icon className="h-4 w-4" aria-hidden="true" />; };
  const badge = (value: KitchenCatalogStatus) => { const meta = getKitchenCatalogStatusMeta(value); const color = meta.tone === "success" ? "text-success bg-success/10" : meta.tone === "danger" ? "text-danger bg-danger/10" : meta.tone === "warning" ? "text-warning bg-warning/10" : "text-muted bg-surface-2"; return <span className={`inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs font-medium ${color}`}>{statusIcon(value)}{meta.label}</span>; };
  const queryString = (page: number) => { const p = new URLSearchParams(); if (query) p.set("q", query); if (status) p.set("status", status); if (text(rawSearchParams.supplier)) p.set("supplier", text(rawSearchParams.supplier)); if (pageSize !== 25) p.set("pageSize", String(pageSize)); if (sort !== "name" || order !== "asc") { p.set("sort", sort); p.set("order", order); } p.set("page", String(page)); return `?${p}`; };
  const resetParams = new URLSearchParams(); if (pageSize !== 25) resetParams.set("pageSize", String(pageSize)); if (sort !== "name" || order !== "asc") { resetParams.set("sort", sort); resetParams.set("order", order); } const resetHref = resetParams.toString() ? `?${resetParams}` : `/${tenantSlug}/kitchen/catalog`;
  return <CatalogNavigationShell>
    {canManage ? <div className="flex justify-end"><CatalogItemDialog tenantSlug={tenantSlug} categories={categories} units={units} /></div> : null}
    <CatalogFilters suppliers={suppliers} />
    <CatalogResultsFrame><>
    <div className="mb-2 text-xs font-medium uppercase tracking-[0.08em] text-muted">Resumen general del catálogo</div><section className="grid gap-2 md:grid-cols-4"><KitchenMetricCard label="Insumos activos" value={data.summary.activeItems} icon={<Package className="h-4 w-4" aria-hidden="true" />} /><KitchenMetricCard label="Listos" value={data.summary.readyItems} icon={<CircleCheck className="h-4 w-4" aria-hidden="true" />} /><KitchenMetricCard label="Precio pendiente" value={data.summary.pricePendingItems} tone={data.summary.pricePendingItems ? "warning" : "default"} icon={<CircleDollarSign className="h-4 w-4" aria-hidden="true" />} /><KitchenMetricCard label="Requieren revisión" value={data.summary.reviewItems} tone={data.summary.reviewItems ? "warning" : "default"} icon={<TriangleAlert className="h-4 w-4" aria-hidden="true" />} /></section>
    {data.total === 0 ? <section className="rounded border border-border bg-surface p-8 text-center"><SearchX className="mx-auto h-8 w-8 text-muted" aria-hidden="true" /><h2 className="mt-3 font-semibold">No encontramos insumos</h2><p className="mt-1 text-sm text-muted">Prueba con otra búsqueda o modifica los filtros aplicados.</p><Link href={resetHref || `/${tenantSlug}/kitchen/catalog`} className="mt-3 inline-block text-sm text-primary hover:underline">Limpiar filtros</Link></section> : <><div className="hidden overflow-x-auto rounded border border-border bg-surface md:block"><table className="w-full text-left text-sm"><thead className="sticky top-0 z-10 border-b border-border bg-surface text-xs text-muted"><tr><th className="p-3">Insumo</th><th className="p-3">Unidad</th><th className="p-3">Proveedor de referencia</th><th className="p-3">Presentación</th><th className="p-3">Costo unitario</th><th className="p-3">Estado</th><th className="p-3"><span className="sr-only">Acción</span></th></tr></thead><tbody>{data.rows.map((row) => <tr key={row.item.id} className="border-b border-border transition-colors last:border-0 hover:bg-surface-2"><td className="p-3"><div className="font-medium">{row.item.name}</div><div className="text-xs text-muted">{row.categoryName ?? "Sin categoría"}</div></td><td className="p-3">{row.unitCode ?? "—"}</td><td className="p-3">{row.referenceSupplierName ?? "—"}</td><td className="p-3">{row.defaultPresentation ? `${row.defaultPresentation.purchaseUnitCode ?? "—"} · ${row.defaultPresentation.quantityPerPurchaseUnit} ${row.defaultPresentation.inventoryUnitCode ?? row.unitCode ?? ""}` : "—"}</td><td className="p-3">{money(row.item.current_unit_cost)} / {row.unitCode ?? "ud"}</td><td className="p-3">{badge(row.status)}</td><td className="p-3 text-right"><Link className="text-primary hover:underline" href={`/${tenantSlug}/kitchen/catalog/${row.item.id}`}>Ver detalle</Link></td></tr>)}</tbody></table></div><div className="space-y-2 md:hidden">{data.rows.map((row) => <Link key={row.item.id} href={`/${tenantSlug}/kitchen/catalog/${row.item.id}`} className="block rounded border border-border bg-surface p-3"><div className="flex items-start justify-between gap-2"><div><div className="font-medium">{row.item.name}</div><div className="text-xs text-muted">{row.unitCode ?? "—"} · {row.referenceSupplierName ?? "Sin proveedor"}</div></div>{badge(row.status)}</div><div className="mt-2 text-sm text-muted">{money(row.item.current_unit_cost)} / {row.unitCode ?? "ud"}</div></Link>)}</div><CatalogPagination previousHref={data.page > 1 ? queryString(data.page - 1) : undefined} nextHref={data.page < data.pageCount ? queryString(data.page + 1) : undefined} page={data.page} pageCount={data.pageCount} total={data.total} pageSize={data.pageSize} /></>}
  </></CatalogResultsFrame>
  </CatalogNavigationShell>;
}
