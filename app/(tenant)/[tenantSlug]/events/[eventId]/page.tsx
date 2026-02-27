import { resolveTenantContextBySlug } from "@/lib/auth/tenant-context";
import { isTenantAccessDeniedError } from "../../../lib/access-errors";
import { getEventDetailsData } from "../actions/eventActions";
import { EventDetailsClient } from "./components/EventDetailsClient";
import { StatePanel } from "./components/StatePanel";

type EventDetailsPageProps = {
  params: Promise<{ tenantSlug: string; eventId: string }>;
};

async function loadEventDetailsPageData(tenantSlug: string, eventId: string) {
  try {
    const tenant = await resolveTenantContextBySlug(tenantSlug);
    const data = await getEventDetailsData(tenant.tenantId, eventId);

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

export default async function EventDetailsPage({ params }: EventDetailsPageProps) {
  const { tenantSlug, eventId } = await params;
  const result = await loadEventDetailsPageData(tenantSlug, eventId);

  if (result.permissionDenied) {
    return (
      <StatePanel
        kind="permission"
        title="Sin permisos para ver este evento"
        message="Tu usuario no tiene acceso a este recurso dentro del tenant. Contacta al administrador."
      />
    );
  }

  const { tenant, data } = result;

  if (!data.event) {
    return <StatePanel kind="empty" title="Evento no encontrado" message="No existe un evento con ese identificador en este tenant." />;
  }

  return (
    <EventDetailsClient
      tenantId={data.tenantId}
      tenantSlug={tenant.tenantSlug}
      event={data.event}
      room={data.room}
      layout={data.layout}
      equipmentMissing={data.equipmentMissing}
      conflictEvents={data.conflictEvents}
      publishChecks={data.publishChecks}
    />
  );
}
