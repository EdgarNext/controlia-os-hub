import { NextRequest } from "next/server";
import { calculatePurchaseCosting } from "@/lib/retail-pos/purchase-costing";
import { authorizePurchaseCosting, jsonError, noStoreJson, readJson, requireRevision } from "@/lib/retail-pos/purchase-costing-route";

export const dynamic = "force-dynamic";
export const revalidate = 0;
type Params = { tenantSlug: string; costingId: string };
export async function POST(request: NextRequest, context: { params: Promise<Params> }) { try { const { tenantSlug, costingId } = await context.params; const body = await readJson(request); return noStoreJson(await calculatePurchaseCosting(await authorizePurchaseCosting(tenantSlug, "manage"), costingId, { expectedRevision: requireRevision(body.expectedRevision) })); } catch (error) { return jsonError(error); } }
