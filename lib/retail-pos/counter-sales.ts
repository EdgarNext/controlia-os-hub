import type {
  RetailPosCounterSaleCompletedCommand,
  RetailPosCounterSaleCompletedCommandResult,
  RetailPosCounterSaleCompletedV1,
  RetailPosCounterSaleSyncResult,
} from "@/shared/types/retail-pos";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { resolveRetailPosRuntimeActor } from "./auth";
import { RetailPosRuntimeError } from "./errors";
import type { RuntimePerfTrace } from "./runtime-perf";

type CounterSaleRpcResult = RetailPosCounterSaleCompletedCommandResult;

const SAFE_CONFLICT_MESSAGES = new Set([
  "IDEMPOTENCY_PAYLOAD_CONFLICT",
  "LOCAL_SALE_PAYLOAD_CONFLICT",
  "COUNTER_SALE_CANONICAL_IDENTITY_CONFLICT",
  "COUNTER_SALE_PAYMENT_ID_CONFLICT",
  "COUNTER_SALE_ORIGIN_LOCAL_FOLIO_CONFLICT",
  "COUNTER_SALE_REMOTE_FOLIO_CONFLICT",
  "COUNTER_SALE_OPEN_SHIFT_CONFLICT",
]);

const SAFE_VALIDATION_MESSAGES = new Set([
  "UNSUPPORTED_SCHEMA_VERSION",
  "INVALID_COUNTER_SALE_IDENTITY",
  "COUNTER_SALE_TENANT_MISMATCH",
  "COUNTER_SALE_DEVICE_MISMATCH",
  "COUNTER_STATION_REQUIRED",
  "COUNTER_STATION_REQUIRES_KIOSK",
  "COUNTER_SALE_REQUIRES_LINES",
  "COUNTER_SALE_INVALID_TOTALS",
  "COUNTER_SALE_DISCOUNTS_NOT_SUPPORTED",
  "COUNTER_SALE_PAYMENT_MUST_EQUAL_TOTAL",
  "COUNTER_SALE_INVALID_PAYMENT_METHOD",
  "COUNTER_SALE_INVALID_CASH_PAYMENT",
  "COUNTER_SALE_INVALID_CHANGE",
  "COUNTER_SALE_CARD_NOT_CONFIRMED",
  "COUNTER_SALE_CARD_REFERENCE_REQUIRED",
  "COUNTER_SALE_OPERATOR_INVALID",
  "COUNTER_SALE_LINE_DISCOUNTS_NOT_SUPPORTED",
  "COUNTER_SALE_LINE_TOTAL_INVALID",
  "COUNTER_SALE_TOTAL_MISMATCH",
  "COUNTER_SALE_COMPUTED_TOTAL_MISMATCH",
]);

function asTrimmedString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function mapCounterSaleSyncError(error: { message?: string } | null): RetailPosRuntimeError {
  const message = error?.message ?? "Unexpected counter sale sync error.";

  if ([...SAFE_CONFLICT_MESSAGES].some((candidate) => message.includes(candidate))) {
    return new RetailPosRuntimeError(409, message);
  }

  if (message.includes("COUNTER_STATION_REQUIRED")) {
    return new RetailPosRuntimeError(403, "counter_station is required for counter sale sync.");
  }

  if ([...SAFE_VALIDATION_MESSAGES].some((candidate) => message.includes(candidate))) {
    return new RetailPosRuntimeError(400, message);
  }

  return new RetailPosRuntimeError(500, "Unexpected counter sale sync error.");
}

function assertCounterSalePayload(value: unknown): RetailPosCounterSaleCompletedV1 {
  if (!value || typeof value !== "object") {
    throw new RetailPosRuntimeError(400, "payload is required.");
  }

  const payload = value as Partial<RetailPosCounterSaleCompletedV1>;
  if (payload.schema_version !== 1) {
    throw new RetailPosRuntimeError(400, "schema_version is not supported.");
  }

  if (
    !asTrimmedString(payload.command_id) ||
    !asTrimmedString(payload.local_sale_id) ||
    !asTrimmedString(payload.origin_local_folio) ||
    !asTrimmedString(payload.created_by_pos_user_id)
  ) {
    throw new RetailPosRuntimeError(
      400,
      "command_id, local_sale_id, origin_local_folio and created_by_pos_user_id are required.",
    );
  }

  if (!payload.shift || !asTrimmedString(payload.shift.local_shift_id)) {
    throw new RetailPosRuntimeError(400, "shift.local_shift_id is required.");
  }

  if (!payload.payment || !asTrimmedString(payload.payment.local_payment_id)) {
    throw new RetailPosRuntimeError(400, "payment.local_payment_id is required.");
  }

  if (!Array.isArray(payload.lines) || payload.lines.length === 0) {
    throw new RetailPosRuntimeError(400, "lines are required.");
  }

  return payload as RetailPosCounterSaleCompletedV1;
}

export async function syncRetailPosCounterSaleCompletedCommand(input: {
  tenantSlug: string;
  command: RetailPosCounterSaleCompletedCommand;
  deviceId?: string | null;
  deviceSecret?: string | null;
  trace?: RuntimePerfTrace;
}): Promise<RetailPosCounterSaleCompletedCommandResult> {
  const actor = await resolveRetailPosRuntimeActor({
    tenantSlug: input.tenantSlug,
    deviceId: input.deviceId,
    deviceSecret: input.deviceSecret,
    trace: input.trace,
  });

  if (actor.mode !== "device" || !actor.deviceRecordId || !actor.devicePublicId) {
    throw new RetailPosRuntimeError(401, "device auth is required for counter sale sync.");
  }

  if (actor.deviceRole !== "counter_station") {
    throw new RetailPosRuntimeError(403, "counter_station is required for counter sale sync.");
  }

  // Capabilities are derived from device role during retail_pos bootstrap.
  // Until there is persisted server-side capability state, the effective
  // authorization guard for counter_sale.sync remains the authenticated role.

  if (input.command.command_type !== "create_paid_counter_sale") {
    throw new RetailPosRuntimeError(400, "command_type must be create_paid_counter_sale.");
  }

  const payload = assertCounterSalePayload(input.command.payload);
  if (payload.command_id !== input.command.command_id) {
    throw new RetailPosRuntimeError(400, "payload.command_id must match command_id.");
  }

  if (payload.tenant_id !== actor.tenantId) {
    throw new RetailPosRuntimeError(409, "payload tenant_id does not match authenticated device.");
  }

  if (payload.device_id !== actor.deviceRecordId) {
    throw new RetailPosRuntimeError(409, "payload device_id does not match authenticated device.");
  }

  if (input.command.device_id !== actor.deviceRecordId) {
    throw new RetailPosRuntimeError(409, "command device_id does not match authenticated device.");
  }

  const supabase = getSupabaseAdminClient({ trace: input.trace });
  const { data, error } = await supabase.rpc("retail_pos_sync_counter_sale_completed_v1", {
    p_tenant_id: actor.tenantId,
    p_device_id: actor.deviceRecordId,
    p_remote_cash_shift_id: input.command.cash_shift_id ?? null,
    p_payload: payload,
  });

  if (error) {
    throw mapCounterSaleSyncError(error);
  }

  if (!data || typeof data !== "object") {
    throw new RetailPosRuntimeError(500, "counter sale sync RPC returned an invalid payload.");
  }

  const result = data as CounterSaleRpcResult;
  const remote = result.result as RetailPosCounterSaleSyncResult;
  if (
    !remote ||
    !asTrimmedString(remote.remote_sale_id) ||
    !asTrimmedString(remote.remote_payment_id) ||
    !asTrimmedString(remote.remote_shift_id)
  ) {
    throw new RetailPosRuntimeError(500, "counter sale sync RPC returned incomplete remote IDs.");
  }

  return result;
}
