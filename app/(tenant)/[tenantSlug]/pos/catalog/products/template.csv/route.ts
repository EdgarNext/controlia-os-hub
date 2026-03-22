import { resolveSalesPosPageContext } from "@/lib/auth/module-page-access";
import { buildProductTemplateCsv } from "@/lib/pos/catalog/csv-transfer";

type ProductsTemplateRouteProps = {
  params: Promise<{ tenantSlug: string }>;
};

export async function GET(_request: Request, { params }: ProductsTemplateRouteProps) {
  const { tenantSlug } = await params;
  const tenant = await resolveSalesPosPageContext(tenantSlug, "products", "manage");
  const csv = await buildProductTemplateCsv(tenant.tenantId);

  return new Response(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${tenant.tenantSlug}-pos-products-template.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
