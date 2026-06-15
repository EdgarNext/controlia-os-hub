import { NextRequest, NextResponse } from "next/server";
import {
  createRetailPosBackofficeSupplier,
  listRetailPosBackofficeSuppliers,
  RetailPosCatalogError,
} from "@/lib/retail-pos/catalog";

type RouteParams = {
  tenantSlug: string;
};

type CreateSupplierBody = {
  name?: unknown;
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

export async function GET(request: NextRequest, context: { params: Promise<RouteParams> }) {
  try {
    const { tenantSlug } = await context.params;
    const payload = await listRetailPosBackofficeSuppliers({
      tenantSlug,
      q: getOptionalSearchParam(request, "q"),
      deviceId:
        getOptionalSearchParam(request, "deviceId") ??
        getOptionalHeader(request, "x-retail-pos-device-id"),
      deviceSecret:
        getOptionalSearchParam(request, "deviceSecret") ??
        getOptionalHeader(request, "x-retail-pos-device-secret"),
    });

    return NextResponse.json(payload);
  } catch (error) {
    if (error instanceof RetailPosCatalogError) {
      return jsonError(error.status, error.message);
    }

    const message =
      error instanceof Error ? error.message : "Unexpected retail_pos suppliers list error.";
    return jsonError(500, message);
  }
}

export async function POST(request: NextRequest, context: { params: Promise<RouteParams> }) {
  try {
    const { tenantSlug } = await context.params;
    const body = (await request.json()) as CreateSupplierBody | null;

    if (!body || typeof body !== "object") {
      return jsonError(400, "Invalid request body.");
    }

    const payload = await createRetailPosBackofficeSupplier({
      tenantSlug,
      name: typeof body.name === "string" ? body.name : "",
      deviceId:
        getOptionalSearchParam(request, "deviceId") ??
        getOptionalHeader(request, "x-retail-pos-device-id"),
      deviceSecret:
        getOptionalSearchParam(request, "deviceSecret") ??
        getOptionalHeader(request, "x-retail-pos-device-secret"),
    });

    return NextResponse.json(payload, { status: payload.created ? 201 : 200 });
  } catch (error) {
    if (error instanceof RetailPosCatalogError) {
      return jsonError(error.status, error.message);
    }

    const message =
      error instanceof Error ? error.message : "Unexpected retail_pos supplier create error.";
    return jsonError(500, message);
  }
}
