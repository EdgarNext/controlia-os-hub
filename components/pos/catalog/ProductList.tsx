import Link from "next/link";
import type { PosCatalogProductListItem } from "@/types/pos-catalog";
import { CatalogEmptyState } from "./CatalogEmptyState";

function formatDateTime(value?: string | null): string {
  if (!value) {
    return "-";
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return "-";
  }

  return parsed.toLocaleString("es-MX");
}

function formatMoneyFromCents(cents: number): string {
  const amount = cents / 100;

  return new Intl.NumberFormat("es-MX", {
    style: "currency",
    currency: "MXN",
    minimumFractionDigits: 2,
  }).format(amount);
}

export function ProductList({
  products,
  tenantSlug,
}: {
  products: PosCatalogProductListItem[];
  tenantSlug?: string;
}) {
  if (products.length === 0) {
    return <CatalogEmptyState message="Aún no hay productos." />;
  }

  return (
    <div className="overflow-hidden rounded-[var(--radius-base)] border border-border bg-surface">
      <table className="w-full text-left text-sm">
        <thead className="bg-surface-2 text-xs uppercase tracking-[0.08em] text-muted">
          <tr>
            <th className="px-4 py-3 font-semibold">Producto</th>
            <th className="px-4 py-3 font-semibold">Precio</th>
            <th className="px-4 py-3 font-semibold">Categoría</th>
            <th className="px-4 py-3 font-semibold">Estado</th>
            <th className="px-4 py-3 font-semibold">Actualizado</th>
            <th className="px-4 py-3 font-semibold">Acciones</th>
          </tr>
        </thead>
        <tbody>
          {products.map((product) => {
            const editHref = tenantSlug
              ? `/${tenantSlug}/pos/admin/catalog/products/${product.id}/edit`
              : null;

            return (
              <tr key={product.id} className="border-t border-border">
                <td className="px-4 py-3">
                  <p className="font-medium text-foreground">{product.name}</p>
                  <p className="text-xs text-muted">ID: {product.id}</p>
                </td>
                <td className="px-4 py-3 text-foreground">{formatMoneyFromCents(product.price_cents)}</td>
                <td className="px-4 py-3 text-muted">
                  {product.category_name ?? product.category_id ?? "Sin categoría"}
                </td>
                <td className="px-4 py-3">
                  {product.deleted_at ? (
                    <span className="rounded-full border border-border bg-surface-2 px-2 py-1 text-xs text-muted">
                      Archivado
                    </span>
                  ) : product.is_active ? (
                    <span className="rounded-full border border-success/40 bg-success-soft px-2 py-1 text-xs text-success">
                      Activo
                    </span>
                  ) : (
                    <span className="rounded-full border border-warning/40 bg-warning/15 px-2 py-1 text-xs text-warning">
                      Inactivo
                    </span>
                  )}
                </td>
                <td className="px-4 py-3 text-muted">{formatDateTime(product.updated_at)}</td>
                <td className="px-4 py-3">
                  {editHref ? (
                    <Link
                      href={editHref}
                      className="inline-flex items-center justify-center rounded-[var(--radius-base)] border border-border bg-surface-2 px-3 py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-surface"
                    >
                      Editar
                    </Link>
                  ) : (
                    <span className="text-xs text-muted">-</span>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
