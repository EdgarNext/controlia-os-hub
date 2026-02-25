import type { HTMLAttributes } from "react";
import { cn } from "@/lib/utils";

export function Card({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "surface-card rounded-[var(--radius-base)] border border-border bg-surface p-5 shadow-[var(--shadow-soft)]",
        className,
      )}
      {...props}
    />
  );
}
