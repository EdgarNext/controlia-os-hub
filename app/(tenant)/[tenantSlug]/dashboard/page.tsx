import { Activity } from "lucide-react";
import { StatePanel } from "@/components/ui/state-panel";

export default async function TenantDashboardPage({ params }: { params: Promise<{ tenantSlug: string }> }) {
  const { tenantSlug } = await params;

  return (
    <div className="space-y-4">
      <header className="space-y-1">
        <div className="inline-flex items-center gap-2">
          <Activity className="h-5 w-5 text-primary" aria-hidden="true" />
          <h1 className="text-xl font-semibold">Tablero</h1>
        </div>
        <p className="text-sm text-muted">Resumen operativo del tenant: {tenantSlug}</p>
      </header>

      <StatePanel
        kind="empty"
        title="Tablero en preparacion"
        message="Esta vista se habilitara con metricas operativas del tenant."
      />
    </div>
  );
}
