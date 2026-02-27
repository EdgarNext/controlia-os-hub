import { randomBytes } from "node:crypto";
import { NextResponse } from "next/server";
import { hashPosDeviceSecret } from "@/lib/pos/device-auth";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";

type PosClaimRequest = {
  tenantSlug?: string;
  claimCode?: string;
};

type TenantRow = {
  id: string;
  slug: string;
  status: string;
};

type ClaimDeviceRow = {
  tenant_id: string;
  device_id: string;
  kiosk_id: string;
};

type KioskRow = {
  id: string;
  number: number;
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

function normalizeTenantSlug(raw: unknown): string {
  return typeof raw === "string" ? raw.trim().toLowerCase() : "";
}

function normalizeClaimCode(raw: unknown): string {
  return typeof raw === "string" ? raw.trim().toUpperCase() : "";
}

function createDeviceSecret(): { secret: string; salt: string; hash: string } {
  const secret = randomBytes(24).toString("base64url");
  const salt = randomBytes(16).toString("hex");
  const hash = hashPosDeviceSecret(secret, salt);
  return { secret, salt, hash };
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as PosClaimRequest;
    const tenantSlug = normalizeTenantSlug(body?.tenantSlug);
    const claimCode = normalizeClaimCode(body?.claimCode);

    if (!tenantSlug) {
      return badRequest("tenantSlug is required.");
    }
    if (!claimCode) {
      return badRequest("claimCode is required.");
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
      return badRequest("Tenant is not available for claim.");
    }

    const nowIso = new Date().toISOString();
    const nextSecret = createDeviceSecret();

    // Atomic claim: only pending + unexpired code can transition to active.
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
      .eq("claim_code", claimCode)
      .eq("status", "pending")
      .gt("claim_expires_at", nowIso)
      .select("tenant_id, device_id, kiosk_id")
      .limit(1)
      .maybeSingle<ClaimDeviceRow>();

    if (claimError) {
      return NextResponse.json(
        { ok: false, error: `Unable to claim device: ${claimError.message}` },
        { status: 500 },
      );
    }

    if (!claimedDevice) {
      const { data: existing, error: existingError } = await supabase
        .from("pos_devices")
        .select("status, claim_expires_at")
        .eq("tenant_id", tenant.id)
        .eq("claim_code", claimCode)
        .limit(1)
        .maybeSingle<{ status: string; claim_expires_at: string | null }>();

      if (existingError) {
        return NextResponse.json(
          { ok: false, error: `Unable to validate claim code: ${existingError.message}` },
          { status: 500 },
        );
      }

      if (!existing) {
        return badRequest("Invalid claim code.");
      }

      if (existing.status !== "pending") {
        return conflict("Claim code already used or device is not claimable.");
      }

      if (!existing.claim_expires_at || new Date(existing.claim_expires_at).getTime() <= Date.now()) {
        return gone("Claim code expired.");
      }

      return badRequest("Unable to claim device.");
    }

    const { data: kiosk, error: kioskError } = await supabase
      .from("kiosks")
      .select("id, number")
      .eq("tenant_id", tenant.id)
      .eq("id", claimedDevice.kiosk_id)
      .limit(1)
      .maybeSingle<KioskRow>();

    if (kioskError) {
      return NextResponse.json(
        { ok: false, error: `Unable to resolve kiosk after claim: ${kioskError.message}` },
        { status: 500 },
      );
    }
    if (!kiosk) {
      return NextResponse.json(
        { ok: false, error: "Kiosk not found for claimed device." },
        { status: 500 },
      );
    }

    return NextResponse.json({
      ok: true,
      deviceId: claimedDevice.device_id,
      deviceSecret: nextSecret.secret,
      kioskId: claimedDevice.kiosk_id,
      kioskNumber: kiosk.number,
      tenantId: claimedDevice.tenant_id,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected claim error.";
    return badRequest(message);
  }
}

