import { getSupabaseServerClient } from "@/lib/supabase/server";
import type { Room } from "@/types/venue";

const ROOM_SELECT =
  "id, tenant_id, name, code, default_capacity, status, created_at, updated_at, created_by, updated_by";

export async function getRooms(tenantId: string): Promise<Room[]> {
  const supabase = await getSupabaseServerClient();
  const { data, error } = await supabase
    .from("venue_rooms")
    .select(ROOM_SELECT)
    .eq("tenant_id", tenantId)
    .order("created_at", { ascending: false });

  if (error) {
    throw new Error(`Failed to load rooms: ${error.message}`);
  }

  return (data ?? []) as Room[];
}

export async function getRoomById(tenantId: string, roomId: string): Promise<Room | null> {
  const supabase = await getSupabaseServerClient();
  const { data, error } = await supabase
    .from("venue_rooms")
    .select(ROOM_SELECT)
    .eq("tenant_id", tenantId)
    .eq("id", roomId)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to load room: ${error.message}`);
  }

  return (data as Room | null) ?? null;
}
