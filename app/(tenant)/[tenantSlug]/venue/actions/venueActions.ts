"use server";

import { revalidatePath } from "next/cache";
import {
  createEquipment,
  createRoom,
  deleteEquipment,
  deleteRoom,
  deleteRoomEquipment,
  getEquipmentCatalog,
  getRoomById,
  getRoomEquipment,
  getRooms,
  updateEquipment,
  updateRoom,
  upsertRoomEquipment,
} from "@/lib/venue";
import type { Equipment, Room, RoomEquipment } from "@/types/venue";
import { assertTenantAdmin, assertTenantMember, normalizeTenantId } from "../../../lib/tenant-access";

type ActionResult = { ok: true; message: string } | { ok: false; message: string };

export type VenueConfigData = {
  tenantId: string;
  rooms: Room[];
  equipmentCatalog: Equipment[];
  roomIdsWithoutEquipment: string[];
};

export type RoomWithSetup = Room & {
  equipmentCount: number;
  needsSetup: boolean;
};

export type VenueRoomsData = {
  tenantId: string;
  rooms: RoomWithSetup[];
};

export type VenueEquipmentData = {
  tenantId: string;
  equipmentCatalog: Equipment[];
};

export type RoomSetupEquipment = RoomEquipment & {
  equipment_name: string;
  equipment_type: string | null;
};

export type RoomSetupData = {
  tenantId: string;
  room: Room;
  assignedEquipment: RoomSetupEquipment[];
  equipmentCatalog: Equipment[];
};

function buildTenantPaths(tenantSlug: string, roomId?: string) {
  const basePaths = [
    `/${tenantSlug}/venue`,
    `/${tenantSlug}/venue/rooms`,
    `/${tenantSlug}/venue/equipment`,
    `/${tenantSlug}/events`,
    `/${tenantSlug}/events/create`,
  ];

  if (roomId) {
    basePaths.push(`/${tenantSlug}/venue/rooms/${roomId}`);
  }

  return basePaths;
}

function parsePositiveInteger(rawValue: FormDataEntryValue | null, fieldLabel: string): number {
  const value = Number(rawValue ?? 0);
  if (!Number.isFinite(value) || value <= 0) {
    throw new Error(`${fieldLabel} debe ser mayor a 0.`);
  }
  return Math.floor(value);
}

async function buildRoomEquipmentCountMap(tenantId: string, rooms: Room[]) {
  const roomEquipmentPairs = await Promise.all(
    rooms.map(async (room) => {
      const roomEquipment = await getRoomEquipment(tenantId, room.id);
      return [room.id, roomEquipment.length] as const;
    }),
  );

  return new Map<string, number>(roomEquipmentPairs);
}

export async function getVenueConfigData(tenantId: string): Promise<VenueConfigData> {
  const normalizedTenantId = normalizeTenantId(tenantId);
  await assertTenantMember(normalizedTenantId);

  const rooms = await getRooms(normalizedTenantId);
  const equipmentCatalog = await getEquipmentCatalog(normalizedTenantId);
  const roomEquipmentCountMap = await buildRoomEquipmentCountMap(normalizedTenantId, rooms);

  return {
    tenantId: normalizedTenantId,
    rooms,
    equipmentCatalog,
    roomIdsWithoutEquipment: rooms
      .filter((room) => (roomEquipmentCountMap.get(room.id) ?? 0) === 0)
      .map((room) => room.id),
  };
}

export async function getVenueRoomsData(tenantId: string): Promise<VenueRoomsData> {
  const normalizedTenantId = normalizeTenantId(tenantId);
  await assertTenantMember(normalizedTenantId);

  const rooms = await getRooms(normalizedTenantId);
  const roomEquipmentCountMap = await buildRoomEquipmentCountMap(normalizedTenantId, rooms);

  return {
    tenantId: normalizedTenantId,
    rooms: rooms.map((room) => {
      const equipmentCount = roomEquipmentCountMap.get(room.id) ?? 0;
      return {
        ...room,
        equipmentCount,
        needsSetup: equipmentCount === 0,
      };
    }),
  };
}

export async function getVenueEquipmentData(tenantId: string): Promise<VenueEquipmentData> {
  const normalizedTenantId = normalizeTenantId(tenantId);
  await assertTenantMember(normalizedTenantId);

  const equipmentCatalog = await getEquipmentCatalog(normalizedTenantId);

  return {
    tenantId: normalizedTenantId,
    equipmentCatalog,
  };
}

export async function getRoomSetupData(tenantId: string, roomId: string): Promise<RoomSetupData | null> {
  const normalizedTenantId = normalizeTenantId(tenantId);
  const normalizedRoomId = String(roomId ?? "").trim();

  if (!normalizedRoomId) {
    throw new Error("El id de la sala es obligatorio.");
  }

  await assertTenantMember(normalizedTenantId);

  const [room, assignedEquipmentRaw, equipmentCatalog] = await Promise.all([
    getRoomById(normalizedTenantId, normalizedRoomId),
    getRoomEquipment(normalizedTenantId, normalizedRoomId),
    getEquipmentCatalog(normalizedTenantId),
  ]);

  if (!room) {
    return null;
  }

  const equipmentById = new Map(equipmentCatalog.map((item) => [item.id, item]));

  const assignedEquipment: RoomSetupEquipment[] = assignedEquipmentRaw.map((assignment) => {
    const equipment = equipmentById.get(assignment.equipment_id);

    return {
      ...assignment,
      equipment_name: equipment?.name ?? "Equipo desconocido",
      equipment_type: equipment?.equipment_type ?? null,
    };
  });

  return {
    tenantId: normalizedTenantId,
    room,
    assignedEquipment,
    equipmentCatalog,
  };
}

export async function createRoomAction(formData: FormData): Promise<ActionResult> {
  try {
    const tenantId = normalizeTenantId(formData.get("tenantId"));
    const tenantSlug = String(formData.get("tenantSlug") ?? "").trim();
    const user = await assertTenantAdmin(tenantId);

    const name = String(formData.get("name") ?? "").trim();
    const code = String(formData.get("code") ?? "").trim();
    const defaultCapacity = parsePositiveInteger(formData.get("defaultCapacity"), "La capacidad");

    if (!tenantSlug) {
      return { ok: false, message: "El slug del tenant es obligatorio." };
    }

    if (!name) {
      return { ok: false, message: "El nombre de la sala es obligatorio." };
    }

    await createRoom(tenantId, {
      name,
      code: code || null,
      defaultCapacity,
      createdBy: user.id,
    });

    for (const path of buildTenantPaths(tenantSlug)) {
      revalidatePath(path);
    }

    return { ok: true, message: "Sala creada." };
  } catch (error) {
    const message = error instanceof Error ? error.message : "No se pudo crear la sala.";
    return { ok: false, message };
  }
}

export async function updateRoomAction(formData: FormData): Promise<ActionResult> {
  try {
    const tenantId = normalizeTenantId(formData.get("tenantId"));
    const tenantSlug = String(formData.get("tenantSlug") ?? "").trim();
    const roomId = String(formData.get("roomId") ?? "").trim();
    const user = await assertTenantAdmin(tenantId);

    const name = String(formData.get("name") ?? "").trim();
    const code = String(formData.get("code") ?? "").trim();
    const defaultCapacity = parsePositiveInteger(formData.get("defaultCapacity"), "La capacidad");

    if (!tenantSlug) {
      return { ok: false, message: "El slug del tenant es obligatorio." };
    }

    if (!roomId) {
      return { ok: false, message: "El id de la sala es obligatorio." };
    }

    if (!name) {
      return { ok: false, message: "El nombre de la sala es obligatorio." };
    }

    await updateRoom(tenantId, roomId, {
      name,
      code: code || null,
      defaultCapacity,
      updatedBy: user.id,
    });

    for (const path of buildTenantPaths(tenantSlug, roomId)) {
      revalidatePath(path);
    }

    return { ok: true, message: "Sala actualizada." };
  } catch (error) {
    const message = error instanceof Error ? error.message : "No se pudo actualizar la sala.";
    return { ok: false, message };
  }
}

export async function deleteRoomAction(formData: FormData): Promise<ActionResult> {
  try {
    const tenantId = normalizeTenantId(formData.get("tenantId"));
    const tenantSlug = String(formData.get("tenantSlug") ?? "").trim();
    const roomId = String(formData.get("roomId") ?? "").trim();
    await assertTenantAdmin(tenantId);

    if (!tenantSlug) {
      return { ok: false, message: "El slug del tenant es obligatorio." };
    }

    if (!roomId) {
      return { ok: false, message: "El id de la sala es obligatorio." };
    }

    await deleteRoom(tenantId, roomId);

    for (const path of buildTenantPaths(tenantSlug, roomId)) {
      revalidatePath(path);
    }

    return { ok: true, message: "Sala eliminada." };
  } catch (error) {
    const message = error instanceof Error ? error.message : "No se pudo eliminar la sala.";
    return { ok: false, message };
  }
}

export async function createEquipmentAction(formData: FormData): Promise<ActionResult> {
  try {
    const tenantId = normalizeTenantId(formData.get("tenantId"));
    const tenantSlug = String(formData.get("tenantSlug") ?? "").trim();
    const user = await assertTenantAdmin(tenantId);

    const name = String(formData.get("name") ?? "").trim();
    const equipmentType = String(formData.get("category") ?? formData.get("equipmentType") ?? "").trim();

    if (!tenantSlug) {
      return { ok: false, message: "El slug del tenant es obligatorio." };
    }

    if (!name) {
      return { ok: false, message: "El nombre del equipo es obligatorio." };
    }

    await createEquipment(tenantId, {
      name,
      equipmentType: equipmentType || null,
      actorUserId: user.id,
    });

    for (const path of buildTenantPaths(tenantSlug)) {
      revalidatePath(path);
    }

    return { ok: true, message: "Equipo creado." };
  } catch (error) {
    const message = error instanceof Error ? error.message : "No se pudo crear el equipo.";
    return { ok: false, message };
  }
}

export async function updateEquipmentAction(formData: FormData): Promise<ActionResult> {
  try {
    const tenantId = normalizeTenantId(formData.get("tenantId"));
    const tenantSlug = String(formData.get("tenantSlug") ?? "").trim();
    const equipmentId = String(formData.get("equipmentId") ?? "").trim();
    const user = await assertTenantAdmin(tenantId);

    const name = String(formData.get("name") ?? "").trim();
    const equipmentType = String(formData.get("category") ?? formData.get("equipmentType") ?? "").trim();

    if (!tenantSlug) {
      return { ok: false, message: "El slug del tenant es obligatorio." };
    }

    if (!equipmentId) {
      return { ok: false, message: "El id del equipo es obligatorio." };
    }

    if (!name) {
      return { ok: false, message: "El nombre del equipo es obligatorio." };
    }

    await updateEquipment(tenantId, equipmentId, {
      name,
      equipmentType: equipmentType || null,
      actorUserId: user.id,
    });

    for (const path of buildTenantPaths(tenantSlug)) {
      revalidatePath(path);
    }

    return { ok: true, message: "Equipo actualizado." };
  } catch (error) {
    const message = error instanceof Error ? error.message : "No se pudo actualizar el equipo.";
    return { ok: false, message };
  }
}

export async function deleteEquipmentAction(formData: FormData): Promise<ActionResult> {
  try {
    const tenantId = normalizeTenantId(formData.get("tenantId"));
    const tenantSlug = String(formData.get("tenantSlug") ?? "").trim();
    const equipmentId = String(formData.get("equipmentId") ?? "").trim();
    await assertTenantAdmin(tenantId);

    if (!tenantSlug) {
      return { ok: false, message: "El slug del tenant es obligatorio." };
    }

    if (!equipmentId) {
      return { ok: false, message: "El id del equipo es obligatorio." };
    }

    await deleteEquipment(tenantId, equipmentId);

    for (const path of buildTenantPaths(tenantSlug)) {
      revalidatePath(path);
    }

    return { ok: true, message: "Equipo eliminado." };
  } catch (error) {
    const message = error instanceof Error ? error.message : "No se pudo eliminar el equipo.";
    return { ok: false, message };
  }
}

export async function assignRoomEquipmentAction(formData: FormData): Promise<ActionResult> {
  try {
    const tenantId = normalizeTenantId(formData.get("tenantId"));
    const tenantSlug = String(formData.get("tenantSlug") ?? "").trim();
    const roomId = String(formData.get("roomId") ?? "").trim();
    const equipmentId = String(formData.get("equipmentId") ?? "").trim();
    const quantity = parsePositiveInteger(formData.get("quantity"), "La cantidad");

    await assertTenantAdmin(tenantId);

    if (!tenantSlug) {
      return { ok: false, message: "El slug del tenant es obligatorio." };
    }

    if (!roomId || !equipmentId) {
      return { ok: false, message: "La sala y el equipo son obligatorios." };
    }

    await upsertRoomEquipment(tenantId, roomId, equipmentId, quantity);

    for (const path of buildTenantPaths(tenantSlug, roomId)) {
      revalidatePath(path);
    }

    return { ok: true, message: "Equipo asignado a la sala." };
  } catch (error) {
    const message = error instanceof Error ? error.message : "No se pudo asignar el equipo.";
    return { ok: false, message };
  }
}

export async function unassignRoomEquipmentAction(formData: FormData): Promise<ActionResult> {
  try {
    const tenantId = normalizeTenantId(formData.get("tenantId"));
    const tenantSlug = String(formData.get("tenantSlug") ?? "").trim();
    const roomId = String(formData.get("roomId") ?? "").trim();
    const roomEquipmentId = String(formData.get("roomEquipmentId") ?? "").trim();

    await assertTenantAdmin(tenantId);

    if (!tenantSlug) {
      return { ok: false, message: "El slug del tenant es obligatorio." };
    }

    if (!roomId || !roomEquipmentId) {
      return { ok: false, message: "La sala y el equipo asignado son obligatorios." };
    }

    await deleteRoomEquipment(tenantId, roomEquipmentId);

    for (const path of buildTenantPaths(tenantSlug, roomId)) {
      revalidatePath(path);
    }

    return { ok: true, message: "Equipo removido de la sala." };
  } catch (error) {
    const message = error instanceof Error ? error.message : "No se pudo remover el equipo.";
    return { ok: false, message };
  }
}
