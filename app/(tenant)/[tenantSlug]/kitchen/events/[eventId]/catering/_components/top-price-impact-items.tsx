import type { ChefTopPriceImpactItem } from "@/lib/kitchen/event-catering/chef-costing";

function formatMoney(value: number | null): string {
  if (value == null) return "—";
  return `$${value.toLocaleString("es-MX", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function TopPriceImpactItems({
  items,
  allItems,
}: {
  items: ChefTopPriceImpactItem[];
  allItems: ChefTopPriceImpactItem[];
}) {
  if (items.length === 0) return null;

  return (
    <section className="space-y-3 rounded-[var(--radius-base)] border border-border bg-surface p-4">
      <div>
        <h2 className="text-sm font-semibold text-foreground">Principales cambios de precio</h2>
        <p className="mt-1 text-sm text-muted">
          Se muestran los insumos con mayor impacto absoluto sobre el costo actualizado.
        </p>
      </div>

      <div className="space-y-3">
        {items.map((item) => (
          <article key={item.itemId} className="rounded-[var(--radius-base)] border border-border bg-surface-2 p-3">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h3 className="text-sm font-semibold text-foreground">{item.itemName}</h3>
                <p className="mt-1 text-xs text-muted">
                  Proveedor: {item.supplierName ?? "Sin proveedor"} · Presentación: {item.purchaseUnitCode ?? "—"}
                </p>
              </div>
              <p className="text-sm font-semibold text-foreground">{formatMoney(item.impactAmount)}</p>
            </div>

            <div className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <MetricMini label="Costo unitario inicial" value={formatMoney(item.initialUnitCost)} />
              <MetricMini label="Costo unitario actualizado" value={formatMoney(item.updatedUnitCost)} />
              <MetricMini
                label="Cantidad congelada"
                value={item.requiredQuantity.toLocaleString("es-MX", { minimumFractionDigits: 0, maximumFractionDigits: 4 })}
              />
              <MetricMini label="Dirección" value={item.direction} />
            </div>

            <p className="mt-3 text-xs text-muted">
              Servicios: {item.serviceNames.join(", ")} · Recetas: {item.recipeNames.join(", ")}
            </p>
            {item.priceResolutionWarning ? (
              <p className="mt-2 text-xs text-danger">{item.priceResolutionWarning}</p>
            ) : null}
          </article>
        ))}
      </div>

      {allItems.length > items.length ? (
        <details className="rounded-[var(--radius-base)] border border-border bg-surface-2 p-3">
          <summary className="cursor-pointer text-sm font-medium text-foreground">
            Ver desglose completo de insumos
          </summary>
          <div className="mt-3 space-y-2">
            {allItems.map((item) => (
              <div key={`all-${item.itemId}`} className="flex flex-wrap items-center justify-between gap-3 text-sm">
                <span>{item.itemName}</span>
                <span>{formatMoney(item.impactAmount)}</span>
              </div>
            ))}
          </div>
        </details>
      ) : null}
    </section>
  );
}

function MetricMini({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[var(--radius-base)] border border-border bg-surface p-3">
      <p className="text-xs text-muted">{label}</p>
      <p className="mt-1 text-sm font-semibold text-foreground">{value}</p>
    </div>
  );
}
