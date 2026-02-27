import Link from "next/link";
import { notFound } from "next/navigation";
import { resolveTenantContextBySlug } from "@/lib/auth/tenant-context";
import { isTenantAccessDeniedError } from "../../../../lib/access-errors";
import { getRoomSetupData } from "../../actions/venueActions";
import { StatePanel } from "../../components/StatePanel";
import { RoomSetupClient } from "./components/RoomSetupClient";

type RoomSetupPageProps = {
  params: Promise<{ tenantSlug: string; room_id: string }>;
};

async function loadRoomSetupPageData(tenantSlug: string, roomId: string) {
  try {
    const tenant = await resolveTenantContextBySlug(tenantSlug);
    const data = await getRoomSetupData(tenant.tenantId, roomId);

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

export default async function RoomSetupPage({ params }: RoomSetupPageProps) {
  const { tenantSlug, room_id: roomId } = await params;
  const result = await loadRoomSetupPageData(tenantSlug, roomId);

  if (result.permissionDenied) {
    return (
      <StatePanel
        kind="permission"
        title="Sin permisos para configurar sala"
        message="No tienes permisos para configurar el equipo de esta sala. Contacta al administrador."
      />
    );
  }

  const { tenant, data } = result;

  if (!data) {
    notFound();
  }

  return (
    <div className="space-y-4">
      <div>
        <Link
          href={`/${tenant.tenantSlug}/venue/rooms`}
          className="inline-flex rounded-[var(--radius-base)] border border-border bg-surface-2 px-3 py-2 text-sm"
        >
          Volver a salas
        </Link>
      </div>

      <RoomSetupClient
        tenantId={data.tenantId}
        tenantSlug={tenant.tenantSlug}
        room={data.room}
        assignedEquipment={data.assignedEquipment}
        equipmentCatalog={data.equipmentCatalog}
      />
    </div>
  );
}
