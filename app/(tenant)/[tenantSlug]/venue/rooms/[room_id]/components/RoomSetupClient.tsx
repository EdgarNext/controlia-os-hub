"use client";

import { useMemo, useState, useTransition } from "react";
import { Search, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import type { Equipment, Room } from "@/types/venue";
import type { RoomSetupEquipment } from "../../../actions/venueActions";
import { assignRoomEquipmentAction, unassignRoomEquipmentAction } from "../../../actions/venueActions";
import { RoomSetupStatusBadge } from "../../../components/RoomSetupStatusBadge";

type RoomSetupClientProps = {
  tenantId: string;
  tenantSlug: string;
  room: Room;
  assignedEquipment: RoomSetupEquipment[];
  equipmentCatalog: Equipment[];
};

export function RoomSetupClient({
  tenantId,
  tenantSlug,
  room,
  assignedEquipment,
  equipmentCatalog,
}: RoomSetupClientProps) {
  const [isPending, startTransition] = useTransition();
  const [searchQuery, setSearchQuery] = useState("");

  const assignedEquipmentIds = useMemo(
    () => new Set(assignedEquipment.map((item) => item.equipment_id)),
    [assignedEquipment],
  );

  const availableEquipment = useMemo(() => {
    const normalizedQuery = searchQuery.trim().toLowerCase();

    return equipmentCatalog
      .filter((item) => !assignedEquipmentIds.has(item.id))
      .filter((item) => {
        if (!normalizedQuery) {
          return true;
        }

        return (
          item.name.toLowerCase().includes(normalizedQuery) ||
          (item.equipment_type ?? "").toLowerCase().includes(normalizedQuery)
        );
      });
  }, [equipmentCatalog, assignedEquipmentIds, searchQuery]);

  const addEquipment = (equipmentId: string) => {
    startTransition(async () => {
      const formData = new FormData();
      formData.set("tenantId", tenantId);
      formData.set("tenantSlug", tenantSlug);
      formData.set("roomId", room.id);
      formData.set("equipmentId", equipmentId);
      formData.set("quantity", "1");

      const result = await assignRoomEquipmentAction(formData);
      if (!result.ok) {
        toast.error(result.message);
        return;
      }

      toast.success(result.message);
    });
  };

  const removeEquipment = (roomEquipmentId: string) => {
    startTransition(async () => {
      const formData = new FormData();
      formData.set("tenantId", tenantId);
      formData.set("tenantSlug", tenantSlug);
      formData.set("roomId", room.id);
      formData.set("roomEquipmentId", roomEquipmentId);

      const result = await unassignRoomEquipmentAction(formData);
      if (!result.ok) {
        toast.error(result.message);
        return;
      }

      toast.success(result.message);
    });
  };

  return (
    <div className="space-y-4">
      <section className="rounded-[var(--radius-base)] border border-border bg-surface p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold">{room.name}</h2>
            <p className="text-sm text-muted">
              Capacity: {room.default_capacity} | Code: {room.code ?? "-"}
            </p>
          </div>
          <RoomSetupStatusBadge needsSetup={assignedEquipment.length === 0} />
        </div>
      </section>

      <section className="rounded-[var(--radius-base)] border border-border bg-surface p-4">
        <h3 className="mb-3 text-base font-semibold">Assigned equipment</h3>

        {assignedEquipment.length === 0 ? (
          <div className="rounded-[var(--radius-base)] border border-border bg-surface-2 p-4 text-sm text-muted">
            Esta sala todavía no tiene equipo asignado.
          </div>
        ) : (
          <ul className="space-y-2">
            {assignedEquipment.map((item) => (
              <li key={item.id} className="flex items-center justify-between gap-3 rounded-[var(--radius-base)] border border-border bg-surface-2 px-3 py-2">
                <div>
                  <p className="text-sm font-medium">{item.equipment_name}</p>
                  <p className="text-xs text-muted">Category: {item.equipment_type ?? "-"} | Qty: {item.quantity}</p>
                </div>
                <Button
                  type="button"
                  variant="danger"
                  isLoading={isPending}
                  onClick={() => removeEquipment(item.id)}
                >
                  <Trash2 className="h-4 w-4" />
                  Remove
                </Button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="rounded-[var(--radius-base)] border border-border bg-surface p-4">
        <h3 className="mb-3 text-base font-semibold">Add equipment</h3>

        <label className="relative mb-3 block">
          <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-muted" aria-hidden="true" />
          <input
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            placeholder="Buscar equipo por nombre o categoría"
            className="w-full rounded-[var(--radius-base)] border border-border bg-surface-2 py-2 pl-9 pr-3 text-sm"
          />
        </label>

        {availableEquipment.length === 0 ? (
          <div className="rounded-[var(--radius-base)] border border-border bg-surface-2 p-4 text-sm text-muted">
            No hay equipos disponibles para agregar.
          </div>
        ) : (
          <ul className="space-y-2">
            {availableEquipment.map((item) => (
              <li key={item.id} className="flex items-center justify-between gap-3 rounded-[var(--radius-base)] border border-border bg-surface-2 px-3 py-2">
                <div>
                  <p className="text-sm font-medium">{item.name}</p>
                  <p className="text-xs text-muted">Category: {item.equipment_type ?? "-"}</p>
                </div>
                <Button type="button" isLoading={isPending} onClick={() => addEquipment(item.id)}>
                  Add equipment
                </Button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
