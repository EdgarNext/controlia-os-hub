"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import type { TenantMembershipRecord } from "@/lib/repos/types";
import { removeTenantMembershipAction, updateTenantMembershipRoleAction } from "../actions/membershipActions";

type MembershipsTableProps = {
  tenantId: string;
  memberships: TenantMembershipRecord[];
};

export function MembershipsTable({ tenantId, memberships }: MembershipsTableProps) {
  const [isPending, startTransition] = useTransition();

  if (memberships.length === 0) {
    return <p className="text-sm text-muted">No hay usuarios asignados a este tenant.</p>;
  }

  return (
    <div className="overflow-x-auto rounded-[var(--radius-base)] border border-border">
      <table className="min-w-full border-collapse text-sm">
        <thead className="bg-surface-2 text-left">
          <tr>
            <th className="px-3 py-2 font-medium">Email</th>
            <th className="px-3 py-2 font-medium">Nombre</th>
            <th className="px-3 py-2 font-medium">Rol</th>
            <th className="px-3 py-2 font-medium">Acciones</th>
          </tr>
        </thead>
        <tbody>
          {memberships.map((membership) => (
            <tr key={membership.membership_id} className="border-t border-border">
              <td className="px-3 py-2">{membership.email ?? "sin email"}</td>
              <td className="px-3 py-2">{membership.display_name ?? "-"}</td>
              <td className="px-3 py-2">
                <form
                  onSubmit={(event) => {
                    event.preventDefault();
                    const formData = new FormData(event.currentTarget);
                    formData.set("tenantId", tenantId);
                    formData.set("membershipId", membership.membership_id);

                    startTransition(async () => {
                      const result = await updateTenantMembershipRoleAction(formData);
                      if (!result.ok) {
                        toast.error(result.message);
                        return;
                      }

                      toast.success(result.message);
                    });
                  }}
                  className="flex items-center gap-2"
                >
                  <select
                    name="role"
                    defaultValue={membership.role}
                    className="rounded-[var(--radius-base)] border border-border bg-surface px-2 py-1"
                  >
                    <option value="admin">admin</option>
                    <option value="operator">operator</option>
                    <option value="viewer">viewer</option>
                  </select>
                  <Button type="submit" variant="secondary" disabled={isPending}>
                    Guardar
                  </Button>
                </form>
              </td>
              <td className="px-3 py-2">
                <Button
                  type="button"
                  variant="danger"
                  disabled={isPending}
                  onClick={() => {
                    startTransition(async () => {
                      const formData = new FormData();
                      formData.set("tenantId", tenantId);
                      formData.set("membershipId", membership.membership_id);
                      formData.set("userId", membership.user_id);

                      const result = await removeTenantMembershipAction(formData);
                      if (!result.ok) {
                        toast.error(result.message);
                        return;
                      }

                      toast.success(result.message);
                    });
                  }}
                >
                  Remover
                </Button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
