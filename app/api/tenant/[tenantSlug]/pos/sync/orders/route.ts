import { NextResponse } from "next/server";
import { authenticatePosDevice } from "@/lib/pos/device-auth";
import { syncOrderBatch } from "@/lib/pos/order-sync";
import { syncMutationsBatch } from "@/lib/pos/order-sync-v2";
import type { PosSyncOrdersRequest } from "@/types/pos";

type RouteParams = {
  tenantSlug: string;
};

function badRequest(message: string) {
  return NextResponse.json({ ok: false, error: message }, { status: 400 });
}

function unauthorized(message: string) {
  return NextResponse.json({ ok: false, error: message }, { status: 401 });
}

function matchesAuthenticatedKioskId(rawKioskId: unknown, expectedKioskId: string): boolean {
  return typeof rawKioskId === "string" && rawKioskId.trim() === expectedKioskId;
}

export async function POST(request: Request, context: { params: Promise<RouteParams> }) {
  try {
    const { tenantSlug } = await context.params;
    const body = (await request.json()) as PosSyncOrdersRequest;

    if (!body || typeof body !== "object") {
      return badRequest("Invalid request body.");
    }

    if (typeof body.deviceId !== "string" || !body.deviceId.trim()) {
      return badRequest("deviceId is required.");
    }

    if (typeof body.deviceSecret !== "string" || !body.deviceSecret.trim()) {
      return badRequest("deviceSecret is required.");
    }

    const hasMutations = Array.isArray(body.mutations);
    const hasLegacyBatch = Array.isArray(body.batch);

    if (!hasMutations && !hasLegacyBatch) {
      return badRequest("Either batch or mutations must be provided.");
    }

    const device = await authenticatePosDevice({
      tenantSlug,
      deviceId: body.deviceId,
      deviceSecret: body.deviceSecret,
    });

    if (hasMutations) {
      if (!body.mutations || body.mutations.length === 0) {
        return badRequest("mutations must contain at least one entry.");
      }
      if (body.mutations.length > 200) {
        return badRequest("mutations size cannot exceed 200 entries.");
      }
      for (const mutation of body.mutations) {
        const kioskId = mutation && typeof mutation === "object" ? (mutation as { kiosk_id?: unknown }).kiosk_id : null;
        if (!matchesAuthenticatedKioskId(kioskId, device.kioskId)) {
          return badRequest("mutation.kiosk_id must match the authenticated device kiosk.");
        }
      }

      const cashShiftMutations = body.mutations.filter(
        (mutation) =>
          mutation.type === "OPEN_CASH_SHIFT" ||
          mutation.type === "CLOSE_CASH_SHIFT",
      );
      if (cashShiftMutations.length > 0) {
        console.info("pos.sync.cash_shift.route.received", {
          tenantSlug,
          deviceId: device.deviceId,
          kioskId: device.kioskId,
          count: cashShiftMutations.length,
          mutations: cashShiftMutations.map((mutation) => ({
            mutation_id: mutation.mutation_id,
            type: mutation.type,
            cash_shift_id:
              "cash_shift_id" in mutation ? mutation.cash_shift_id : null,
          })),
        });
      }

      const result = await syncMutationsBatch({
        tenantId: device.tenantId,
        tenantSlug: device.tenantSlug,
        mutations: body.mutations,
      });

      if (cashShiftMutations.length > 0) {
        console.info("pos.sync.cash_shift.route.resolved", {
          tenantSlug,
          deviceId: device.deviceId,
          kioskId: device.kioskId,
          ackCount: result.acks.length,
          conflictCount: result.conflicts.length,
          acks: result.acks.map((ack) => ({
            mutation_id: ack.mutation_id,
            status: ack.status,
            order_id: ack.order_id ?? null,
            message: ack.message ?? null,
          })),
          conflicts: result.conflicts.map((conflict) => ({
            mutation_id: conflict.mutation_id,
            order_id: conflict.order_id ?? null,
            reason: conflict.reason,
          })),
        });
      }

      return NextResponse.json(result, { status: result.conflicts.length > 0 ? 409 : 200 });
    }

    if (!body.batch || body.batch.length === 0) {
      return badRequest("batch must contain at least one entry.");
    }
    if (body.batch.length > 100) {
      return badRequest("batch size cannot exceed 100 entries.");
    }
    for (const entry of body.batch) {
      const kioskId = entry?.order?.kiosk_id;
      if (!matchesAuthenticatedKioskId(kioskId, device.kioskId)) {
        return badRequest("order.kiosk_id must match the authenticated device kiosk.");
      }
    }

    const result = await syncOrderBatch({
      tenantId: device.tenantId,
      tenantSlug: device.tenantSlug,
      batch: body.batch,
    });

    return NextResponse.json(result, { status: result.ok ? 200 : 207 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected orders sync error.";
    return unauthorized(message);
  }
}
