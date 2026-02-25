import { Activity } from "lucide-react";

export default async function TenantDashboardPage({ params }: { params: Promise<{ tenantSlug: string }> }) {
  const { tenantSlug } = await params;

  return (
    <div className="space-y-4">
      <header className="space-y-1">
        <div className="inline-flex items-center gap-2">
          <Activity className="h-5 w-5 text-primary" aria-hidden="true" />
          <h1 className="text-xl font-semibold">Dashboard</h1>
        </div>
        <p className="text-sm text-muted">Operational overview for tenant: {tenantSlug}</p>
      </header>

      <div className="rounded-[var(--radius-base)] border border-border bg-surface p-5 text-sm text-muted">
        Dashboard scaffold ready.
      </div>
    </div>
  );
}
