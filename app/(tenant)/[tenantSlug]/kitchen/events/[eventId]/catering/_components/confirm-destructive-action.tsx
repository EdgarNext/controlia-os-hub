"use client";

import { useState, useTransition } from "react";
import { AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/button";
import { KitchenSubmitButton } from "@/app/(tenant)/[tenantSlug]/kitchen/_components/kitchen-submit-button";
import {
  initialKitchenMutationActionState,
  type KitchenMutationActionState,
} from "@/lib/kitchen/event-catering/mutation-action-state";

type HiddenField = {
  name: string;
  value: string;
};

export function ConfirmDestructiveAction({
  title,
  description,
  confirmLabel,
  pendingLabel,
  triggerLabel,
  action,
  hiddenFields,
}: {
  title: string;
  description: string;
  confirmLabel: string;
  pendingLabel: string;
  triggerLabel: string;
  action: (
    previousState: KitchenMutationActionState,
    formData: FormData,
  ) => Promise<KitchenMutationActionState>;
  hiddenFields: HiddenField[];
}) {
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  return (
    <>
      <Button type="button" variant="danger" onClick={() => setOpen(true)} className="w-full justify-start">
        {triggerLabel}
      </Button>

      <Modal open={open} onClose={() => setOpen(false)} title={title}>
        <form
          action={(formData) => {
            startTransition(async () => {
              const result = await action(initialKitchenMutationActionState, formData);
              if (result.error) {
                toast.error(result.error);
                return;
              }

              if (result.success) {
                toast.success(result.success);
              }
              setOpen(false);
            });
          }}
          className="space-y-4"
        >
          {hiddenFields.map((field) => (
            <input key={`${field.name}-${field.value}`} type="hidden" name={field.name} value={field.value} />
          ))}

          <div className="rounded-[var(--radius-base)] border border-danger/40 bg-danger/10 p-3 text-sm text-foreground">
            <div className="flex items-start gap-2">
              <AlertTriangle className="mt-0.5 h-4 w-4 text-danger" aria-hidden="true" />
              <p>{description}</p>
            </div>
          </div>

          <div className="flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={() => setOpen(false)} disabled={isPending}>
              Cancelar
            </Button>
            <KitchenSubmitButton variant="danger" pendingLabel={pendingLabel} disabled={isPending}>
              {confirmLabel}
            </KitchenSubmitButton>
          </div>
        </form>
      </Modal>
    </>
  );
}
