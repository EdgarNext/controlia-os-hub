import { getSupabaseServerClient } from "@/lib/supabase/server";
import type { Event, EventFilters } from "@/types/events";

const EVENT_SELECT =
  "id, tenant_id, name, status, starts_at, ends_at, venue_room_id, venue_room_layout_id, expected_attendance, created_at, updated_at, created_by, updated_by";

export async function getEvents(tenantId: string, filters?: EventFilters): Promise<Event[]> {
  const supabase = await getSupabaseServerClient();

  let query = supabase
    .from("events")
    .select(EVENT_SELECT)
    .eq("tenant_id", tenantId)
    .order("starts_at", { ascending: true });

  if (filters?.status) {
    query = query.eq("status", filters.status);
  }

  if (filters?.roomId) {
    query = query.eq("venue_room_id", filters.roomId);
  }

  if (filters?.fromStartsAt) {
    query = query.gte("starts_at", filters.fromStartsAt);
  }

  if (filters?.toStartsAt) {
    query = query.lte("starts_at", filters.toStartsAt);
  }

  if (typeof filters?.limit === "number") {
    query = query.limit(filters.limit);
  }

  const { data, error } = await query;

  if (error) {
    throw new Error(`Failed to load events: ${error.message}`);
  }

  return (data ?? []) as Event[];
}

export async function getEventById(tenantId: string, eventId: string): Promise<Event | null> {
  const supabase = await getSupabaseServerClient();
  const { data, error } = await supabase
    .from("events")
    .select(EVENT_SELECT)
    .eq("tenant_id", tenantId)
    .eq("id", eventId)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to load event: ${error.message}`);
  }

  return (data as Event | null) ?? null;
}
