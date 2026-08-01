import { NextRequest, NextResponse } from "next/server";
import { getUserCached } from "@/lib/auth/get-user";
import { resolveRetailPosPageContext } from "@/lib/auth/module-page-access";
import { RetailPosRuntimeError } from "@/lib/retail-pos/errors";
import {
  normalizeRetailPosCostingSearchQuery,
  parseBooleanQueryParam,
  searchRetailPosCostingProducts,
} from "@/lib/retail-pos/catalog-search";
import { createRuntimePerfTrace } from "@/lib/retail-pos/runtime-perf";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type RouteParams = { tenantSlug: string };

function jsonError(input: {
  status: number;
  message: string;
  code?: string | null;
  requestId?: string | null;
  headers?: Record<string, string>;
}) {
  return NextResponse.json(
    {
      ok: false,
      error: input.message,
      code: input.code ?? null,
      request_id: input.requestId ?? null,
    },
    { status: input.status, headers: input.headers },
  );
}

function isNextNotFoundError(error: unknown) {
  const digest =
    error && typeof error === "object" && "digest" in error
      ? (error as { digest?: unknown }).digest
      : null;
  return typeof digest === "string" && digest.includes("404");
}

export async function GET(
  request: NextRequest,
  context: { params: Promise<RouteParams> },
) {
  const { tenantSlug } = await context.params;
  const trace = createRuntimePerfTrace({
    request,
    route: "retail-pos/catalog/costing-search",
    method: "GET",
    tenantSlug,
  });
  const responseHeaders = {
    ...trace.headers(),
    "cache-control": "private, no-store",
  };

  try {
    const user = await getUserCached();
    if (!user) {
      trace.log({ step: "route_total", ok: false, status: 401 });
      return jsonError({
        status: 401,
        message: "Authentication required.",
        code: "AUTH_REQUIRED",
        requestId: trace.requestId,
        headers: responseHeaders,
      });
    }

    const rawQuery = request.nextUrl.searchParams.get("q");
    if (rawQuery === null) {
      throw new RetailPosRuntimeError(400, "q es obligatorio.", "INVALID_SEARCH_REQUEST");
    }

    const supplierId = request.nextUrl.searchParams.get("supplierId")?.trim() || null;
    const supplierOnly = parseBooleanQueryParam(
      request.nextUrl.searchParams.get("supplierOnly"),
      "supplierOnly",
    );
    const rawLimit = request.nextUrl.searchParams.get("limit");
    const limit = rawLimit === null ? 20 : Number(rawLimit);
    if (!Number.isInteger(limit)) {
      throw new RetailPosRuntimeError(400, "limit debe ser un entero.", "INVALID_SEARCH_REQUEST");
    }

    const normalized = normalizeRetailPosCostingSearchQuery({
      query: rawQuery,
      supplierId,
      supplierOnly,
      limit,
    });
    const tenant = await resolveRetailPosPageContext(tenantSlug, "catalog", "read");
    if (!tenant.enabledModuleKeys.includes("retail_pos")) {
      throw new RetailPosRuntimeError(403, "Access denied for this tenant.", "TENANT_MODULE_DISABLED");
    }

    const payload = await trace.measure("service", () =>
      searchRetailPosCostingProducts({
        tenantId: tenant.tenantId,
        query: normalized.query,
        supplierId: normalized.supplierId,
        supplierOnly: normalized.supplierOnly,
        limit: normalized.limit,
        trace,
      }),
    );

    trace.log({ step: "route_total", ok: true, status: 200 });
    return NextResponse.json(payload, {
      status: 200,
      headers: { ...trace.headers(), "cache-control": "private, no-store" },
    });
  } catch (error) {
    const runtimeError = error instanceof RetailPosRuntimeError ? error : null;
    const isAccessDenied = error instanceof Error && error.message === "Access denied for this tenant page.";
    const status = runtimeError?.status ?? (isNextNotFoundError(error) ? 404 : isAccessDenied ? 403 : 500);
    const message =
      runtimeError?.message ??
      (status === 404
        ? "Tenant not found."
        : status === 403
          ? "Access denied for this tenant."
          : "Unexpected server error.");
    const code =
      runtimeError?.code ??
      (status === 404 ? "TENANT_NOT_FOUND" : status === 403 ? "TENANT_ACCESS_DENIED" : "COSTING_SEARCH_FAILED");
    trace.log({ step: "route_total", ok: false, status, error });
    return jsonError({
      status,
      message,
      code,
      requestId: trace.requestId,
      headers: { ...trace.headers(), "cache-control": "private, no-store" },
    });
  }
}
