import type { PosAlertItem } from "@/types/pos-reports";
import { PosAlertRow } from "./PosAlertRow";

type PosAlertsListProps = {
  alerts: PosAlertItem[];
};

export function PosAlertsList({ alerts }: PosAlertsListProps) {
  return (
    <div className="space-y-4">
      {alerts.map((alert) => (
        <PosAlertRow key={alert.id} alert={alert} />
      ))}
    </div>
  );
}
