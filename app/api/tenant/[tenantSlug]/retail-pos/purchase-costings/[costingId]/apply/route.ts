import { NextRequest } from "next/server";
import { applyPurchaseCosting } from "@/lib/retail-pos/purchase-costing";
import { authorizePurchaseCosting, jsonError, noStoreJson, readJson, requireRevision } from "@/lib/retail-pos/purchase-costing-route";

export const dynamic = "force-dynamic";
export const revalidate = 0;
type Params = { tenantSlug: string; costingId: string };

export async function POST(request: NextRequest, context: { params: Promise<Params> }) {
  try {
    const { tenantSlug, costingId } = await context.params;
    const body = await readJson(request);
    const expectedRevision = requireRevision(body.expectedRevision);
    return noStoreJson(await applyPurchaseCosting(await authorizePurchaseCosting(tenantSlug, "manage"), costingId, expectedRevision));
  } catch (error) {
    return jsonError(error);
  }
}
