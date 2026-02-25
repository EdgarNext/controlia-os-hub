import { getSupabaseServerClient } from "@/lib/supabase/server";
import type { RoomLayout } from "@/types/venue";

const LAYOUT_SELECT =
  "id, tenant_id, room_id, name, capacity, status, created_at, updated_at, created_by, updated_by";

export async function getRoomLayouts(tenantId: string, roomId: string): Promise<RoomLayout[]> {
  const supabase = await getSupabaseServerClient();
  const { data, error } = await supabase
    .from("venue_room_layouts")
    .select(LAYOUT_SELECT)
    .eq("tenant_id", tenantId)
    .eq("room_id", roomId)
    .order("created_at", { ascending: false });

  if (error) {
    throw new Error(`Failed to load room layouts: ${error.message}`);
  }

  return (data ?? []) as RoomLayout[];
}
