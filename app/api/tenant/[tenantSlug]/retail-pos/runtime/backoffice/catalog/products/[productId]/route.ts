import { NextRequest, NextResponse } from "next/server";
import {
  getRetailPosBackofficeCatalogProduct,
  RetailPosCatalogError,
  updateRetailPosBackofficeCatalogProduct,
} from "@/lib/retail-pos/catalog";
import type { UpdateRetailPosBackofficeProductRequest } from "@/shared/types/retail-pos";

type RouteParams = {
  tenantSlug: string;
  productId: string;
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
    const { tenantSlug, productId } = await context.params;
    const payload = await getRetailPosBackofficeCatalogProduct({
      tenantSlug,
      productId,
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
      error instanceof Error
        ? error.message
        : "Unexpected retail_pos backoffice catalog detail error.";
    return jsonError(500, message);
  }
}

export async function PATCH(request: NextRequest, context: { params: Promise<RouteParams> }) {
  try {
    const { tenantSlug, productId } = await context.params;
    const body = (await request.json()) as UpdateRetailPosBackofficeProductRequest | null;

    if (!body || typeof body !== "object" || Array.isArray(body)) {
      return jsonError(400, "Invalid request body.");
    }

    const payload = await updateRetailPosBackofficeCatalogProduct({
      tenantSlug,
      productId,
      request: body,
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
      error instanceof Error
        ? error.message
        : "Unexpected retail_pos backoffice catalog update error.";
    return jsonError(500, message);
  }
}
