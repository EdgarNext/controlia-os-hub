"use client";

import { LoaderCircle } from "lucide-react";
import { cn } from "@/lib/utils";

type AsyncActivityIndicatorProps = { active: boolean; label?: string; delay?: number; className?: string };

export function AsyncActivityIndicator({ active, label = "Actualizando resultados", delay = 180, className }: AsyncActivityIndicatorProps) {
  const delayClass = delay >= 180 ? "delay-200" : "delay-150";
  return <span className={cn("pointer-events-none absolute right-3 top-3 rounded-full border border-border bg-surface p-1.5 shadow-sm transition-opacity", active ? `opacity-100 ${delayClass}` : "opacity-0", className)} role="status" aria-live="polite" aria-label={active ? label : undefined}>
    <LoaderCircle className="h-4 w-4 animate-spin text-primary motion-reduce:animate-none" aria-hidden="true" />
    <span className="sr-only">{active ? label : ""}</span>
  </span>;
}
