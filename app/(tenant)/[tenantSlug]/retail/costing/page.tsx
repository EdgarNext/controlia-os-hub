import { Calculator } from "lucide-react";
import { CatalogSectionHeader } from "@/components/pos/catalog/CatalogSectionHeader";
import { PurchaseCostingDocumentsList } from "@/components/retail-pos/PurchaseCostingDocumentsList";
import { listPurchaseCostings } from "@/lib/retail-pos/purchase-costing";
import { resolveRetailPosTypePageContext } from "@/lib/auth/tenant-pos-access";
import type { RetailPosPurchaseCostingStatus } from "@/shared/types/retail-pos";

type Props = { params: Promise<{ tenantSlug: string }>; searchParams: Promise<{ page?: string; invoiceReference?: string; status?: string }> };

export const dynamic = "force-dynamic";
export const revalidate = 0;

export const metadata = { title: "Costeo de compras" };

export default async function RetailCostingPage({ params, searchParams }: Props) {
  const { tenantSlug } = await params;
  const filters = await searchParams;
  const tenant = await resolveRetailPosTypePageContext(tenantSlug, "catalog", "read");
  const page = Number(filters.page ?? "1");
  const result = await listPurchaseCostings({ tenantId: tenant.tenantId }, { page: Number.isInteger(page) && page > 0 ? page : 1, pageSize: 25, invoiceReference: filters.invoiceReference, status: filters.status && ["draft", "calculated", "applied", "voided"].includes(filters.status) ? filters.status as RetailPosPurchaseCostingStatus : undefined });
  return <div className="space-y-4"><CatalogSectionHeader title="Costeo de compras" description="Administra borradores y cálculos de costos a partir de tus facturas." /><div className="flex items-center gap-2 text-xs text-muted"><Calculator className="h-4 w-4" aria-hidden="true" /><span>Los documentos son persistentes y no modifican el catálogo.</span></div><PurchaseCostingDocumentsList tenantSlug={tenant.tenantSlug} rows={result.results} page={result.meta.page} pageCount={result.meta.pageCount} invoiceReference={filters.invoiceReference} /></div>;
}
