import Link from "next/link";
import { ArrowLeft, Calculator } from "lucide-react";
import { CatalogSectionHeader } from "@/components/pos/catalog/CatalogSectionHeader";
import { PurchaseCostingEditor } from "@/components/retail-pos/PurchaseCostingEditor";
import { listRetailPosBackofficeSuppliers } from "@/lib/retail-pos/catalog";
import { getPurchaseCosting } from "@/lib/retail-pos/purchase-costing";
import { resolveRetailPosTypePageContext } from "@/lib/auth/tenant-pos-access";

type Props = { params: Promise<{ tenantSlug: string; costingId: string }> };

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function RetailCostingDetailPage({ params }: Props) {
  const { tenantSlug, costingId } = await params;
  const tenant = await resolveRetailPosTypePageContext(tenantSlug, "catalog", "read");
  const [document, suppliers] = await Promise.all([
    getPurchaseCosting({ tenantId: tenant.tenantId }, costingId),
    listRetailPosBackofficeSuppliers({ tenantSlug: tenant.tenantSlug }),
  ]);
  return <div className="space-y-4"><Link href={`/${tenant.tenantSlug}/retail/costing`} className="inline-flex items-center gap-1 text-sm text-muted hover:text-foreground"><ArrowLeft className="h-4 w-4" aria-hidden="true" />Costeos de compras</Link><CatalogSectionHeader title={document.invoiceReference || "Nuevo costeo"} description="Captura los datos de la factura y calcula sus costos sugeridos." /><div className="flex items-center gap-2 text-xs text-muted"><Calculator className="h-4 w-4" aria-hidden="true" /><span>Los cambios se guardan automáticamente.</span></div><PurchaseCostingEditor tenantSlug={tenant.tenantSlug} initialDocument={document} suppliers={suppliers.items} /></div>;
}
