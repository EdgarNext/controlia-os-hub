import type { ReactNode } from "react";
import { Card } from "@/components/ui/card";

type KitchenMetricCardProps = {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  tone?: "default" | "warning";
};

export function KitchenMetricCard({ label, value, hint, tone = "default" }: KitchenMetricCardProps) {
  return (
    <Card className="p-4">
      <p className="text-xs text-muted">{label}</p>
      <p className={`mt-1 text-2xl font-semibold ${tone === "warning" ? "text-amber-600" : "text-foreground"}`}>{value}</p>
      {hint ? <p className="mt-1 text-xs text-muted">{hint}</p> : null}
    </Card>
  );
}
