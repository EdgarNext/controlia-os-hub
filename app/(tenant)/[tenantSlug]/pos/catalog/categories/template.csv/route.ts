import { buildCategoryTemplateCsv } from "@/lib/pos/catalog/csv-transfer";
import { resolveSalesPosPageContext } from "@/lib/auth/module-page-access";

type CategoriesTemplateRouteProps = {
  params: Promise<{ tenantSlug: string }>;
};

export async function GET(_request: Request, { params }: CategoriesTemplateRouteProps) {
  const { tenantSlug } = await params;
  const tenant = await resolveSalesPosPageContext(tenantSlug, "categories", "manage");
  const csv = await buildCategoryTemplateCsv(tenant.tenantId);

  return new Response(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${tenant.tenantSlug}-pos-categories-template.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
