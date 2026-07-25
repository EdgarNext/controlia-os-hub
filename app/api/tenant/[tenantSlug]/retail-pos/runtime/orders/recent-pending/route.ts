import { NextRequest, NextResponse } from "next/server";
import { listRetailPosRecentPendingOrders } from "@/lib/retail-pos/orders";
import { RetailPosRuntimeError } from "@/lib/retail-pos/errors";

type RouteParams = { tenantSlug: string };

function errorResponse(error: unknown) {
  if (error instanceof RetailPosRuntimeError) {
    return NextResponse.json({ ok: false, error: error.message, code: error.code ?? null }, { status: error.status });
  }
  return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : "Unexpected recent orders error." }, { status: 500 });
}

function optionalValue(request: NextRequest, key: string) {
  return request.nextUrl.searchParams.get(key)?.trim() || request.headers.get(`x-retail-pos-${key}`)?.trim() || null;
}

export async function GET(request: NextRequest, context: { params: Promise<RouteParams> }) {
  try {
    const { tenantSlug } = await context.params;
    const rawLimit = Number(request.nextUrl.searchParams.get("limit") ?? 5);
    return NextResponse.json(await listRetailPosRecentPendingOrders({
      tenantSlug,
      limit: Number.isFinite(rawLimit) ? rawLimit : 5,
      deviceId: optionalValue(request, "device-id"),
      deviceSecret: optionalValue(request, "device-secret"),
    }));
  } catch (error) {
    return errorResponse(error);
  }
}
