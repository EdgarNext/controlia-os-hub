import { createHash, timingSafeEqual } from "node:crypto";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";

type TenantRow = {
  id: string;
  slug: string;
  status: string;
};

type PosDeviceRow = {
  id: string;
  tenant_id: string;
  device_id: string;
  name: string;
  status: string;
  secret_salt: string;
  secret_hash: string;
};

export type AuthenticatedPosDevice = {
  tenantId: string;
  tenantSlug: string;
  deviceId: string;
  deviceName: string;
};

export function hashPosDeviceSecret(secret: string, salt: string): string {
  return createHash("sha256").update(`${salt}:${secret}`).digest("hex");
}

function normalizeTenantSlug(rawSlug: string) {
  return rawSlug.trim().toLowerCase();
}

function normalizeDeviceId(rawDeviceId: string) {
  return rawDeviceId.trim();
}

function verifySecret(candidateSecret: string, salt: string, expectedHash: string): boolean {
  const computed = hashPosDeviceSecret(candidateSecret, salt);

  const expectedBuffer = Buffer.from(expectedHash, "hex");
  const actualBuffer = Buffer.from(computed, "hex");

  if (expectedBuffer.length !== actualBuffer.length) {
    return false;
  }

  return timingSafeEqual(expectedBuffer, actualBuffer);
}

export async function authenticatePosDevice(input: {
  tenantSlug: string;
  deviceId: string;
  deviceSecret: string;
}): Promise<AuthenticatedPosDevice> {
  const tenantSlug = normalizeTenantSlug(input.tenantSlug);
  const deviceId = normalizeDeviceId(input.deviceId);
  const deviceSecret = input.deviceSecret;

  if (!tenantSlug) {
    throw new Error("tenantSlug is required.");
  }

  if (!deviceId) {
    throw new Error("deviceId is required.");
  }

  if (!deviceSecret) {
    throw new Error("deviceSecret is required.");
  }

  const supabase = getSupabaseAdminClient();

  const { data: tenant, error: tenantError } = await supabase
    .from("tenants")
    .select("id, slug, status")
    .eq("slug", tenantSlug)
    .limit(1)
    .maybeSingle<TenantRow>();

  if (tenantError) {
    throw new Error(`Unable to resolve tenant: ${tenantError.message}`);
  }

  if (!tenant || tenant.status !== "active") {
    throw new Error("Tenant is not available for POS sync.");
  }

  const { data: device, error: deviceError } = await supabase
    .from("pos_devices")
    .select("id, tenant_id, device_id, name, status, secret_salt, secret_hash")
    .eq("tenant_id", tenant.id)
    .eq("device_id", deviceId)
    .limit(1)
    .maybeSingle<PosDeviceRow>();

  if (deviceError) {
    throw new Error(`Unable to resolve POS device: ${deviceError.message}`);
  }

  if (!device || device.status !== "active") {
    throw new Error("POS device is not active.");
  }

  if (!verifySecret(deviceSecret, device.secret_salt, device.secret_hash)) {
    throw new Error("Invalid POS device credentials.");
  }

  const nowIso = new Date().toISOString();

  const { error: touchError } = await supabase
    .from("pos_devices")
    .update({ last_seen_at: nowIso, updated_at: nowIso })
    .eq("id", device.id);

  if (touchError) {
    throw new Error(`Unable to update POS device heartbeat: ${touchError.message}`);
  }

  return {
    tenantId: tenant.id,
    tenantSlug: tenant.slug,
    deviceId: device.device_id,
    deviceName: device.name,
  };
}
