import Link from "next/link";
import { StatePanel } from "@/components/ui/state-panel";
import type { PosCatalogCategoryListItem } from "@/types/pos-catalog";

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

export function CategoryList({
  categories,
  tenantSlug,
}: {
  categories: PosCatalogCategoryListItem[];
  tenantSlug?: string;
}) {
  if (categories.length === 0) {
    return (
      <StatePanel
        kind="empty"
        title="Sin categorías"
        message="Aún no hay categorías para este tenant."
      />
    );
  }

  return (
    <div className="overflow-hidden rounded-[var(--radius-base)] border border-border bg-surface">
      <table className="w-full text-left text-sm">
        <thead className="bg-surface-2 text-xs uppercase tracking-[0.08em] text-muted">
          <tr>
            <th className="px-4 py-3 font-semibold">Nombre</th>
            <th className="px-4 py-3 font-semibold">Estado</th>
            <th className="px-4 py-3 font-semibold">Actualizado</th>
            <th className="px-4 py-3 font-semibold">Creado</th>
            <th className="px-4 py-3 font-semibold">Acciones</th>
          </tr>
        </thead>
        <tbody>
          {categories.map((category) => {
            const editHref = tenantSlug
              ? `/${tenantSlug}/pos/catalog/categories/${category.id}/edit`
              : null;

            return (
              <tr key={category.id} className="border-t border-border">
                <td className="px-4 py-3">
                  <p className="font-medium text-foreground">{category.name}</p>
                  <p className="text-xs text-muted">Orden: {category.sort_order}</p>
                </td>
                <td className="px-4 py-3">
                  {category.deleted_at ? (
                    <span className="rounded-full border border-border bg-surface-2 px-2 py-1 text-xs text-muted">
                      Archivada
                    </span>
                  ) : category.is_active ? (
                    <span className="rounded-full border border-success/40 bg-success-soft px-2 py-1 text-xs text-success">
                      Activa
                    </span>
                  ) : (
                    <span className="rounded-full border border-warning/40 bg-warning/15 px-2 py-1 text-xs text-warning">
                      Inactiva
                    </span>
                  )}
                </td>
                <td className="px-4 py-3 text-muted">{formatDateTime(category.updated_at)}</td>
                <td className="px-4 py-3 text-muted">{formatDateTime(category.created_at)}</td>
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
