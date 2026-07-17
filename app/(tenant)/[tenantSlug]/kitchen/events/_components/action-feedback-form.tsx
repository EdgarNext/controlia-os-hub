"use client";

import { type ReactNode, startTransition, useActionState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  initialKitchenMutationActionState,
  type KitchenMutationActionState,
} from "@/lib/kitchen/event-catering/mutation-action-state";

export function ActionFeedbackForm({
  action,
  className,
  children,
  onSuccess,
}: {
  action: (
    previousState: KitchenMutationActionState,
    formData: FormData,
  ) => Promise<KitchenMutationActionState>;
  className?: string;
  children: ReactNode;
  onSuccess?: () => void;
}) {
  const [state, formAction] = useActionState(action, initialKitchenMutationActionState);
  const router = useRouter();
  const previousSuccess = useRef<string | null>(null);
  const previousError = useRef<string | null>(null);

  useEffect(() => {
    if (state.success && state.success !== previousSuccess.current) {
      previousSuccess.current = state.success;
      startTransition(() => {
        router.refresh();
      });
      toast.success(state.success);
      onSuccess?.();
    }
  }, [onSuccess, router, state.success]);

  useEffect(() => {
    if (state.error && state.error !== previousError.current) {
      previousError.current = state.error;
      toast.error(state.error);
    }
  }, [state.error]);

  return (
    <form action={formAction} className={className}>
      {children}
    </form>
  );
}
