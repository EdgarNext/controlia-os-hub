import { NextRequest, NextResponse } from "next/server";
import { getRetailPosCashShiftCloseSummary } from "@/lib/retail-pos/cash-shifts";
import { RetailPosRuntimeError } from "@/lib/retail-pos/errors";

type RouteParams = { tenantSlug: string; shiftId: string };

function jsonError(status: number, message: string) {
  return NextResponse.json({ ok: false, error: message }, { status });
}

function getOptionalHeader(request: NextRequest, key: string) {
  const value = request.headers.get(key)?.trim();
  return value ? value : null;
}

export async function GET(request: NextRequest, context: { params: Promise<RouteParams> }) {
  try {
    const { tenantSlug, shiftId } = await context.params;
    const payload = await getRetailPosCashShiftCloseSummary({
      tenantSlug,
      shiftId,
      deviceId: getOptionalHeader(request, "x-retail-pos-device-id"),
      deviceSecret: getOptionalHeader(request, "x-retail-pos-device-secret"),
    });

    return NextResponse.json(payload);
  } catch (error) {
    if (error instanceof RetailPosRuntimeError) {
      return jsonError(error.status, error.message);
    }

    const message = error instanceof Error ? error.message : "Unexpected retail_pos cash shift summary error.";
    return jsonError(500, message);
  }
}
