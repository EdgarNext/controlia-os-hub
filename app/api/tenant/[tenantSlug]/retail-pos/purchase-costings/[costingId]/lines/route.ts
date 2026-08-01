import { NextRequest } from "next/server";
import { addPurchaseCostingLine } from "@/lib/retail-pos/purchase-costing";
import { authorizePurchaseCosting, jsonError, noStoreJson, readJson, requireRevision } from "@/lib/retail-pos/purchase-costing-route";

export const dynamic = "force-dynamic";
export const revalidate = 0;
type Params = { tenantSlug: string; costingId: string };
export async function POST(request: NextRequest, context: { params: Promise<Params> }) { try { const { tenantSlug, costingId } = await context.params; const body = await readJson(request); return noStoreJson(await addPurchaseCostingLine(await authorizePurchaseCosting(tenantSlug, "manage"), costingId, { ...body, expectedRevision: requireRevision(body.expectedRevision) } as never), 201); } catch (error) { return jsonError(error); } }
