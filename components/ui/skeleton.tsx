import type { HTMLAttributes } from "react";
import { cn } from "@/lib/utils";

type SkeletonProps = HTMLAttributes<HTMLDivElement> & {
  shimmer?: boolean;
};

export function Skeleton({ className, shimmer = false, ...props }: SkeletonProps) {
  return (
    <div
      className={cn(
        "rounded-[var(--radius-base)] bg-surface-2",
        shimmer ? "skeleton-shimmer" : "animate-pulse",
        className,
      )}
      {...props}
    />
  );
}
