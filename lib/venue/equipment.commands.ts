import { getSupabaseServerClient } from "@/lib/supabase/server";
import type { Equipment, EquipmentInput, RoomEquipment, UpdateEquipmentInput } from "@/types/venue";

const EQUIPMENT_SELECT =
  "id, tenant_id, name, equipment_type, status, created_at, updated_at, created_by, updated_by";
const ROOM_EQUIPMENT_SELECT =
  "id, tenant_id, room_id, equipment_id, quantity, status, created_at, updated_at, created_by, updated_by";

export async function createEquipment(tenantId: string, input: EquipmentInput): Promise<Equipment> {
  const supabase = await getSupabaseServerClient();
  const { data, error } = await supabase
    .from("venue_equipment")
    .insert({
      tenant_id: tenantId,
      name: input.name,
      equipment_type: input.equipmentType ?? null,
      status: input.status ?? "active",
      created_by: input.actorUserId ?? null,
      updated_by: input.actorUserId ?? null,
    })
    .select(EQUIPMENT_SELECT)
    .single();

  if (error) {
    throw new Error(`Failed to create equipment: ${error.message}`);
  }

  return data as Equipment;
}

export async function updateEquipment(
  tenantId: string,
  equipmentId: string,
  input: UpdateEquipmentInput,
): Promise<Equipment> {
  const supabase = await getSupabaseServerClient();
  const patch: Record<string, unknown> = {};

  if (input.name !== undefined) patch.name = input.name;
  if (input.equipmentType !== undefined) patch.equipment_type = input.equipmentType;
  if (input.status !== undefined) patch.status = input.status;
  if (input.actorUserId !== undefined) patch.updated_by = input.actorUserId;

  const { data, error } = await supabase
    .from("venue_equipment")
    .update(patch)
    .eq("tenant_id", tenantId)
    .eq("id", equipmentId)
    .select(EQUIPMENT_SELECT)
    .single();

  if (error) {
    throw new Error(`Failed to update equipment: ${error.message}`);
  }

  return data as Equipment;
}

export async function deleteEquipment(tenantId: string, equipmentId: string): Promise<void> {
  const supabase = await getSupabaseServerClient();
  const { error } = await supabase
    .from("venue_equipment")
    .delete()
    .eq("tenant_id", tenantId)
    .eq("id", equipmentId);

  if (error) {
    throw new Error(`Failed to delete equipment: ${error.message}`);
  }
}

export async function upsertRoomEquipment(
  tenantId: string,
  roomId: string,
  equipmentId: string,
  quantity: number,
): Promise<RoomEquipment> {
  const supabase = await getSupabaseServerClient();
  const { data, error } = await supabase
    .from("venue_room_equipment")
    .upsert(
      {
        tenant_id: tenantId,
        room_id: roomId,
        equipment_id: equipmentId,
        quantity,
      },
      { onConflict: "tenant_id,room_id,equipment_id" },
    )
    .select(ROOM_EQUIPMENT_SELECT)
    .single();

  if (error) {
    throw new Error(`Failed to upsert room equipment: ${error.message}`);
  }

  return data as RoomEquipment;
}

export async function deleteRoomEquipment(tenantId: string, roomEquipmentId: string): Promise<void> {
  const supabase = await getSupabaseServerClient();
  const { error } = await supabase
    .from("venue_room_equipment")
    .delete()
    .eq("tenant_id", tenantId)
    .eq("id", roomEquipmentId);

  if (error) {
    throw new Error(`Failed to delete room equipment: ${error.message}`);
  }
}
