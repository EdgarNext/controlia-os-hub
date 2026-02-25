import { getSupabaseServerClient } from "@/lib/supabase/server";
import type { CreateRoomInput, Room, UpdateRoomInput } from "@/types/venue";

const ROOM_SELECT =
  "id, tenant_id, name, code, default_capacity, status, created_at, updated_at, created_by, updated_by";

export async function createRoom(tenantId: string, input: CreateRoomInput): Promise<Room> {
  const supabase = await getSupabaseServerClient();
  const { data, error } = await supabase
    .from("venue_rooms")
    .insert({
      tenant_id: tenantId,
      name: input.name,
      code: input.code ?? null,
      default_capacity: input.defaultCapacity,
      status: input.status ?? "active",
      created_by: input.createdBy ?? null,
      updated_by: input.createdBy ?? null,
    })
    .select(ROOM_SELECT)
    .single();

  if (error) {
    throw new Error(`Failed to create room: ${error.message}`);
  }

  return data as Room;
}

export async function updateRoom(tenantId: string, roomId: string, input: UpdateRoomInput): Promise<Room> {
  const supabase = await getSupabaseServerClient();
  const patch: Record<string, unknown> = {};

  if (input.name !== undefined) patch.name = input.name;
  if (input.code !== undefined) patch.code = input.code;
  if (input.defaultCapacity !== undefined) patch.default_capacity = input.defaultCapacity;
  if (input.status !== undefined) patch.status = input.status;
  if (input.updatedBy !== undefined) patch.updated_by = input.updatedBy;

  const { data, error } = await supabase
    .from("venue_rooms")
    .update(patch)
    .eq("tenant_id", tenantId)
    .eq("id", roomId)
    .select(ROOM_SELECT)
    .single();

  if (error) {
    throw new Error(`Failed to update room: ${error.message}`);
  }

  return data as Room;
}

export async function deleteRoom(tenantId: string, roomId: string): Promise<void> {
  const supabase = await getSupabaseServerClient();
  const { error } = await supabase
    .from("venue_rooms")
    .delete()
    .eq("tenant_id", tenantId)
    .eq("id", roomId);

  if (error) {
    throw new Error(`Failed to delete room: ${error.message}`);
  }
}
