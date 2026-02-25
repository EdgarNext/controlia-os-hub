"use client";

import { useLinkStatus } from "next/link";
import { cn } from "@/lib/utils";

type TenantFilterLinkLabelProps = {
  label: string;
  isActive: boolean;
};

export function TenantFilterLinkLabel({ label, isActive }: TenantFilterLinkLabelProps) {
  const { pending } = useLinkStatus();

  return (
    <span className={cn(pending && "opacity-80", pending && !isActive && "animate-pulse")}>
      {label}
    </span>
  );
}
