import type { HTMLAttributes } from "react";
import { cn } from "@/lib/utils";

type BadgeVariant = "primary" | "success" | "warning" | "danger";

const variants: Record<BadgeVariant, string> = {
  primary: "bg-primary text-primary-foreground",
  success: "bg-success text-foreground",
  warning: "bg-warning text-foreground",
  danger: "bg-danger text-primary-foreground",
};

export function Badge({
  className,
  children,
  variant = "primary",
  ...props
}: HTMLAttributes<HTMLSpanElement> & { variant?: BadgeVariant }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border border-border px-2.5 py-1 text-xs font-semibold",
        variants[variant],
        className,
      )}
      {...props}
    >
      {children}
    </span>
  );
}
