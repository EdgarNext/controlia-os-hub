"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, CalendarClock, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import type { Event } from "@/types/events";
import type { Room } from "@/types/venue";
import { createEventAction } from "../../actions/eventActions";
import { StatePanel } from "./StatePanel";

type EventWizardFormProps = {
  tenantId: string;
  tenantSlug: string;
  rooms: Room[];
  roomIdsWithoutEquipment: string[];
  recentEvents: Event[];
};

type WizardStep = 1 | 2 | 3 | 4;

type EventFormState = {
  name: string;
  startsAt: string;
  endsAt: string;
  roomId: string;
  expectedAttendance: string;
};

const STEP_LABELS: Record<WizardStep, string> = {
  1: "Datos basicos",
  2: "Horario",
  3: "Venue y capacidad",
  4: "Revision y creacion",
};

const INITIAL_STATE: EventFormState = {
  name: "",
  startsAt: "",
  endsAt: "",
  roomId: "",
  expectedAttendance: "",
};

function addHours(datetimeLocal: string, hours: number): string {
  const date = new Date(datetimeLocal);
  date.setHours(date.getHours() + hours);
  const timezoneOffset = date.getTimezoneOffset();
  const adjusted = new Date(date.getTime() - timezoneOffset * 60000);
  return adjusted.toISOString().slice(0, 16);
}

function calculateDuration(startsAt: string, endsAt: string): string {
  if (!startsAt || !endsAt) {
    return "";
  }

  const start = new Date(startsAt);
  const end = new Date(endsAt);
  const diffMs = end.getTime() - start.getTime();

  if (!Number.isFinite(diffMs) || diffMs <= 0) {
    return "";
  }

  const totalMinutes = Math.floor(diffMs / 60000);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  return `Duracion: ${hours}h ${minutes}m`;
}

export function EventWizardForm({ tenantId, tenantSlug, rooms, roomIdsWithoutEquipment, recentEvents }: EventWizardFormProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [step, setStep] = useState<WizardStep>(1);
  const [form, setForm] = useState<EventFormState>(INITIAL_STATE);
  const [actionError, setActionError] = useState<string | null>(null);

  const selectedRoom = useMemo(() => rooms.find((room) => room.id === form.roomId) ?? null, [rooms, form.roomId]);

  const expectedAttendance = form.expectedAttendance.trim() ? Number(form.expectedAttendance) : null;
  const expectedAttendanceInvalid = expectedAttendance !== null && (!Number.isFinite(expectedAttendance) || expectedAttendance <= 0);

  const capacityExceeded =
    selectedRoom !== null &&
    expectedAttendance !== null &&
    Number.isFinite(expectedAttendance) &&
    expectedAttendance > selectedRoom.default_capacity;

  const roomNeedsSetup = form.roomId ? roomIdsWithoutEquipment.includes(form.roomId) : false;

  const scheduleValid = useMemo(() => {
    if (!form.startsAt || !form.endsAt) {
      return false;
    }

    const start = new Date(form.startsAt).getTime();
    const end = new Date(form.endsAt).getTime();

    return Number.isFinite(start) && Number.isFinite(end) && end > start;
  }, [form.startsAt, form.endsAt]);

  const conflictingEvents = useMemo(() => {
    if (!form.roomId || !scheduleValid) {
      return [] as Event[];
    }

    const startMs = new Date(form.startsAt).getTime();
    const endMs = new Date(form.endsAt).getTime();

    return recentEvents.filter((event) => {
      if (event.venue_room_id !== form.roomId) {
        return false;
      }

      if (event.status === "closed") {
        return false;
      }

      if (!event.starts_at || !event.ends_at) {
        return false;
      }

      const eventStart = new Date(event.starts_at).getTime();
      const eventEnd = new Date(event.ends_at).getTime();

      return startMs < eventEnd && endMs > eventStart;
    });
  }, [form.roomId, form.startsAt, form.endsAt, recentEvents, scheduleValid]);

  const hasConflict = conflictingEvents.length > 0;

  const durationText = calculateDuration(form.startsAt, form.endsAt);

  const stepValid: Record<WizardStep, boolean> = {
    1: form.name.trim().length > 0,
    2: scheduleValid,
    3: Boolean(form.roomId) && !expectedAttendanceInvalid,
    4: form.name.trim().length > 0 && scheduleValid && Boolean(form.roomId) && !expectedAttendanceInvalid,
  };

  const canContinue = stepValid[step];

  const goNext = () => {
    if (!canContinue || step === 4) {
      return;
    }

    setStep((current) => (current + 1) as WizardStep);
  };

  const goBack = () => {
    if (step === 1) {
      return;
    }

    setStep((current) => (current - 1) as WizardStep);
  };

  const onStartsAtChange = (value: string) => {
    setForm((prev) => {
      const next = { ...prev, startsAt: value };

      if (!value) {
        return next;
      }

      const autoEnd = addHours(value, 2);
      if (!prev.endsAt) {
        next.endsAt = autoEnd;
        return next;
      }

      if (new Date(prev.endsAt).getTime() < new Date(value).getTime()) {
        next.endsAt = autoEnd;
      }

      return next;
    });
  };

  const createDraft = () => {
    if (!stepValid[4]) {
      return;
    }

    startTransition(async () => {
      const formData = new FormData();
      formData.set("tenantId", tenantId);
      formData.set("tenantSlug", tenantSlug);
      formData.set("name", form.name.trim());
      formData.set("startsAt", form.startsAt);
      formData.set("endsAt", form.endsAt);
      formData.set("venueRoomId", form.roomId);
      formData.set("expectedAttendance", form.expectedAttendance.trim());

      const result = await createEventAction(formData);

      if (!result.ok) {
        setActionError(result.message);
        return;
      }

      setActionError(null);
      toast.success(result.message);

      if (result.warning) {
        toast.warning(result.warning);
      }

      if (result.eventId) {
        router.push(`/${tenantSlug}/events/${result.eventId}`);
        return;
      }

      router.push(`/${tenantSlug}/events`);
    });
  };

  return (
    <div className="space-y-4">
      <header className="rounded-[var(--radius-base)] border border-border bg-surface p-4">
        <h1 className="text-xl font-semibold">Crear evento</h1>
        <p className="text-sm text-muted">Crea un borrador. Publica cuando todo este listo.</p>

        <ol className="mt-4 grid gap-2 sm:grid-cols-4">
          {[1, 2, 3, 4].map((index) => {
            const typed = index as WizardStep;
            const isActive = step === typed;
            const isComplete = typed < step;

            return (
              <li
                key={typed}
                className={[
                  "rounded-[var(--radius-base)] border px-3 py-2 text-sm",
                  isActive
                    ? "border-primary bg-primary text-primary-foreground"
                    : isComplete
                      ? "border-success bg-success text-foreground"
                      : "border-border bg-surface-2 text-muted",
                ].join(" ")}
              >
                <span className="font-medium">{index}. </span>
                {STEP_LABELS[typed]}
              </li>
            );
          })}
        </ol>
      </header>

      {actionError ? <StatePanel kind="error" title="No se pudo crear el borrador" message={actionError} /> : null}

      <section className="rounded-[var(--radius-base)] border border-border bg-surface p-4">
        {step === 1 ? (
          <div className="space-y-3">
            <h2 className="text-base font-semibold">1) Basics</h2>
            <label className="space-y-1 text-sm">
              <span className="text-muted">Nombre del evento</span>
              <input
                value={form.name}
                onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))}
                className="w-full rounded-[var(--radius-base)] border border-border bg-surface-2 px-3 py-2"
                placeholder="Cumbre anual de socios"
              />
            </label>
            {!stepValid[1] ? (
              <p className="text-sm text-danger">El nombre del evento es obligatorio.</p>
            ) : null}
          </div>
        ) : null}

        {step === 2 ? (
          <div className="space-y-3">
            <h2 className="text-base font-semibold">2) Horario</h2>
            <div className="grid gap-3 md:grid-cols-2">
              <label className="space-y-1 text-sm">
                <span className="text-muted">Inicio</span>
                <input
                  type="datetime-local"
                  value={form.startsAt}
                  onChange={(event) => onStartsAtChange(event.target.value)}
                  className="w-full rounded-[var(--radius-base)] border border-border bg-surface-2 px-3 py-2"
                />
              </label>

              <label className="space-y-1 text-sm">
                <span className="text-muted">Fin</span>
                <input
                  type="datetime-local"
                  min={form.startsAt || undefined}
                  value={form.endsAt}
                  onChange={(event) => setForm((prev) => ({ ...prev, endsAt: event.target.value }))}
                  className="w-full rounded-[var(--radius-base)] border border-border bg-surface-2 px-3 py-2"
                />
              </label>
            </div>

            {durationText ? (
              <p className="inline-flex items-center gap-2 text-sm text-muted">
                <CalendarClock className="h-4 w-4" />
                {durationText}
              </p>
            ) : null}

            {!stepValid[2] ? (
              <p className="text-sm text-danger">La fecha de fin debe ser mayor que la de inicio.</p>
            ) : null}
          </div>
        ) : null}

        {step === 3 ? (
          <div className="space-y-3">
            <h2 className="text-base font-semibold">3) Venue y capacidad</h2>

            <label className="space-y-1 text-sm">
              <span className="text-muted">Sala</span>
              <select
                value={form.roomId}
                onChange={(event) => setForm((prev) => ({ ...prev, roomId: event.target.value }))}
                className="w-full rounded-[var(--radius-base)] border border-border bg-surface-2 px-3 py-2"
              >
                <option value="">Seleccionar sala</option>
                {rooms.map((room) => (
                  <option key={room.id} value={room.id}>
                    {room.name} (cap. {room.default_capacity})
                  </option>
                ))}
              </select>
            </label>

            <label className="space-y-1 text-sm">
              <span className="text-muted">Asistencia esperada (opcional)</span>
              <input
                type="number"
                min={1}
                value={form.expectedAttendance}
                onChange={(event) => setForm((prev) => ({ ...prev, expectedAttendance: event.target.value }))}
                className="w-full rounded-[var(--radius-base)] border border-border bg-surface-2 px-3 py-2"
                placeholder="250"
              />
            </label>

            {expectedAttendanceInvalid ? (
              <p className="text-sm text-danger">La asistencia esperada debe ser mayor que 0.</p>
            ) : null}

            {roomNeedsSetup ? (
              <StatePanel
                kind="warning"
                title="Sala con setup pendiente"
                message="Esta sala aun no tiene equipo asignado. Podras crear el borrador, pero no publicar hasta configurarla."
              />
            ) : null}

            {capacityExceeded ? (
              <StatePanel
                kind="warning"
                title="Capacidad superada"
                message="La asistencia esperada supera la capacidad de la sala. Se permite borrador, pero bloqueara la publicacion."
              />
            ) : null}

            {hasConflict ? (
              <StatePanel
                kind="warning"
                title="Conflicto de horario"
                message="Hay otro evento en esta sala en el mismo horario. Revisa antes de publicar."
              >
                <ul className="mt-2 list-disc space-y-1 pl-5 text-xs text-muted">
                  {conflictingEvents.slice(0, 3).map((item) => (
                    <li key={item.id}>{item.name}</li>
                  ))}
                </ul>
              </StatePanel>
            ) : null}

            {!form.roomId ? <p className="text-sm text-danger">Debes seleccionar una sala.</p> : null}
          </div>
        ) : null}

        {step === 4 ? (
          <div className="space-y-3">
            <h2 className="text-base font-semibold">4) Revision y creacion</h2>
            <div className="grid gap-3 text-sm md:grid-cols-2">
              <div className="rounded-[var(--radius-base)] border border-border bg-surface-2 p-3">
                <p className="text-muted">Evento</p>
                <p className="font-medium">{form.name || "-"}</p>
              </div>
              <div className="rounded-[var(--radius-base)] border border-border bg-surface-2 p-3">
                <p className="text-muted">Sala</p>
                <p className="font-medium">{selectedRoom?.name ?? "-"}</p>
              </div>
              <div className="rounded-[var(--radius-base)] border border-border bg-surface-2 p-3">
                <p className="text-muted">Horario</p>
                <p className="font-medium">{form.startsAt && form.endsAt ? `${form.startsAt} -> ${form.endsAt}` : "-"}</p>
              </div>
              <div className="rounded-[var(--radius-base)] border border-border bg-surface-2 p-3">
                <p className="text-muted">Asistencia esperada</p>
                <p className="font-medium">{form.expectedAttendance || "-"}</p>
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              <span className="inline-flex items-center gap-1 rounded-full border border-border bg-surface-2 px-2.5 py-1 text-xs font-medium">
                <CheckCircle2 className="h-3.5 w-3.5 text-success" />
                Borrador permitido
              </span>
              {roomNeedsSetup ? (
                <span className="inline-flex items-center gap-1 rounded-full border border-warning/50 bg-warning/10 px-2.5 py-1 text-xs font-medium">
                  <AlertTriangle className="h-3.5 w-3.5 text-warning" />
                  Sala pendiente de configuracion
                </span>
              ) : null}
              {hasConflict ? (
                <span className="inline-flex items-center gap-1 rounded-full border border-warning/50 bg-warning/10 px-2.5 py-1 text-xs font-medium">
                  <AlertTriangle className="h-3.5 w-3.5 text-warning" />
                  Conflicto de horario
                </span>
              ) : null}
              {capacityExceeded ? (
                <span className="inline-flex items-center gap-1 rounded-full border border-warning/50 bg-warning/10 px-2.5 py-1 text-xs font-medium">
                  <AlertTriangle className="h-3.5 w-3.5 text-warning" />
                  Capacidad excedida
                </span>
              ) : null}
            </div>
          </div>
        ) : null}
      </section>

      <footer className="flex items-center justify-between">
          <Button type="button" variant="secondary" onClick={goBack} disabled={step === 1 || isPending}>
          Volver
        </Button>

        {step < 4 ? (
          <Button type="button" onClick={goNext} disabled={!canContinue || isPending}>
            Continuar
          </Button>
        ) : (
          <Button type="button" onClick={createDraft} isLoading={isPending} disabled={!stepValid[4]}>
            Crear borrador
          </Button>
        )}
      </footer>
    </div>
  );
}
