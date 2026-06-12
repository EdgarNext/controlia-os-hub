import { NextRequest, NextResponse } from "next/server";
import { cancelRetailPosOrder } from "@/lib/retail-pos/orders";
import { RetailPosRuntimeError } from "@/lib/retail-pos/errors";

type RouteParams = { tenantSlug: string; orderId: string };

type CancelOrderBody = {
  tenant_id: string;
  order_id: string;
  cancelled_by_pos_user_id: string;
  cancel_reason: string | null;
  deviceId?: unknown;
  deviceSecret?: unknown;
};

function jsonError(status: number, message: string) {
  return NextResponse.json({ ok: false, error: message }, { status });
}

function asTrimmedString(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

export async function POST(request: NextRequest, context: { params: Promise<RouteParams> }) {
  try {
    const { tenantSlug, orderId } = await context.params;
    const body = (await request.json()) as CancelOrderBody | null;

    if (!body || typeof body !== "object") {
      return jsonError(400, "Invalid request body.");
    }

    const payload = await cancelRetailPosOrder({
      tenantSlug,
      orderId,
      request: body,
      deviceId: asTrimmedString(body.deviceId),
      deviceSecret: asTrimmedString(body.deviceSecret),
    });

    return NextResponse.json(payload);
  } catch (error) {
    if (error instanceof RetailPosRuntimeError) {
      return jsonError(error.status, error.message);
    }

    const message = error instanceof Error ? error.message : "Unexpected retail_pos order cancellation error.";
    return jsonError(500, message);
  }
}
