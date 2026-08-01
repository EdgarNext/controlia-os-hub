import { NextRequest } from "next/server";
import { deletePurchaseCostingLine, updatePurchaseCostingLine } from "@/lib/retail-pos/purchase-costing";
import { authorizePurchaseCosting, jsonError, noStoreJson, readJson, requireRevision } from "@/lib/retail-pos/purchase-costing-route";

export const dynamic = "force-dynamic";
export const revalidate = 0;
type Params = { tenantSlug: string; costingId: string; lineId: string };
export async function PATCH(request: NextRequest, context: { params: Promise<Params> }) { try { const { tenantSlug, costingId, lineId } = await context.params; const body = await readJson(request); return noStoreJson(await updatePurchaseCostingLine(await authorizePurchaseCosting(tenantSlug, "manage"), costingId, lineId, { ...body, expectedRevision: requireRevision(body.expectedRevision) } as never)); } catch (error) { return jsonError(error); } }
export async function DELETE(request: NextRequest, context: { params: Promise<Params> }) { try { const { tenantSlug, costingId, lineId } = await context.params; const expectedRevision = requireRevision(request.nextUrl.searchParams.get("expectedRevision") ? Number(request.nextUrl.searchParams.get("expectedRevision")) : undefined); return noStoreJson(await deletePurchaseCostingLine(await authorizePurchaseCosting(tenantSlug, "manage"), costingId, lineId, expectedRevision)); } catch (error) { return jsonError(error); } }
