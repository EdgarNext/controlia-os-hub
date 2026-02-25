import type { TenantRecord } from "@/lib/repos/types";
import { TenantStatusBadge } from "./TenantStatusBadge";

export function TenantTitle({ tenant }: { tenant: TenantRecord }) {
  return (
    <header className="space-y-2">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-xl font-semibold">{tenant.name}</h1>
        <TenantStatusBadge status={tenant.status} />
      </div>
      <p className="text-sm text-muted">Slug: {tenant.slug}</p>
    </header>
  );
}
