import type {
  RetailPosPriceTierDecisionCommand,
  RetailPosPriceTierDecisionCommandResult,
} from "@/shared/types/retail-pos";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { assertRetailPosCashierAccess, resolveRetailPosRuntimeActor } from "./auth";
import {
  beginRetailPosCommand,
  completeRetailPosCommand,
  markRetailPosCommandRetryableError,
  rejectRetailPosCommand,
} from "./commands";
import { RetailPosRuntimeError } from "./errors";

function requiredString(value: unknown, field: string) {
  if (typeof value !== "string" || !value.trim()) throw new RetailPosRuntimeError(400, `${field} is required.`);
  return value.trim();
}

export async function resolveRetailPosPriceTierCommand(input: {
  tenantSlug: string;
  command: RetailPosPriceTierDecisionCommand;
  deviceId?: string | null;
  deviceSecret?: string | null;
}): Promise<RetailPosPriceTierDecisionCommandResult> {
  const actor = await resolveRetailPosRuntimeActor({ ...input });
  if (actor.mode !== "device" || !actor.deviceRecordId || !actor.devicePublicId) {
    throw new RetailPosRuntimeError(401, "device auth is required for price tier decisions.");
  }
  assertRetailPosCashierAccess(actor);
  if (input.command.command_type !== "price_tier_decision") throw new RetailPosRuntimeError(400, "command_type must be price_tier_decision.");
  const commandId = requiredString(input.command.command_id, "command_id");
  const deviceId = requiredString(input.command.device_id, "device_id");
  const operatorId = requiredString(input.command.operator_id, "operator_id");
  const shiftId = requiredString(input.command.cash_shift_id, "cash_shift_id");
  const payload = input.command.payload;
  const orderId = requiredString(payload?.order_id, "payload.order_id");
  if (deviceId !== actor.devicePublicId) throw new RetailPosRuntimeError(409, "command device_id does not match authenticated retail_pos device.");
  if (!Number.isInteger(payload.expected_revision) || payload.expected_revision < 0) throw new RetailPosRuntimeError(400, "payload.expected_revision is invalid.");
  if (!Array.isArray(payload.decisions) || payload.decisions.length === 0) throw new RetailPosRuntimeError(400, "payload.decisions is required.");

  const begin = await beginRetailPosCommand<RetailPosPriceTierDecisionCommandResult["result"]>({
    tenantId: actor.tenantId, commandId, commandType: "price_tier_decision", deviceId: actor.deviceRecordId,
    posUserId: operatorId, cashShiftId: shiftId, orderId, requestPayload: input.command as unknown as Record<string, unknown>,
  });
  if (begin.kind === "replay") return begin.result as RetailPosPriceTierDecisionCommandResult;
  try {
    const supabase = getSupabaseAdminClient();
    const { data, error } = await supabase.rpc("retail_pos_resolve_price_tiers_v1", {
      p_tenant_id: actor.tenantId, p_device_id: actor.deviceRecordId, p_pos_user_id: operatorId,
      p_cash_shift_id: shiftId, p_order_id: orderId, p_expected_revision: payload.expected_revision,
      p_decisions: payload.decisions, p_command_id: commandId,
    });
    if (error) throw new RetailPosRuntimeError(error.code === "P0002" ? 409 : 400, error.message);
    const result: RetailPosPriceTierDecisionCommandResult = {
      command_id: commandId, command_type: "price_tier_decision", status: "completed", idempotent_replay: false,
      device_id: actor.deviceRecordId, operator_id: operatorId, cash_shift_id: shiftId,
      result: data as RetailPosPriceTierDecisionCommandResult["result"], server_time: new Date().toISOString(),
    };
    await completeRetailPosCommand({ tenantId: actor.tenantId, commandId, result });
    return result;
  } catch (error) {
    if (error instanceof RetailPosRuntimeError && error.status < 500) {
      await rejectRetailPosCommand({ tenantId: actor.tenantId, commandId, error });
    } else await markRetailPosCommandRetryableError({ tenantId: actor.tenantId, commandId, error });
    throw error;
  }
}
