import { NextRequest, NextResponse } from "next/server";
import {
  assignRetailPosProductBarcode,
  RetailPosCatalogError,
} from "@/lib/retail-pos/catalog";

type RouteParams = {
  tenantSlug: string;
  productId: string;
};

type AssignBarcodeBody = {
  barcode: unknown;
  client_event_id: unknown;
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
    const { tenantSlug, productId } = await context.params;
    const body = (await request.json()) as AssignBarcodeBody | null;

    if (!body || typeof body !== "object") {
      return jsonError(400, "Invalid request body.");
    }

    const payload = await assignRetailPosProductBarcode({
      tenantSlug,
      productId,
      request: {
        barcode: body.barcode as string,
        client_event_id: body.client_event_id as string,
      },
      deviceId: asTrimmedString(body.deviceId),
      deviceSecret: asTrimmedString(body.deviceSecret),
    });

    return NextResponse.json(payload);
  } catch (error) {
    if (error instanceof RetailPosCatalogError) {
      return jsonError(error.status, error.message);
    }

    const message = error instanceof Error ? error.message : "Unexpected retail_pos barcode assignment error.";
    return jsonError(500, message);
  }
}
