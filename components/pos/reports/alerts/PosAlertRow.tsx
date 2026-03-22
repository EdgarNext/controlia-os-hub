import Link from "next/link";
import { AlertTriangle, CircleAlert, Info } from "lucide-react";
import { Card } from "@/components/ui/card";
import type { PosAlertItem } from "@/types/pos-reports";

type PosAlertRowProps = {
  alert: PosAlertItem;
};

const sourceLabelByReport = {
  sales: "Ventas",
  products: "Productos",
  cashiers: "Cajeros",
  "cashier-shift": "Cortes",
} as const;

function getSeverityMeta(severity: PosAlertItem["severity"]) {
  if (severity === "critical") {
    return {
      label: "Critica",
      icon: AlertTriangle,
    };
  }

  if (severity === "medium") {
    return {
      label: "Media",
      icon: CircleAlert,
    };
  }

  return {
    label: "Informativa",
    icon: Info,
  };
}

export function PosAlertRow({ alert }: PosAlertRowProps) {
  const severity = getSeverityMeta(alert.severity);
  const SeverityIcon = severity.icon;

  return (
    <Card className="space-y-3 p-4">
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <SeverityIcon className="h-4 w-4 text-primary" aria-hidden="true" />
            <p className="text-xs font-medium uppercase tracking-[0.08em] text-muted">
              {severity.label}
            </p>
          </div>
          <h2 className="text-base font-semibold text-foreground">{alert.title}</h2>
          <p className="text-sm text-muted">{alert.description}</p>
        </div>

        <div className="rounded-[calc(var(--radius-base)-4px)] border border-border bg-surface-2 px-3 py-2 text-sm text-muted">
          {alert.href ? (
            <Link href={alert.href} className="text-foreground transition-colors hover:text-primary">
              Origen: {sourceLabelByReport[alert.source_report]}
            </Link>
          ) : (
            <span>Origen: {sourceLabelByReport[alert.source_report]}</span>
          )}
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        <div className="rounded-[calc(var(--radius-base)-4px)] border border-border bg-surface-2 p-3">
          <p className="text-xs font-medium uppercase tracking-[0.08em] text-muted">Contexto</p>
          <p className="mt-1 text-sm text-foreground">{alert.context_value ?? "Sin contexto adicional"}</p>
        </div>
        <div className="rounded-[calc(var(--radius-base)-4px)] border border-border bg-surface-2 p-3">
          <p className="text-xs font-medium uppercase tracking-[0.08em] text-muted">Accion sugerida</p>
          <p className="mt-1 text-sm text-foreground">
            {alert.recommended_action ?? "Revisar el reporte origen."}
          </p>
        </div>
      </div>
    </Card>
  );
}
