import { Card } from "@/components/ui/card";
import type { PosAlertItem } from "@/types/pos-reports";

type PosAlertsHighlightsProps = {
  alerts: PosAlertItem[];
  limitations: string[];
};

export function PosAlertsHighlights({ alerts, limitations }: PosAlertsHighlightsProps) {
  const topAlerts = alerts.slice(0, 2);

  return (
    <Card className="space-y-4 p-4">
      <div className="space-y-1">
        <h2 className="text-base font-semibold text-foreground">Resumen de revision</h2>
        <p className="text-sm text-muted">
          Vista corta de lo mas urgente y de las limitaciones actuales del sistema de alertas.
        </p>
      </div>

      <div className="space-y-3">
        <div className="space-y-2 rounded-[calc(var(--radius-base)-4px)] border border-border bg-surface-2 p-3">
          <p className="text-xs font-medium uppercase tracking-[0.08em] text-muted">Prioridad</p>
          {topAlerts.length === 0 ? (
            <p className="text-sm text-foreground">No hay alertas activas en el rango.</p>
          ) : (
            topAlerts.map((alert) => (
              <p key={alert.id} className="text-sm text-foreground">
                {alert.title}
              </p>
            ))
          )}
        </div>

        <div className="space-y-2 rounded-[calc(var(--radius-base)-4px)] border border-border bg-surface-2 p-3">
          <p className="text-xs font-medium uppercase tracking-[0.08em] text-muted">Limitaciones</p>
          {limitations.length === 0 ? (
            <p className="text-sm text-foreground">Sin limitaciones adicionales registradas.</p>
          ) : (
            limitations.slice(0, 2).map((item) => (
              <p key={item} className="text-sm text-foreground">
                {item}
              </p>
            ))
          )}
        </div>
      </div>
    </Card>
  );
}
