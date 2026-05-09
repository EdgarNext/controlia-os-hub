"use client";

import type { ComponentProps, ReactNode } from "react";
import { useFormStatus } from "react-dom";
import { Button } from "@/components/ui/button";

type KitchenSubmitButtonProps = Omit<ComponentProps<typeof Button>, "children" | "type" | "isLoading"> & {
  children: ReactNode;
  pendingLabel?: ReactNode;
};

export function KitchenSubmitButton({
  children,
  pendingLabel,
  disabled,
  ...props
}: KitchenSubmitButtonProps) {
  const { pending } = useFormStatus();

  return (
    <Button
      type="submit"
      isLoading={pending}
      disabled={disabled || pending}
      aria-busy={pending || undefined}
      {...props}
    >
      {pending && pendingLabel ? pendingLabel : children}
    </Button>
  );
}
