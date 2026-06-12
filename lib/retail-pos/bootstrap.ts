import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import type {
  RetailPosAuthLease,
  RetailPosBootstrapResponse,
  RetailPosCapability,
  RetailPosCashShift,
  RetailPosCashierState,
  RetailPosCatalogDeviceSettings,
  RetailPosDeviceRole,
} from "@/shared/types/retail-pos";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { resolveRetailPosTenant } from "./auth";
import { getOpenRetailPosCashShiftForDevice } from "./cash-shifts";
import { RetailPosRuntimeError } from "./errors";
import type { RuntimePerfTrace } from "./runtime-perf";
import { runSupabaseReadWithRetry } from "./runtime-supabase-retry";

type BootstrapDeviceRow = {
  id: string;
  tenant_id: string;
  kiosk_id: string | null;
  device_id: string;
  name: string;
  status: string;
  secret_salt: string;
  secret_hash: string;
  updated_at: string;
};

type BootstrapKioskRow = {
  id: string;
  tenant_id: string;
  number: number | null;
  name: string | null;
  is_active: boolean;
  updated_at: string | null;
};

type BootstrapPosUserRow = {
  id: string;
  name: string;
  role: "cashier" | "supervisor" | "admin";
  is_active: boolean;
};

type BootstrapDeviceSettingsRow = RetailPosCatalogDeviceSettings;

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

function assertSupportedDeviceRole(
  deviceRole: string,
): asserts deviceRole is RetailPosDeviceRole {
  if (deviceRole !== "order_station" && deviceRole !== "cashier_station") {
    throw new RetailPosRuntimeError(403, "POS device role is not supported for retail_pos bootstrap.");
  }
}

function buildCapabilities(deviceRole: RetailPosDeviceRole): RetailPosCapability[] {
  if (deviceRole === "cashier_station") {
    return [
      "catalog.read",
      "orders.lookup",
      "cashier.status.read",
      "cashier.shift.open",
      "cashier.shift.close",
      "payments.collect",
      "tickets.print.payment",
    ];
  }

  return [
    "catalog.read",
    "catalog.assign_barcode",
    "catalog.quick_create",
    "orders.create",
    "orders.sync",
    "orders.lookup",
    "orders.cancel",
    "tickets.print.order",
  ];
}

function buildConfigVersion(input: {
  tenantId: string;
  device: BootstrapDeviceRow;
  settings: BootstrapDeviceSettingsRow;
  kiosk: BootstrapKioskRow | null;
}) {
  const payload = JSON.stringify({
    tenant_id: input.tenantId,
    device: {
      id: input.device.id,
      device_id: input.device.device_id,
      kiosk_id: input.device.kiosk_id,
      name: input.device.name,
      status: input.device.status,
      updated_at: input.device.updated_at,
    },
    settings: {
      device_role: input.settings.device_role,
      printer_name: input.settings.printer_name,
      printer_driver: input.settings.printer_driver,
      auto_print_order_ticket: input.settings.auto_print_order_ticket,
      auto_print_payment_ticket: input.settings.auto_print_payment_ticket,
      scanner_enabled: input.settings.scanner_enabled,
      is_active: input.settings.is_active,
      updated_at: input.settings.updated_at,
    },
    kiosk: input.kiosk
      ? {
          id: input.kiosk.id,
          number: input.kiosk.number,
          name: input.kiosk.name,
          is_active: input.kiosk.is_active,
          updated_at: input.kiosk.updated_at,
        }
      : null,
  });

  return `rpb_${createHash("sha256").update(payload).digest("hex").slice(0, 24)}`;
}

function getLeaseSigningSecret() {
  return (
    process.env.RETAIL_POS_RUNTIME_LEASE_SECRET?.trim() ||
    process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() ||
    "retail-pos-bootstrap-lease-dev-secret"
  );
}

function buildAuthLease(input: {
  tenantId: string;
  deviceRecordId: string;
  devicePublicId: string;
  configVersion: string;
  issuedAt: string;
}): RetailPosAuthLease {
  const issuedAtDate = new Date(input.issuedAt);
  const refreshAfterDate = new Date(issuedAtDate);
  const expiresAtDate = new Date(issuedAtDate);

  // Fase inicial: refresh suave a 15 minutos y expiración a 60 minutos.
  refreshAfterDate.setMinutes(refreshAfterDate.getMinutes() + 15);
  expiresAtDate.setMinutes(expiresAtDate.getMinutes() + 60);

  const refreshAfter = refreshAfterDate.toISOString();
  const expiresAt = expiresAtDate.toISOString();
  const tokenPayload = JSON.stringify({
    tenant_id: input.tenantId,
    device_record_id: input.deviceRecordId,
    device_id: input.devicePublicId,
    config_version: input.configVersion,
    issued_at: input.issuedAt,
    refresh_after: refreshAfter,
    expires_at: expiresAt,
  });
  const leaseToken = `rpl_v1_${createHmac("sha256", getLeaseSigningSecret()).update(tokenPayload).digest("base64url")}`;

  return {
    lease_token: leaseToken,
    issued_at: input.issuedAt,
    refresh_after: refreshAfter,
    expires_at: expiresAt,
    config_version: input.configVersion,
  };
}

function buildCashRegisterSummary(input: {
  deviceRole: RetailPosDeviceRole;
  kiosk: BootstrapKioskRow | null;
  device: BootstrapDeviceRow;
}) {
  if (input.deviceRole !== "cashier_station" || !input.kiosk) {
    return null;
  }

  return {
    id: `kiosk:${input.kiosk.id}`,
    name:
      input.kiosk.name?.trim() ||
      (typeof input.kiosk.number === "number" ? `Caja ${input.kiosk.number}` : input.device.name),
    status: input.kiosk.is_active ? "active" : "inactive",
  } satisfies RetailPosBootstrapResponse["cash_register"];
}

function buildCashierState(input: {
  serverTime: string;
  device: BootstrapDeviceRow;
  deviceRole: RetailPosDeviceRole;
  currentShift: RetailPosCashShift | null;
  operator: BootstrapPosUserRow | null;
}): RetailPosCashierState | null {
  if (input.deviceRole !== "cashier_station") {
    return null;
  }

  const warnings: string[] = [];
  let mode: RetailPosCashierState["mode"] = "ready";
  let statusMessage = "Listo para cobrar.";

  if (!input.currentShift) {
    warnings.push("No hay turno abierto para esta terminal.");
    mode = "shift_required";
    statusMessage = "Se requiere abrir turno antes de cobrar.";
  } else if (input.currentShift.status !== "open") {
    warnings.push("El turno actual no está abierto.");
    mode = "blocked";
    statusMessage = "La terminal no puede cobrar hasta recuperar un turno abierto.";
  }

  return {
    device_id: input.device.device_id,
    device_role: input.deviceRole,
    current_cash_shift_id: input.currentShift?.id ?? null,
    current_cash_shift_status: input.currentShift?.status ?? null,
    mode,
    operator_id: input.operator?.id ?? input.currentShift?.opened_by_pos_user_id ?? null,
    operator_name: input.operator?.name ?? null,
    can_collect_payments: input.currentShift?.status === "open",
    shift_required: true,
    shift_open_required: input.currentShift?.status !== "open",
    status_message: statusMessage,
    warnings,
    updated_at: input.serverTime,
  };
}

async function loadBootstrapDevice(input: {
  tenantId: string;
  deviceId: string;
  trace?: RuntimePerfTrace;
}) {
  const supabase = getSupabaseAdminClient({ trace: input.trace });
  const { data, error } = await runSupabaseReadWithRetry<BootstrapDeviceRow>({
    trace: input.trace,
    step: "bootstrap_device",
    query: (signal) =>
      supabase
        .from("pos_devices")
        .select("id, tenant_id, kiosk_id, device_id, name, status, secret_salt, secret_hash, updated_at")
        .abortSignal(signal)
        .eq("tenant_id", input.tenantId)
        .eq("device_id", input.deviceId)
        .limit(1)
        .maybeSingle<BootstrapDeviceRow>(),
  });

  if (error) {
    throw new RetailPosRuntimeError(500, `Unable to resolve POS device: ${error.message}`);
  }

  if (!data) {
    throw new RetailPosRuntimeError(401, "Invalid POS device credentials.");
  }

  return data;
}

async function loadBootstrapDeviceSettings(input: {
  tenantId: string;
  deviceRecordId: string;
  trace?: RuntimePerfTrace;
}) {
  const supabase = getSupabaseAdminClient({ trace: input.trace });
  const { data, error } = await runSupabaseReadWithRetry<BootstrapDeviceSettingsRow>({
    trace: input.trace,
    step: "bootstrap_device_settings",
    query: (signal) =>
      supabase
        .from("retail_pos_device_settings")
        .select(
          "device_id, tenant_id, device_role, printer_name, printer_driver, auto_print_order_ticket, auto_print_payment_ticket, scanner_enabled, is_active, updated_at",
        )
        .abortSignal(signal)
        .eq("tenant_id", input.tenantId)
        .eq("device_id", input.deviceRecordId)
        .limit(1)
        .maybeSingle<BootstrapDeviceSettingsRow>(),
  });

  if (error) {
    throw new RetailPosRuntimeError(500, `Unable to resolve retail_pos device settings: ${error.message}`);
  }

  if (!data) {
    throw new RetailPosRuntimeError(403, "retail_pos device settings are required for this device.");
  }

  if (!data.is_active) {
    throw new RetailPosRuntimeError(403, "retail_pos device settings are inactive for this device.");
  }

  assertSupportedDeviceRole(data.device_role);

  return data;
}

async function loadBootstrapKiosk(input: {
  tenantId: string;
  kioskId: string | null;
  trace?: RuntimePerfTrace;
}) {
  if (!input.kioskId) {
    return null;
  }

  const supabase = getSupabaseAdminClient({ trace: input.trace });
  const { data, error } = await runSupabaseReadWithRetry<BootstrapKioskRow>({
    trace: input.trace,
    step: "bootstrap_kiosk",
    query: (signal) =>
      supabase
        .from("kiosks")
        .select("id, tenant_id, number, name, is_active, updated_at")
        .abortSignal(signal)
        .eq("tenant_id", input.tenantId)
        .eq("id", input.kioskId)
        .limit(1)
        .maybeSingle<BootstrapKioskRow>(),
  });

  if (error) {
    throw new RetailPosRuntimeError(500, `Unable to resolve kiosk for POS device: ${error.message}`);
  }

  if (!data) {
    throw new RetailPosRuntimeError(403, "POS device kiosk assignment is not available for this tenant.");
  }

  if (!data.is_active) {
    throw new RetailPosRuntimeError(403, "POS device kiosk is inactive.");
  }

  return data;
}

async function loadShiftOperator(input: {
  tenantId: string;
  posUserId: string | null;
  trace?: RuntimePerfTrace;
}) {
  if (!input.posUserId) {
    return null;
  }

  const supabase = getSupabaseAdminClient({ trace: input.trace });
  const { data, error } = await runSupabaseReadWithRetry<BootstrapPosUserRow>({
    trace: input.trace,
    step: "bootstrap_shift_operator",
    query: (signal) =>
      supabase
        .from("pos_users")
        .select("id, name, role, is_active")
        .abortSignal(signal)
        .eq("tenant_id", input.tenantId)
        .eq("id", input.posUserId)
        .limit(1)
        .maybeSingle<BootstrapPosUserRow>(),
  });

  if (error) {
    throw new RetailPosRuntimeError(500, `Unable to resolve POS operator: ${error.message}`);
  }

  if (!data || !data.is_active) {
    return null;
  }

  return data;
}

export async function getRetailPosBootstrap(input: {
  tenantSlug: string;
  deviceId: string;
  deviceSecret: string;
  trace?: RuntimePerfTrace;
}): Promise<RetailPosBootstrapResponse> {
  const normalizedDeviceId = normalizeOptionalValue(input.deviceId);
  const normalizedDeviceSecret = normalizeOptionalValue(input.deviceSecret);

  if (!normalizedDeviceId || !normalizedDeviceSecret) {
    throw new RetailPosRuntimeError(400, "deviceId and deviceSecret are required.");
  }

  const tenant = await resolveRetailPosTenant(input.tenantSlug, input.trace);
  const device = await loadBootstrapDevice({
    tenantId: tenant.id,
    deviceId: normalizedDeviceId,
    trace: input.trace,
  });

  if (device.status !== "active") {
    throw new RetailPosRuntimeError(403, "POS device is inactive or revoked.");
  }

  const computedHash = hashDeviceSecret(normalizedDeviceSecret, device.secret_salt);
  if (!timingSafeSecretEquals(device.secret_hash, computedHash)) {
    throw new RetailPosRuntimeError(401, "Invalid POS device credentials.");
  }

  const settings = await loadBootstrapDeviceSettings({
    tenantId: tenant.id,
    deviceRecordId: device.id,
    trace: input.trace,
  });
  const kiosk = await loadBootstrapKiosk({
    tenantId: tenant.id,
    kioskId: device.kiosk_id,
    trace: input.trace,
  });
  const currentShift =
    settings.device_role === "cashier_station"
      ? await getOpenRetailPosCashShiftForDevice({
          tenantId: tenant.id,
          deviceRecordId: device.id,
          trace: input.trace,
        })
      : null;
  const operator = await loadShiftOperator({
    tenantId: tenant.id,
    posUserId: currentShift?.opened_by_pos_user_id ?? null,
    trace: input.trace,
  });

  const serverTime = new Date().toISOString();
  const configVersion = buildConfigVersion({
    tenantId: tenant.id,
    device,
    settings,
    kiosk,
  });
  const authLease = buildAuthLease({
    tenantId: tenant.id,
    deviceRecordId: device.id,
    devicePublicId: device.device_id,
    configVersion,
    issuedAt: serverTime,
  });
  const capabilities = buildCapabilities(settings.device_role);
  const cashierState = buildCashierState({
    serverTime,
    device,
    deviceRole: settings.device_role,
    currentShift,
    operator,
  });

  return {
    tenant: {
      id: tenant.id,
      slug: tenant.slug,
      name: tenant.name,
      status: tenant.status,
    },
    device: {
      device_record_id: device.id,
      device_id: device.device_id,
      name: device.name,
      status: device.status,
      kiosk_id: device.kiosk_id,
    },
    device_role: settings.device_role,
    station: kiosk
      ? {
          id: kiosk.id,
          number: kiosk.number,
          name: kiosk.name,
        }
      : null,
    cash_register: buildCashRegisterSummary({
      deviceRole: settings.device_role,
      kiosk,
      device,
    }),
    current_shift: currentShift,
    cashier_state: cashierState,
    capabilities,
    auth_lease: authLease,
    config_version: configVersion,
    server_time: serverTime,
  };
}
