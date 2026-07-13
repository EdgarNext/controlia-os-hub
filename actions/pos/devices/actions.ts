"use server";

import { randomBytes, randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth/require-user";
import { resolveTenantContextBySlug } from "@/lib/auth/tenant-context";
import type { RetailPosDeviceRole } from "@/shared/types/retail-pos";
import {
  RETAIL_TECHNICAL_KIOSK_NAME,
  isRetailClaimDeviceRole,
  isTechnicalRetailKioskName,
  type RetailClaimDeviceRole,
} from "@/lib/pos/device-claims";
import { hashPosDeviceSecret } from "@/lib/pos/device-auth";
import { getSupabaseServerClient } from "@/lib/supabase/server";

const CLAIM_TTL_MINUTES = 15;
const DEVICE_MODULE_KEYS = ["sales_pos", "retail_pos"] as const;

export type DeviceModuleKey = (typeof DEVICE_MODULE_KEYS)[number];

export type PosKioskOption = {
  id: string;
  number: number;
  name: string | null;
  is_active: boolean;
};

export type PosDeviceRow = {
  id: string;
  tenant_id: string;
  kiosk_id: string;
  device_id: string;
  name: string;
  status: "pending" | "active" | "revoked" | "disabled";
  claim_code: string | null;
  claim_expires_at: string | null;
  claimed_at: string | null;
  last_seen_at: string | null;
  last_sync_at: string | null;
  created_at: string;
  updated_at: string;
};

type RetailDeviceSettingsRow = {
  device_id: string;
  tenant_id: string;
  device_role: RetailPosDeviceRole;
  allow_order_entry: boolean;
  is_active: boolean;
};

type TenantModuleRow = {
  enabled: boolean;
};

type MutablePosDeviceSnapshot = {
  id: string;
  tenant_id: string;
  kiosk_id: string;
  name: string;
  status: "pending" | "active" | "revoked" | "disabled";
  claim_code: string | null;
  claim_expires_at: string | null;
  claimed_at: string | null;
  claimed_by_user_id: string | null;
  secret_salt: string;
  secret_hash: string;
};

type PosDeviceModuleMetadata = {
  moduleKey: DeviceModuleKey;
  deviceRole: RetailPosDeviceRole | null;
  isRetailBound: boolean;
};

export type DeviceManagementCapabilities = {
  canManageSalesPosDevices: boolean;
  canManageRetailPosDevices: boolean;
};

type DevicesAccess = DeviceManagementCapabilities & {
  tenant: {
    tenantId: string;
    tenantSlug: string;
  };
  user: {
    id: string;
  };
};

export type PosDeviceListItem = {
  id: string;
  kioskId: string;
  deviceId: string;
  name: string;
  moduleKey: DeviceModuleKey;
  deviceRole: RetailPosDeviceRole | null;
  status: "pending" | "active" | "revoked" | "disabled";
  claimCode: string | null;
  claimExpiresAt: string | null;
  claimedAt: string | null;
  lastSeenAt: string | null;
  lastSyncAt: string | null;
  createdAt: string;
  updatedAt: string;
  kiosk: {
    id: string;
    number: number;
    name: string | null;
    isActive: boolean;
  } | null;
};

export type IssueClaimFormState = {
  error: string | null;
  fieldErrors: {
    moduleKey?: string;
    kioskId?: string;
    name?: string;
    deviceRole?: string;
    deviceId?: string;
    confirmPhrase?: string;
  };
  result: {
    deviceRecordId: string;
    deviceId: string;
    deviceName: string;
    moduleKey: DeviceModuleKey;
    deviceRole: RetailPosDeviceRole | null;
    kioskId: string;
    kioskName: string;
    kioskNumber: number;
    claimCode: string;
    claimExpiresAt: string;
  } | null;
};

export type DisableDeviceFormState = {
  error: string | null;
  done: boolean;
};

export type CreateKioskFormState = {
  error: string | null;
  fieldErrors: {
    name?: string;
  };
  values: {
    name: string;
  };
  nextNumber: number | null;
  result: {
    id: string;
    number: number;
    name: string | null;
  } | null;
};

const initialIssueClaimState: IssueClaimFormState = {
  error: null,
  fieldErrors: {},
  result: null,
};

const initialDisableState: DisableDeviceFormState = {
  error: null,
  done: false,
};

const initialCreateKioskState: CreateKioskFormState = {
  error: null,
  fieldErrors: {},
  values: {
    name: "",
  },
  nextNumber: null,
  result: null,
};

function normalizeTenantSlug(value: unknown): string {
  return String(value ?? "").trim().toLowerCase();
}

function normalizeDeviceName(value: unknown): string {
  return String(value ?? "").trim();
}

function normalizeKioskId(value: unknown): string {
  return String(value ?? "").trim();
}

function normalizeRecordId(value: unknown): string {
  return String(value ?? "").trim();
}

function normalizeOptionalDeviceId(value: unknown): string | null {
  const normalized = String(value ?? "").trim();
  return normalized.length > 0 ? normalized : null;
}

function normalizeModuleKey(value: unknown): DeviceModuleKey | null {
  const normalized = String(value ?? "").trim().toLowerCase();
  return normalized === "sales_pos" || normalized === "retail_pos" ? normalized : null;
}

function normalizeRetailDeviceRole(value: unknown): RetailClaimDeviceRole | null {
  const normalized = String(value ?? "").trim();
  return isRetailClaimDeviceRole(normalized) ? normalized : null;
}

function getKioskLabel(kiosk: { number: number; name: string | null }): string {
  return kiosk.name ?? `Kiosco ${kiosk.number}`;
}

function getKioskByMap(
  kioskId: string,
  kiosksById: Map<string, { id: string; number: number; name: string | null; is_active: boolean }>,
): PosDeviceListItem["kiosk"] {
  const kiosk = kiosksById.get(kioskId);
  if (!kiosk) {
    return null;
  }
  return {
    id: kiosk.id,
    number: kiosk.number,
    name: kiosk.name,
    isActive: kiosk.is_active,
  };
}

function inferPosDeviceModule(input: {
  kiosk: { name: string | null } | null;
  retailSettings: RetailDeviceSettingsRow | null;
}): PosDeviceModuleMetadata {
  const hasRetailSettings = Boolean(input.retailSettings?.is_active);
  const hasSupportedRetailRole = hasRetailSettings && isRetailClaimDeviceRole(input.retailSettings?.device_role);
  const hasTechnicalRetailKiosk = isTechnicalRetailKioskName(input.kiosk?.name ?? null);
  const isRetailBound = Boolean(hasRetailSettings && hasSupportedRetailRole && hasTechnicalRetailKiosk);

  return {
    moduleKey: isRetailBound ? "retail_pos" : "sales_pos",
    deviceRole: isRetailBound ? input.retailSettings?.device_role ?? null : null,
    isRetailBound,
  };
}

function toDeviceListItem(
  row: PosDeviceRow,
  kiosksById: Map<string, { id: string; number: number; name: string | null; is_active: boolean }>,
  retailSettingsByDeviceId: Map<string, RetailDeviceSettingsRow>,
): PosDeviceListItem {
  const retailSettings = retailSettingsByDeviceId.get(row.id) ?? null;
  const kiosk = getKioskByMap(row.kiosk_id, kiosksById);
  const metadata = inferPosDeviceModule({
    kiosk,
    retailSettings,
  });
  return {
    id: row.id,
    kioskId: row.kiosk_id,
    deviceId: row.device_id,
    name: row.name,
    moduleKey: metadata.moduleKey,
    deviceRole: metadata.deviceRole,
    status: row.status,
    claimCode: row.claim_code,
    claimExpiresAt: row.claim_expires_at,
    claimedAt: row.claimed_at,
    lastSeenAt: row.last_seen_at,
    lastSyncAt: row.last_sync_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    kiosk,
  };
}

function createPendingCredentialSeed() {
  const seed = randomBytes(24).toString("base64url");
  const salt = randomBytes(16).toString("hex");
  const hash = hashPosDeviceSecret(seed, salt);

  return { salt, hash };
}

function generateClaimCode(): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const bytes = randomBytes(8);
  let claim = "";

  for (let i = 0; i < 8; i += 1) {
    claim += alphabet[bytes[i] % alphabet.length];
  }

  return claim;
}

function generateDeviceId(): string {
  return `edge-${randomBytes(5).toString("hex")}`;
}

function revalidateDeviceAdminPaths(tenantSlug: string, deviceRecordId?: string | null) {
  revalidatePath(`/${tenantSlug}/pos/devices`);
  revalidatePath(`/${tenantSlug}/pos/devices/new`);
  revalidatePath(`/${tenantSlug}/retail/devices`);
  revalidatePath(`/${tenantSlug}/retail/devices/new`);

  if (deviceRecordId) {
    revalidatePath(`/${tenantSlug}/pos/devices/${deviceRecordId}`);
    revalidatePath(`/${tenantSlug}/retail/devices/${deviceRecordId}`);
  }
}

function plusClaimTtlIso(nowIso: string): string {
  const now = new Date(nowIso);
  now.setMinutes(now.getMinutes() + CLAIM_TTL_MINUTES);
  return now.toISOString();
}

async function resolveDevicesAccess(tenantSlug: string): Promise<DevicesAccess> {
  const tenant = await resolveTenantContextBySlug(tenantSlug);
  if (!tenant.isPlatformOwner) {
    throw new Error("Access denied. Only Platform Owner can administer POS devices.");
  }

  const user = await requireUser();

  return {
    tenant: {
      tenantId: tenant.tenantId,
      tenantSlug: tenant.tenantSlug,
    },
    user: {
      id: user.id,
    },
    canManageSalesPosDevices: tenant.enabledModuleKeys.includes("sales_pos"),
    canManageRetailPosDevices: tenant.enabledModuleKeys.includes("retail_pos"),
  };
}

function assertModuleManagementAccess(access: DeviceManagementCapabilities, moduleKey: DeviceModuleKey) {
  if (moduleKey === "sales_pos" && !access.canManageSalesPosDevices) {
    throw new Error("No tienes permisos para administrar dispositivos de sales_pos.");
  }

  if (moduleKey === "retail_pos" && !access.canManageRetailPosDevices) {
    throw new Error("No tienes permisos para administrar dispositivos de retail_pos.");
  }
}

function assertSalesPosManagementAccess(access: DeviceManagementCapabilities) {
  if (!access.canManageSalesPosDevices) {
    throw new Error("No tienes permisos para administrar kioscos o dispositivos de sales_pos.");
  }
}

function filterDevicesByAccess(
  devices: PosDeviceListItem[],
  access: DeviceManagementCapabilities,
): PosDeviceListItem[] {
  return devices.filter((device) => {
    if (device.moduleKey === "sales_pos") {
      return access.canManageSalesPosDevices;
    }

    return access.canManageRetailPosDevices;
  });
}

async function getDeviceModuleByRecordId(
  tenantId: string,
  deviceRecordId: string,
): Promise<PosDeviceModuleMetadata | null> {
  const supabase = await getSupabaseServerClient();
  const { data: device, error: deviceError } = await supabase
    .from("pos_devices")
    .select("id, kiosk_id")
    .eq("tenant_id", tenantId)
    .eq("id", deviceRecordId)
    .limit(1)
    .maybeSingle<{ id: string; kiosk_id: string }>();

  if (deviceError) {
    throw new Error(`No fue posible consultar el módulo del dispositivo POS: ${deviceError.message}`);
  }

  if (!device) {
    return null;
  }

  const [{ data: kiosk, error: kioskError }, { data: retailSettings, error: retailSettingsError }] = await Promise.all([
    supabase
      .from("kiosks")
      .select("name")
      .eq("tenant_id", tenantId)
      .eq("id", device.kiosk_id)
      .limit(1)
      .maybeSingle<{ name: string | null }>(),
    supabase
      .from("retail_pos_device_settings")
      .select("device_id, tenant_id, device_role, allow_order_entry, is_active")
      .eq("tenant_id", tenantId)
      .eq("device_id", device.id)
      .limit(1)
      .maybeSingle<RetailDeviceSettingsRow>(),
  ]);

  if (kioskError) {
    throw new Error(`No fue posible resolver kiosco del dispositivo POS: ${kioskError.message}`);
  }

  if (retailSettingsError) {
    throw new Error(`No fue posible resolver settings retail del dispositivo POS: ${retailSettingsError.message}`);
  }

  return inferPosDeviceModule({
    kiosk: kiosk ?? null,
    retailSettings: retailSettings ?? null,
  });
}

async function getKioskById(tenantId: string, kioskId: string): Promise<PosKioskOption | null> {
  const supabase = await getSupabaseServerClient();
  const { data, error } = await supabase
    .from("kiosks")
    .select("id, number, name, is_active")
    .eq("tenant_id", tenantId)
    .eq("id", kioskId)
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new Error(`No fue posible consultar el kiosco: ${error.message}`);
  }

  return (data as PosKioskOption | null) ?? null;
}

async function assertRetailPosEnabled(tenantId: string) {
  const supabase = await getSupabaseServerClient();
  const { data, error } = await supabase
    .from("tenant_modules")
    .select("enabled")
    .eq("tenant_id", tenantId)
    .eq("module_key", "retail_pos")
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new Error(`No fue posible validar retail_pos para el tenant: ${error.message}`);
  }

  if (!(data as TenantModuleRow | null)?.enabled) {
    throw new Error("El tenant no tiene habilitado retail_pos.");
  }
}

export async function listKiosksForDevices(tenantSlug: string): Promise<PosKioskOption[]> {
  const normalizedTenantSlug = normalizeTenantSlug(tenantSlug);
  const access = await resolveDevicesAccess(normalizedTenantSlug);
  assertSalesPosManagementAccess(access);

  const supabase = await getSupabaseServerClient();
  const { data, error } = await supabase
    .from("kiosks")
    .select("id, number, name, is_active")
    .eq("tenant_id", access.tenant.tenantId)
    .order("number", { ascending: true });

  if (error) {
    throw new Error(`No fue posible listar kioscos: ${error.message}`);
  }

  return ((data ?? []) as PosKioskOption[]).filter((kiosk) => !isTechnicalRetailKioskName(kiosk.name));
}

function computeNextAvailableKioskNumber(numbers: number[]): number {
  const normalized = new Set(
    numbers.filter((value) => Number.isInteger(value) && value > 0).map((value) => Math.trunc(value)),
  );
  let next = 1;
  while (normalized.has(next)) {
    next += 1;
  }
  return next;
}

async function getNextAvailableKioskNumberForTenantId(tenantId: string): Promise<number> {
  const supabase = await getSupabaseServerClient();
  const { data, error } = await supabase
    .from("kiosks")
    .select("number")
    .eq("tenant_id", tenantId)
    .order("number", { ascending: true });

  if (error) {
    throw new Error(`No fue posible calcular el próximo número de kiosco: ${error.message}`);
  }

  return computeNextAvailableKioskNumber(
    (data ?? []).map((row) => Number((row as { number: unknown }).number)).filter((value) => Number.isInteger(value)),
  );
}

export async function getNextAvailableKioskNumber(tenantSlug: string): Promise<number> {
  const normalizedTenantSlug = normalizeTenantSlug(tenantSlug);
  const access = await resolveDevicesAccess(normalizedTenantSlug);
  assertSalesPosManagementAccess(access);
  return getNextAvailableKioskNumberForTenantId(access.tenant.tenantId);
}

async function getOrCreateTechnicalRetailKiosk(input: {
  tenantId: string;
  userId: string;
}): Promise<PosKioskOption> {
  const supabase = await getSupabaseServerClient();
  const { data: existing, error: existingError } = await supabase
    .from("kiosks")
    .select("id, number, name, is_active")
    .eq("tenant_id", input.tenantId)
    .eq("name", RETAIL_TECHNICAL_KIOSK_NAME)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (existingError) {
    throw new Error(`No fue posible consultar el kiosco técnico retail: ${existingError.message}`);
  }

  if (existing) {
    return existing as PosKioskOption;
  }

  const nowIso = new Date().toISOString();
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const nextNumber = await getNextAvailableKioskNumberForTenantId(input.tenantId);
    const { data, error } = await supabase
      .from("kiosks")
      .insert({
        id: randomUUID(),
        tenant_id: input.tenantId,
        number: nextNumber,
        name: RETAIL_TECHNICAL_KIOSK_NAME,
        is_active: true,
        created_at: nowIso,
        updated_at: nowIso,
        created_by: input.userId,
        updated_by: input.userId,
      })
      .select("id, number, name, is_active")
      .limit(1)
      .maybeSingle();

    if (!error && data) {
      return data as PosKioskOption;
    }

    if (
      error &&
      !error.message.includes("kiosks_tenant_number_unique") &&
      !error.message.includes("kiosks_tenant_number_key")
    ) {
      throw new Error(`No fue posible crear el kiosco técnico retail: ${error.message}`);
    }
  }

  const { data: refreshed, error: refreshedError } = await supabase
    .from("kiosks")
    .select("id, number, name, is_active")
    .eq("tenant_id", input.tenantId)
    .eq("name", RETAIL_TECHNICAL_KIOSK_NAME)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (refreshedError) {
    throw new Error(`No fue posible recuperar el kiosco técnico retail: ${refreshedError.message}`);
  }

  if (!refreshed) {
    throw new Error("No fue posible crear el kiosco técnico retail.");
  }

  return refreshed as PosKioskOption;
}

async function deactivateRetailSettings(deviceRecordId: string, tenantId: string) {
  const supabase = await getSupabaseServerClient();
  const { error } = await supabase
    .from("retail_pos_device_settings")
    .update({ is_active: false })
    .eq("tenant_id", tenantId)
    .eq("device_id", deviceRecordId);

  if (error) {
    throw new Error(`No fue posible desactivar settings retail del dispositivo: ${error.message}`);
  }
}

async function upsertRetailDeviceSettings(input: {
  tenantId: string;
  deviceRecordId: string;
  deviceRole: RetailClaimDeviceRole;
  userId: string;
  nowIso: string;
}) {
  const supabase = await getSupabaseServerClient();
  const { error } = await supabase.from("retail_pos_device_settings").upsert({
    device_id: input.deviceRecordId,
    tenant_id: input.tenantId,
    device_role: input.deviceRole,
    allow_order_entry: input.deviceRole === "order_station",
    printer_name: null,
    printer_driver: null,
    auto_print_order_ticket: true,
    auto_print_payment_ticket: true,
    scanner_enabled: true,
    is_active: true,
    created_at: input.nowIso,
    updated_at: input.nowIso,
    created_by: input.userId,
    updated_by: input.userId,
  });

  if (error) {
    throw new Error(`No fue posible crear o validar retail_pos_device_settings: ${error.message}`);
  }
}

async function restoreDeviceSnapshot(snapshot: MutablePosDeviceSnapshot, userId: string, nowIso: string) {
  const supabase = await getSupabaseServerClient();
  const { error } = await supabase
    .from("pos_devices")
    .update({
      kiosk_id: snapshot.kiosk_id,
      name: snapshot.name,
      status: snapshot.status,
      claim_code: snapshot.claim_code,
      claim_expires_at: snapshot.claim_expires_at,
      claimed_at: snapshot.claimed_at,
      claimed_by_user_id: snapshot.claimed_by_user_id,
      secret_salt: snapshot.secret_salt,
      secret_hash: snapshot.secret_hash,
      updated_at: nowIso,
      updated_by: userId,
    })
    .eq("tenant_id", snapshot.tenant_id)
    .eq("id", snapshot.id);

  if (error) {
    throw new Error(`No fue posible restaurar el dispositivo después del fallo retail: ${error.message}`);
  }
}

async function cleanupFailedNewRetailDevice(deviceRecordId: string, tenantId: string, userId: string, nowIso: string) {
  const supabase = await getSupabaseServerClient();
  const { error } = await supabase
    .from("pos_devices")
    .update({
      status: "disabled",
      claim_code: null,
      claim_expires_at: null,
      claimed_at: null,
      claimed_by_user_id: null,
      updated_at: nowIso,
      updated_by: userId,
    })
    .eq("tenant_id", tenantId)
    .eq("id", deviceRecordId);

  if (error) {
    throw new Error(`No fue posible limpiar el dispositivo retail fallido: ${error.message}`);
  }
}

export async function listDevices(tenantSlug: string): Promise<PosDeviceListItem[]> {
  const normalizedTenantSlug = normalizeTenantSlug(tenantSlug);
  const access = await resolveDevicesAccess(normalizedTenantSlug);

  const supabase = await getSupabaseServerClient();
  const { data, error } = await supabase
    .from("pos_devices")
    .select(
      "id, tenant_id, kiosk_id, device_id, name, status, claim_code, claim_expires_at, claimed_at, last_seen_at, last_sync_at, created_at, updated_at",
    )
    .eq("tenant_id", access.tenant.tenantId)
    .order("updated_at", { ascending: false });

  if (error) {
    throw new Error(`No fue posible listar dispositivos POS: ${error.message}`);
  }

  const rows = (data ?? []) as PosDeviceRow[];
  if (rows.length === 0) {
    return [];
  }

  const kioskIds = Array.from(new Set(rows.map((row) => row.kiosk_id)));
  const { data: kiosks, error: kiosksError } = await supabase
    .from("kiosks")
    .select("id, number, name, is_active")
    .eq("tenant_id", access.tenant.tenantId)
    .in("id", kioskIds);

  if (kiosksError) {
    throw new Error(`No fue posible resolver kioscos POS: ${kiosksError.message}`);
  }

  const { data: retailSettings, error: retailSettingsError } = await supabase
    .from("retail_pos_device_settings")
    .select("device_id, tenant_id, device_role, allow_order_entry, is_active")
    .eq("tenant_id", access.tenant.tenantId)
    .in("device_id", rows.map((row) => row.id));

  if (retailSettingsError) {
    throw new Error(`No fue posible resolver settings retail del dispositivo POS: ${retailSettingsError.message}`);
  }

  const kiosksById = new Map(((kiosks ?? []) as PosKioskOption[]).map((kiosk) => [kiosk.id, kiosk] as const));
  const retailSettingsByDeviceId = new Map(
    ((retailSettings ?? []) as RetailDeviceSettingsRow[]).map((settings) => [settings.device_id, settings] as const),
  );

  return filterDevicesByAccess(
    rows.map((row) => toDeviceListItem(row, kiosksById, retailSettingsByDeviceId)),
    access,
  );
}

export async function getDeviceById(tenantSlug: string, deviceRecordId: string): Promise<PosDeviceListItem | null> {
  const normalizedTenantSlug = normalizeTenantSlug(tenantSlug);
  const normalizedRecordId = normalizeRecordId(deviceRecordId);
  const access = await resolveDevicesAccess(normalizedTenantSlug);

  const supabase = await getSupabaseServerClient();
  const { data, error } = await supabase
    .from("pos_devices")
    .select(
      "id, tenant_id, kiosk_id, device_id, name, status, claim_code, claim_expires_at, claimed_at, last_seen_at, last_sync_at, created_at, updated_at",
    )
    .eq("tenant_id", access.tenant.tenantId)
    .eq("id", normalizedRecordId)
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new Error(`No fue posible consultar el dispositivo POS: ${error.message}`);
  }

  if (!data) {
    return null;
  }

  const { data: kiosk, error: kioskError } = await supabase
    .from("kiosks")
    .select("id, number, name, is_active")
    .eq("tenant_id", access.tenant.tenantId)
    .eq("id", (data as PosDeviceRow).kiosk_id)
    .limit(1)
    .maybeSingle();

  if (kioskError) {
    throw new Error(`No fue posible resolver el kiosco del dispositivo POS: ${kioskError.message}`);
  }

  const { data: retailSettings, error: retailSettingsError } = await supabase
    .from("retail_pos_device_settings")
    .select("device_id, tenant_id, device_role, allow_order_entry, is_active")
    .eq("tenant_id", access.tenant.tenantId)
    .eq("device_id", (data as PosDeviceRow).id)
    .limit(1)
    .maybeSingle();

  if (retailSettingsError) {
    throw new Error(`No fue posible resolver settings retail del dispositivo POS: ${retailSettingsError.message}`);
  }

  const kiosksById = new Map<string, PosKioskOption>();
  if (kiosk) {
    kiosksById.set(kiosk.id, kiosk as PosKioskOption);
  }

  const retailSettingsByDeviceId = new Map<string, RetailDeviceSettingsRow>();
  if (retailSettings) {
    retailSettingsByDeviceId.set((retailSettings as RetailDeviceSettingsRow).device_id, retailSettings as RetailDeviceSettingsRow);
  }

  const device = toDeviceListItem(data as PosDeviceRow, kiosksById, retailSettingsByDeviceId);
  assertModuleManagementAccess(access, device.moduleKey);
  return device;
}

export async function getDeviceManagementCapabilities(tenantSlug: string): Promise<DeviceManagementCapabilities> {
  const access = await resolveDevicesAccess(normalizeTenantSlug(tenantSlug));
  return {
    canManageSalesPosDevices: access.canManageSalesPosDevices,
    canManageRetailPosDevices: access.canManageRetailPosDevices,
  };
}

async function issueClaimInternal(input: {
  tenantSlug: string;
  moduleKey: DeviceModuleKey;
  kioskId?: string | null;
  name: string;
  deviceRole?: RetailClaimDeviceRole | null;
  existingDeviceRecordId?: string | null;
}) {
  const normalizedTenantSlug = normalizeTenantSlug(input.tenantSlug);
  const normalizedKioskId = normalizeKioskId(input.kioskId ?? "");
  const normalizedName = normalizeDeviceName(input.name);
  const normalizedExistingId = input.existingDeviceRecordId ? normalizeRecordId(input.existingDeviceRecordId) : null;

  if (!normalizedTenantSlug) {
    throw new Error("Tenant inválido.");
  }

  if (!normalizedName) {
    throw new Error("El nombre del dispositivo es obligatorio.");
  }

  const access = await resolveDevicesAccess(normalizedTenantSlug);
  assertModuleManagementAccess(access, input.moduleKey);
  const { tenant, user } = access;
  const claimCode = generateClaimCode();
  const nowIso = new Date().toISOString();
  const claimExpiresAt = plusClaimTtlIso(nowIso);
  const pendingSeed = createPendingCredentialSeed();
  const supabase = await getSupabaseServerClient();

  let kiosk: PosKioskOption | null = null;
  if (input.moduleKey === "sales_pos") {
    if (!normalizedKioskId) {
      throw new Error("Selecciona un kiosco.");
    }

    kiosk = await getKioskById(tenant.tenantId, normalizedKioskId);
    if (!kiosk) {
      throw new Error("El kiosco seleccionado no existe en este tenant.");
    }
  } else {
    if (!input.deviceRole) {
      throw new Error("Selecciona un rol retail.");
    }

    await assertRetailPosEnabled(tenant.tenantId);
    kiosk = await getOrCreateTechnicalRetailKiosk({
      tenantId: tenant.tenantId,
      userId: user.id,
    });
  }

  if (!kiosk) {
    throw new Error("No fue posible resolver el kiosco para el claim.");
  }

  let previousSnapshot: MutablePosDeviceSnapshot | null = null;
  if (normalizedExistingId) {
    const { data: existingDevice, error: existingDeviceError } = await supabase
      .from("pos_devices")
      .select("id, tenant_id, kiosk_id, name, status, claim_code, claim_expires_at, claimed_at, claimed_by_user_id, secret_salt, secret_hash")
      .eq("tenant_id", tenant.tenantId)
      .eq("id", normalizedExistingId)
      .limit(1)
      .maybeSingle();

    if (existingDeviceError) {
      throw new Error(`No fue posible consultar el dispositivo POS: ${existingDeviceError.message}`);
    }

    if (!existingDevice) {
      throw new Error("No existe el dispositivo solicitado para este tenant.");
    }

    previousSnapshot = existingDevice as MutablePosDeviceSnapshot;
  }

  if (normalizedExistingId) {
    const { data, error } = await supabase
      .from("pos_devices")
      .update({
        kiosk_id: kiosk.id,
        name: normalizedName,
        status: "pending",
        claim_code: claimCode,
        claim_expires_at: claimExpiresAt,
        claimed_at: null,
        claimed_by_user_id: null,
        secret_salt: pendingSeed.salt,
        secret_hash: pendingSeed.hash,
        updated_at: nowIso,
        updated_by: user.id,
      })
      .eq("tenant_id", tenant.tenantId)
      .eq("id", normalizedExistingId)
      .select("id, device_id, name, kiosk_id")
      .limit(1)
      .maybeSingle();

    if (error) {
      throw new Error(`No fue posible reemitir el claim: ${error.message}`);
    }

    if (!data) {
      throw new Error("No existe el dispositivo solicitado para este tenant.");
    }

    const currentModule = await getDeviceModuleByRecordId(tenant.tenantId, data.id);

    if (!currentModule) {
      throw new Error("No existe el dispositivo solicitado para este tenant.");
    }

    if (currentModule.moduleKey !== input.moduleKey) {
      throw new Error("La reemisión debe conservar el módulo original del dispositivo.");
    }

    if (input.moduleKey === "sales_pos") {
      await deactivateRetailSettings(data.id, tenant.tenantId);
    } else {
      try {
        await upsertRetailDeviceSettings({
          tenantId: tenant.tenantId,
          deviceRecordId: data.id,
          deviceRole: input.deviceRole!,
          userId: user.id,
          nowIso,
        });
      } catch (error) {
        await restoreDeviceSnapshot(previousSnapshot!, user.id, nowIso);
        throw error;
      }
    }

    return {
      deviceRecordId: data.id,
      deviceId: data.device_id,
      deviceName: data.name,
      moduleKey: input.moduleKey,
      deviceRole: input.moduleKey === "retail_pos" ? input.deviceRole ?? null : null,
      kioskId: data.kiosk_id,
      kioskName: getKioskLabel(kiosk),
      kioskNumber: kiosk.number,
      claimCode,
      claimExpiresAt,
    };
  }

  const { data, error } = await supabase
    .from("pos_devices")
    .insert({
      id: randomUUID(),
      tenant_id: tenant.tenantId,
      kiosk_id: kiosk.id,
      device_id: generateDeviceId(),
      name: normalizedName,
      status: "pending",
      claim_code: claimCode,
      claim_expires_at: claimExpiresAt,
      claimed_at: null,
      claimed_by_user_id: null,
      secret_salt: pendingSeed.salt,
      secret_hash: pendingSeed.hash,
      created_at: nowIso,
      updated_at: nowIso,
      created_by: user.id,
      updated_by: user.id,
    })
    .select("id, device_id, name, kiosk_id")
    .single();

  if (error) {
    throw new Error(`No fue posible crear el dispositivo POS: ${error.message}`);
  }

  if (input.moduleKey === "retail_pos") {
    try {
      await upsertRetailDeviceSettings({
        tenantId: tenant.tenantId,
        deviceRecordId: data.id,
        deviceRole: input.deviceRole!,
        userId: user.id,
        nowIso,
      });
    } catch (error) {
      await cleanupFailedNewRetailDevice(data.id, tenant.tenantId, user.id, nowIso);
      throw error;
    }
  }

  return {
    deviceRecordId: data.id,
    deviceId: data.device_id,
    deviceName: data.name,
    moduleKey: input.moduleKey,
    deviceRole: input.moduleKey === "retail_pos" ? input.deviceRole ?? null : null,
    kioskId: data.kiosk_id,
    kioskName: getKioskLabel(kiosk),
    kioskNumber: kiosk.number,
    claimCode,
    claimExpiresAt,
  };
}

export async function createKioskAction(
  _previousState: CreateKioskFormState,
  formData: FormData,
): Promise<CreateKioskFormState> {
  const tenantSlug = normalizeTenantSlug(formData.get("tenantSlug"));
  const kioskNameRaw = normalizeDeviceName(formData.get("name"));
  const kioskName = kioskNameRaw.length > 0 ? kioskNameRaw : null;
  const values = {
    name: kioskNameRaw,
  };
  const fieldErrors: CreateKioskFormState["fieldErrors"] = {};

  if (kioskName && kioskName.length > 120) {
    fieldErrors.name = "El nombre no puede exceder 120 caracteres.";
  }

  if (Object.keys(fieldErrors).length > 0) {
    return {
      ...initialCreateKioskState,
      fieldErrors,
      values,
      nextNumber: null,
    };
  }

  try {
    const access = await resolveDevicesAccess(tenantSlug);
    assertSalesPosManagementAccess(access);
    const { tenant, user } = access;
    const nowIso = new Date().toISOString();
    const supabase = await getSupabaseServerClient();
    const nextNumber = await getNextAvailableKioskNumber(tenantSlug);

    const { data, error } = await supabase
      .from("kiosks")
      .insert({
        id: randomUUID(),
        tenant_id: tenant.tenantId,
        number: nextNumber,
        name: kioskName,
        is_active: true,
        created_at: nowIso,
        updated_at: nowIso,
        created_by: user.id,
        updated_by: user.id,
      })
      .select("id, number, name")
      .limit(1)
      .maybeSingle();

    if (error) {
      if (error.message.includes("kiosks_tenant_number_unique") || error.message.includes("kiosks_tenant_number_key")) {
        return {
          ...initialCreateKioskState,
          error: "El número automático de kiosco cambió mientras guardábamos. Intenta de nuevo.",
          values,
          nextNumber: await getNextAvailableKioskNumber(tenantSlug),
        };
      }
      throw new Error(`No fue posible crear el kiosco: ${error.message}`);
    }

    if (!data) {
      throw new Error("No fue posible crear el kiosco.");
    }

    revalidateDeviceAdminPaths(tenant.tenantSlug);

    const refreshedNextNumber = await getNextAvailableKioskNumber(tenantSlug);

    return {
      ...initialCreateKioskState,
      nextNumber: refreshedNextNumber,
      result: {
        id: data.id,
        number: data.number,
        name: data.name,
      },
    };
  } catch (error) {
    return {
      ...initialCreateKioskState,
      error: error instanceof Error ? error.message : "No fue posible crear el kiosco.",
      values,
      nextNumber: null,
    };
  }
}

export async function createOrIssueClaimAction(
  _previousState: IssueClaimFormState,
  formData: FormData,
): Promise<IssueClaimFormState> {
  const tenantSlug = normalizeTenantSlug(formData.get("tenantSlug"));
  const moduleKey = normalizeModuleKey(formData.get("moduleKey"));
  const kioskId = normalizeKioskId(formData.get("kioskId"));
  const deviceName = normalizeDeviceName(formData.get("name"));
  const deviceRole = normalizeRetailDeviceRole(formData.get("deviceRole"));

  const fieldErrors: IssueClaimFormState["fieldErrors"] = {};

  if (!moduleKey) {
    fieldErrors.moduleKey = "Selecciona un módulo.";
  }

  if (moduleKey === "sales_pos" && !kioskId) {
    fieldErrors.kioskId = "Selecciona un kiosco.";
  }

  if (!deviceName) {
    fieldErrors.name = "El nombre del dispositivo es obligatorio.";
  } else if (deviceName.length > 120) {
    fieldErrors.name = "El nombre no puede exceder 120 caracteres.";
  }

  if (moduleKey === "retail_pos" && !deviceRole) {
    fieldErrors.deviceRole = "Selecciona un rol retail.";
  }

  if (Object.keys(fieldErrors).length > 0) {
    return {
      ...initialIssueClaimState,
      fieldErrors,
    };
  }

  try {
    assertModuleManagementAccess(await getDeviceManagementCapabilities(tenantSlug), moduleKey!);
    const result = await issueClaimInternal({
      tenantSlug,
      moduleKey: moduleKey!,
      kioskId: moduleKey === "sales_pos" ? kioskId : null,
      name: deviceName,
      deviceRole,
    });

    revalidateDeviceAdminPaths(tenantSlug);

    return {
      ...initialIssueClaimState,
      result,
    };
  } catch (error) {
    return {
      ...initialIssueClaimState,
      error: error instanceof Error ? error.message : "No fue posible emitir el claim.",
    };
  }
}

export async function disableDeviceAction(
  _previousState: DisableDeviceFormState,
  formData: FormData,
): Promise<DisableDeviceFormState> {
  const tenantSlug = normalizeTenantSlug(formData.get("tenantSlug"));
  const deviceRecordId = normalizeRecordId(formData.get("deviceRecordId"));
  const confirmPhrase = normalizeDeviceName(formData.get("confirmPhrase")).toUpperCase();

  if (confirmPhrase !== "DESACTIVAR") {
    return {
      ...initialDisableState,
      error: "Escribe DESACTIVAR para confirmar.",
    };
  }

  try {
    const access = await resolveDevicesAccess(tenantSlug);
    const deviceModule = await getDeviceModuleByRecordId(access.tenant.tenantId, deviceRecordId);

    if (!deviceModule) {
      throw new Error("No existe el dispositivo solicitado para este tenant.");
    }

    assertModuleManagementAccess(access, deviceModule.moduleKey);
    const { tenant, user } = access;
    const nowIso = new Date().toISOString();
    const supabase = await getSupabaseServerClient();

    const { error } = await supabase
      .from("pos_devices")
      .update({
        status: "disabled",
        claim_code: null,
        claim_expires_at: null,
        updated_at: nowIso,
        updated_by: user.id,
      })
      .eq("tenant_id", tenant.tenantId)
      .eq("id", deviceRecordId);

    if (error) {
      throw new Error(`No fue posible desactivar el dispositivo: ${error.message}`);
    }

    revalidateDeviceAdminPaths(tenant.tenantSlug, deviceRecordId);

    return {
      ...initialDisableState,
      done: true,
    };
  } catch (error) {
    return {
      ...initialDisableState,
      error: error instanceof Error ? error.message : "No fue posible desactivar el dispositivo.",
    };
  }
}

export async function reissueClaimAction(
  _previousState: IssueClaimFormState,
  formData: FormData,
): Promise<IssueClaimFormState> {
  const tenantSlug = normalizeTenantSlug(formData.get("tenantSlug"));
  const moduleKey = normalizeModuleKey(formData.get("moduleKey"));
  const kioskId = normalizeKioskId(formData.get("kioskId"));
  const deviceName = normalizeDeviceName(formData.get("name"));
  const deviceRole = normalizeRetailDeviceRole(formData.get("deviceRole"));
  const deviceRecordId = normalizeOptionalDeviceId(formData.get("deviceRecordId"));
  const confirmPhrase = normalizeDeviceName(formData.get("confirmPhrase")).toUpperCase();

  const fieldErrors: IssueClaimFormState["fieldErrors"] = {};
  let effectiveModuleKey: DeviceModuleKey | null = moduleKey;

  if (!deviceRecordId) {
    fieldErrors.deviceId = "No se identificó el dispositivo a actualizar.";
  }

  if (!deviceName) {
    fieldErrors.name = "El nombre del dispositivo es obligatorio.";
  } else if (deviceName.length > 120) {
    fieldErrors.name = "El nombre no puede exceder 120 caracteres.";
  }

  if (confirmPhrase !== "RECLAMAR") {
    fieldErrors.confirmPhrase = "Escribe RECLAMAR para confirmar.";
  }

  if (deviceRecordId) {
    try {
      const access = await resolveDevicesAccess(tenantSlug);
      const currentModule = await getDeviceModuleByRecordId(access.tenant.tenantId, deviceRecordId);

      if (!currentModule) {
        fieldErrors.deviceId = "No existe el dispositivo solicitado para este tenant.";
      } else {
        effectiveModuleKey = currentModule.moduleKey;
        assertModuleManagementAccess(access, currentModule.moduleKey);

        if (moduleKey && moduleKey !== currentModule.moduleKey) {
          fieldErrors.moduleKey = "La reemisión debe conservar el módulo original del dispositivo.";
        }

        if (currentModule.moduleKey === "sales_pos" && !kioskId) {
          fieldErrors.kioskId = "Selecciona un kiosco.";
        }

        if (currentModule.moduleKey === "retail_pos" && !deviceRole) {
          fieldErrors.deviceRole = "Selecciona un rol retail.";
        }
      }
    } catch (error) {
      return {
        ...initialIssueClaimState,
        error: error instanceof Error ? error.message : "No fue posible validar permisos para reemitir el claim.",
      };
    }
  }

  if (Object.keys(fieldErrors).length > 0) {
    return {
      ...initialIssueClaimState,
      fieldErrors,
    };
  }

  try {
    const result = await issueClaimInternal({
      tenantSlug,
      moduleKey: effectiveModuleKey!,
      kioskId: effectiveModuleKey === "sales_pos" ? kioskId : null,
      name: deviceName,
      deviceRole: effectiveModuleKey === "retail_pos" ? deviceRole : null,
      existingDeviceRecordId: deviceRecordId,
    });

    revalidateDeviceAdminPaths(tenantSlug, deviceRecordId);

    return {
      ...initialIssueClaimState,
      result,
    };
  } catch (error) {
    return {
      ...initialIssueClaimState,
      error: error instanceof Error ? error.message : "No fue posible reemitir el claim.",
    };
  }
}
