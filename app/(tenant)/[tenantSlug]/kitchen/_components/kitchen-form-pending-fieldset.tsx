"use client";

import type { ReactNode } from "react";
import { useFormStatus } from "react-dom";

type KitchenFormPendingFieldsetProps = {
  children: ReactNode;
  className?: string;
};

export function KitchenFormPendingFieldset({ children, className }: KitchenFormPendingFieldsetProps) {
  const { pending } = useFormStatus();

  return (
    <fieldset disabled={pending} aria-busy={pending || undefined} className={className}>
      {children}
    </fieldset>
  );
}
