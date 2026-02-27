import Link from "next/link";
import { Card } from "@/components/ui/card";
import type { TenantRecord } from "@/lib/repos/types";
import { TenantStatusBadge } from "./TenantStatusBadge";

type TenantsTableProps = {
  tenants: TenantRecord[];
};

export function TenantsTable({ tenants }: TenantsTableProps) {
  if (tenants.length === 0) {
    return (
      <Card>
        <h3 className="text-base font-semibold">Sin tenants</h3>
        <p className="mt-1 text-sm text-muted">Crea el primer tenant para iniciar la plataforma.</p>
      </Card>
    );
  }

  return (
    <Card className="overflow-x-auto p-0">
      <table className="min-w-full border-collapse text-sm">
        <thead className="bg-surface-2 text-left">
          <tr>
            <th className="px-4 py-3 font-medium">Nombre</th>
            <th className="px-4 py-3 font-medium">Slug</th>
            <th className="px-4 py-3 font-medium">Estado</th>
            <th className="px-4 py-3 font-medium">Acciones</th>
          </tr>
        </thead>
        <tbody>
          {tenants.map((tenant) => (
            <tr key={tenant.id} className="border-t border-border">
              <td className="px-4 py-3">{tenant.name}</td>
              <td className="px-4 py-3 text-muted">{tenant.slug}</td>
              <td className="px-4 py-3">
                <TenantStatusBadge status={tenant.status} />
              </td>
              <td className="px-4 py-3">
                <div className="flex flex-wrap gap-2">
                  <Link
                    href={`/tenants/${tenant.id}`}
                    className="rounded-[var(--radius-base)] border border-border bg-surface-2 px-3 py-1.5 text-xs hover:bg-surface"
                  >
                    Ver
                  </Link>
                  <Link
                    href={`/tenants/${tenant.id}/users`}
                    className="rounded-[var(--radius-base)] border border-border bg-surface-2 px-3 py-1.5 text-xs hover:bg-surface"
                  >
                    Usuarios
                  </Link>
                  <Link
                    href={`/tenants/${tenant.id}/branding`}
                    className="rounded-[var(--radius-base)] border border-border bg-surface-2 px-3 py-1.5 text-xs hover:bg-surface"
                  >
                    Branding
                  </Link>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </Card>
  );
}
