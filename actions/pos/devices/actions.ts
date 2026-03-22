"use server";

import { randomBytes, randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { resolveSalesPosPageActor } from "@/lib/auth/module-page-access";
import { hashPosDeviceSecret } from "@/lib/pos/device-auth";
import { getSupabaseServerClient } from "@/lib/supabase/server";

const CLAIM_TTL_MINUTES = 15;

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

export type PosDeviceListItem = {
  id: string;
  kioskId: string;
  deviceId: string;
  name: string;
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
    kioskId?: string;
    name?: string;
    deviceId?: string;
    confirmPhrase?: string;
  };
  result: {
    deviceRecordId: string;
    deviceId: string;
    deviceName: string;
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

function toDeviceListItem(
  row: PosDeviceRow,
  kiosksById: Map<string, { id: string; number: number; name: string | null; is_active: boolean }>,
): PosDeviceListItem {
  return {
    id: row.id,
    kioskId: row.kiosk_id,
    deviceId: row.device_id,
    name: row.name,
    status: row.status,
    claimCode: row.claim_code,
    claimExpiresAt: row.claim_expires_at,
    claimedAt: row.claimed_at,
    lastSeenAt: row.last_seen_at,
    lastSyncAt: row.last_sync_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    kiosk: getKioskByMap(row.kiosk_id, kiosksById),
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

function plusClaimTtlIso(nowIso: string): string {
  const now = new Date(nowIso);
  now.setMinutes(now.getMinutes() + CLAIM_TTL_MINUTES);
  return now.toISOString();
}

async function resolveDevicesAccess(tenantSlug: string) {
  return resolveSalesPosPageActor(tenantSlug, "devices", "manage");
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

export async function listKiosksForDevices(tenantSlug: string): Promise<PosKioskOption[]> {
  const normalizedTenantSlug = normalizeTenantSlug(tenantSlug);
  const { tenant } = await resolveDevicesAccess(normalizedTenantSlug);

  const supabase = await getSupabaseServerClient();
  const { data, error } = await supabase
    .from("kiosks")
    .select("id, number, name, is_active")
    .eq("tenant_id", tenant.tenantId)
    .order("number", { ascending: true });

  if (error) {
    throw new Error(`No fue posible listar kioscos: ${error.message}`);
  }

  return (data ?? []) as PosKioskOption[];
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

export async function getNextAvailableKioskNumber(tenantSlug: string): Promise<number> {
  const normalizedTenantSlug = normalizeTenantSlug(tenantSlug);
  const { tenant } = await resolveDevicesAccess(normalizedTenantSlug);

  const supabase = await getSupabaseServerClient();
  const { data, error } = await supabase
    .from("kiosks")
    .select("number")
    .eq("tenant_id", tenant.tenantId)
    .order("number", { ascending: true });

  if (error) {
    throw new Error(`No fue posible calcular el próximo número de kiosco: ${error.message}`);
  }

  return computeNextAvailableKioskNumber(
    (data ?? []).map((row) => Number((row as { number: unknown }).number)).filter((value) => Number.isInteger(value)),
  );
}

export async function listDevices(tenantSlug: string): Promise<PosDeviceListItem[]> {
  const normalizedTenantSlug = normalizeTenantSlug(tenantSlug);
  const { tenant } = await resolveDevicesAccess(normalizedTenantSlug);

  const supabase = await getSupabaseServerClient();
  const { data, error } = await supabase
    .from("pos_devices")
    .select(
      "id, tenant_id, kiosk_id, device_id, name, status, claim_code, claim_expires_at, claimed_at, last_seen_at, last_sync_at, created_at, updated_at",
    )
    .eq("tenant_id", tenant.tenantId)
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
    .eq("tenant_id", tenant.tenantId)
    .in("id", kioskIds);

  if (kiosksError) {
    throw new Error(`No fue posible resolver kioscos POS: ${kiosksError.message}`);
  }

  const kiosksById = new Map(
    ((kiosks ?? []) as PosKioskOption[]).map((kiosk) => [kiosk.id, kiosk] as const),
  );

  return rows.map((row) => toDeviceListItem(row, kiosksById));
}

export async function getDeviceById(
  tenantSlug: string,
  deviceRecordId: string,
): Promise<PosDeviceListItem | null> {
  const normalizedTenantSlug = normalizeTenantSlug(tenantSlug);
  const normalizedRecordId = normalizeRecordId(deviceRecordId);
  const { tenant } = await resolveDevicesAccess(normalizedTenantSlug);

  const supabase = await getSupabaseServerClient();
  const { data, error } = await supabase
    .from("pos_devices")
    .select(
      "id, tenant_id, kiosk_id, device_id, name, status, claim_code, claim_expires_at, claimed_at, last_seen_at, last_sync_at, created_at, updated_at",
    )
    .eq("tenant_id", tenant.tenantId)
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
    .eq("tenant_id", tenant.tenantId)
    .eq("id", (data as PosDeviceRow).kiosk_id)
    .limit(1)
    .maybeSingle();

  if (kioskError) {
    throw new Error(`No fue posible resolver el kiosco del dispositivo POS: ${kioskError.message}`);
  }

  const kiosksById = new Map<string, PosKioskOption>();
  if (kiosk) {
    kiosksById.set(kiosk.id, kiosk as PosKioskOption);
  }
  return toDeviceListItem(data as PosDeviceRow, kiosksById);
}

async function issueClaimInternal(input: {
  tenantSlug: string;
  kioskId: string;
  name: string;
  existingDeviceRecordId?: string | null;
}) {
  const normalizedTenantSlug = normalizeTenantSlug(input.tenantSlug);
  const normalizedKioskId = normalizeKioskId(input.kioskId);
  const normalizedName = normalizeDeviceName(input.name);
  const normalizedExistingId = input.existingDeviceRecordId
    ? normalizeRecordId(input.existingDeviceRecordId)
    : null;

  if (!normalizedTenantSlug) {
    throw new Error("Tenant inválido.");
  }

  if (!normalizedKioskId) {
    throw new Error("Selecciona un kiosco.");
  }

  if (!normalizedName) {
    throw new Error("El nombre del dispositivo es obligatorio.");
  }

  const { tenant, user } = await resolveDevicesAccess(normalizedTenantSlug);
  const kiosk = await getKioskById(tenant.tenantId, normalizedKioskId);

  if (!kiosk) {
    throw new Error("El kiosco seleccionado no existe en este tenant.");
  }

  const claimCode = generateClaimCode();
  const nowIso = new Date().toISOString();
  const claimExpiresAt = plusClaimTtlIso(nowIso);
  const pendingSeed = createPendingCredentialSeed();
  const supabase = await getSupabaseServerClient();

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

    return {
      deviceRecordId: data.id,
      deviceId: data.device_id,
      deviceName: data.name,
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

  return {
    deviceRecordId: data.id,
    deviceId: data.device_id,
    deviceName: data.name,
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
    const { tenant, user } = await resolveDevicesAccess(tenantSlug);
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

    revalidatePath(`/${tenant.tenantSlug}/pos/devices`);
    revalidatePath(`/${tenant.tenantSlug}/pos/devices/new`);

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
  const kioskId = normalizeKioskId(formData.get("kioskId"));
  const deviceName = normalizeDeviceName(formData.get("name"));

  const fieldErrors: IssueClaimFormState["fieldErrors"] = {};

  if (!kioskId) {
    fieldErrors.kioskId = "Selecciona un kiosco.";
  }

  if (!deviceName) {
    fieldErrors.name = "El nombre del dispositivo es obligatorio.";
  } else if (deviceName.length > 120) {
    fieldErrors.name = "El nombre no puede exceder 120 caracteres.";
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
      kioskId,
      name: deviceName,
    });

    revalidatePath(`/${tenantSlug}/pos/devices`);
    revalidatePath(`/${tenantSlug}/pos/devices/new`);

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
    const { tenant, user } = await resolveDevicesAccess(tenantSlug);
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

    revalidatePath(`/${tenant.tenantSlug}/pos/devices`);
    revalidatePath(`/${tenant.tenantSlug}/pos/devices/${deviceRecordId}`);

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
  const kioskId = normalizeKioskId(formData.get("kioskId"));
  const deviceName = normalizeDeviceName(formData.get("name"));
  const deviceRecordId = normalizeOptionalDeviceId(formData.get("deviceRecordId"));
  const confirmPhrase = normalizeDeviceName(formData.get("confirmPhrase")).toUpperCase();

  const fieldErrors: IssueClaimFormState["fieldErrors"] = {};

  if (!deviceRecordId) {
    fieldErrors.deviceId = "No se identificó el dispositivo a actualizar.";
  }

  if (!kioskId) {
    fieldErrors.kioskId = "Selecciona un kiosco.";
  }

  if (!deviceName) {
    fieldErrors.name = "El nombre del dispositivo es obligatorio.";
  }

  if (confirmPhrase !== "RECLAMAR") {
    fieldErrors.confirmPhrase = "Escribe RECLAMAR para confirmar.";
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
      kioskId,
      name: deviceName,
      existingDeviceRecordId: deviceRecordId,
    });

    revalidatePath(`/${tenantSlug}/pos/devices`);
    revalidatePath(`/${tenantSlug}/pos/devices/${deviceRecordId}`);

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
