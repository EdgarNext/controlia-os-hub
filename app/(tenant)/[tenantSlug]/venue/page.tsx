import Link from "next/link";
import { AlertTriangle, CheckCircle2, Wrench } from "lucide-react";
import { resolveTenantContextBySlug } from "@/lib/auth/tenant-context";
import { isTenantAccessDeniedError } from "../../lib/access-errors";
import { getVenueConfigData } from "./actions/venueActions";
import { RoomSetupStatusBadge } from "./components/RoomSetupStatusBadge";
import { StatePanel } from "./components/StatePanel";

type VenuePageProps = {
  params: Promise<{ tenantSlug: string }>;
};

type VenueHealthState = "no_rooms" | "no_equipment" | "needs_setup" | "healthy";

function getVenueHealthState(data: Awaited<ReturnType<typeof getVenueConfigData>>): VenueHealthState {
  if (data.rooms.length === 0) {
    return "no_rooms";
  }

  if (data.equipmentCatalog.length === 0) {
    return "no_equipment";
  }

  if (data.roomIdsWithoutEquipment.length > 0) {
    return "needs_setup";
  }

  return "healthy";
}

async function loadVenuePageData(tenantSlug: string) {
  try {
    const tenant = await resolveTenantContextBySlug(tenantSlug);
    const data = await getVenueConfigData(tenant.tenantId);

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

export default async function VenuePage({ params }: VenuePageProps) {
  const { tenantSlug } = await params;
  const result = await loadVenuePageData(tenantSlug);

  if (result.permissionDenied) {
    return (
      <StatePanel
        kind="error"
        title="Sin permisos para Venue Config"
        message="Tu usuario no tiene acceso a salas/equipamiento de este tenant. Contacta al administrador para habilitar permisos."
      />
    );
  }

  const { tenant, data } = result;
  const venueHealthState = getVenueHealthState(data);

  const roomsById = new Map(data.rooms.map((room) => [room.id, room]));
  const roomsNeedingSetup = data.roomIdsWithoutEquipment
    .map((roomId) => roomsById.get(roomId))
    .filter((room): room is NonNullable<typeof room> => Boolean(room));

  const healthCopy = {
    no_rooms: {
      title: "No rooms",
      message: "No tienes salas aun. Crea una sala para poder crear eventos.",
      kind: "warning" as const,
    },
    no_equipment: {
      title: "No equipment",
      message: "Crea tu catalogo de equipo para asignarlo a cada sala.",
      kind: "warning" as const,
    },
    needs_setup: {
      title: "Needs setup",
      message: "Hay salas sin equipo asignado. Configuralas para publicar eventos sin friccion.",
      kind: "warning" as const,
    },
    healthy: {
      title: "Healthy",
      message: "Tu configuracion de venue esta lista para operar y publicar eventos.",
      kind: "empty" as const,
    },
  }[venueHealthState];

  return (
    <div className="space-y-4">
      <section className="rounded-[var(--radius-base)] border border-border bg-surface p-4">
        <div className="mb-3 flex items-center gap-2">
          {venueHealthState === "healthy" ? (
            <CheckCircle2 className="h-5 w-5 text-success" aria-hidden="true" />
          ) : (
            <AlertTriangle className="h-5 w-5 text-warning" aria-hidden="true" />
          )}
          <h2 className="text-lg font-semibold">Venue health</h2>
        </div>

        <StatePanel kind={healthCopy.kind} title={healthCopy.title} message={healthCopy.message} />

        <div className="mt-4 grid gap-3 md:grid-cols-3">
          <div className="rounded-[var(--radius-base)] border border-border bg-surface-2 p-3">
            <p className="text-xs text-muted">Rooms</p>
            <p className="text-2xl font-semibold">{data.rooms.length}</p>
          </div>
          <div className="rounded-[var(--radius-base)] border border-border bg-surface-2 p-3">
            <p className="text-xs text-muted">Equipment</p>
            <p className="text-2xl font-semibold">{data.equipmentCatalog.length}</p>
          </div>
          <div className="rounded-[var(--radius-base)] border border-border bg-surface-2 p-3">
            <p className="text-xs text-muted">Needs setup</p>
            <p className="text-2xl font-semibold">{data.roomIdsWithoutEquipment.length}</p>
          </div>
        </div>
      </section>

      <section className="rounded-[var(--radius-base)] border border-border bg-surface p-4">
        <div className="mb-3 flex items-center gap-2">
          <Wrench className="h-5 w-5 text-primary" aria-hidden="true" />
          <h2 className="text-lg font-semibold">Rooms needing setup</h2>
        </div>

        {roomsNeedingSetup.length === 0 ? (
          <div className="rounded-[var(--radius-base)] border border-border bg-surface-2 p-4 text-sm text-muted">
            Todas las salas tienen equipo asignado.
          </div>
        ) : (
          <ul className="space-y-2">
            {roomsNeedingSetup.map((room) => (
              <li
                key={room.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-[var(--radius-base)] border border-border bg-surface-2 px-3 py-2"
              >
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium">{room.name}</span>
                  <RoomSetupStatusBadge needsSetup />
                </div>

                <Link
                  href={`/${tenant.tenantSlug}/venue/rooms/${room.id}`}
                  className="inline-flex rounded-[var(--radius-base)] border border-border bg-surface px-3 py-1.5 text-sm"
                >
                  Setup room
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <div className="flex flex-wrap items-center gap-2">
        <Link
          href={`/${tenant.tenantSlug}/venue/rooms`}
          className="inline-flex rounded-[var(--radius-base)] border border-border bg-surface-2 px-3 py-2 text-sm"
        >
          Create room
        </Link>
        <Link
          href={`/${tenant.tenantSlug}/venue/equipment`}
          className="inline-flex rounded-[var(--radius-base)] border border-border bg-surface-2 px-3 py-2 text-sm"
        >
          Create equipment
        </Link>
      </div>
    </div>
  );
}
