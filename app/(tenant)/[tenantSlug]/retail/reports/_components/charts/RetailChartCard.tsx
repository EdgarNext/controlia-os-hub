import type { ReactNode } from "react";
import { Card } from "@/components/ui/card";

type RetailChartCardProps = {
  title: string;
  description: string;
  children: ReactNode;
  footer?: ReactNode;
};

export function RetailChartCard({ title, description, children, footer }: RetailChartCardProps) {
  return (
    <Card className="space-y-4 p-4">
      <div className="space-y-1">
        <h2 className="text-sm font-semibold text-foreground">{title}</h2>
        <p className="text-xs text-muted">{description}</p>
      </div>
      {children}
      {footer ? <div className="border-t border-border pt-3">{footer}</div> : null}
    </Card>
  );
}
