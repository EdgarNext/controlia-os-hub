import { NextRequest, NextResponse } from "next/server";
import { listRetailPosPaymentHistory } from "@/lib/retail-pos/payment-history";
import { RetailPosRuntimeError } from "@/lib/retail-pos/errors";

type RouteParams = { tenantSlug: string };

function jsonError(status: number, message: string, code?: string | null) {
  return NextResponse.json({ ok: false, error: message, code: code ?? null }, { status });
}

function getOptionalSearchParam(request: NextRequest, key: string) {
  const value = request.nextUrl.searchParams.get(key)?.trim();
  return value ? value : null;
}

function getOptionalHeader(request: NextRequest, key: string) {
  const value = request.headers.get(key)?.trim();
  return value ? value : null;
}

export async function GET(request: NextRequest, context: { params: Promise<RouteParams> }) {
  try {
    const { tenantSlug } = await context.params;
    const payload = await listRetailPosPaymentHistory({
      tenantSlug,
      paidFrom: getOptionalSearchParam(request, "paid_from"),
      paidTo: getOptionalSearchParam(request, "paid_to"),
      limit: getOptionalSearchParam(request, "limit"),
      deviceId:
        getOptionalSearchParam(request, "deviceId") ??
        getOptionalHeader(request, "x-retail-pos-device-id"),
      deviceSecret:
        getOptionalSearchParam(request, "deviceSecret") ??
        getOptionalHeader(request, "x-retail-pos-device-secret"),
    });

    return NextResponse.json(payload);
  } catch (error) {
    if (error instanceof RetailPosRuntimeError) {
      return jsonError(error.status, error.message, error.code);
    }

    const message =
      error instanceof Error ? error.message : "Unexpected retail_pos payment history error.";
    return jsonError(500, message);
  }
}
