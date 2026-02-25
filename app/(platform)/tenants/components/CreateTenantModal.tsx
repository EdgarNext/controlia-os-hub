"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/Modal";
import { createTenantAction } from "../actions/tenantActions";

export function CreateTenantModal({ defaultOpen = false }: { defaultOpen?: boolean }) {
  const router = useRouter();
  const [open, setOpen] = useState(defaultOpen);
  const [isPending, startTransition] = useTransition();

  return (
    <>
      <Button type="button" onClick={() => setOpen(true)}>
        Nuevo tenant
      </Button>

      <Modal open={open} onClose={() => setOpen(false)} title="Crear tenant">
        <form
          className="space-y-4"
          onSubmit={(event) => {
            event.preventDefault();
            const formData = new FormData(event.currentTarget);

            startTransition(async () => {
              const result = await createTenantAction(formData);

              if (!result.ok) {
                toast.error(result.message);
                return;
              }

              toast.success(result.message);
              setOpen(false);

              if (result.redirectTo) {
                router.push(result.redirectTo);
              } else {
                router.refresh();
              }
            });
          }}
        >
          <label className="block space-y-1 text-sm">
            <span className="text-muted">Nombre</span>
            <input
              name="name"
              required
              className="w-full rounded-[var(--radius-base)] border border-border bg-surface-2 px-3 py-2"
              placeholder="Acme Events"
            />
          </label>

          <label className="block space-y-1 text-sm">
            <span className="text-muted">Slug</span>
            <input
              name="slug"
              required
              className="w-full rounded-[var(--radius-base)] border border-border bg-surface-2 px-3 py-2"
              placeholder="acme-events"
            />
          </label>

          <div className="flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={() => setOpen(false)} disabled={isPending}>
              Cancelar
            </Button>
            <Button type="submit" isLoading={isPending}>
              Crear
            </Button>
          </div>
        </form>
      </Modal>
    </>
  );
}
