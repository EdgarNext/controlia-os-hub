import { NextRequest, NextResponse } from "next/server";
import { commitRetailPosReturn } from "@/lib/retail-pos/post-sale";
import { RetailPosRuntimeError } from "@/lib/retail-pos/errors";
import { createRuntimePerfTrace } from "@/lib/retail-pos/runtime-perf";

type RouteParams = { tenantSlug: string };

type CommitBody = {
  command_id: string;
  operator_id: string;
  order_id: string;
  cash_shift_id: string | null;
  expected_order_revision: number;
  fingerprint: string;
  lines: Array<{ order_line_id: string; quantity: string }>;
  reason_code: string;
  comment: string | null;
  refund_method: "cash" | "card_external";
};

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
    route: "retail-pos/post-sale/return/commit",
    method: "POST",
    tenantSlug,
    deviceId: getOptionalHeader(request, "x-retail-pos-device-id"),
  });

  try {
    const body = (await request.json()) as CommitBody | null;

    if (!body || typeof body !== "object") {
      const response = jsonError({
        status: 400,
        message: "Invalid request body.",
        requestId: trace.requestId,
      });
      Object.entries(trace.headers()).forEach(([key, value]) => response.headers.set(key, value));
      trace.log({ step: "route_total", ok: false, status: 400 });
      return response;
    }

    const payload = await trace.measure("business", () =>
      commitRetailPosReturn({
        tenantSlug,
        commandId: body.command_id,
        operatorId: body.operator_id,
        request: {
          order_id: body.order_id,
          cash_shift_id: body.cash_shift_id,
          expected_order_revision: body.expected_order_revision,
          fingerprint: body.fingerprint,
          lines: body.lines,
          reason_code: body.reason_code as Parameters<typeof commitRetailPosReturn>[0]["request"]["reason_code"],
          comment: body.comment,
          refund_method: body.refund_method,
        },
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
      Object.entries(trace.headers()).forEach(([key, value]) => response.headers.set(key, value));
      trace.log({ step: "route_total", ok: false, status: error.status, error });
      return response;
    }

    const response = jsonError({
      status: 500,
      message:
        error instanceof Error ? error.message : "Unexpected retail_pos post sale return commit error.",
      requestId: trace.requestId,
    });
    Object.entries(trace.headers()).forEach(([key, value]) => response.headers.set(key, value));
    trace.log({ step: "route_total", ok: false, status: 500, error });
    return response;
  }
}
