import { getSupabaseServerClient } from "@/lib/supabase/server";
import type { Equipment, RoomEquipment } from "@/types/venue";

const EQUIPMENT_SELECT =
  "id, tenant_id, name, equipment_type, status, created_at, updated_at, created_by, updated_by";
const ROOM_EQUIPMENT_SELECT =
  "id, tenant_id, room_id, equipment_id, quantity, status, created_at, updated_at, created_by, updated_by";

export async function getEquipmentCatalog(tenantId: string): Promise<Equipment[]> {
  const supabase = await getSupabaseServerClient();
  const { data, error } = await supabase
    .from("venue_equipment")
    .select(EQUIPMENT_SELECT)
    .eq("tenant_id", tenantId)
    .order("created_at", { ascending: false });

  if (error) {
    throw new Error(`Failed to load equipment catalog: ${error.message}`);
  }

  return (data ?? []) as Equipment[];
}

export async function getRoomEquipment(tenantId: string, roomId: string): Promise<RoomEquipment[]> {
  const supabase = await getSupabaseServerClient();
  const { data, error } = await supabase
    .from("venue_room_equipment")
    .select(ROOM_EQUIPMENT_SELECT)
    .eq("tenant_id", tenantId)
    .eq("room_id", roomId)
    .order("created_at", { ascending: false });

  if (error) {
    throw new Error(`Failed to load room equipment: ${error.message}`);
  }

  return (data ?? []) as RoomEquipment[];
}
