import type {
  RetailPosCommandResult,
  RetailPosCommandType,
} from "@/shared/types/retail-pos";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { RetailPosRuntimeError } from "./errors";

type RetailPosCommandLogStatus =
  | "processing"
  | "completed"
  | "rejected"
  | "retryable_error";

type RetailPosCommandLogRow = {
  id: string;
  tenant_id: string;
  command_id: string;
  command_type: RetailPosCommandType;
  device_id: string;
  pos_user_id: string | null;
  cash_shift_id: string | null;
  order_id: string | null;
  request_payload: unknown;
  response_payload: unknown;
  status: RetailPosCommandLogStatus;
  error_code: string | null;
  error_message: string | null;
  created_at: string;
  updated_at: string;
};

type BeginRetailPosCommandInput = {
  tenantId: string;
  commandId: string;
  commandType: RetailPosCommandType;
  deviceId: string;
  posUserId: string | null;
  cashShiftId: string | null;
  orderId: string | null;
  requestPayload: Record<string, unknown>;
};

type BeginRetailPosCommandResult<TResult> =
  | { kind: "started" }
  | { kind: "replay"; result: RetailPosCommandResult<TResult> };

function isUniqueViolation(
  error: { code?: string; message?: string } | null,
  constraint?: string,
) {
  if (!error || error.code !== "23505") {
    return false;
  }

  return constraint ? Boolean(error.message?.includes(constraint)) : true;
}

async function loadRetailPosCommandLog(input: {
  tenantId: string;
  commandId: string;
}): Promise<RetailPosCommandLogRow | null> {
  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .from("retail_pos_command_log")
    .select(
      "id, tenant_id, command_id, command_type, device_id, pos_user_id, cash_shift_id, order_id, request_payload, response_payload, status, error_code, error_message, created_at, updated_at",
    )
    .eq("tenant_id", input.tenantId)
    .eq("command_id", input.commandId)
    .limit(1)
    .maybeSingle<RetailPosCommandLogRow>();

  if (error) {
    throw new RetailPosRuntimeError(
      500,
      `Unable to load retail_pos command log: ${error.message}`,
    );
  }

  return data ?? null;
}

async function updateRetailPosCommandLogStatus(input: {
  tenantId: string;
  commandId: string;
  status: RetailPosCommandLogStatus;
  responsePayload?: Record<string, unknown> | null;
  errorCode?: string | null;
  errorMessage?: string | null;
}): Promise<void> {
  const supabase = getSupabaseAdminClient();
  const { error } = await supabase
    .from("retail_pos_command_log")
    .update({
      status: input.status,
      response_payload:
        typeof input.responsePayload === "undefined"
          ? undefined
          : input.responsePayload,
      error_code:
        typeof input.errorCode === "undefined" ? undefined : input.errorCode,
      error_message:
        typeof input.errorMessage === "undefined"
          ? undefined
          : input.errorMessage,
    })
    .eq("tenant_id", input.tenantId)
    .eq("command_id", input.commandId);

  if (error) {
    throw new RetailPosRuntimeError(
      500,
      `Unable to update retail_pos command log: ${error.message}`,
    );
  }
}

async function reclaimRetryableRetailPosCommand(input: {
  tenantId: string;
  commandId: string;
  requestPayload: Record<string, unknown>;
}): Promise<boolean> {
  const existing = await loadRetailPosCommandLog(input);
  if (!existing || existing.status !== "retryable_error") {
    return false;
  }

  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .from("retail_pos_command_log")
    .update({
      status: "processing",
      request_payload: input.requestPayload,
      response_payload: null,
      error_code: null,
      error_message: null,
    })
    .eq("tenant_id", input.tenantId)
    .eq("command_id", input.commandId)
    .eq("status", "retryable_error")
    .eq("updated_at", existing.updated_at)
    .select("id")
    .limit(1)
    .maybeSingle<{ id: string }>();

  if (error) {
    throw new RetailPosRuntimeError(
      500,
      `Unable to reclaim retail_pos command log: ${error.message}`,
    );
  }

  return Boolean(data?.id);
}

function toReplayResult<TResult>(
  row: RetailPosCommandLogRow,
): RetailPosCommandResult<TResult> {
  const payload = row.response_payload;
  if (!payload || typeof payload !== "object") {
    throw new RetailPosRuntimeError(
      500,
      "retail_pos command replay is missing response payload.",
    );
  }

  const stored = payload as RetailPosCommandResult<TResult>;
  return {
    ...stored,
    status: "replayed",
    idempotent_replay: true,
  };
}

function parseStoredRuntimeError(row: RetailPosCommandLogRow): RetailPosRuntimeError {
  const parsedStatus = Number.parseInt(row.error_code ?? "", 10);
  const status =
    Number.isInteger(parsedStatus) && parsedStatus >= 400 && parsedStatus < 500
      ? parsedStatus
      : 409;

  return new RetailPosRuntimeError(
    status,
    row.error_message ?? "retail_pos command was previously rejected.",
  );
}

export async function beginRetailPosCommand<TResult>(
  input: BeginRetailPosCommandInput,
): Promise<BeginRetailPosCommandResult<TResult>> {
  const supabase = getSupabaseAdminClient();
  const { error } = await supabase.from("retail_pos_command_log").insert({
    tenant_id: input.tenantId,
    command_id: input.commandId,
    command_type: input.commandType,
    device_id: input.deviceId,
    pos_user_id: input.posUserId,
    cash_shift_id: input.cashShiftId,
    order_id: input.orderId,
    request_payload: input.requestPayload,
    response_payload: null,
    status: "processing",
    error_code: null,
    error_message: null,
  });

  if (!error) {
    return { kind: "started" };
  }

  if (
    isUniqueViolation(error, "retail_pos_command_log_tenant_command_uidx") &&
    (await reclaimRetryableRetailPosCommand(input))
  ) {
    return { kind: "started" };
  }

  if (!isUniqueViolation(error, "retail_pos_command_log_tenant_command_uidx")) {
    throw new RetailPosRuntimeError(
      400,
      `Unable to create retail_pos command log: ${error.message}`,
    );
  }

  const existing = await loadRetailPosCommandLog({
    tenantId: input.tenantId,
    commandId: input.commandId,
  });

  if (!existing) {
    throw new RetailPosRuntimeError(
      500,
      "retail_pos command log conflict occurred but record could not be loaded.",
    );
  }

  if (existing.status === "completed") {
    return { kind: "replay", result: toReplayResult<TResult>(existing) };
  }

  if (existing.status === "rejected") {
    throw parseStoredRuntimeError(existing);
  }

  if (existing.status === "retryable_error") {
    if (await reclaimRetryableRetailPosCommand(input)) {
      return { kind: "started" };
    }

    throw new RetailPosRuntimeError(
      409,
      "retail_pos command retry is already being processed.",
    );
  }

  throw new RetailPosRuntimeError(
    409,
    "retail_pos command is already being processed.",
  );
}

export async function completeRetailPosCommand<TResult>(input: {
  tenantId: string;
  commandId: string;
  result: RetailPosCommandResult<TResult>;
}): Promise<void> {
  await updateRetailPosCommandLogStatus({
    tenantId: input.tenantId,
    commandId: input.commandId,
    status: "completed",
    responsePayload: input.result as Record<string, unknown>,
    errorCode: null,
    errorMessage: null,
  });
}

export async function rejectRetailPosCommand(input: {
  tenantId: string;
  commandId: string;
  error: RetailPosRuntimeError;
}): Promise<void> {
  await updateRetailPosCommandLogStatus({
    tenantId: input.tenantId,
    commandId: input.commandId,
    status: "rejected",
    responsePayload: null,
    errorCode: String(input.error.status),
    errorMessage: input.error.message,
  });
}

export async function markRetailPosCommandRetryableError(input: {
  tenantId: string;
  commandId: string;
  error: unknown;
}): Promise<void> {
  const message =
    input.error instanceof Error
      ? input.error.message
      : "Unexpected retail_pos command error.";
  const code =
    input.error instanceof RetailPosRuntimeError
      ? String(input.error.status)
      : "500";

  await updateRetailPosCommandLogStatus({
    tenantId: input.tenantId,
    commandId: input.commandId,
    status: "retryable_error",
    responsePayload: null,
    errorCode: code,
    errorMessage: message,
  });
}
