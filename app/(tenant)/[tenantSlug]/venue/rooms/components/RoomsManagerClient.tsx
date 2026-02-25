"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { Pencil, Plus, Settings2, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/button";
import type { RoomWithSetup } from "../../actions/venueActions";
import { createRoomAction, deleteRoomAction, updateRoomAction } from "../../actions/venueActions";
import { RoomSetupStatusBadge } from "../../components/RoomSetupStatusBadge";

type RoomsManagerClientProps = {
  tenantId: string;
  tenantSlug: string;
  rooms: RoomWithSetup[];
};

type RoomFormState = {
  name: string;
  code: string;
  capacity: string;
};

const initialRoomForm: RoomFormState = {
  name: "",
  code: "",
  capacity: "",
};

export function RoomsManagerClient({ tenantId, tenantSlug, rooms }: RoomsManagerClientProps) {
  const [isPending, startTransition] = useTransition();
  const [createOpen, setCreateOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [editRoom, setEditRoom] = useState<RoomWithSetup | null>(null);
  const [createForm, setCreateForm] = useState<RoomFormState>(initialRoomForm);
  const [editForm, setEditForm] = useState<RoomFormState>(initialRoomForm);

  const openEdit = (room: RoomWithSetup) => {
    setEditRoom(room);
    setEditForm({
      name: room.name,
      code: room.code ?? "",
      capacity: String(room.default_capacity),
    });
    setEditOpen(true);
  };

  const submitCreate = () => {
    if (!createForm.name.trim()) {
      toast.error("El nombre de la sala es obligatorio.");
      return;
    }

    const capacity = Number(createForm.capacity);
    if (!Number.isFinite(capacity) || capacity <= 0) {
      toast.error("La capacidad debe ser mayor a 0.");
      return;
    }

    startTransition(async () => {
      const formData = new FormData();
      formData.set("tenantId", tenantId);
      formData.set("tenantSlug", tenantSlug);
      formData.set("name", createForm.name.trim());
      formData.set("code", createForm.code.trim());
      formData.set("defaultCapacity", String(capacity));

      const result = await createRoomAction(formData);
      if (!result.ok) {
        toast.error(result.message);
        return;
      }

      toast.success(result.message);
      setCreateOpen(false);
      setCreateForm(initialRoomForm);
    });
  };

  const submitEdit = () => {
    if (!editRoom) {
      return;
    }

    if (!editForm.name.trim()) {
      toast.error("El nombre de la sala es obligatorio.");
      return;
    }

    const capacity = Number(editForm.capacity);
    if (!Number.isFinite(capacity) || capacity <= 0) {
      toast.error("La capacidad debe ser mayor a 0.");
      return;
    }

    startTransition(async () => {
      const formData = new FormData();
      formData.set("tenantId", tenantId);
      formData.set("tenantSlug", tenantSlug);
      formData.set("roomId", editRoom.id);
      formData.set("name", editForm.name.trim());
      formData.set("code", editForm.code.trim());
      formData.set("defaultCapacity", String(capacity));

      const result = await updateRoomAction(formData);
      if (!result.ok) {
        toast.error(result.message);
        return;
      }

      toast.success(result.message);
      setEditOpen(false);
      setEditRoom(null);
    });
  };

  const removeRoom = (room: RoomWithSetup) => {
    startTransition(async () => {
      const formData = new FormData();
      formData.set("tenantId", tenantId);
      formData.set("tenantSlug", tenantSlug);
      formData.set("roomId", room.id);

      const result = await deleteRoomAction(formData);
      if (!result.ok) {
        toast.error(result.message);
        return;
      }

      toast.success(result.message);
    });
  };

  return (
    <>
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">Rooms</h2>
          <p className="text-sm text-muted">Administra salas y su estado de preparación para eventos.</p>
        </div>
        <Button type="button" onClick={() => setCreateOpen(true)}>
          <Plus className="h-4 w-4" />
          Create room
        </Button>
      </div>

      {rooms.length === 0 ? (
        <div className="rounded-[var(--radius-base)] border border-border bg-surface p-5 text-sm text-muted">
          No tienes salas aún. Crea una sala para poder crear eventos.
        </div>
      ) : (
        <ul className="space-y-3">
          {rooms.map((room) => (
            <li key={room.id} className="rounded-[var(--radius-base)] border border-border bg-surface p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <p className="text-base font-semibold">{room.name}</p>
                    <RoomSetupStatusBadge needsSetup={room.needsSetup} />
                  </div>
                  <p className="text-sm text-muted">
                    Code: {room.code ?? "-"} | Capacity: {room.default_capacity} | Equipment assigned: {room.equipmentCount}
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <Link
                    href={`/${tenantSlug}/venue/rooms/${room.id}`}
                    className="inline-flex items-center gap-2 rounded-[var(--radius-base)] border border-border bg-surface-2 px-3 py-2 text-sm"
                  >
                    <Settings2 className="h-4 w-4" />
                    Setup room
                  </Link>
                  <Button type="button" variant="secondary" onClick={() => openEdit(room)}>
                    <Pencil className="h-4 w-4" />
                    Edit
                  </Button>
                  <Button type="button" variant="danger" onClick={() => removeRoom(room)} isLoading={isPending}>
                    <Trash2 className="h-4 w-4" />
                    Delete
                  </Button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}

      <Modal open={createOpen} onClose={() => setCreateOpen(false)} title="Create room">
        <div className="space-y-3">
          <label className="space-y-1 text-sm">
            <span className="text-muted">Name</span>
            <input
              value={createForm.name}
              onChange={(event) => setCreateForm((prev) => ({ ...prev, name: event.target.value }))}
              className="w-full rounded-[var(--radius-base)] border border-border bg-surface-2 px-3 py-2"
              placeholder="Main Hall"
            />
          </label>

          <label className="space-y-1 text-sm">
            <span className="text-muted">Code</span>
            <input
              value={createForm.code}
              onChange={(event) => setCreateForm((prev) => ({ ...prev, code: event.target.value }))}
              className="w-full rounded-[var(--radius-base)] border border-border bg-surface-2 px-3 py-2"
              placeholder="HALL-A"
            />
          </label>

          <label className="space-y-1 text-sm">
            <span className="text-muted">Capacity</span>
            <input
              type="number"
              min={1}
              value={createForm.capacity}
              onChange={(event) => setCreateForm((prev) => ({ ...prev, capacity: event.target.value }))}
              className="w-full rounded-[var(--radius-base)] border border-border bg-surface-2 px-3 py-2"
              placeholder="500"
            />
          </label>

          <div className="flex items-center justify-end gap-2 pt-2">
            <Button type="button" variant="secondary" onClick={() => setCreateOpen(false)}>
              Cancel
            </Button>
            <Button type="button" isLoading={isPending} onClick={submitCreate}>
              Create room
            </Button>
          </div>
        </div>
      </Modal>

      <Modal open={editOpen} onClose={() => setEditOpen(false)} title="Edit room">
        <div className="space-y-3">
          <label className="space-y-1 text-sm">
            <span className="text-muted">Name</span>
            <input
              value={editForm.name}
              onChange={(event) => setEditForm((prev) => ({ ...prev, name: event.target.value }))}
              className="w-full rounded-[var(--radius-base)] border border-border bg-surface-2 px-3 py-2"
              placeholder="Main Hall"
            />
          </label>

          <label className="space-y-1 text-sm">
            <span className="text-muted">Code</span>
            <input
              value={editForm.code}
              onChange={(event) => setEditForm((prev) => ({ ...prev, code: event.target.value }))}
              className="w-full rounded-[var(--radius-base)] border border-border bg-surface-2 px-3 py-2"
              placeholder="HALL-A"
            />
          </label>

          <label className="space-y-1 text-sm">
            <span className="text-muted">Capacity</span>
            <input
              type="number"
              min={1}
              value={editForm.capacity}
              onChange={(event) => setEditForm((prev) => ({ ...prev, capacity: event.target.value }))}
              className="w-full rounded-[var(--radius-base)] border border-border bg-surface-2 px-3 py-2"
              placeholder="500"
            />
          </label>

          <div className="flex items-center justify-end gap-2 pt-2">
            <Button type="button" variant="secondary" onClick={() => setEditOpen(false)}>
              Cancel
            </Button>
            <Button type="button" isLoading={isPending} onClick={submitEdit}>
              Save changes
            </Button>
          </div>
        </div>
      </Modal>
    </>
  );
}
