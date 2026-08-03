import { NextRequest, NextResponse } from "next/server";
import {
  recordRetailPosTicketEvent,
} from "@/lib/retail-pos/ticket-events";
import { RetailPosRuntimeError } from "@/lib/retail-pos/errors";

type RouteParams = {
  tenantSlug: string;
};

type TicketEventBody = {
  order_id: unknown;
  ticket_type: unknown;
  event_type: unknown;
  client_event_id: unknown;
  printed_at?: unknown;
  printer_name?: unknown;
  error_message?: unknown;
  metadata?: unknown;
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
  try {
    const { tenantSlug } = await context.params;
    const body = (await request.json()) as TicketEventBody | null;

    if (!body || typeof body !== "object") {
      return jsonError(400, "Invalid request body.");
    }

    const payload = await recordRetailPosTicketEvent({
      tenantSlug,
      request: {
        order_id: body.order_id as string,
        ticket_type: body.ticket_type as never,
        event_type: body.event_type as never,
        client_event_id: body.client_event_id as string,
        printed_at: body.printed_at as string | null | undefined,
        printer_name: body.printer_name as string | null | undefined,
        error_message: body.error_message as string | null | undefined,
        metadata: (body.metadata as Record<string, unknown> | null | undefined) ?? null,
      },
      deviceId: asTrimmedString(body.deviceId) ?? asTrimmedString(request.headers.get('x-retail-pos-device-id')),
      deviceSecret: asTrimmedString(body.deviceSecret) ?? asTrimmedString(request.headers.get('x-retail-pos-device-secret')),
    });

    return NextResponse.json(payload);
  } catch (error) {
    if (error instanceof RetailPosRuntimeError) {
      return jsonError(error.status, error.message);
    }

    const message = error instanceof Error ? error.message : "Unexpected retail_pos ticket event error.";
    return jsonError(500, message);
  }
}
