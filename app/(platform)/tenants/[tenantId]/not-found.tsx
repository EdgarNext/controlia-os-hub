import Link from "next/link";
import { Card } from "@/components/ui/card";
import { StatePanel } from "@/components/ui/state-panel";

export default function TenantNotFound() {
  return (
    <Card className="space-y-3">
      <StatePanel
        kind="empty"
        title="Tenant no encontrado"
        message="El identificador no existe o no tienes acceso."
      />
      <Link
        href="/tenants"
        className="inline-flex rounded-[var(--radius-base)] border border-border bg-surface-2 px-3 py-2 text-sm hover:bg-surface"
      >
        Volver al listado
      </Link>
    </Card>
  );
}
