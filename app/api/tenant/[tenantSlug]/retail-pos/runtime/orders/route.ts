import { NextRequest, NextResponse } from "next/server";
import { createRetailPosOrder } from "@/lib/retail-pos/orders";
import { RetailPosRuntimeError } from "@/lib/retail-pos/errors";
import { createRuntimePerfTrace } from "@/lib/retail-pos/runtime-perf";

type RouteParams = { tenantSlug: string };

type CreateOrderBody = {
  tenant_id: string;
  origin_client_order_id: string;
  origin_device_id: string;
  created_by_pos_user_id: string;
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

export async function POST(request: NextRequest, context: { params: Promise<RouteParams> }) {
  const { tenantSlug } = await context.params;
  const trace = createRuntimePerfTrace({
    request,
    route: "retail-pos/orders",
    method: "POST",
    tenantSlug,
  });

  try {
    const payloadParseStartedAt =
      typeof performance !== "undefined" ? performance.now() : Date.now();
    const body = (await request.json()) as CreateOrderBody | null;
    trace.addDuration(
      "payload_parse",
      (typeof performance !== "undefined" ? performance.now() : Date.now()) -
        payloadParseStartedAt,
    );

    if (!body || typeof body !== "object") {
      const response = jsonError(400, "Invalid request body.");
      Object.entries(trace.headers()).forEach(([key, value]) => response.headers.set(key, value));
      trace.log({ step: "route_total", ok: false, status: 400 });
      return response;
    }

    const payload = await trace.measure("business", () =>
      createRetailPosOrder({
        tenantSlug,
        request: body,
        deviceId: asTrimmedString(body.deviceId),
        deviceSecret: asTrimmedString(body.deviceSecret),
        trace,
      }),
    );

    const response = NextResponse.json(payload, { headers: trace.headers() });
    trace.log({ step: "route_total", ok: true, status: 200 });
    return response;
  } catch (error) {
    if (error instanceof RetailPosRuntimeError) {
      const response = jsonError(error.status, error.message);
      Object.entries(trace.headers()).forEach(([key, value]) => response.headers.set(key, value));
      trace.log({ step: "route_total", ok: false, status: error.status, error });
      return response;
    }

    const message = error instanceof Error ? error.message : "Unexpected retail_pos order creation error.";
    const response = jsonError(500, message);
    Object.entries(trace.headers()).forEach(([key, value]) => response.headers.set(key, value));
    trace.log({ step: "route_total", ok: false, status: 500, error });
    return response;
  }
}
