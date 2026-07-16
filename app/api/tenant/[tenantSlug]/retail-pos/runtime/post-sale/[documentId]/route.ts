import { NextRequest, NextResponse } from "next/server";
import { getRetailPosPostSaleDetail } from "@/lib/retail-pos/post-sale";
import { RetailPosRuntimeError } from "@/lib/retail-pos/errors";
import { createRuntimePerfTrace } from "@/lib/retail-pos/runtime-perf";

type RouteParams = { tenantSlug: string; documentId: string };

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

function getOptionalSearchParam(request: NextRequest, key: string) {
  const value = request.nextUrl.searchParams.get(key)?.trim();
  return value ? value : null;
}

export async function GET(
  request: NextRequest,
  context: { params: Promise<RouteParams> },
) {
  const { tenantSlug, documentId } = await context.params;
  const trace = createRuntimePerfTrace({
    request,
    route: "retail-pos/post-sale/detail",
    method: "GET",
    tenantSlug,
    deviceId:
      getOptionalSearchParam(request, "deviceId") ??
      getOptionalHeader(request, "x-retail-pos-device-id"),
  });

  try {
    const payload = await trace.measure("business", () =>
      getRetailPosPostSaleDetail({
        tenantSlug,
        documentId,
        deviceId:
          getOptionalSearchParam(request, "deviceId") ??
          getOptionalHeader(request, "x-retail-pos-device-id"),
        deviceSecret:
          getOptionalSearchParam(request, "deviceSecret") ??
          getOptionalHeader(request, "x-retail-pos-device-secret"),
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
          : "Unexpected retail_pos post sale detail error.",
      requestId: trace.requestId,
    });
    Object.entries(trace.headers()).forEach(([key, value]) =>
      response.headers.set(key, value),
    );
    trace.log({ step: "route_total", ok: false, status: 500, error });
    return response;
  }
}
