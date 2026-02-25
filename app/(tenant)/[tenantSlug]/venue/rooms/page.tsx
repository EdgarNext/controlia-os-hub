import { resolveTenantContextBySlug } from "@/lib/auth/tenant-context";
import { isTenantAccessDeniedError } from "../../../lib/access-errors";
import { getVenueRoomsData } from "../actions/venueActions";
import { StatePanel } from "../components/StatePanel";
import { RoomsManagerClient } from "./components/RoomsManagerClient";

type VenueRoomsPageProps = {
  params: Promise<{ tenantSlug: string }>;
};

async function loadVenueRoomsPageData(tenantSlug: string) {
  try {
    const tenant = await resolveTenantContextBySlug(tenantSlug);
    const data = await getVenueRoomsData(tenant.tenantId);

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

export default async function VenueRoomsPage({ params }: VenueRoomsPageProps) {
  const { tenantSlug } = await params;
  const result = await loadVenueRoomsPageData(tenantSlug);

  if (result.permissionDenied) {
    return (
      <StatePanel
        kind="error"
        title="Sin permisos para salas"
        message="No tienes permisos para gestionar salas de este tenant. Contacta al administrador."
      />
    );
  }

  const { tenant, data } = result;

  return <RoomsManagerClient tenantId={data.tenantId} tenantSlug={tenant.tenantSlug} rooms={data.rooms} />;
}
