"use server";

import { revalidatePath } from "next/cache";
import { closeEvent, createEvent, getEventById, getEvents, publishEvent } from "@/lib/events";
import { getRoomById, getRoomEquipment, getRooms } from "@/lib/venue";
import type { Event, EventFilters } from "@/types/events";
import type { Room, RoomLayout } from "@/types/venue";
import { assertTenantAdmin, assertTenantMember, normalizeTenantId } from "../../../lib/tenant-access";

type ActionResult =
  | { ok: true; message: string; warning?: string; eventId?: string }
  | { ok: false; message: string };

export type EventCreateData = {
  tenantId: string;
  events: Event[];
  rooms: Room[];
  roomLayouts: RoomLayout[];
  roomIdsWithoutEquipment: string[];
};

export type EventPublishChecks = {
  missingRoom: boolean;
  invalidSchedule: boolean;
  capacityExceeded: boolean;
  roomNeedsSetup: boolean;
  hasConflict: boolean;
  roomCapacity: number | null;
};

export type EventDetailsData = {
  tenantId: string;
  event: Event | null;
  room: Room | null;
  layout: RoomLayout | null;
  equipmentMissing: boolean;
  conflictEvents: Event[];
  publishChecks: EventPublishChecks;
};

const DEFAULT_PUBLISH_CHECKS: EventPublishChecks = {
  missingRoom: false,
  invalidSchedule: false,
  capacityExceeded: false,
  roomNeedsSetup: false,
  hasConflict: false,
  roomCapacity: null,
};

function buildTenantPaths(tenantSlug: string, eventId?: string) {
  const paths = [
    `/${tenantSlug}/events`,
    `/${tenantSlug}/events/new`,
    `/${tenantSlug}/events/create`,
    `/${tenantSlug}/venue`,
  ];

  if (eventId) {
    paths.push(`/${tenantSlug}/events/${eventId}`);
  }

  return paths;
}

function normalizeOptionalNumber(raw: FormDataEntryValue | null): number | null {
  const value = String(raw ?? "").trim();
  if (!value) return null;

  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return null;
  }

  return parsed;
}

function parseDateInput(raw: FormDataEntryValue | null, fieldName: string) {
  const value = String(raw ?? "").trim();
  if (!value) {
    return { value: null, error: null as string | null };
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return { value: null, error: `${fieldName} tiene un valor invalido.` };
  }

  return { value: parsed.toISOString(), error: null as string | null };
}

function isStrictlyAfter(startIso: string | null, endIso: string | null): boolean {
  if (!startIso || !endIso) return false;
  return new Date(endIso).getTime() > new Date(startIso).getTime();
}

function hasTimeOverlap(
  firstStartIso: string,
  firstEndIso: string,
  secondStartIso: string,
  secondEndIso: string,
): boolean {
  const firstStart = new Date(firstStartIso).getTime();
  const firstEnd = new Date(firstEndIso).getTime();
  const secondStart = new Date(secondStartIso).getTime();
  const secondEnd = new Date(secondEndIso).getTime();

  return firstStart < secondEnd && firstEnd > secondStart;
}

async function findRoomConflicts(
  tenantId: string,
  roomId: string,
  startsAt: string,
  endsAt: string,
  excludeEventId?: string,
): Promise<Event[]> {
  const roomEvents = await getEvents(tenantId, { roomId, limit: 200 });

  return roomEvents.filter((event) => {
    if (excludeEventId && event.id === excludeEventId) {
      return false;
    }

    if (event.status === "closed") {
      return false;
    }

    if (!event.starts_at || !event.ends_at) {
      return false;
    }

    return hasTimeOverlap(startsAt, endsAt, event.starts_at, event.ends_at);
  });
}

async function evaluatePublishChecks(
  tenantId: string,
  event: Pick<Event, "id" | "venue_room_id" | "starts_at" | "ends_at" | "expected_attendance">,
) {
  let room: Room | null = null;
  let roomCapacity: number | null = null;
  let roomNeedsSetup = false;

  if (event.venue_room_id) {
    room = await getRoomById(tenantId, event.venue_room_id);

    if (room) {
      roomCapacity = room.default_capacity;
      const roomEquipment = await getRoomEquipment(tenantId, room.id);
      roomNeedsSetup = roomEquipment.length === 0;
    }
  }

  const missingRoom = !event.venue_room_id || !room;
  const invalidSchedule = !isStrictlyAfter(event.starts_at, event.ends_at);
  const capacityExceeded =
    event.expected_attendance !== null &&
    roomCapacity !== null &&
    event.expected_attendance > roomCapacity;

  let conflictEvents: Event[] = [];
  if (!missingRoom && !invalidSchedule && room) {
    conflictEvents = await findRoomConflicts(
      tenantId,
      room.id,
      event.starts_at as string,
      event.ends_at as string,
      event.id,
    );
  }

  return {
    room,
    checks: {
      missingRoom,
      invalidSchedule,
      capacityExceeded,
      roomNeedsSetup,
      hasConflict: conflictEvents.length > 0,
      roomCapacity,
    } as EventPublishChecks,
    conflictEvents,
  };
}

function getDraftWarnings(checks: EventPublishChecks): string[] {
  const warnings: string[] = [];

  if (checks.roomNeedsSetup) {
    warnings.push(
      "Esta sala aun no tiene equipo asignado. Podras crear el borrador, pero no publicar hasta configurarla.",
    );
  }

  if (checks.hasConflict) {
    warnings.push("Hay otro evento en esta sala en el mismo horario. Revisa antes de publicar.");
  }

  if (checks.capacityExceeded && checks.roomCapacity !== null) {
    warnings.push(`La asistencia esperada supera la capacidad de la sala (${checks.roomCapacity}).`);
  }

  return warnings;
}

export async function getEventCreateData(tenantId: string, filters?: EventFilters): Promise<EventCreateData> {
  const normalizedTenantId = normalizeTenantId(tenantId);
  await assertTenantMember(normalizedTenantId);

  const [events, rooms] = await Promise.all([
    getEvents(normalizedTenantId, filters),
    getRooms(normalizedTenantId),
  ]);

  const roomEquipmentMap = await Promise.all(
    rooms.map(async (room) => {
      const items = await getRoomEquipment(normalizedTenantId, room.id);
      return { roomId: room.id, count: items.length };
    }),
  );

  return {
    tenantId: normalizedTenantId,
    events,
    rooms,
    roomLayouts: [],
    roomIdsWithoutEquipment: roomEquipmentMap.filter((entry) => entry.count === 0).map((entry) => entry.roomId),
  };
}

export async function getEventDetailsData(tenantId: string, eventId: string): Promise<EventDetailsData> {
  const normalizedTenantId = normalizeTenantId(tenantId);
  await assertTenantMember(normalizedTenantId);

  const event = await getEventById(normalizedTenantId, eventId);

  if (!event) {
    return {
      tenantId: normalizedTenantId,
      event: null,
      room: null,
      layout: null,
      equipmentMissing: false,
      conflictEvents: [],
      publishChecks: DEFAULT_PUBLISH_CHECKS,
    };
  }

  const { room, checks, conflictEvents } = await evaluatePublishChecks(normalizedTenantId, event);

  return {
    tenantId: normalizedTenantId,
    event,
    room,
    layout: null,
    equipmentMissing: checks.roomNeedsSetup,
    conflictEvents,
    publishChecks: checks,
  };
}

export async function createEventAction(formData: FormData): Promise<ActionResult> {
  try {
    const tenantId = normalizeTenantId(formData.get("tenantId"));
    const tenantSlug = String(formData.get("tenantSlug") ?? "").trim();
    const user = await assertTenantAdmin(tenantId);

    const name = String(formData.get("name") ?? "").trim();
    const venueRoomId = String(formData.get("venueRoomId") ?? "").trim();
    const startsAtInput = parseDateInput(formData.get("startsAt"), "starts_at");
    const endsAtInput = parseDateInput(formData.get("endsAt"), "ends_at");
    const expectedAttendance = normalizeOptionalNumber(formData.get("expectedAttendance"));

    if (!tenantSlug) {
      return { ok: false, message: "El slug del tenant es obligatorio." };
    }

    if (!name) {
      return { ok: false, message: "El nombre del evento es obligatorio." };
    }

    if (!venueRoomId) {
      return { ok: false, message: "La sala es obligatoria." };
    }

    if (startsAtInput.error || endsAtInput.error) {
      return { ok: false, message: startsAtInput.error ?? endsAtInput.error ?? "Horario invalido." };
    }

    if (!startsAtInput.value || !endsAtInput.value) {
      return { ok: false, message: "Las fechas de inicio y fin son obligatorias." };
    }

    if (!isStrictlyAfter(startsAtInput.value, endsAtInput.value)) {
      return { ok: false, message: "La fecha de fin debe ser posterior a la fecha de inicio." };
    }

    if (expectedAttendance !== null && expectedAttendance <= 0) {
      return { ok: false, message: "La asistencia esperada debe ser mayor a 0." };
    }

    const publishReadiness = await evaluatePublishChecks(tenantId, {
      id: "draft-preview",
      venue_room_id: venueRoomId,
      starts_at: startsAtInput.value,
      ends_at: endsAtInput.value,
      expected_attendance: expectedAttendance,
    });

    const event = await createEvent(tenantId, {
      name,
      status: "draft",
      startsAt: startsAtInput.value,
      endsAt: endsAtInput.value,
      venueRoomId,
      venueRoomLayoutId: null,
      expectedAttendance,
      createdBy: user.id,
    });

    for (const path of buildTenantPaths(tenantSlug, event.id)) {
      revalidatePath(path);
    }

    const warnings = getDraftWarnings(publishReadiness.checks);

    return {
      ok: true,
      message: "Borrador creado.",
      warning: warnings.length > 0 ? warnings.join(" ") : undefined,
      eventId: event.id,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "No se pudo crear el evento.";
    return { ok: false, message };
  }
}

export async function publishEventAction(formData: FormData): Promise<ActionResult> {
  try {
    const tenantId = normalizeTenantId(formData.get("tenantId"));
    const tenantSlug = String(formData.get("tenantSlug") ?? "").trim();
    await assertTenantAdmin(tenantId);
    const eventId = String(formData.get("eventId") ?? "").trim();

    if (!tenantSlug) {
      return { ok: false, message: "El slug del tenant es obligatorio." };
    }

    if (!eventId) {
      return { ok: false, message: "El id del evento es obligatorio." };
    }

    const event = await getEventById(tenantId, eventId);
    if (!event) {
      return { ok: false, message: "Evento no encontrado." };
    }

    const { checks } = await evaluatePublishChecks(tenantId, event);

    const blockedReasons: string[] = [];
    if (checks.missingRoom) blockedReasons.push("falta sala asignada");
    if (checks.invalidSchedule) blockedReasons.push("horario invalido");
    if (checks.capacityExceeded) blockedReasons.push("asistencia supera capacidad");
    if (checks.roomNeedsSetup) blockedReasons.push("la sala no tiene equipo asignado");
    if (checks.hasConflict) blockedReasons.push("existe conflicto de horario");

    if (blockedReasons.length > 0) {
      return {
        ok: false,
        message: `No se puede publicar: ${blockedReasons.join(", ")}.`,
      };
    }

    await publishEvent(tenantId, eventId);

    for (const path of buildTenantPaths(tenantSlug, eventId)) {
      revalidatePath(path);
    }

    return { ok: true, message: "Evento publicado." };
  } catch (error) {
    const message = error instanceof Error ? error.message : "No se pudo publicar el evento.";
    return { ok: false, message };
  }
}

export async function closeEventAction(formData: FormData): Promise<ActionResult> {
  try {
    const tenantId = normalizeTenantId(formData.get("tenantId"));
    const tenantSlug = String(formData.get("tenantSlug") ?? "").trim();
    await assertTenantAdmin(tenantId);
    const eventId = String(formData.get("eventId") ?? "").trim();

    if (!tenantSlug) {
      return { ok: false, message: "El slug del tenant es obligatorio." };
    }

    if (!eventId) {
      return { ok: false, message: "El id del evento es obligatorio." };
    }

    await closeEvent(tenantId, eventId);

    for (const path of buildTenantPaths(tenantSlug, eventId)) {
      revalidatePath(path);
    }

    return { ok: true, message: "Evento cerrado." };
  } catch (error) {
    const message = error instanceof Error ? error.message : "No se pudo cerrar el evento.";
    return { ok: false, message };
  }
}
