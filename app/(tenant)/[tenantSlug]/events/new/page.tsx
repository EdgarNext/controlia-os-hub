import { isTenantAccessDeniedError } from "../../../lib/access-errors";
import { resolveTenantModuleContext } from "@/lib/auth/module-role-guard";
import { getEventCreateData } from "../actions/eventActions";
import { EventWizardForm } from "./components/EventWizardForm";
import { StatePanel } from "./components/StatePanel";

type EventNewPageProps = {
  params: Promise<{ tenantSlug: string }>;
};

async function loadEventNewPageData(tenantSlug: string) {
  try {
    const tenant = await resolveTenantModuleContext(tenantSlug, "event_core", "read");
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

export default async function EventNewPage({ params }: EventNewPageProps) {
  const { tenantSlug } = await params;
  const result = await loadEventNewPageData(tenantSlug);

  if (result.permissionDenied) {
    return (
      <StatePanel
        kind="permission"
        title="Sin permisos para crear eventos"
        message="No tienes permisos para crear eventos en este tenant. Contacta al administrador."
      />
    );
  }

  const { tenant, data } = result;

  if (data.rooms.length === 0) {
    return (
      <StatePanel
        kind="empty"
        title="No hay salas disponibles"
        message="No tienes salas aun. Crea una sala para poder crear eventos."
      />
    );
  }

  return (
    <EventWizardForm
      tenantId={data.tenantId}
      tenantSlug={tenant.tenantSlug}
      rooms={data.rooms}
      roomIdsWithoutEquipment={data.roomIdsWithoutEquipment}
      recentEvents={data.events}
    />
  );
}
