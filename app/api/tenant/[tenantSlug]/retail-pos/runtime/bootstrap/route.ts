import { NextRequest, NextResponse } from "next/server";
import { getRetailPosBootstrap } from "@/lib/retail-pos/bootstrap";
import { RetailPosRuntimeError } from "@/lib/retail-pos/errors";
import { createRuntimePerfTrace } from "@/lib/retail-pos/runtime-perf";

type RouteParams = { tenantSlug: string };

function jsonError(status: number, message: string) {
  return NextResponse.json({ ok: false, error: message }, { status });
}

function getOptionalHeader(request: NextRequest, key: string) {
  const value = request.headers.get(key)?.trim();
  return value ? value : null;
}

export async function GET(request: NextRequest, context: { params: Promise<RouteParams> }) {
  const { tenantSlug } = await context.params;
  const deviceId = getOptionalHeader(request, "x-retail-pos-device-id");
  const trace = createRuntimePerfTrace({
    request,
    route: "retail-pos/bootstrap",
    method: "GET",
    tenantSlug,
    deviceId,
  });

  try {
    const payload = await trace.measure("business", () =>
      getRetailPosBootstrap({
        tenantSlug,
        deviceId: deviceId ?? "",
        deviceSecret: getOptionalHeader(request, "x-retail-pos-device-secret") ?? "",
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

    const message = error instanceof Error ? error.message : "Unexpected retail_pos bootstrap error.";
    const response = jsonError(500, message);
    Object.entries(trace.headers()).forEach(([key, value]) => response.headers.set(key, value));
    trace.log({ step: "route_total", ok: false, status: 500, error });
    return response;
  }
}
