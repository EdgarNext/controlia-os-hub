"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import { Trash2, TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { Equipment, Room } from "@/types/venue";
import { createEquipmentAction, createRoomAction, deleteEquipmentAction, deleteRoomAction } from "../actions/venueActions";
import { StatePanel } from "./StatePanel";

type VenueConfigClientProps = {
  tenantId: string;
  tenantSlug: string;
  rooms: Room[];
  equipmentCatalog: Equipment[];
  roomIdsWithoutEquipment: string[];
};

export function VenueConfigClient({
  tenantId,
  tenantSlug,
  rooms,
  equipmentCatalog,
  roomIdsWithoutEquipment,
}: VenueConfigClientProps) {
  const [isPending, startTransition] = useTransition();

  return (
    <div className="space-y-6">
      {roomIdsWithoutEquipment.length > 0 ? (
        <StatePanel
          kind="warning"
          title="Equipamiento faltante"
          message="Some rooms do not have equipment assigned yet."
        >
          <p className="text-xs text-muted">Rooms affected: {roomIdsWithoutEquipment.length}</p>
        </StatePanel>
      ) : null}

      <section className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-[var(--radius-base)] border border-border bg-surface p-4">
          <h2 className="text-base font-semibold">Create room</h2>
          <form
            className="mt-3 space-y-3"
            onSubmit={(event) => {
              event.preventDefault();
              const form = event.currentTarget;
              const formData = new FormData(form);
              formData.set("tenantId", tenantId);
              formData.set("tenantSlug", tenantSlug);

              startTransition(async () => {
                const result = await createRoomAction(formData);
                if (!result.ok) {
                  toast.error(result.message);
                  return;
                }
                toast.success(result.message);
                form.reset();
              });
            }}
          >
            <input name="name" required placeholder="Main Hall" className="w-full rounded-[var(--radius-base)] border border-border bg-surface-2 px-3 py-2 text-sm" />
            <input name="code" placeholder="HALL-A" className="w-full rounded-[var(--radius-base)] border border-border bg-surface-2 px-3 py-2 text-sm" />
            <input
              name="defaultCapacity"
              type="number"
              min={1}
              required
              placeholder="500"
              className="w-full rounded-[var(--radius-base)] border border-border bg-surface-2 px-3 py-2 text-sm"
            />
            <Button type="submit" isLoading={isPending}>Create room</Button>
          </form>
        </div>

        <div className="rounded-[var(--radius-base)] border border-border bg-surface p-4">
          <h2 className="text-base font-semibold">Create equipment</h2>
          <form
            className="mt-3 space-y-3"
            onSubmit={(event) => {
              event.preventDefault();
              const form = event.currentTarget;
              const formData = new FormData(form);
              formData.set("tenantId", tenantId);
              formData.set("tenantSlug", tenantSlug);

              startTransition(async () => {
                const result = await createEquipmentAction(formData);
                if (!result.ok) {
                  toast.error(result.message);
                  return;
                }
                toast.success(result.message);
                form.reset();
              });
            }}
          >
            <input name="name" required placeholder="Projector" className="w-full rounded-[var(--radius-base)] border border-border bg-surface-2 px-3 py-2 text-sm" />
            <input
              name="equipmentType"
              placeholder="visual"
              className="w-full rounded-[var(--radius-base)] border border-border bg-surface-2 px-3 py-2 text-sm"
            />
            <Button type="submit" isLoading={isPending}>Create equipment</Button>
          </form>
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-[var(--radius-base)] border border-border bg-surface p-4">
          <h2 className="mb-3 text-base font-semibold">Rooms</h2>
          {rooms.length === 0 ? (
            <StatePanel kind="empty" title="No rooms yet" message="Create your first room to configure venue capacity." />
          ) : (
            <ul className="space-y-2">
              {rooms.map((room) => {
                const missingEquipment = roomIdsWithoutEquipment.includes(room.id);

                return (
                  <li key={room.id} className="flex items-center justify-between gap-3 rounded-[var(--radius-base)] border border-border bg-surface-2 px-3 py-2 text-sm">
                    <div>
                      <p className="font-medium">{room.name}</p>
                      <p className="text-muted">Cap. {room.default_capacity}</p>
                      {missingEquipment ? (
                        <p className="inline-flex items-center gap-1 text-xs text-warning">
                          <TriangleAlert className="h-3.5 w-3.5" />
                          Missing equipment
                        </p>
                      ) : null}
                    </div>
                    <Button
                      type="button"
                      variant="danger"
                      onClick={() => {
                        const formData = new FormData();
                        formData.set("tenantId", tenantId);
                        formData.set("tenantSlug", tenantSlug);
                        formData.set("roomId", room.id);
                        startTransition(async () => {
                          const result = await deleteRoomAction(formData);
                          if (!result.ok) {
                            toast.error(result.message);
                            return;
                          }
                          toast.success(result.message);
                        });
                      }}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        <div className="rounded-[var(--radius-base)] border border-border bg-surface p-4">
          <h2 className="mb-3 text-base font-semibold">Equipment catalog</h2>
          {equipmentCatalog.length === 0 ? (
            <StatePanel kind="empty" title="No equipment yet" message="Create equipment items for room operations." />
          ) : (
            <ul className="space-y-2">
              {equipmentCatalog.map((equipment) => (
                <li key={equipment.id} className="flex items-center justify-between gap-3 rounded-[var(--radius-base)] border border-border bg-surface-2 px-3 py-2 text-sm">
                  <div>
                    <p className="font-medium">{equipment.name}</p>
                    <p className="text-muted">{equipment.equipment_type ?? "No type"}</p>
                  </div>
                  <Button
                    type="button"
                    variant="danger"
                    onClick={() => {
                      const formData = new FormData();
                      formData.set("tenantId", tenantId);
                      formData.set("tenantSlug", tenantSlug);
                      formData.set("equipmentId", equipment.id);
                      startTransition(async () => {
                        const result = await deleteEquipmentAction(formData);
                        if (!result.ok) {
                          toast.error(result.message);
                          return;
                        }
                        toast.success(result.message);
                      });
                    }}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>
    </div>
  );
}
