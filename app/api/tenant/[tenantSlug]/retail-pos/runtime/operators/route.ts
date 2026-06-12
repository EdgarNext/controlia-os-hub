import { NextRequest, NextResponse } from "next/server";
import { RetailPosRuntimeError } from "@/lib/retail-pos/errors";
import { listRetailPosRuntimeOperators } from "@/lib/retail-pos/operators";
import { createRuntimePerfTrace } from "@/lib/retail-pos/runtime-perf";

type RouteParams = {
  tenantSlug: string;
};

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
  const { tenantSlug } = await context.params;
  const deviceId =
    getOptionalSearchParam(request, "deviceId") ??
    getOptionalHeader(request, "x-retail-pos-device-id");
  const trace = createRuntimePerfTrace({
    request,
    route: "retail-pos/operators",
    method: "GET",
    tenantSlug,
    deviceId,
  });

  try {
    const deviceSecret =
      getOptionalSearchParam(request, "deviceSecret") ??
      getOptionalHeader(request, "x-retail-pos-device-secret");

    const payload = await trace.measure("business", () =>
      listRetailPosRuntimeOperators({
        tenantSlug,
        deviceId,
        deviceSecret,
        trace,
      }),
    );

    const response = NextResponse.json(payload, { headers: trace.headers() });
    response.headers.set(
      "x-retail-pos-probe-total-ms",
      String(payload.diagnostics?.total_ms ?? Math.round(trace.totalMs())),
    );
    trace.log({ step: "route_total", ok: true, status: 200 });
    return response;
  } catch (error) {
    if (error instanceof RetailPosRuntimeError) {
      const response = jsonError(error.status, error.message);
      Object.entries(trace.headers()).forEach(([key, value]) => response.headers.set(key, value));
      trace.log({ step: "route_total", ok: false, status: error.status, error });
      return response;
    }

    const message = error instanceof Error ? error.message : "Unexpected retail_pos operators runtime error.";
    const response = jsonError(500, message);
    Object.entries(trace.headers()).forEach(([key, value]) => response.headers.set(key, value));
    trace.log({ step: "route_total", ok: false, status: 500, error });
    return response;
  }
}
