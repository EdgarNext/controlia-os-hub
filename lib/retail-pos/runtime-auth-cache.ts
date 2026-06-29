import { createHash } from "node:crypto";
import type { RetailPosRuntimeActor } from "./auth";

type RuntimeAuthCacheEntry = {
  actor: RetailPosRuntimeActor;
  createdAt: number;
  expiresAt: number;
  lastAccessAt: number;
};

type RuntimeAuthCacheGetResult =
  | {
      hit: true;
      actor: RetailPosRuntimeActor;
      ttlRemainingMs: number;
      durationMs: number;
    }
  | {
      hit: false;
      ttlRemainingMs: 0;
      durationMs: number;
    };

export const DEFAULT_RUNTIME_AUTH_CACHE_TTL_MS = 30_000;
export const MAX_RUNTIME_AUTH_CACHE_ENTRIES = 500;

const runtimeAuthCache = new Map<string, RuntimeAuthCacheEntry>();

function nowMs() {
  return typeof performance !== "undefined" ? performance.now() : Date.now();
}

function normalizeEnvFlag(value: string | undefined) {
  if (!value) {
    return false;
  }

  const normalized = value.trim().toLowerCase();
  return normalized === "1" || normalized === "true" || normalized === "yes" || normalized === "on";
}

export function isRuntimeAuthCacheDisabled() {
  return normalizeEnvFlag(process.env.RETAIL_POS_RUNTIME_AUTH_CACHE_DISABLED);
}

export function getRuntimeAuthCacheTtlMs() {
  const rawValue = process.env.RETAIL_POS_RUNTIME_AUTH_CACHE_TTL_MS;
  const parsedValue = rawValue ? Number.parseInt(rawValue, 10) : Number.NaN;

  if (!Number.isFinite(parsedValue) || parsedValue <= 0) {
    return DEFAULT_RUNTIME_AUTH_CACHE_TTL_MS;
  }

  return parsedValue;
}

export function buildRuntimeAuthCacheKey(input: {
  tenantSlug: string;
  deviceId: string;
  deviceSecret: string;
}) {
  const secretHash = createHash("sha256").update(input.deviceSecret).digest("hex");
  return createHash("sha256")
    .update(`${input.tenantSlug}:${input.deviceId}:${secretHash}`)
    .digest("hex");
}

function cloneActor(actor: RetailPosRuntimeActor): RetailPosRuntimeActor {
  return {
    tenantId: actor.tenantId,
    tenantSlug: actor.tenantSlug,
    mode: actor.mode,
    deviceRecordId: actor.deviceRecordId,
    kioskId: actor.kioskId,
    devicePublicId: actor.devicePublicId,
    deviceName: actor.deviceName,
    deviceRole: actor.deviceRole,
    allowOrderEntry: actor.allowOrderEntry,
  };
}

function deleteExpiredEntries(referenceTime: number) {
  for (const [key, entry] of runtimeAuthCache.entries()) {
    if (entry.expiresAt <= referenceTime) {
      runtimeAuthCache.delete(key);
    }
  }
}

function evictOldestEntry() {
  let oldestKey: string | null = null;
  let oldestTouchedAt = Number.POSITIVE_INFINITY;

  for (const [key, entry] of runtimeAuthCache.entries()) {
    if (entry.lastAccessAt < oldestTouchedAt) {
      oldestTouchedAt = entry.lastAccessAt;
      oldestKey = key;
    }
  }

  if (oldestKey) {
    runtimeAuthCache.delete(oldestKey);
  }
}

export function getRuntimeAuthCacheEntry(cacheKey: string): RuntimeAuthCacheGetResult {
  const startedAt = nowMs();
  const currentTime = nowMs();
  const entry = runtimeAuthCache.get(cacheKey);

  if (!entry) {
    return {
      hit: false,
      ttlRemainingMs: 0,
      durationMs: nowMs() - startedAt,
    };
  }

  if (entry.expiresAt <= currentTime) {
    runtimeAuthCache.delete(cacheKey);
    return {
      hit: false,
      ttlRemainingMs: 0,
      durationMs: nowMs() - startedAt,
    };
  }

  entry.lastAccessAt = currentTime;

  return {
    hit: true,
    actor: cloneActor(entry.actor),
    ttlRemainingMs: Math.max(0, Math.round(entry.expiresAt - currentTime)),
    durationMs: nowMs() - startedAt,
  };
}

export function setRuntimeAuthCacheEntry(input: {
  cacheKey: string;
  actor: RetailPosRuntimeActor;
  ttlMs?: number;
}) {
  const startedAt = nowMs();
  const currentTime = nowMs();
  const ttlMs = input.ttlMs ?? getRuntimeAuthCacheTtlMs();

  deleteExpiredEntries(currentTime);

  runtimeAuthCache.set(input.cacheKey, {
    actor: cloneActor(input.actor),
    createdAt: currentTime,
    expiresAt: currentTime + ttlMs,
    lastAccessAt: currentTime,
  });

  while (runtimeAuthCache.size > MAX_RUNTIME_AUTH_CACHE_ENTRIES) {
    evictOldestEntry();
  }

  return {
    durationMs: nowMs() - startedAt,
    ttlMs,
  };
}
