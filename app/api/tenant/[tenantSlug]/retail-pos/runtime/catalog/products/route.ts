import { NextRequest, NextResponse } from "next/server";
import {
  quickCreateRetailPosProduct,
  RetailPosCatalogError,
} from "@/lib/retail-pos/catalog";

type RouteParams = {
  tenantSlug: string;
};

type QuickCreateProductBody = {
  name: unknown;
  category_name: unknown;
  brand: unknown;
  sku: unknown;
  barcode: unknown;
  unit_price_cents: unknown;
  sales_unit_code: unknown;
  sales_unit_label: unknown;
  allow_decimal_quantity: unknown;
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
    const { tenantSlug } = await context.params;
    const body = (await request.json()) as QuickCreateProductBody | null;

    if (!body || typeof body !== "object") {
      return jsonError(400, "Invalid request body.");
    }

    const payload = await quickCreateRetailPosProduct({
      tenantSlug,
      request: {
        name: body.name as string,
        category_name: body.category_name as string,
        brand: body.brand as string | null,
        sku: body.sku as string | null,
        barcode: body.barcode as string | null,
        unit_price_cents: body.unit_price_cents as number,
        sales_unit_code: body.sales_unit_code as string,
        sales_unit_label: body.sales_unit_label as string,
        allow_decimal_quantity: body.allow_decimal_quantity as boolean,
        client_event_id: body.client_event_id as string,
      },
      deviceId: asTrimmedString(body.deviceId),
      deviceSecret: asTrimmedString(body.deviceSecret),
    });

    return NextResponse.json(payload, { status: payload.idempotent ? 200 : 201 });
  } catch (error) {
    if (error instanceof RetailPosCatalogError) {
      return jsonError(error.status, error.message);
    }

    const message = error instanceof Error ? error.message : "Unexpected retail_pos product quick-create error.";
    return jsonError(500, message);
  }
}
