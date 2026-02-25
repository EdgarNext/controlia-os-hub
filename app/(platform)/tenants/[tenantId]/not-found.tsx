import Link from "next/link";
import { Card } from "@/components/ui/card";

export default function TenantNotFound() {
  return (
    <Card className="space-y-3">
      <h2 className="text-base font-semibold">Tenant no encontrado</h2>
      <p className="text-sm text-muted">El identificador no existe o no tienes acceso.</p>
      <Link
        href="/tenants"
        className="inline-flex rounded-[var(--radius-base)] border border-border bg-surface-2 px-3 py-2 text-sm hover:bg-surface"
      >
        Volver al listado
      </Link>
    </Card>
  );
}
