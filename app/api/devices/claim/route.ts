import { randomBytes } from "node:crypto";
import { NextResponse } from "next/server";
import { isRetailClaimDeviceRole } from "@/lib/pos/device-claims";
import { hashPosDeviceSecret } from "@/lib/pos/device-auth";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";

type DeviceModuleKey = "sales_pos" | "retail_pos";

type DeviceClaimRequest = {
  tenantSlug?: string;
  claimCode?: string;
  moduleKey?: DeviceModuleKey;
};

type TenantRow = {
  id: string;
  slug: string;
  status: string;
};

type TenantModuleRow = {
  enabled: boolean;
};

type ClaimDeviceRow = {
  id: string;
  tenant_id: string;
  device_id: string;
  kiosk_id: string;
  status: string;
  claim_expires_at: string | null;
};

type RetailSettingsRow = {
  device_id: string;
  device_role: string;
  is_active: boolean;
  assigned_pos_user_id: string | null;
};

type RetailOperatorRow = {
  id: string;
  name: string;
  is_active: boolean;
};

type KioskRow = {
  id: string;
};

function badRequest(message: string) {
  return NextResponse.json({ ok: false, error: message }, { status: 400 });
}

function conflict(message: string) {
  return NextResponse.json({ ok: false, error: message }, { status: 409 });
}

function gone(message: string) {
  return NextResponse.json({ ok: false, error: message }, { status: 410 });
}

function forbidden(message: string) {
  return NextResponse.json({ ok: false, error: message }, { status: 403 });
}

function notFound(message: string) {
  return NextResponse.json({ ok: false, error: message }, { status: 404 });
}

function normalizeTenantSlug(raw: unknown): string {
  return typeof raw === "string" ? raw.trim().toLowerCase() : "";
}

function normalizeClaimCode(raw: unknown): string {
  return typeof raw === "string" ? raw.trim().toUpperCase() : "";
}

function normalizeModuleKey(raw: unknown): DeviceModuleKey | null {
  return raw === "sales_pos" || raw === "retail_pos" ? raw : null;
}

function createDeviceSecret(): { secret: string; salt: string; hash: string } {
  const secret = randomBytes(24).toString("base64url");
  const salt = randomBytes(16).toString("hex");
  const hash = hashPosDeviceSecret(secret, salt);
  return { secret, salt, hash };
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as DeviceClaimRequest;
    const tenantSlug = normalizeTenantSlug(body?.tenantSlug);
    const claimCode = normalizeClaimCode(body?.claimCode);
    const moduleKey = normalizeModuleKey(body?.moduleKey);

    if (!tenantSlug) {
      return badRequest("tenantSlug is required.");
    }
    if (!claimCode) {
      return badRequest("claimCode is required.");
    }
    if (!moduleKey) {
      return badRequest("moduleKey is required.");
    }
    if (moduleKey !== "retail_pos") {
      return badRequest("Only retail_pos is supported on /api/devices/claim in Fase A.");
    }

    const supabase = getSupabaseAdminClient();

    const { data: tenant, error: tenantError } = await supabase
      .from("tenants")
      .select("id, slug, status")
      .eq("slug", tenantSlug)
      .limit(1)
      .maybeSingle<TenantRow>();

    if (tenantError) {
      return NextResponse.json(
        { ok: false, error: `Unable to resolve tenant: ${tenantError.message}` },
        { status: 500 },
      );
    }
    if (!tenant || tenant.status !== "active") {
      return notFound("Tenant not found or inactive.");
    }

    const { data: tenantModule, error: tenantModuleError } = await supabase
      .from("tenant_modules")
      .select("enabled")
      .eq("tenant_id", tenant.id)
      .eq("module_key", "retail_pos")
      .limit(1)
      .maybeSingle<TenantModuleRow>();

    if (tenantModuleError) {
      return NextResponse.json(
        { ok: false, error: `Unable to resolve retail_pos module: ${tenantModuleError.message}` },
        { status: 500 },
      );
    }
    if (!tenantModule?.enabled) {
      return forbidden("retail_pos is not enabled for this tenant.");
    }

    const { data: claimCandidate, error: claimCandidateError } = await supabase
      .from("pos_devices")
      .select("id, tenant_id, device_id, kiosk_id, status, claim_expires_at")
      .eq("tenant_id", tenant.id)
      .eq("claim_code", claimCode)
      .limit(1)
      .maybeSingle<ClaimDeviceRow>();

    if (claimCandidateError) {
      return NextResponse.json(
        { ok: false, error: `Unable to resolve claim device: ${claimCandidateError.message}` },
        { status: 500 },
      );
    }

    if (!claimCandidate) {
      return badRequest("Invalid claim code.");
    }

    if (claimCandidate.status !== "pending") {
      return conflict("Claim code already used or device is not claimable.");
    }

    if (!claimCandidate.claim_expires_at || new Date(claimCandidate.claim_expires_at).getTime() <= Date.now()) {
      return gone("Claim code expired.");
    }

    const { data: retailSettings, error: retailSettingsError } = await supabase
      .from("retail_pos_device_settings")
      .select("device_id, device_role, is_active, assigned_pos_user_id")
      .eq("tenant_id", tenant.id)
      .eq("device_id", claimCandidate.id)
      .eq("is_active", true)
      .limit(1)
      .maybeSingle<RetailSettingsRow>();

    if (retailSettingsError) {
      return NextResponse.json(
        { ok: false, error: `Unable to resolve retail device settings: ${retailSettingsError.message}` },
        { status: 500 },
      );
    }

    if (!retailSettings) {
      return forbidden("Claim code is not configured for retail_pos.");
    }

    if (!isRetailClaimDeviceRole(retailSettings.device_role)) {
      return forbidden("Claim code is not configured with a supported retail_pos device role.");
    }

    let assignedOperator: RetailOperatorRow | null = null;
    if (retailSettings.device_role === "multi_station") {
      if (!retailSettings.assigned_pos_user_id) {
        return forbidden("La terminal multifunción no tiene un operador asignado.");
      }
      const { data: operator, error: operatorError } = await supabase
        .from("pos_users")
        .select("id, name, is_active")
        .eq("tenant_id", tenant.id)
        .eq("id", retailSettings.assigned_pos_user_id)
        .limit(1)
        .maybeSingle<RetailOperatorRow>();
      if (operatorError) {
        return NextResponse.json({ ok: false, error: `Unable to resolve assigned POS operator: ${operatorError.message}` }, { status: 500 });
      }
      if (!operator?.is_active) return forbidden("El operador asignado no existe o está inactivo.");
      assignedOperator = operator;
    }

    const { data: kiosk, error: kioskError } = await supabase
      .from("kiosks")
      .select("id")
      .eq("tenant_id", tenant.id)
      .eq("id", claimCandidate.kiosk_id)
      .limit(1)
      .maybeSingle<KioskRow>();

    if (kioskError) {
      return NextResponse.json(
        { ok: false, error: `Unable to resolve claim kiosk: ${kioskError.message}` },
        { status: 500 },
      );
    }

    if (!kiosk) {
      return forbidden("Claim device kiosk is invalid for retail_pos.");
    }

    const nowIso = new Date().toISOString();
    const nextSecret = createDeviceSecret();

    const { data: claimedDevice, error: claimError } = await supabase
      .from("pos_devices")
      .update({
        secret_salt: nextSecret.salt,
        secret_hash: nextSecret.hash,
        status: "active",
        claimed_at: nowIso,
        claimed_by_user_id: null,
        claim_code: null,
        claim_expires_at: null,
        updated_at: nowIso,
      })
      .eq("tenant_id", tenant.id)
      .eq("id", claimCandidate.id)
      .eq("claim_code", claimCode)
      .eq("status", "pending")
      .gt("claim_expires_at", nowIso)
      .select("tenant_id, device_id")
      .limit(1)
      .maybeSingle<{ tenant_id: string; device_id: string }>();

    if (claimError) {
      return NextResponse.json(
        { ok: false, error: `Unable to claim device: ${claimError.message}` },
        { status: 500 },
      );
    }

    if (!claimedDevice) {
      return conflict("Claim code already used or device is not claimable.");
    }

    return NextResponse.json({
      ok: true,
      tenantId: claimedDevice.tenant_id,
      tenantSlug: tenant.slug,
      moduleKey,
      deviceId: claimedDevice.device_id,
      deviceSecret: nextSecret.secret,
      deviceRole: retailSettings.device_role,
      assignedPosUserId: assignedOperator?.id ?? null,
      assignedPosUserName: assignedOperator?.name ?? null,
      bootstrapRequired: true,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected claim error.";
    return badRequest(message);
  }
}
