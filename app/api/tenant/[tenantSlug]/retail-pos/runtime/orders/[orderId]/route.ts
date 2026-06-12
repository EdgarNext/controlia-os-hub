import { NextRequest, NextResponse } from "next/server";
import {
  getRetailPosOrderById,
  updateRetailPosOrder,
} from "@/lib/retail-pos/orders";
import { RetailPosRuntimeError } from "@/lib/retail-pos/errors";

type RouteParams = { tenantSlug: string; orderId: string };

type UpdateOrderBody = {
  tenant_id: string;
  order_id: string;
  lines: Array<{
    line_number: number;
    product_id: string;
    product_variant_id: string | null;
    quantity: string;
    unit_price_cents: number;
    discount_cents: number;
  }>;
  deviceId?: unknown;
  deviceSecret?: unknown;
};

function jsonError(status: number, message: string) {
  return NextResponse.json({ ok: false, error: message }, { status });
}

function asTrimmedString(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
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
    const { tenantSlug, orderId } = await context.params;
    const payload = await getRetailPosOrderById({
      tenantSlug,
      orderId,
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
      return jsonError(error.status, error.message);
    }

    const message = error instanceof Error ? error.message : "Unexpected retail_pos order detail error.";
    return jsonError(500, message);
  }
}

export async function PATCH(request: NextRequest, context: { params: Promise<RouteParams> }) {
  try {
    const { tenantSlug, orderId } = await context.params;
    const body = (await request.json()) as UpdateOrderBody | null;

    if (!body || typeof body !== "object") {
      return jsonError(400, "Invalid request body.");
    }

    const payload = await updateRetailPosOrder({
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

    const message = error instanceof Error ? error.message : "Unexpected retail_pos order update error.";
    return jsonError(500, message);
  }
}
