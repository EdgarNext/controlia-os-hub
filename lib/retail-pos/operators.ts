import type {
  RetailPosRuntimeOperator,
  RetailPosRuntimeProbeDiagnostics,
  RetailPosRuntimeOperatorsPayload,
} from "../../../shared/types/retail-pos";
import { listPosUsersForTenant } from "@/lib/pos/users";
import {
  assertRetailPosDeviceRole,
  resolveRetailPosRuntimeActor,
} from "./auth";
import type { RuntimePerfTrace } from "./runtime-perf";

export async function listRetailPosRuntimeOperators(input: {
  tenantSlug: string;
  deviceId?: string | null;
  deviceSecret?: string | null;
  trace?: RuntimePerfTrace;
}): Promise<RetailPosRuntimeOperatorsPayload> {
  const totalStartedAt = performance.now();
  const authStartedAt = performance.now();
  const actor = await resolveRetailPosRuntimeActor(input);
  const authMs = Math.round(performance.now() - authStartedAt);
  assertRetailPosDeviceRole(actor, ["order_station", "cashier_station"]);

  const operatorsQueryStartedAt = performance.now();
  const operators = (await listPosUsersForTenant(actor.tenantId, input.trace))
    .filter((row) => row.is_active)
    .map<RetailPosRuntimeOperator>((row) => ({
      id: row.id,
      tenant_id: row.tenant_id,
      name: row.name,
      role: row.role,
      is_active: row.is_active,
    }));
  const operatorsQueryMs = Math.round(performance.now() - operatorsQueryStartedAt);
  const totalMs = Math.round(performance.now() - totalStartedAt);
  input.trace?.addDuration("business", operatorsQueryMs);
  const diagnostics: RetailPosRuntimeProbeDiagnostics = {
    auth_ms: authMs,
    operators_query_ms: operatorsQueryMs,
    total_ms: totalMs,
  };

  if (totalMs >= 3000) {
    console.warn("[retail-pos][runtime][operators] slow probe", {
      tenantSlug: actor.tenantSlug,
      tenantId: actor.tenantId,
      deviceId: actor.devicePublicId,
      deviceRole: actor.deviceRole,
      diagnostics,
    });
  }

  return {
    tenant_id: actor.tenantId,
    device_id: actor.deviceRecordId,
    device_role: actor.deviceRole,
    operators,
    synced_at: new Date().toISOString(),
    diagnostics,
  };
}
