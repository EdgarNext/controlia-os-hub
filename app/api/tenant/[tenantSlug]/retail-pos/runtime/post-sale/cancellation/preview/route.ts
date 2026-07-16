import { NextRequest, NextResponse } from "next/server";
import { previewRetailPosSaleCancellation } from "@/lib/retail-pos/post-sale";
import { RetailPosRuntimeError } from "@/lib/retail-pos/errors";
import { createRuntimePerfTrace } from "@/lib/retail-pos/runtime-perf";

type RouteParams = { tenantSlug: string };

function jsonError(input: {
  status: number;
  message: string;
  code?: string | null;
  details?: Record<string, unknown> | null;
  requestId?: string | null;
}) {
  return NextResponse.json(
    {
      ok: false,
      error: input.message,
      code: input.code ?? null,
      status: input.status,
      details: input.details ?? null,
      request_id: input.requestId ?? null,
    },
    { status: input.status },
  );
}

function getOptionalHeader(request: NextRequest, key: string) {
  const value = request.headers.get(key)?.trim();
  return value ? value : null;
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<RouteParams> },
) {
  const { tenantSlug } = await context.params;
  const trace = createRuntimePerfTrace({
    request,
    route: "retail-pos/post-sale/cancellation/preview",
    method: "POST",
    tenantSlug,
    deviceId: getOptionalHeader(request, "x-retail-pos-device-id"),
  });

  try {
    const body = (await request.json()) as Parameters<
      typeof previewRetailPosSaleCancellation
    >[0]["request"] | null;

    if (!body || typeof body !== "object") {
      const response = jsonError({
        status: 400,
        message: "Invalid request body.",
        requestId: trace.requestId,
      });
      Object.entries(trace.headers()).forEach(([key, value]) =>
        response.headers.set(key, value),
      );
      trace.log({ step: "route_total", ok: false, status: 400 });
      return response;
    }

    const payload = await trace.measure("business", () =>
      previewRetailPosSaleCancellation({
        tenantSlug,
        request: body,
        deviceId: getOptionalHeader(request, "x-retail-pos-device-id"),
        deviceSecret: getOptionalHeader(request, "x-retail-pos-device-secret"),
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
      Object.entries(trace.headers()).forEach(([key, value]) =>
        response.headers.set(key, value),
      );
      trace.log({ step: "route_total", ok: false, status: error.status, error });
      return response;
    }

    const response = jsonError({
      status: 500,
      message:
        error instanceof Error
          ? error.message
          : "Unexpected retail_pos post sale cancellation preview error.",
      requestId: trace.requestId,
    });
    Object.entries(trace.headers()).forEach(([key, value]) =>
      response.headers.set(key, value),
    );
    trace.log({ step: "route_total", ok: false, status: 500, error });
    return response;
  }
}
