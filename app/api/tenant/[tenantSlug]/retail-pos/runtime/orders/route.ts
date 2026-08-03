import { NextRequest, NextResponse } from "next/server";
import { createRetailPosOrder } from "@/lib/retail-pos/orders";
import { RetailPosRuntimeError } from "@/lib/retail-pos/errors";
import { createRuntimePerfTrace } from "@/lib/retail-pos/runtime-perf";
import type { CreateRetailPosOrderRequest } from "@/shared/types/retail-pos";

type RouteParams = { tenantSlug: string };

type CreateOrderBody = CreateRetailPosOrderRequest & {
  deviceId?: unknown;
  deviceSecret?: unknown;
};

function jsonError(input: { status: number; message: string; code?: string | null; details?: Record<string, unknown> | null; requestId?: string | null }) {
  return NextResponse.json({
    ok: false,
    error: input.message,
    code: input.code ?? null,
    details: input.details ?? null,
    request_id: input.requestId ?? null,
  }, { status: input.status });
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
      const response = jsonError({ status: 400, message: "Invalid request body.", requestId: trace.requestId });
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
      const response = jsonError({
        status: error.status,
        message: error.message,
        code: error.code,
        details: error.details,
        requestId: trace.requestId,
      });
      Object.entries(trace.headers()).forEach(([key, value]) => response.headers.set(key, value));
      trace.log({ step: "route_total", ok: false, status: error.status, error });
      return response;
    }

    const message = error instanceof Error ? error.message : "Unexpected retail_pos order creation error.";
    const response = jsonError({ status: 500, message, requestId: trace.requestId });
    Object.entries(trace.headers()).forEach(([key, value]) => response.headers.set(key, value));
    trace.log({ step: "route_total", ok: false, status: 500, error });
    return response;
  }
}
