import { createHash, timingSafeEqual } from "node:crypto";
import { resolveTenantContextBySlug } from "@/lib/auth/tenant-context";
import { requireUser } from "@/lib/auth/require-user";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import type { RuntimePerfTrace } from "./runtime-perf";
import {
  buildRuntimeAuthCacheKey,
  getRuntimeAuthCacheEntry,
  getRuntimeAuthCacheTtlMs,
  isRuntimeAuthCacheDisabled,
  setRuntimeAuthCacheEntry,
} from "./runtime-auth-cache";
import { runSupabaseReadWithRetry } from "./runtime-supabase-retry";
import type { RetailPosDeviceRole } from "@/shared/types/retail-pos";
import { RetailPosRuntimeError } from "./errors";

type TenantRow = {
  id: string;
  slug: string;
  name: string;
  status: string;
};

type TenantModuleRow = {
  enabled: boolean;
};

type PosDeviceRow = {
  id: string;
  tenant_id: string;
  kiosk_id: string;
  device_id: string;
  name: string;
  status: string;
  secret_salt: string;
  secret_hash: string;
};

type DeviceSettingsRow = {
  device_id: string;
  tenant_id: string;
  device_role: RetailPosDeviceRole;
  is_active: boolean;
};

export type RetailPosTargetDevice = {
  deviceRecordId: string;
  kioskId: string;
  devicePublicId: string;
  deviceName: string;
  deviceRole: RetailPosDeviceRole;
};

export type RetailPosRuntimeActor = {
  tenantId: string;
  tenantSlug: string;
  mode: "session" | "device";
  deviceRecordId: string | null;
  kioskId: string | null;
  devicePublicId: string | null;
  deviceName: string | null;
  deviceRole: RetailPosDeviceRole | null;
};

function normalizeTenantSlug(tenantSlug: string) {
  return tenantSlug.trim().toLowerCase();
}

function normalizeOptionalValue(value: string | null | undefined) {
  const normalized = value?.trim();
  return normalized ? normalized : null;
}

function hashDeviceSecret(secret: string, salt: string) {
  return createHash("sha256").update(`${salt}:${secret}`).digest("hex");
}

function timingSafeSecretEquals(expectedHash: string, computedHash: string) {
  const expectedBuffer = Buffer.from(expectedHash, "hex");
  const actualBuffer = Buffer.from(computedHash, "hex");

  if (expectedBuffer.length !== actualBuffer.length) {
    return false;
  }

  return timingSafeEqual(expectedBuffer, actualBuffer);
}

function nowMs() {
  return typeof performance !== "undefined" ? performance.now() : Date.now();
}

function logRuntimeAuthCache(input: {
  trace?: RuntimePerfTrace;
  tenantSlug: string;
  deviceId: string;
  cacheHit: boolean;
  cacheMiss: boolean;
  cacheSet: boolean;
  ttlRemainingMs: number;
  durationMs: number;
}) {
  console.info(
    `[retail-pos][runtime][auth-cache] ${JSON.stringify({
      request_id: input.trace?.requestId ?? null,
      tenant_slug: input.tenantSlug,
      device_id: input.deviceId,
      cache_hit: input.cacheHit,
      cache_miss: input.cacheMiss,
      cache_set: input.cacheSet,
      ttl_remaining_ms: Math.round(input.ttlRemainingMs),
      duration_ms: Math.round(input.durationMs * 100) / 100,
    })}`,
  );
}

export async function resolveRetailPosTenant(
  tenantSlug: string,
  trace?: RuntimePerfTrace,
) {
  const tenantResolveStartedAt =
    typeof performance !== "undefined" ? performance.now() : Date.now();
  const supabase = getSupabaseAdminClient({ trace });
  const normalizedTenantSlug = normalizeTenantSlug(tenantSlug);

  const { data: tenant, error: tenantError } =
    await runSupabaseReadWithRetry<TenantRow>({
      trace,
      step: "tenant",
      query: (signal) =>
        supabase
          .from("tenants")
          .select("id, slug, name, status")
          .abortSignal(signal)
          .eq("slug", normalizedTenantSlug)
          .limit(1)
          .maybeSingle<TenantRow>(),
    });

  if (tenantError) {
    trace?.log({
      step: "tenant",
      ok: false,
      status: 500,
      error: tenantError,
      extra: { tenant_slug: normalizedTenantSlug },
    });
    throw new RetailPosRuntimeError(500, `Unable to resolve tenant: ${tenantError.message}`);
  }

  if (!tenant || tenant.status !== "active") {
    throw new RetailPosRuntimeError(404, "Tenant not found or inactive.");
  }

  const { data: tenantModule, error: moduleError } =
    await runSupabaseReadWithRetry<TenantModuleRow>({
      trace,
      step: "module",
      query: (signal) =>
        supabase
          .from("tenant_modules")
          .select("enabled")
          .abortSignal(signal)
          .eq("tenant_id", tenant.id)
          .eq("module_key", "retail_pos")
          .limit(1)
          .maybeSingle<TenantModuleRow>(),
    });

  if (moduleError) {
    trace?.log({
      step: "module",
      ok: false,
      status: 500,
      error: moduleError,
      extra: { tenant_slug: normalizedTenantSlug, tenant_id: tenant.id },
    });
    throw new RetailPosRuntimeError(500, `Unable to resolve retail_pos module: ${moduleError.message}`);
  }

  if (!tenantModule?.enabled) {
    throw new RetailPosRuntimeError(403, "retail_pos is not enabled for this tenant.");
  }

  trace?.addDuration(
    "resolve_tenant_total_ms",
    (typeof performance !== "undefined" ? performance.now() : Date.now()) -
      tenantResolveStartedAt,
  );
  return tenant;
}

export async function resolveRetailPosSessionActor(tenantSlug: string): Promise<RetailPosRuntimeActor> {
  await requireUser();
  const tenant = await resolveRetailPosTenant(tenantSlug);
  const sessionTenant = await resolveTenantContextBySlug(tenantSlug);

  if (sessionTenant.tenantId !== tenant.id) {
    throw new RetailPosRuntimeError(403, "Session tenant does not match requested tenant.");
  }

  if (!sessionTenant.enabledModuleKeys.includes("retail_pos")) {
    throw new RetailPosRuntimeError(403, "retail_pos is not enabled for this tenant.");
  }

  return {
    tenantId: tenant.id,
    tenantSlug: tenant.slug,
    mode: "session",
    deviceRecordId: null,
    kioskId: null,
    devicePublicId: null,
    deviceName: null,
    deviceRole: null,
  };
}

export async function authenticateRetailPosDeviceActor(input: {
  tenantSlug: string;
  deviceId: string;
  deviceSecret: string;
  trace?: RuntimePerfTrace;
}): Promise<RetailPosRuntimeActor> {
  const authStartedAt =
    typeof performance !== "undefined" ? performance.now() : Date.now();
  const normalizedDeviceId = normalizeOptionalValue(input.deviceId);
  const normalizedDeviceSecret = normalizeOptionalValue(input.deviceSecret);

  if (!normalizedDeviceId || !normalizedDeviceSecret) {
    throw new RetailPosRuntimeError(400, "deviceId and deviceSecret are required.");
  }

  const tenant = await resolveRetailPosTenant(input.tenantSlug, input.trace);
  const supabase = getSupabaseAdminClient({ trace: input.trace });

  const { data: device, error: deviceError } =
    await runSupabaseReadWithRetry<PosDeviceRow>({
      trace: input.trace,
      step: "device",
      query: (signal) =>
        supabase
          .from("pos_devices")
          .select("id, tenant_id, kiosk_id, device_id, name, status, secret_salt, secret_hash")
          .abortSignal(signal)
          .eq("tenant_id", tenant.id)
          .eq("device_id", normalizedDeviceId)
          .limit(1)
          .maybeSingle<PosDeviceRow>(),
    });

  if (deviceError) {
    throw new RetailPosRuntimeError(500, `Unable to resolve POS device: ${deviceError.message}`);
  }

  if (!device || device.status !== "active") {
    throw new RetailPosRuntimeError(401, "POS device is not active.");
  }

  const hashStartedAt =
    typeof performance !== "undefined" ? performance.now() : Date.now();
  const computedHash = hashDeviceSecret(normalizedDeviceSecret, device.secret_salt);
  input.trace?.addDuration(
    "secret_hash_verify",
    (typeof performance !== "undefined" ? performance.now() : Date.now()) -
      hashStartedAt,
  );

  if (!timingSafeSecretEquals(device.secret_hash, computedHash)) {
    throw new RetailPosRuntimeError(401, "Invalid POS device credentials.");
  }

  const { data: settings, error: settingsError } =
    await runSupabaseReadWithRetry<DeviceSettingsRow>({
      trace: input.trace,
      step: "device_settings",
      query: (signal) =>
        supabase
          .from("retail_pos_device_settings")
          .select("device_id, tenant_id, device_role, is_active")
          .abortSignal(signal)
          .eq("tenant_id", tenant.id)
          .eq("device_id", device.id)
          .eq("is_active", true)
          .limit(1)
          .maybeSingle<DeviceSettingsRow>(),
    });

  if (settingsError) {
    throw new RetailPosRuntimeError(500, `Unable to resolve retail_pos device settings: ${settingsError.message}`);
  }

  if (!settings) {
    throw new RetailPosRuntimeError(403, "retail_pos device settings are required for this device.");
  }

  input.trace?.addDuration(
    "runtime_auth_total_ms",
    (typeof performance !== "undefined" ? performance.now() : Date.now()) -
      authStartedAt,
  );
  input.trace?.addDuration(
    "auth",
    (typeof performance !== "undefined" ? performance.now() : Date.now()) -
      authStartedAt,
  );
  return {
    tenantId: tenant.id,
    tenantSlug: tenant.slug,
    mode: "device",
    deviceRecordId: device.id,
    kioskId: device.kiosk_id,
    devicePublicId: device.device_id,
    deviceName: device.name,
    deviceRole: settings.device_role,
  };
}

export async function resolveRetailPosRuntimeActor(input: {
  tenantSlug: string;
  deviceId?: string | null;
  deviceSecret?: string | null;
  trace?: RuntimePerfTrace;
}): Promise<RetailPosRuntimeActor> {
  const normalizedDeviceId = normalizeOptionalValue(input.deviceId);
  const normalizedDeviceSecret = normalizeOptionalValue(input.deviceSecret);

  if (normalizedDeviceId || normalizedDeviceSecret) {
    if (!normalizedDeviceId || !normalizedDeviceSecret) {
      throw new RetailPosRuntimeError(400, "deviceId and deviceSecret are required together.");
    }

    const cacheDisabled = isRuntimeAuthCacheDisabled();
    const cacheTtlMs = getRuntimeAuthCacheTtlMs();
    const cacheKey = buildRuntimeAuthCacheKey({
      tenantSlug: normalizeTenantSlug(input.tenantSlug),
      deviceId: normalizedDeviceId,
      deviceSecret: normalizedDeviceSecret,
    });

    if (!cacheDisabled) {
      const cacheLookup = getRuntimeAuthCacheEntry(cacheKey);
      input.trace?.addDuration("auth_cache", cacheLookup.durationMs);
      input.trace?.addDuration(
        cacheLookup.hit ? "auth_cache_hit" : "auth_cache_miss",
        cacheLookup.durationMs,
      );
      input.trace?.addDuration("auth_cache_ttl_remaining_ms", cacheLookup.ttlRemainingMs);

      if (cacheLookup.hit) {
        input.trace?.addDuration("runtime_auth_total_ms", cacheLookup.durationMs);
        input.trace?.addDuration("auth", cacheLookup.durationMs);
        logRuntimeAuthCache({
          trace: input.trace,
          tenantSlug: normalizeTenantSlug(input.tenantSlug),
          deviceId: normalizedDeviceId,
          cacheHit: true,
          cacheMiss: false,
          cacheSet: false,
          ttlRemainingMs: cacheLookup.ttlRemainingMs,
          durationMs: cacheLookup.durationMs,
        });
        return cacheLookup.actor;
      }

      logRuntimeAuthCache({
        trace: input.trace,
        tenantSlug: normalizeTenantSlug(input.tenantSlug),
        deviceId: normalizedDeviceId,
        cacheHit: false,
        cacheMiss: true,
        cacheSet: false,
        ttlRemainingMs: 0,
        durationMs: cacheLookup.durationMs,
      });
    }

    const actor = await authenticateRetailPosDeviceActor({
      tenantSlug: input.tenantSlug,
      deviceId: normalizedDeviceId,
      deviceSecret: normalizedDeviceSecret,
      trace: input.trace,
    });

    if (!cacheDisabled && actor.mode === "device") {
      const cacheSet = setRuntimeAuthCacheEntry({
        cacheKey,
        actor,
        ttlMs: cacheTtlMs,
      });
      input.trace?.addDuration("auth_cache_set", cacheSet.durationMs);
      logRuntimeAuthCache({
        trace: input.trace,
        tenantSlug: normalizeTenantSlug(input.tenantSlug),
        deviceId: normalizedDeviceId,
        cacheHit: false,
        cacheMiss: false,
        cacheSet: true,
        ttlRemainingMs: cacheSet.ttlMs,
        durationMs: cacheSet.durationMs,
      });
    }

    return actor;
  }

  return resolveRetailPosSessionActor(input.tenantSlug);
}

export function assertRetailPosDeviceRole(
  actor: RetailPosRuntimeActor,
  allowedRoles: RetailPosDeviceRole[],
) {
  if (actor.mode !== "device") {
    return;
  }

  if (!actor.deviceRole || allowedRoles.indexOf(actor.deviceRole) === -1) {
    throw new RetailPosRuntimeError(403, "POS device role is not allowed for this operation.");
  }
}

export async function resolveRetailPosTargetDevice(input: {
  actor: RetailPosRuntimeActor;
  deviceRecordId?: string | null;
  requiredRole?: RetailPosDeviceRole;
}): Promise<RetailPosTargetDevice> {
  const requestedDeviceRecordId = input.deviceRecordId?.trim() || null;

  if (input.actor.mode === "device") {
    if (
      !input.actor.deviceRecordId ||
      !input.actor.kioskId ||
      !input.actor.devicePublicId ||
      !input.actor.deviceName ||
      !input.actor.deviceRole
    ) {
      throw new RetailPosRuntimeError(500, "Authenticated retail_pos device context is incomplete.");
    }

    if (requestedDeviceRecordId && requestedDeviceRecordId !== input.actor.deviceRecordId) {
      throw new RetailPosRuntimeError(403, "Authenticated device does not match requested device.");
    }

    if (input.requiredRole && input.actor.deviceRole !== input.requiredRole) {
      throw new RetailPosRuntimeError(403, "POS device role is not allowed for this operation.");
    }

    return {
      deviceRecordId: input.actor.deviceRecordId,
      kioskId: input.actor.kioskId,
      devicePublicId: input.actor.devicePublicId,
      deviceName: input.actor.deviceName,
      deviceRole: input.actor.deviceRole,
    };
  }

  if (!requestedDeviceRecordId) {
    throw new RetailPosRuntimeError(400, "device_id is required for session-driven retail_pos runtime operations.");
  }

  const supabase = getSupabaseAdminClient();
  const { data: device, error: deviceError } = await supabase
    .from("pos_devices")
    .select("id, tenant_id, kiosk_id, device_id, name, status")
    .eq("tenant_id", input.actor.tenantId)
    .eq("id", requestedDeviceRecordId)
    .eq("status", "active")
    .limit(1)
    .maybeSingle<{ id: string; tenant_id: string; kiosk_id: string; device_id: string; name: string; status: string }>();

  if (deviceError) {
    throw new RetailPosRuntimeError(500, `Unable to resolve POS device: ${deviceError.message}`);
  }

  if (!device) {
    throw new RetailPosRuntimeError(404, "POS device is not available for this tenant.");
  }

  const { data: settings, error: settingsError } = await supabase
    .from("retail_pos_device_settings")
    .select("device_id, tenant_id, device_role, is_active")
    .eq("tenant_id", input.actor.tenantId)
    .eq("device_id", device.id)
    .eq("is_active", true)
    .limit(1)
    .maybeSingle<DeviceSettingsRow>();

  if (settingsError) {
    throw new RetailPosRuntimeError(500, `Unable to resolve retail_pos device settings: ${settingsError.message}`);
  }

  if (!settings) {
    throw new RetailPosRuntimeError(403, "retail_pos device settings are required for this device.");
  }

  if (input.requiredRole && settings.device_role !== input.requiredRole) {
    throw new RetailPosRuntimeError(403, "POS device role is not allowed for this operation.");
  }

  return {
    deviceRecordId: device.id,
    kioskId: device.kiosk_id,
    devicePublicId: device.device_id,
    deviceName: device.name,
    deviceRole: settings.device_role,
  };
}
