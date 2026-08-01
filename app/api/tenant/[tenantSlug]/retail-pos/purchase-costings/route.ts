import { NextRequest } from "next/server";
import { authorizePurchaseCosting, jsonError, noStoreJson, readJson } from "@/lib/retail-pos/purchase-costing-route";
import { createPurchaseCosting, listPurchaseCostings } from "@/lib/retail-pos/purchase-costing";
import type { RetailPosPurchaseCostingStatus } from "@/shared/types/retail-pos";

export const dynamic = "force-dynamic";
export const revalidate = 0;
type Params = { tenantSlug: string };

export async function GET(request: NextRequest, context: { params: Promise<Params> }) {
  try {
    const { tenantSlug } = await context.params;
    const auth = await authorizePurchaseCosting(tenantSlug, "read");
    const params = request.nextUrl.searchParams;
    const page = params.get("page"); const pageSize = params.get("pageSize");
    return noStoreJson(await listPurchaseCostings(auth, { status: (params.get("status") as RetailPosPurchaseCostingStatus | null) ?? undefined, supplierId: params.get("supplierId") ?? undefined, invoiceReference: params.get("invoiceReference") ?? undefined, dateFrom: params.get("dateFrom") ?? undefined, dateTo: params.get("dateTo") ?? undefined, page: page ? Number(page) : undefined, pageSize: pageSize ? Number(pageSize) : undefined }));
  } catch (error) { return jsonError(error); }
}

export async function POST(request: NextRequest, context: { params: Promise<Params> }) {
  try { const { tenantSlug } = await context.params; const auth = await authorizePurchaseCosting(tenantSlug, "manage"); return noStoreJson(await createPurchaseCosting(auth, await readJson(request) as never), 201); } catch (error) { return jsonError(error); }
}
