import { NextRequest, NextResponse } from "next/server";
import { closeRetailPosCashShift } from "@/lib/retail-pos/cash-shifts";
import { RetailPosRuntimeError } from "@/lib/retail-pos/errors";
import { createRuntimePerfTrace } from "@/lib/retail-pos/runtime-perf";

type RouteParams = { tenantSlug: string; shiftId: string };

type CloseCashShiftBody = {
  tenant_id: string;
  cash_shift_id: string;
  device_id: string;
  closed_by_pos_user_id: string;
  expected_cash_cents: number;
  declared_cash_cents: number;
  closing_note?: string | null;
  closed_at?: string;
  status?: "closed" | "canceled";
  deviceId?: unknown;
  deviceSecret?: unknown;
};

function jsonError(status: number, message: string) {
  return NextResponse.json({ ok: false, error: message }, { status });
}

function asTrimmedString(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function getOptionalHeader(request: NextRequest, key: string) {
  const value = request.headers.get(key)?.trim();
  return value ? value : null;
}

export async function POST(request: NextRequest, context: { params: Promise<RouteParams> }) {
  const { tenantSlug, shiftId } = await context.params;
  const headerDeviceId = getOptionalHeader(request, "x-retail-pos-device-id");
  const trace = createRuntimePerfTrace({
    request,
    route: "retail-pos/cash-shifts/close",
    method: "POST",
    tenantSlug,
    deviceId: headerDeviceId,
  });

  try {
    const payloadParseStartedAt =
      typeof performance !== "undefined" ? performance.now() : Date.now();
    const body = (await request.json()) as CloseCashShiftBody | null;
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
      closeRetailPosCashShift({
        tenantSlug,
        shiftId,
        request: body,
        deviceId: asTrimmedString(body.deviceId) ?? headerDeviceId,
        deviceSecret:
          asTrimmedString(body.deviceSecret) ??
          getOptionalHeader(request, "x-retail-pos-device-secret"),
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

    const message = error instanceof Error ? error.message : "Unexpected retail_pos cash shift close error.";
    const response = jsonError(500, message);
    Object.entries(trace.headers()).forEach(([key, value]) => response.headers.set(key, value));
    trace.log({ step: "route_total", ok: false, status: 500, error });
    return response;
  }
}
