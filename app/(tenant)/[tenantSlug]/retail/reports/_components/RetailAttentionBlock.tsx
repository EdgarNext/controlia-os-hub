import Link from "next/link";
import { AlertCircle } from "lucide-react";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { hasRetailAttentionItems, type RetailAttentionItem } from "@/lib/retail-pos/reporting-ui";

type RetailAttentionBlockProps = {
  items: readonly RetailAttentionItem[];
};

export function RetailAttentionBlock({ items }: RetailAttentionBlockProps) {
  if (!hasRetailAttentionItems(items)) {
    return null;
  }

  return (
    <Card className="space-y-3 p-4">
      <div className="space-y-1">
        <h2 className="text-sm font-semibold text-foreground">Asuntos que requieren atención</h2>
        <p className="text-xs text-muted">Lista preparada por la página a partir de las métricas ya disponibles.</p>
      </div>

      <div className="space-y-3">
        {items.map((item) => (
          <article
            key={item.id}
            className={cn(
              "rounded-[var(--radius-base)] border px-3 py-3",
              item.tone === "warning" ? "border-warning/50 bg-warning/10" : "border-border bg-surface-2",
            )}
            aria-label={item.accessibleLabel ?? item.title}
          >
            <div className="flex items-start gap-3">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
              <div className="min-w-0 flex-1 space-y-1">
                <p className="text-sm font-semibold text-foreground">{item.title}</p>
                <p className="text-sm text-muted">{item.description}</p>

                {item.quantity || item.amount ? (
                  <p className="text-xs text-muted">
                    {item.quantity ? `Cantidad: ${item.quantity}` : null}
                    {item.quantity && item.amount ? " · " : null}
                    {item.amount ? `Monto: ${item.amount}` : null}
                  </p>
                ) : null}

                {item.href && item.linkLabel ? (
                  <Link href={item.href} className="inline-flex text-xs font-medium text-primary hover:opacity-90">
                    {item.linkLabel}
                  </Link>
                ) : null}
              </div>
            </div>
          </article>
        ))}
      </div>
    </Card>
  );
}
