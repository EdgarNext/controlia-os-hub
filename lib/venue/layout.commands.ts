import { getSupabaseServerClient } from "@/lib/supabase/server";
import type { RoomLayout } from "@/types/venue";

const LAYOUT_SELECT =
  "id, tenant_id, room_id, name, capacity, status, created_at, updated_at, created_by, updated_by";

export async function upsertRoomLayout(
  tenantId: string,
  roomId: string,
  layoutType: string,
  capacity: number,
  changeNote?: string,
): Promise<RoomLayout> {
  void changeNote;

  const supabase = await getSupabaseServerClient();
  const { data, error } = await supabase
    .from("venue_room_layouts")
    .upsert(
      {
        tenant_id: tenantId,
        room_id: roomId,
        name: layoutType,
        capacity,
      },
      { onConflict: "tenant_id,room_id,name" },
    )
    .select(LAYOUT_SELECT)
    .single();

  if (error) {
    throw new Error(`Failed to upsert room layout: ${error.message}`);
  }

  return data as RoomLayout;
}

export async function deleteRoomLayout(tenantId: string, layoutId: string): Promise<void> {
  const supabase = await getSupabaseServerClient();
  const { error } = await supabase
    .from("venue_room_layouts")
    .delete()
    .eq("tenant_id", tenantId)
    .eq("id", layoutId);

  if (error) {
    throw new Error(`Failed to delete room layout: ${error.message}`);
  }
}
