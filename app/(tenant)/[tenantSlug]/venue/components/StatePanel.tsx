import type { ReactNode } from "react";
import { AlertTriangle, CircleAlert, Inbox } from "lucide-react";

type StatePanelProps = {
  kind: "empty" | "error" | "warning";
  title: string;
  message: string;
  children?: ReactNode;
};

export function StatePanel({ kind, title, message, children }: StatePanelProps) {
  const Icon = kind === "error" ? CircleAlert : kind === "warning" ? AlertTriangle : Inbox;
  const tone =
    kind === "error"
      ? "border-danger/50 bg-danger/10"
      : kind === "warning"
        ? "border-warning/50 bg-warning/10"
        : "border-border bg-surface";

  return (
    <div className={`rounded-[var(--radius-base)] border p-4 ${tone}`}>
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
