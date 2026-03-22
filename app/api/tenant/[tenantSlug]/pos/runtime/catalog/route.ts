import { NextResponse } from "next/server";
import { authenticatePosDevice } from "@/lib/pos/device-auth";
import { getSalesPosCatalog } from "@/lib/pos/accounts/runtime";

type RouteParams = {
  tenantSlug: string;
};

function badRequest(message: string) {
  return NextResponse.json({ ok: false, error: message }, { status: 400 });
}

function unauthorized(message: string) {
  return NextResponse.json({ ok: false, error: message }, { status: 401 });
}

export async function POST(request: Request, context: { params: Promise<RouteParams> }) {
  try {
    const { tenantSlug } = await context.params;
    const body = (await request.json()) as {
      deviceId?: unknown;
      deviceSecret?: unknown;
    };

    if (!body || typeof body !== "object") {
      return badRequest("Invalid request body.");
    }
    if (typeof body.deviceId !== "string" || !body.deviceId.trim()) {
      return badRequest("deviceId is required.");
    }
    if (typeof body.deviceSecret !== "string" || !body.deviceSecret.trim()) {
      return badRequest("deviceSecret is required.");
    }

    const device = await authenticatePosDevice({
      tenantSlug,
      deviceId: body.deviceId,
      deviceSecret: body.deviceSecret,
    });

    const payload = await getSalesPosCatalog({
      tenantId: device.tenantId,
      tenantSlug: device.tenantSlug,
    });

    return NextResponse.json({
      ok: true,
      device: {
        id: device.deviceId,
        name: device.deviceName,
      },
      ...payload,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected runtime catalog error.";
    return unauthorized(message);
  }
}
