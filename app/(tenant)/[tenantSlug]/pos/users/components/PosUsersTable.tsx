import { Card } from "@/components/ui/card";
import type { PosUserRow } from "@/lib/pos/users";

function formatDate(value: string) {
  return new Intl.DateTimeFormat("es-MX", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

type PosUsersTableProps = {
  rows: PosUserRow[];
};

export function PosUsersTable({ rows }: PosUsersTableProps) {
  return (
    <Card className="space-y-4 p-4">
      <div className="space-y-1">
        <h2 className="text-base font-semibold text-foreground">Usuarios POS registrados</h2>
        <p className="text-sm text-muted">
          Estos usuarios se sincronizan al Edge POS para permitir login offline.
        </p>
      </div>

      <div className="overflow-x-auto rounded-[calc(var(--radius-base)-4px)] border border-border">
        <table className="min-w-full text-left text-sm">
          <thead className="bg-surface-2 text-xs uppercase tracking-[0.08em] text-muted">
            <tr>
              <th className="px-4 py-3 font-semibold">Nombre</th>
              <th className="px-4 py-3 font-semibold">Rol</th>
              <th className="px-4 py-3 font-semibold">Estado</th>
              <th className="px-4 py-3 font-semibold">Actualizado</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id} className="border-t border-border">
                <td className="px-4 py-3 font-medium text-foreground">{row.name}</td>
                <td className="px-4 py-3 text-muted">{row.role}</td>
                <td className="px-4 py-3 text-muted">
                  {row.is_active ? "Activo" : "Inactivo"}
                </td>
                <td className="px-4 py-3 text-muted">{formatDate(row.updated_at)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}
