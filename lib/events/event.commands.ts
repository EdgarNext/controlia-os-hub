import { getSupabaseServerClient } from "@/lib/supabase/server";
import type { Event, UpdateEventInput, CreateEventInput } from "@/types/events";

const EVENT_SELECT =
  "id, tenant_id, name, status, starts_at, ends_at, venue_room_id, venue_room_layout_id, expected_attendance, created_at, updated_at, created_by, updated_by";

export async function createEvent(tenantId: string, input: CreateEventInput): Promise<Event> {
  const supabase = await getSupabaseServerClient();
  const { data, error } = await supabase
    .from("events")
    .insert({
      tenant_id: tenantId,
      name: input.name,
      status: input.status ?? "draft",
      starts_at: input.startsAt ?? null,
      ends_at: input.endsAt ?? null,
      venue_room_id: input.venueRoomId ?? null,
      venue_room_layout_id: input.venueRoomLayoutId ?? null,
      expected_attendance: input.expectedAttendance ?? null,
      created_by: input.createdBy ?? null,
      updated_by: input.createdBy ?? null,
    })
    .select(EVENT_SELECT)
    .single();

  if (error) {
    throw new Error(`Failed to create event: ${error.message}`);
  }

  return data as Event;
}

export async function updateEvent(tenantId: string, eventId: string, input: UpdateEventInput): Promise<Event> {
  const supabase = await getSupabaseServerClient();
  const patch: Record<string, unknown> = {};

  if (input.name !== undefined) patch.name = input.name;
  if (input.status !== undefined) patch.status = input.status;
  if (input.startsAt !== undefined) patch.starts_at = input.startsAt;
  if (input.endsAt !== undefined) patch.ends_at = input.endsAt;
  if (input.venueRoomId !== undefined) patch.venue_room_id = input.venueRoomId;
  if (input.venueRoomLayoutId !== undefined) patch.venue_room_layout_id = input.venueRoomLayoutId;
  if (input.expectedAttendance !== undefined) patch.expected_attendance = input.expectedAttendance;
  if (input.updatedBy !== undefined) patch.updated_by = input.updatedBy;

  const { data, error } = await supabase
    .from("events")
    .update(patch)
    .eq("tenant_id", tenantId)
    .eq("id", eventId)
    .select(EVENT_SELECT)
    .single();

  if (error) {
    throw new Error(`Failed to update event: ${error.message}`);
  }

  return data as Event;
}

export async function publishEvent(tenantId: string, eventId: string): Promise<Event> {
  const supabase = await getSupabaseServerClient();
  const { data, error } = await supabase
    .from("events")
    .update({ status: "published" })
    .eq("tenant_id", tenantId)
    .eq("id", eventId)
    .select(EVENT_SELECT)
    .single();

  if (error) {
    throw new Error(`Failed to publish event: ${error.message}`);
  }

  return data as Event;
}

export async function closeEvent(tenantId: string, eventId: string): Promise<Event> {
  const supabase = await getSupabaseServerClient();
  const { data, error } = await supabase
    .from("events")
    .update({ status: "closed" })
    .eq("tenant_id", tenantId)
    .eq("id", eventId)
    .select(EVENT_SELECT)
    .single();

  if (error) {
    throw new Error(`Failed to close event: ${error.message}`);
  }

  return data as Event;
}
