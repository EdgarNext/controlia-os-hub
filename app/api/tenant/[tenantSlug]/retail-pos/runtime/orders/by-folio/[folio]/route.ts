import { NextRequest, NextResponse } from "next/server";
import { getRetailPosOrderByFolio } from "@/lib/retail-pos/orders";
import { RetailPosRuntimeError } from "@/lib/retail-pos/errors";
import { createRuntimePerfTrace } from "@/lib/retail-pos/runtime-perf";

type RouteParams = { tenantSlug: string; folio: string };

function jsonError(status: number, message: string) {
  return NextResponse.json({ ok: false, error: message }, { status });
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
  const { tenantSlug, folio } = await context.params;
  const trace = createRuntimePerfTrace({
    request,
    route: "retail-pos/orders/by-folio",
    method: "GET",
    tenantSlug,
    deviceId:
      getOptionalSearchParam(request, "deviceId") ??
      getOptionalHeader(request, "x-retail-pos-device-id"),
    folio,
  });

  try {
    const deviceId =
      getOptionalSearchParam(request, "deviceId") ??
      getOptionalHeader(request, "x-retail-pos-device-id");
    const deviceSecret =
      getOptionalSearchParam(request, "deviceSecret") ??
      getOptionalHeader(request, "x-retail-pos-device-secret");
    const payload = await trace.measure("business", () =>
      getRetailPosOrderByFolio({
        tenantSlug,
        folio,
        deviceId,
        deviceSecret,
        trace,
      }),
    );

    const response = NextResponse.json(payload, { headers: trace.headers() });
    trace.log({ step: "route_total", ok: true, status: 200 });
    return response;
  } catch (error) {
    if (error instanceof RetailPosRuntimeError) {
      const response = jsonError(error.status, error.message);
      const headers = trace.headers();
      Object.entries(headers).forEach(([key, value]) => response.headers.set(key, value));
      trace.log({ step: "route_total", ok: false, status: error.status, error });
      return response;
    }

    const message = error instanceof Error ? error.message : "Unexpected retail_pos order folio lookup error.";
    const response = jsonError(500, message);
    const headers = trace.headers();
    Object.entries(headers).forEach(([key, value]) => response.headers.set(key, value));
    trace.log({ step: "route_total", ok: false, status: 500, error });
    return response;
  }
}
