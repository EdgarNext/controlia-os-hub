"use client";

import { useActionState, useEffect, useRef } from "react";
import { toast } from "sonner";
import { initialUpdateEventCostingActionState } from "@/lib/kitchen/event-catering/update-costing-action-state";
import {
  updateEventCostingWithCurrentPricesAction,
} from "@/lib/kitchen/event-catering/actions";
import { KitchenSubmitButton } from "@/app/(tenant)/[tenantSlug]/kitchen/_components/kitchen-submit-button";

type UpdateCostButtonProps = {
  tenantSlug: string;
  eventId: string;
};

export function UpdateCostButton({ tenantSlug, eventId }: UpdateCostButtonProps) {
  const [state, formAction] = useActionState(
    updateEventCostingWithCurrentPricesAction,
    initialUpdateEventCostingActionState,
  );
  const previousSuccess = useRef<string | null>(null);
  const previousError = useRef<string | null>(null);

  useEffect(() => {
    if (state.success && state.success !== previousSuccess.current) {
      previousSuccess.current = state.success;
      toast.success(state.success);
    }
  }, [state.success]);

  useEffect(() => {
    if (state.error && state.error !== previousError.current) {
      previousError.current = state.error;
      toast.error(state.error);
    }
  }, [state.error]);

  return (
    <form action={formAction}>
      <input type="hidden" name="tenantSlug" value={tenantSlug} />
      <input type="hidden" name="eventId" value={eventId} />
      <KitchenSubmitButton pendingLabel="Actualizando costo...">
        Actualizar costo con precios vigentes
      </KitchenSubmitButton>
    </form>
  );
}
