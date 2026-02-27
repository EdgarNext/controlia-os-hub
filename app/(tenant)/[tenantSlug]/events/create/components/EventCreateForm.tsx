"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CalendarPlus2, TriangleAlert } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import type { Event } from "@/types/events";
import type { Room, RoomLayout } from "@/types/venue";
import { createEventAction } from "../../actions/eventActions";
import { StatePanel } from "./StatePanel";

type EventCreateFormProps = {
  tenantId: string;
  tenantSlug: string;
  rooms: Room[];
  roomLayouts: RoomLayout[];
  roomIdsWithoutEquipment: string[];
  recentEvents: Event[];
};

export function EventCreateForm({
  tenantId,
  tenantSlug,
  rooms,
  roomLayouts,
  roomIdsWithoutEquipment,
  recentEvents,
}: EventCreateFormProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [selectedRoomId, setSelectedRoomId] = useState("");
  const [actionError, setActionError] = useState<string | null>(null);

  const layoutsForRoom = useMemo(
    () => roomLayouts.filter((layout) => layout.room_id === selectedRoomId),
    [roomLayouts, selectedRoomId],
  );

  const missingEquipmentForSelectedRoom = selectedRoomId
    ? roomIdsWithoutEquipment.includes(selectedRoomId)
    : false;

  return (
    <div className="space-y-4">
      <div className="rounded-[var(--radius-base)] border border-border bg-surface p-4">
        <div className="mb-3 flex items-center gap-2">
          <CalendarPlus2 className="h-5 w-5 text-primary" aria-hidden="true" />
          <h1 className="text-xl font-semibold">Crear evento</h1>
        </div>
        <p className="text-sm text-muted">Crea un borrador y publicalo cuando pase todas las validaciones de venue.</p>

        {actionError ? (
          <div className="mt-4">
            <StatePanel kind="error" title="Validacion bloqueada" message={actionError} />
          </div>
        ) : null}

        {missingEquipmentForSelectedRoom ? (
          <div className="mt-4 rounded-[var(--radius-base)] border border-warning/50 bg-warning/10 p-3 text-sm">
            <p className="inline-flex items-center gap-2 font-medium">
              <TriangleAlert className="h-4 w-4" />
              Equipamiento faltante en el room seleccionado.
            </p>
            <p className="mt-1 text-muted">Puedes crear el draft, pero se recomienda completar equipamiento antes de publicar.</p>
          </div>
        ) : null}

        <form
          className="mt-4 grid gap-3 md:grid-cols-2"
          onSubmit={(event) => {
            event.preventDefault();
            const form = event.currentTarget;
            const formData = new FormData(form);
            formData.set("tenantId", tenantId);
            formData.set("tenantSlug", tenantSlug);

            startTransition(async () => {
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

              form.reset();
              setSelectedRoomId("");
              router.refresh();
            });
          }}
        >
          <label className="space-y-1 text-sm md:col-span-2">
            <span className="text-muted">Nombre del evento</span>
            <input
              name="name"
              required
              placeholder="Cumbre anual de socios"
              className="w-full rounded-[var(--radius-base)] border border-border bg-surface-2 px-3 py-2"
            />
          </label>

          <label className="space-y-1 text-sm">
            <span className="text-muted">Sala</span>
            <select
              name="venueRoomId"
              required
              className="w-full rounded-[var(--radius-base)] border border-border bg-surface-2 px-3 py-2"
              value={selectedRoomId}
              onChange={(event) => setSelectedRoomId(event.target.value)}
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
            <span className="text-muted">Distribucion</span>
            <select
              name="venueRoomLayoutId"
              className="w-full rounded-[var(--radius-base)] border border-border bg-surface-2 px-3 py-2"
              disabled={!selectedRoomId}
            >
              <option value="">Sin distribucion</option>
              {layoutsForRoom.map((layout) => (
                <option key={layout.id} value={layout.id}>
                  {layout.name} (cap. {layout.capacity})
                </option>
              ))}
            </select>
          </label>

          <label className="space-y-1 text-sm">
            <span className="text-muted">Asistencia esperada</span>
            <input
              name="expectedAttendance"
              required
              min={1}
              type="number"
              placeholder="250"
              className="w-full rounded-[var(--radius-base)] border border-border bg-surface-2 px-3 py-2"
            />
          </label>

          <label className="space-y-1 text-sm">
            <span className="text-muted">Inicio</span>
            <input name="startsAt" type="datetime-local" className="w-full rounded-[var(--radius-base)] border border-border bg-surface-2 px-3 py-2" />
          </label>

          <label className="space-y-1 text-sm md:col-span-2">
            <span className="text-muted">Fin</span>
            <input name="endsAt" type="datetime-local" className="w-full rounded-[var(--radius-base)] border border-border bg-surface-2 px-3 py-2" />
          </label>

          <div className="md:col-span-2">
            <Button type="submit" isLoading={isPending}>Crear borrador</Button>
          </div>
        </form>
      </div>

      <div className="rounded-[var(--radius-base)] border border-border bg-surface p-4">
        <h2 className="mb-3 text-base font-semibold">Eventos recientes</h2>
        {recentEvents.length === 0 ? (
          <StatePanel kind="empty" title="Aun no hay eventos" message="Crea el primer borrador de evento para este tenant." />
        ) : (
          <ul className="space-y-2 text-sm">
            {recentEvents.slice(0, 5).map((item) => (
              <li key={item.id} className="rounded-[var(--radius-base)] border border-border bg-surface-2 px-3 py-2">
                <p className="font-medium">{item.name}</p>
                <p className="text-muted">Estado: {item.status}</p>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
