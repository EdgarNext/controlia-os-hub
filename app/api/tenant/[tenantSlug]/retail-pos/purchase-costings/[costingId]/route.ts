import { NextRequest } from "next/server";
import { authorizePurchaseCosting, jsonError, noStoreJson, readJson, requireRevision } from "@/lib/retail-pos/purchase-costing-route";
import { getPurchaseCosting, updatePurchaseCostingHeader } from "@/lib/retail-pos/purchase-costing";

export const dynamic = "force-dynamic";
export const revalidate = 0;
type Params = { tenantSlug: string; costingId: string };

export async function GET(_request: NextRequest, context: { params: Promise<Params> }) { try { const { tenantSlug, costingId } = await context.params; return noStoreJson(await getPurchaseCosting(await authorizePurchaseCosting(tenantSlug, "read"), costingId)); } catch (error) { return jsonError(error); } }
export async function PATCH(request: NextRequest, context: { params: Promise<Params> }) { try { const { tenantSlug, costingId } = await context.params; const body = await readJson(request); return noStoreJson(await updatePurchaseCostingHeader(await authorizePurchaseCosting(tenantSlug, "manage"), costingId, { ...body, expectedRevision: requireRevision(body.expectedRevision) } as never)); } catch (error) { return jsonError(error); } }
