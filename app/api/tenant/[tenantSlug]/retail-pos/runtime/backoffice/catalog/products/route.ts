import { NextRequest, NextResponse } from "next/server";
import {
  RetailPosCatalogError,
  searchRetailPosBackofficeCatalogProducts,
} from "@/lib/retail-pos/catalog";

type RouteParams = {
  tenantSlug: string;
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

function getOptionalNumericSearchParam(request: NextRequest, key: string) {
  const raw = getOptionalSearchParam(request, key);
  if (!raw) {
    return null;
  }

  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : null;
}

export async function GET(request: NextRequest, context: { params: Promise<RouteParams> }) {
  try {
    const { tenantSlug } = await context.params;
    const payload = await searchRetailPosBackofficeCatalogProducts({
      tenantSlug,
      q: getOptionalSearchParam(request, "q"),
      limit: getOptionalNumericSearchParam(request, "limit"),
      cursor: getOptionalSearchParam(request, "cursor"),
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
        : "Unexpected retail_pos backoffice catalog products error.";
    return jsonError(500, message);
  }
}
