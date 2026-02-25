import { NextResponse } from "next/server";
import { authenticatePosDevice } from "@/lib/pos/device-auth";
import { getCatalogSyncPayload } from "@/lib/pos/catalog-sync";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import type { PosSyncCatalogRequest } from "@/types/pos";

type RouteParams = {
  tenantSlug: string;
};

function badRequest(message: string) {
  return NextResponse.json({ ok: false, error: message }, { status: 400 });
}

function unauthorized(message: string) {
  return NextResponse.json({ ok: false, error: message }, { status: 401 });
}

function parseSince(since?: string | null): string | null {
  if (!since) {
    return null;
  }

  const parsed = new Date(since);
  if (Number.isNaN(parsed.getTime())) {
    throw new Error("since must be a valid ISO timestamp.");
  }

  return parsed.toISOString();
}

export async function POST(request: Request, context: { params: Promise<RouteParams> }) {
  try {
    const { tenantSlug } = await context.params;
    const body = (await request.json()) as PosSyncCatalogRequest;

    if (!body || typeof body !== "object") {
      return badRequest("Invalid request body.");
    }

    if (typeof body.deviceId !== "string" || !body.deviceId.trim()) {
      return badRequest("deviceId is required.");
    }

    if (typeof body.deviceSecret !== "string" || !body.deviceSecret) {
      return badRequest("deviceSecret is required.");
    }

    if (body.since != null && typeof body.since !== "string") {
      return badRequest("since must be an ISO timestamp string.");
    }

    const normalizedSince = parseSince(body.since ?? null);

    const device = await authenticatePosDevice({
      tenantSlug,
      deviceId: body.deviceId,
      deviceSecret: body.deviceSecret,
    });

    const payload = await getCatalogSyncPayload({
      tenantId: device.tenantId,
      tenantSlug: device.tenantSlug,
      since: normalizedSince,
    });

    const supabase = getSupabaseAdminClient();
    const { error: updateError } = await supabase
      .from("pos_devices")
      .update({ last_sync_at: payload.syncedAt, updated_at: payload.syncedAt })
      .eq("tenant_id", device.tenantId)
      .eq("device_id", device.deviceId);

    if (updateError) {
      return NextResponse.json(
        { ok: false, error: `Unable to persist sync checkpoint: ${updateError.message}` },
        { status: 500 },
      );
    }

    return NextResponse.json({ ok: true, device: { id: device.deviceId, name: device.deviceName }, ...payload });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected sync error.";
    if (message.toLowerCase().includes("since must")) {
      return badRequest(message);
    }
    return unauthorized(message);
  }
}
