import type { ReactNode } from "react";
import { Card } from "@/components/ui/card";

type KitchenMetricCardProps = {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  tone?: "default" | "warning";
  icon?: ReactNode;
};

export function KitchenMetricCard({ label, value, hint, tone = "default", icon }: KitchenMetricCardProps) {
  return (
    <Card className="p-3">
      <div className="flex items-center gap-2 text-xs text-muted">{icon ? <span aria-hidden="true">{icon}</span> : null}<p>{label}</p></div>
      <p className={`mt-1 text-2xl font-semibold ${tone === "warning" ? "text-amber-600" : "text-foreground"}`}>{value}</p>
      {hint ? <p className="mt-1 text-xs text-muted">{hint}</p> : null}
    </Card>
  );
}
