import type { ReactNode } from "react";
import { AlertTriangle, CircleAlert, Hand, Inbox } from "lucide-react";
import { cn } from "@/lib/utils";

export type StatePanelKind = "empty" | "error" | "warning" | "permission";

export type StatePanelProps = {
  kind: StatePanelKind;
  title: string;
  message: string;
  children?: ReactNode;
  className?: string;
};

const toneByKind: Record<StatePanelKind, string> = {
  empty: "border-border bg-surface",
  error: "border-danger/50 bg-danger/10",
  warning: "border-warning/50 bg-warning/10",
  permission: "border-warning/50 bg-warning/10",
};

const iconByKind: Record<StatePanelKind, typeof Inbox> = {
  empty: Inbox,
  error: CircleAlert,
  warning: AlertTriangle,
  permission: Hand,
};

export function StatePanel({ kind, title, message, children, className }: StatePanelProps) {
  const Icon = iconByKind[kind];

  return (
    <div className={cn("rounded-[var(--radius-base)] border p-4", toneByKind[kind], className)}>
      <div className="flex items-start gap-3">
        <Icon className="mt-0.5 h-4 w-4" aria-hidden="true" />
        <div className="space-y-1">
          <p className="text-sm font-semibold">{title}</p>
          <p className="text-sm text-muted">{message}</p>
          {children}
        </div>
      </div>
    </div>
  );
}
