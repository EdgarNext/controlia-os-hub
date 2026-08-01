import { NextResponse } from "next/server";
import { getUserCached } from "@/lib/auth/get-user";
import { resolveRetailPosPageContext } from "@/lib/auth/module-page-access";
import { RetailPosRuntimeError } from "@/lib/retail-pos/errors";

export async function authorizePurchaseCosting(tenantSlug: string, level: "read" | "manage") {
  const user = await getUserCached();
  if (!user) throw new RetailPosRuntimeError(401, "Authentication required.", "AUTH_REQUIRED");
  const tenant = await resolveRetailPosPageContext(tenantSlug, "catalog", level);
  return { tenantId: tenant.tenantId, actorPosUserId: null as string | null };
}

export function jsonError(error: unknown) {
  const runtimeError = error instanceof RetailPosRuntimeError ? error : null;
  const status = runtimeError?.status ?? (error instanceof Error && error.message === "Access denied for this tenant page." ? 403 : 500);
  return NextResponse.json({ ok: false, error: runtimeError?.message ?? (status === 403 ? "Access denied for this tenant." : "Unexpected server error."), code: runtimeError?.code ?? (status === 403 ? "TENANT_ACCESS_DENIED" : "COSTING_OPERATION_FAILED") }, { status, headers: { "cache-control": "private, no-store" } });
}

export async function readJson(request: Request) {
  try {
    const value = await request.json();
    if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("object required");
    return value as Record<string, unknown>;
  } catch {
    throw new RetailPosRuntimeError(400, "El cuerpo JSON no es válido.", "INVALID_JSON");
  }
}

export function noStoreJson(data: unknown, status = 200) {
  return NextResponse.json(data, { status, headers: { "cache-control": "private, no-store" } });
}

export function requireRevision(value: unknown) {
  if (typeof value !== "number" || !Number.isInteger(value) || value < 1) throw new RetailPosRuntimeError(400, "expectedRevision debe ser un entero positivo.", "INVALID_REVISION");
  return value;
}
