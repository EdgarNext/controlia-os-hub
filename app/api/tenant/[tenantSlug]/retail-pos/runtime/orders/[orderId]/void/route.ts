import { NextRequest, NextResponse } from "next/server";
import { voidRetailPosOrder } from "@/lib/retail-pos/orders";
import { RetailPosRuntimeError } from "@/lib/retail-pos/errors";

type RouteParams = { tenantSlug: string; orderId: string };

type VoidOrderBody = {
  tenant_id: string;
  order_id: string;
  voided_by_pos_user_id: string;
  void_reason: string | null;
  void_note?: string | null;
  expected_revision?: number;
  command_id?: string;
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
    const body = (await request.json()) as VoidOrderBody | null;

    if (!body || typeof body !== "object") {
      return jsonError(400, "Invalid request body.");
    }

    const payload = await voidRetailPosOrder({
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

    const message =
      error instanceof Error ? error.message : "Unexpected retail_pos order void error.";
    return jsonError(500, message);
  }
}
