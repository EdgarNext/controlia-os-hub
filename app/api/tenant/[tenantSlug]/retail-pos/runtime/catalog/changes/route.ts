import { NextRequest, NextResponse } from "next/server";
import {
  getRetailPosCatalogChangesForTenant,
  RetailPosCatalogError,
} from "@/lib/retail-pos/catalog";
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

function getOptionalLimit(request: NextRequest) {
  const raw = request.nextUrl.searchParams.get("limit")?.trim();
  if (!raw) {
    return null;
  }

  const parsed = Number(raw);
  if (!Number.isFinite(parsed)) {
    return null;
  }

  return parsed;
}

export async function GET(request: NextRequest, context: { params: Promise<RouteParams> }) {
  const { tenantSlug } = await context.params;
  const deviceId =
    getOptionalSearchParam(request, "deviceId") ??
    getOptionalHeader(request, "x-retail-pos-device-id");
  const trace = createRuntimePerfTrace({
    request,
    route: "retail-pos/catalog/changes",
    method: "GET",
    tenantSlug,
    deviceId,
  });

  try {
    const deviceSecret =
      getOptionalSearchParam(request, "deviceSecret") ??
      getOptionalHeader(request, "x-retail-pos-device-secret");
    const since = getOptionalSearchParam(request, "since");
    const limit = getOptionalLimit(request);

    const payload = await trace.measure("business", () =>
      getRetailPosCatalogChangesForTenant({
        tenantSlug,
        deviceId,
        deviceSecret,
        since,
        limit,
        trace,
      }),
    );

    const response = NextResponse.json(payload, { headers: trace.headers() });
    trace.log({ step: "route_total", ok: true, status: 200 });
    return response;
  } catch (error) {
    if (error instanceof RetailPosCatalogError) {
      const response = jsonError(error.status, error.message);
      Object.entries(trace.headers()).forEach(([key, value]) => response.headers.set(key, value));
      trace.log({ step: "route_total", ok: false, status: error.status, error });
      return response;
    }

    const message = error instanceof Error ? error.message : "Unexpected retail_pos catalog changes runtime error.";
    const response = jsonError(500, message);
    Object.entries(trace.headers()).forEach(([key, value]) => response.headers.set(key, value));
    trace.log({ step: "route_total", ok: false, status: 500, error });
    return response;
  }
}
