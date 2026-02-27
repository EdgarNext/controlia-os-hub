import { resolveTenantContextBySlug } from "@/lib/auth/tenant-context";
import { isTenantAccessDeniedError } from "../../../lib/access-errors";
import { getVenueEquipmentData } from "../actions/venueActions";
import { StatePanel } from "../components/StatePanel";
import { EquipmentManagerClient } from "./components/EquipmentManagerClient";

type VenueEquipmentPageProps = {
  params: Promise<{ tenantSlug: string }>;
};

async function loadVenueEquipmentPageData(tenantSlug: string) {
  try {
    const tenant = await resolveTenantContextBySlug(tenantSlug);
    const data = await getVenueEquipmentData(tenant.tenantId);

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

export default async function VenueEquipmentPage({ params }: VenueEquipmentPageProps) {
  const { tenantSlug } = await params;
  const result = await loadVenueEquipmentPageData(tenantSlug);

  if (result.permissionDenied) {
    return (
      <StatePanel
        kind="permission"
        title="Sin permisos para equipo"
        message="No tienes permisos para gestionar el catalogo de equipo de este tenant. Contacta al administrador."
      />
    );
  }

  const { tenant, data } = result;

  return (
    <EquipmentManagerClient
      tenantId={data.tenantId}
      tenantSlug={tenant.tenantSlug}
      equipmentCatalog={data.equipmentCatalog}
    />
  );
}
