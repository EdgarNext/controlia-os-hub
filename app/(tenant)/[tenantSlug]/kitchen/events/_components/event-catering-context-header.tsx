import Link from "next/link";

type EventCateringContextHeaderProps = {
  tenantSlug: string;
  eventId: string | null;
  eventName?: string | null;
  eventDate?: string | null;
  planId: string | null;
  planName?: string | null;
  peopleBase?: number | null;
  operationalStatus?: string | null;
};

export function EventCateringContextHeader({
  tenantSlug,
  eventId,
  eventName,
  eventDate,
  planId,
  planName,
  peopleBase,
  operationalStatus,
}: EventCateringContextHeaderProps) {
  return (
    <section className="rounded-[var(--radius-base)] border border-primary/20 bg-primary/10 p-3 text-xs">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-foreground">
        <span>Evento: {eventName ?? (eventId ? eventId.slice(0, 8) : "—")}</span>
        <span>Fecha: {eventDate ? new Date(eventDate).toLocaleString("es-MX") : "—"}</span>
        <span>Servicio: {planName ?? (planId ? planId.slice(0, 8) : "—")}</span>
        <span>Personas / porciones a cubrir: {peopleBase != null ? Number(peopleBase).toLocaleString("es-MX") : "—"}</span>
        <span>Estado operativo: {operationalStatus ?? "—"}</span>
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-3 text-xs">
        {eventId ? <Link href={`/${tenantSlug}/kitchen/events/${eventId}/catering`} className="underline underline-offset-2">Abrir evento</Link> : null}
        {eventId && planId ? <Link href={`/${tenantSlug}/kitchen/events/${eventId}/catering/${planId}`} className="underline underline-offset-2">Abrir plan</Link> : null}
        <Link href={`/${tenantSlug}/kitchen/events/requisitions`} className="underline underline-offset-2">Requisiciones</Link>
        <Link href={`/${tenantSlug}/kitchen/events/receipts`} className="underline underline-offset-2">Recepciones</Link>
        <Link href={`/${tenantSlug}/kitchen/events/consumption`} className="underline underline-offset-2">Consumo</Link>
      </div>
    </section>
  );
}
