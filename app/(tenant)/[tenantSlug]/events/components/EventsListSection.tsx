import Link from "next/link";
import { TriangleAlert } from "lucide-react";
import { resolveTenantContextBySlug } from "@/lib/auth/tenant-context";
import { isTenantAccessDeniedError } from "../../../lib/access-errors";
import { getEventCreateData } from "../actions/eventActions";
import { EventStatusBadge } from "../[eventId]/components/EventStatusBadge";
import { StatePanel } from "../create/components/StatePanel";

type StatusFilter = "all" | "draft" | "published";

function formatEventDate(startsAt: string | null) {
  if (!startsAt) {
    return "Sin fecha";
  }

  return new Date(startsAt).toLocaleString();
}

async function loadEventsListData(tenantSlug: string) {
  try {
    const tenant = await resolveTenantContextBySlug(tenantSlug);
    const data = await getEventCreateData(tenant.tenantId, { limit: 50 });

    return {
      tenant,
      data,
      permissionDenied: false as const,
    };
  } catch (error) {
    if (isTenantAccessDeniedError(error)) {
      return {
        permissionDenied: true as const,
      };
    }

    throw error;
  }
}

export async function EventsListSection({ tenantSlug, statusFilter }: { tenantSlug: string; statusFilter: StatusFilter }) {
  const result = await loadEventsListData(tenantSlug);

  if (result.permissionDenied) {
    return (
      <StatePanel
        kind="permission"
        title="Sin permisos para eventos"
        message="No tienes permisos para consultar eventos de este tenant. Contacta al administrador para habilitar acceso."
      />
    );
  }

  const { tenant, data } = result;
  const roomById = new Map(data.rooms.map((room) => [room.id, room]));

  const filteredEvents = data.events.filter((event) => {
    if (statusFilter === "all") {
      return true;
    }

    return event.status === statusFilter;
  });

  const hasNoRooms = data.rooms.length === 0;
  const hasRoomsWithoutEquipment = data.roomIdsWithoutEquipment.length > 0;

  return (
    <div className="space-y-4">
      {hasNoRooms ? (
        <div className="rounded-[var(--radius-base)] border border-warning/50 bg-warning/10 p-4 text-sm">
          <p className="inline-flex items-center gap-2 font-medium">
            <TriangleAlert className="h-4 w-4" />
            Venue setup pendiente: no hay salas configuradas.
          </p>
          <div className="mt-2">
            <Link
              href={`/${tenant.tenantSlug}/venue/rooms`}
              className="inline-flex rounded-[var(--radius-base)] border border-border bg-surface px-3 py-1.5 text-sm"
            >
              Crear sala
            </Link>
          </div>
        </div>
      ) : null}

      {!hasNoRooms && hasRoomsWithoutEquipment ? (
        <div className="rounded-[var(--radius-base)] border border-warning/50 bg-warning/10 p-4 text-sm">
          <p className="inline-flex items-center gap-2 font-medium">
            <TriangleAlert className="h-4 w-4" />
            Hay salas sin equipo asignado.
          </p>
          <p className="mt-1 text-muted">Resuelve la configuracion del venue para publicar eventos sin friccion.</p>
          <div className="mt-2">
            <Link
              href={`/${tenant.tenantSlug}/venue`}
              className="inline-flex rounded-[var(--radius-base)] border border-border bg-surface px-3 py-1.5 text-sm"
            >
              Resolver configuracion del venue
            </Link>
          </div>
        </div>
      ) : null}

      {filteredEvents.length === 0 ? (
        <StatePanel
          kind="empty"
          title="Aun no hay eventos"
          message="Crea un borrador para comenzar la operacion."
        />
      ) : (
        <ul className="space-y-2">
          {filteredEvents.map((event) => (
            <li key={event.id} className="rounded-[var(--radius-base)] border border-border bg-surface p-3">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <p className="font-medium">{event.name}</p>
                  <p className="text-sm text-muted">
                    {formatEventDate(event.starts_at)} | Sala: {event.venue_room_id ? roomById.get(event.venue_room_id)?.name ?? "Sin sala" : "Sin sala"}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <EventStatusBadge status={event.status} />
                  <Link
                    href={`/${tenant.tenantSlug}/events/${event.id}`}
                    className="rounded-[var(--radius-base)] border border-border bg-surface-2 px-3 py-1.5 text-sm"
                  >
                    Abrir
                  </Link>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
