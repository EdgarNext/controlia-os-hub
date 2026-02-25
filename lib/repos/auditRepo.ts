import { getSupabaseServerClient } from "@/lib/supabase/server";

type AuditPayload = {
  actorUserId: string;
  eventType: string;
  tenantId?: string | null;
  entityType?: string | null;
  entityId?: string | null;
  payload?: Record<string, unknown>;
};

export async function logAuditEvent({
  actorUserId,
  eventType,
  tenantId = null,
  entityType = null,
  entityId = null,
  payload = {},
}: AuditPayload) {
  const supabase = await getSupabaseServerClient();

  const { error } = await supabase.from("audit_events").insert({
    actor_user_id: actorUserId,
    tenant_id: tenantId,
    event_type: eventType,
    entity_type: entityType,
    entity_id: entityId,
    payload,
  });

  if (error) {
    throw new Error(error.message);
  }
}
