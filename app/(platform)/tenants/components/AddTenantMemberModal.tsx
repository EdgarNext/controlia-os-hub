"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/Modal";
import { addTenantMembershipAction } from "../actions/membershipActions";

export function AddTenantMemberModal({ tenantId }: { tenantId: string }) {
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  return (
    <>
      <Button type="button" onClick={() => setOpen(true)}>
        Agregar usuario
      </Button>

      <Modal open={open} onClose={() => setOpen(false)} title="Agregar usuario al tenant">
        <form
          className="space-y-4"
          onSubmit={(event) => {
            event.preventDefault();
            const formData = new FormData(event.currentTarget);

            startTransition(async () => {
              const result = await addTenantMembershipAction(formData);

              if (!result.ok) {
                toast.error(result.message);
                return;
              }

              toast.success(result.message);
              setOpen(false);
            });
          }}
        >
          <input type="hidden" name="tenantId" value={tenantId} />

          <label className="block space-y-1 text-sm">
            <span className="text-muted">Email del usuario</span>
            <input
              type="email"
              name="email"
              required
              className="w-full rounded-[var(--radius-base)] border border-border bg-surface-2 px-3 py-2"
              placeholder="usuario@dominio.com"
            />
          </label>

          <label className="block space-y-1 text-sm">
            <span className="text-muted">Rol</span>
            <select
              name="role"
              defaultValue="viewer"
              className="w-full rounded-[var(--radius-base)] border border-border bg-surface-2 px-3 py-2"
            >
              <option value="admin">admin</option>
              <option value="operator">operator</option>
              <option value="viewer">viewer</option>
            </select>
          </label>

          <div className="flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={() => setOpen(false)} disabled={isPending}>
              Cancelar
            </Button>
            <Button type="submit" isLoading={isPending}>
              Agregar
            </Button>
          </div>
        </form>
      </Modal>
    </>
  );
}
