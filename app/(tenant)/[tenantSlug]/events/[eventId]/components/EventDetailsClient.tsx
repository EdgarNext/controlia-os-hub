"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CalendarClock, CheckCircle2, CircleAlert, ShieldAlert, TriangleAlert, Wrench } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/Modal";
import type { Event } from "@/types/events";
import type { Room, RoomLayout } from "@/types/venue";
import type { EventPublishChecks } from "../../actions/eventActions";
import { closeEventAction, publishEventAction } from "../../actions/eventActions";
import { EventStatusBadge } from "./EventStatusBadge";
import { StatePanel } from "./StatePanel";

type EventDetailsClientProps = {
  tenantId: string;
  tenantSlug: string;
  event: Event;
  room: Room | null;
  layout: RoomLayout | null;
  equipmentMissing: boolean;
  conflictEvents: Event[];
  publishChecks: EventPublishChecks;
};

type ChecklistItem = {
  id: string;
  label: string;
  status: "pass" | "fail" | "warn";
  detail: string;
};

export function EventDetailsClient({
  tenantId,
  tenantSlug,
  event,
  room,
  layout,
  equipmentMissing,
  conflictEvents,
  publishChecks,
}: EventDetailsClientProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [publishOpen, setPublishOpen] = useState(false);
  const [closeOpen, setCloseOpen] = useState(false);

  const canClose = event.status === "published";

  const publishBlocked =
    publishChecks.missingRoom ||
    publishChecks.invalidSchedule ||
    publishChecks.capacityExceeded ||
    publishChecks.roomNeedsSetup ||
    publishChecks.hasConflict;

  const canPublish = event.status === "draft" && !publishBlocked;

  const checklist: ChecklistItem[] = [
    {
      id: "room",
      label: "Sala asignada",
      status: publishChecks.missingRoom ? "fail" : "pass",
      detail: publishChecks.missingRoom ? "Falta seleccionar una sala." : "Sala configurada.",
    },
    {
      id: "schedule",
      label: "Horario valido",
      status: publishChecks.invalidSchedule ? "fail" : "pass",
      detail: publishChecks.invalidSchedule
        ? "La fecha de fin debe ser mayor que la fecha de inicio."
        : "Horario valido.",
    },
    {
      id: "capacity",
      label: "Control de capacidad",
      status: publishChecks.capacityExceeded ? "fail" : "pass",
      detail: publishChecks.capacityExceeded
        ? `La asistencia esperada supera la capacidad (${publishChecks.roomCapacity ?? "N/A"}).`
        : "Capacidad dentro de limite.",
    },
    {
      id: "room-setup",
      label: "Configuracion de sala",
      status: publishChecks.roomNeedsSetup ? "fail" : "pass",
      detail: publishChecks.roomNeedsSetup
        ? "La sala no tiene equipo asignado."
        : "Sala con equipo asignado.",
    },
    {
      id: "conflict",
      label: "Conflicto de horario",
      status: publishChecks.hasConflict ? "fail" : "pass",
      detail: publishChecks.hasConflict
        ? "Hay otro evento en esta sala en el mismo horario."
        : "Sin conflictos detectados.",
    },
  ];

  return (
    <div className="space-y-4">
      {equipmentMissing ? (
        <StatePanel
          kind="warning"
          title="Equipamiento faltante"
          message="Esta sala aun no tiene equipo asignado. Podras crear el borrador, pero no publicar hasta configurarla."
        >
          {room ? (
            <div className="mt-2">
              <Link
                href={`/${tenantSlug}/venue/rooms/${room.id}`}
                className="inline-flex rounded-[var(--radius-base)] border border-border bg-surface px-3 py-1.5 text-xs"
              >
                Ir a configuracion de sala
              </Link>
            </div>
          ) : null}
        </StatePanel>
      ) : null}

      {publishChecks.hasConflict ? (
        <StatePanel
          kind="warning"
          title="Conflicto detectado"
          message="Hay otro evento en esta sala en el mismo horario. Revisa antes de publicar."
        >
          {conflictEvents.length > 0 ? (
            <ul className="mt-2 list-disc space-y-1 pl-5 text-xs text-muted">
              {conflictEvents.slice(0, 3).map((item) => (
                <li key={item.id}>{item.name}</li>
              ))}
            </ul>
          ) : null}
        </StatePanel>
      ) : null}

      <div className="rounded-[var(--radius-base)] border border-border bg-surface p-4">
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-1">
            <h1 className="text-xl font-semibold">{event.name}</h1>
            <div className="inline-flex items-center gap-2">
              <CalendarClock className="h-4 w-4 text-muted" aria-hidden="true" />
              <p className="text-sm text-muted">
                {event.starts_at ? new Date(event.starts_at).toLocaleString() : "Sin fecha de inicio"}
              </p>
            </div>
          </div>
          <EventStatusBadge status={event.status} />
        </div>

        <dl className="mt-4 grid gap-3 text-sm md:grid-cols-2">
          <div className="rounded-[var(--radius-base)] border border-border bg-surface-2 p-3">
            <dt className="text-muted">Sala</dt>
            <dd className="font-medium">{room?.name ?? "Sin sala asignada"}</dd>
          </div>
          <div className="rounded-[var(--radius-base)] border border-border bg-surface-2 p-3">
            <dt className="text-muted">Distribucion</dt>
            <dd className="font-medium">{layout?.name ?? "Sin uso en MVP"}</dd>
          </div>
          <div className="rounded-[var(--radius-base)] border border-border bg-surface-2 p-3">
            <dt className="text-muted">Asistencia esperada</dt>
            <dd className="font-medium">{event.expected_attendance ?? "Sin definir"}</dd>
          </div>
          <div className="rounded-[var(--radius-base)] border border-border bg-surface-2 p-3">
            <dt className="text-muted">Fin</dt>
            <dd className="font-medium">{event.ends_at ? new Date(event.ends_at).toLocaleString() : "Sin definir"}</dd>
          </div>
        </dl>
      </div>

      <section className="rounded-[var(--radius-base)] border border-border bg-surface p-4">
        <h2 className="text-base font-semibold">Listo para publicar?</h2>

        <ul className="mt-3 space-y-2">
          {checklist.map((item) => (
            <li key={item.id} className="flex items-start gap-2 rounded-[var(--radius-base)] border border-border bg-surface-2 px-3 py-2 text-sm">
              {item.status === "pass" ? (
                <CheckCircle2 className="mt-0.5 h-4 w-4 text-success" aria-hidden="true" />
              ) : item.status === "warn" ? (
                <TriangleAlert className="mt-0.5 h-4 w-4 text-warning" aria-hidden="true" />
              ) : (
                <CircleAlert className="mt-0.5 h-4 w-4 text-danger" aria-hidden="true" />
              )}
              <div>
                <p className="font-medium">{item.label}</p>
                <p className="text-muted">{item.detail}</p>
              </div>
            </li>
          ))}
        </ul>

        <div className="mt-4 flex flex-wrap gap-2">
          <Button type="button" onClick={() => setPublishOpen(true)} disabled={!canPublish || isPending}>
            Publicar
          </Button>
          <Button type="button" variant="danger" onClick={() => setCloseOpen(true)} disabled={!canClose || isPending}>
            Cerrar
          </Button>

          {!canPublish ? (
            <p className="inline-flex items-center gap-1 text-sm text-muted">
              <Wrench className="h-4 w-4" />
              Publicacion bloqueada hasta completar el checklist.
            </p>
          ) : null}
        </div>
      </section>

      <Modal open={publishOpen} onClose={() => setPublishOpen(false)} title="Confirmar publicacion">
        <div className="space-y-4 text-sm">
          <p>Esta accion mueve el evento de borrador a publicado.</p>
          {publishBlocked ? (
            <div className="rounded-[var(--radius-base)] border border-danger/50 bg-danger/10 p-3 text-muted">
              No se puede publicar hasta que el checklist este en estado valido.
            </div>
          ) : null}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={() => setPublishOpen(false)} disabled={isPending}>
              Cancelar
            </Button>
            <Button
              type="button"
              isLoading={isPending}
              disabled={publishBlocked}
              onClick={() => {
                const formData = new FormData();
                formData.set("tenantId", tenantId);
                formData.set("tenantSlug", tenantSlug);
                formData.set("eventId", event.id);

                startTransition(async () => {
                  const result = await publishEventAction(formData);
                  if (!result.ok) {
                    toast.error(result.message);
                    return;
                  }

                  toast.success(result.message);
                  setPublishOpen(false);
                  router.refresh();
                });
              }}
            >
              Confirmar publicacion
            </Button>
          </div>
        </div>
      </Modal>

      <Modal open={closeOpen} onClose={() => setCloseOpen(false)} title="Cerrar evento (irreversible)">
        <div className="space-y-4 text-sm">
          <p className="inline-flex items-center gap-2 font-medium text-danger">
            <ShieldAlert className="h-4 w-4" />
            Cerrar un evento es irreversible.
          </p>
          <p className="text-muted">Continua solo si ya concluyeron la operacion y el reporte de este evento.</p>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={() => setCloseOpen(false)} disabled={isPending}>
              Cancelar
            </Button>
            <Button
              type="button"
              variant="danger"
              isLoading={isPending}
              onClick={() => {
                const formData = new FormData();
                formData.set("tenantId", tenantId);
                formData.set("tenantSlug", tenantSlug);
                formData.set("eventId", event.id);

                startTransition(async () => {
                  const result = await closeEventAction(formData);
                  if (!result.ok) {
                    toast.error(result.message);
                    return;
                  }

                  toast.success(result.message);
                  setCloseOpen(false);
                  router.refresh();
                });
              }}
            >
              Cerrar evento
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
