"use client";

import { useMemo, useState, useTransition } from "react";
import { Pencil, Plus, Search, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/button";
import type { Equipment } from "@/types/venue";
import { createEquipmentAction, deleteEquipmentAction, updateEquipmentAction } from "../../actions/venueActions";

type EquipmentManagerClientProps = {
  tenantId: string;
  tenantSlug: string;
  equipmentCatalog: Equipment[];
};

type EquipmentFormState = {
  name: string;
  category: string;
};

const initialEquipmentForm: EquipmentFormState = {
  name: "",
  category: "",
};

export function EquipmentManagerClient({ tenantId, tenantSlug, equipmentCatalog }: EquipmentManagerClientProps) {
  const [isPending, startTransition] = useTransition();
  const [query, setQuery] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [createForm, setCreateForm] = useState<EquipmentFormState>(initialEquipmentForm);
  const [editForm, setEditForm] = useState<EquipmentFormState>(initialEquipmentForm);
  const [editEquipment, setEditEquipment] = useState<Equipment | null>(null);

  const filteredEquipment = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    if (!normalizedQuery) {
      return equipmentCatalog;
    }

    return equipmentCatalog.filter((item) => {
      return (
        item.name.toLowerCase().includes(normalizedQuery) ||
        (item.equipment_type ?? "").toLowerCase().includes(normalizedQuery)
      );
    });
  }, [equipmentCatalog, query]);

  const openEdit = (equipment: Equipment) => {
    setEditEquipment(equipment);
    setEditForm({
      name: equipment.name,
      category: equipment.equipment_type ?? "",
    });
    setEditOpen(true);
  };

  const submitCreate = () => {
    if (!createForm.name.trim()) {
      toast.error("El nombre del equipo es obligatorio.");
      return;
    }

    startTransition(async () => {
      const formData = new FormData();
      formData.set("tenantId", tenantId);
      formData.set("tenantSlug", tenantSlug);
      formData.set("name", createForm.name.trim());
      formData.set("category", createForm.category.trim());

      const result = await createEquipmentAction(formData);
      if (!result.ok) {
        toast.error(result.message);
        return;
      }

      toast.success(result.message);
      setCreateOpen(false);
      setCreateForm(initialEquipmentForm);
    });
  };

  const submitEdit = () => {
    if (!editEquipment) {
      return;
    }

    if (!editForm.name.trim()) {
      toast.error("El nombre del equipo es obligatorio.");
      return;
    }

    startTransition(async () => {
      const formData = new FormData();
      formData.set("tenantId", tenantId);
      formData.set("tenantSlug", tenantSlug);
      formData.set("equipmentId", editEquipment.id);
      formData.set("name", editForm.name.trim());
      formData.set("category", editForm.category.trim());

      const result = await updateEquipmentAction(formData);
      if (!result.ok) {
        toast.error(result.message);
        return;
      }

      toast.success(result.message);
      setEditOpen(false);
      setEditEquipment(null);
    });
  };

  const removeEquipment = (equipment: Equipment) => {
    startTransition(async () => {
      const formData = new FormData();
      formData.set("tenantId", tenantId);
      formData.set("tenantSlug", tenantSlug);
      formData.set("equipmentId", equipment.id);

      const result = await deleteEquipmentAction(formData);
      if (!result.ok) {
        toast.error(result.message);
        return;
      }

      toast.success(result.message);
    });
  };

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">Equipment library</h2>
          <p className="text-sm text-muted">Mantén el catálogo de equipos que podrás asignar a cada sala.</p>
        </div>
        <Button type="button" onClick={() => setCreateOpen(true)}>
          <Plus className="h-4 w-4" />
          Create equipment
        </Button>
      </div>

      <label className="relative block">
        <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-muted" aria-hidden="true" />
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Buscar por nombre o categoría"
          className="w-full rounded-[var(--radius-base)] border border-border bg-surface-2 py-2 pl-9 pr-3 text-sm"
        />
      </label>

      {equipmentCatalog.length === 0 ? (
        <div className="rounded-[var(--radius-base)] border border-border bg-surface p-5 text-sm text-muted">
          Crea tu catálogo de equipo para asignarlo a cada sala.
        </div>
      ) : filteredEquipment.length === 0 ? (
        <div className="rounded-[var(--radius-base)] border border-border bg-surface p-5 text-sm text-muted">
          No hay resultados para tu búsqueda.
        </div>
      ) : (
        <ul className="space-y-3">
          {filteredEquipment.map((equipment) => (
            <li key={equipment.id} className="rounded-[var(--radius-base)] border border-border bg-surface p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-base font-semibold">{equipment.name}</p>
                  <p className="text-sm text-muted">Category: {equipment.equipment_type ?? "-"}</p>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <Button type="button" variant="secondary" onClick={() => openEdit(equipment)}>
                    <Pencil className="h-4 w-4" />
                    Edit
                  </Button>
                  <Button type="button" variant="danger" onClick={() => removeEquipment(equipment)} isLoading={isPending}>
                    <Trash2 className="h-4 w-4" />
                    Delete
                  </Button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}

      <Modal open={createOpen} onClose={() => setCreateOpen(false)} title="Create equipment">
        <div className="space-y-3">
          <label className="space-y-1 text-sm">
            <span className="text-muted">Name</span>
            <input
              value={createForm.name}
              onChange={(event) => setCreateForm((prev) => ({ ...prev, name: event.target.value }))}
              className="w-full rounded-[var(--radius-base)] border border-border bg-surface-2 px-3 py-2"
              placeholder="Projector"
            />
          </label>

          <label className="space-y-1 text-sm">
            <span className="text-muted">Category</span>
            <input
              value={createForm.category}
              onChange={(event) => setCreateForm((prev) => ({ ...prev, category: event.target.value }))}
              className="w-full rounded-[var(--radius-base)] border border-border bg-surface-2 px-3 py-2"
              placeholder="visual"
            />
          </label>

          <div className="flex items-center justify-end gap-2 pt-2">
            <Button type="button" variant="secondary" onClick={() => setCreateOpen(false)}>
              Cancel
            </Button>
            <Button type="button" isLoading={isPending} onClick={submitCreate}>
              Create equipment
            </Button>
          </div>
        </div>
      </Modal>

      <Modal open={editOpen} onClose={() => setEditOpen(false)} title="Edit equipment">
        <div className="space-y-3">
          <label className="space-y-1 text-sm">
            <span className="text-muted">Name</span>
            <input
              value={editForm.name}
              onChange={(event) => setEditForm((prev) => ({ ...prev, name: event.target.value }))}
              className="w-full rounded-[var(--radius-base)] border border-border bg-surface-2 px-3 py-2"
              placeholder="Projector"
            />
          </label>

          <label className="space-y-1 text-sm">
            <span className="text-muted">Category</span>
            <input
              value={editForm.category}
              onChange={(event) => setEditForm((prev) => ({ ...prev, category: event.target.value }))}
              className="w-full rounded-[var(--radius-base)] border border-border bg-surface-2 px-3 py-2"
              placeholder="visual"
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
