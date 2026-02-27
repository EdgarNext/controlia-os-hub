import Link from "next/link";
import { Card } from "@/components/ui/card";
import { StatePanel } from "@/components/ui/state-panel";
import { requireUser } from "@/lib/auth/require-user";

export default async function ForbiddenPage() {
  const user = await requireUser();

  return (
    <div className="mx-auto w-full max-w-xl py-10">
      <Card className="space-y-4">
        <StatePanel
          kind="permission"
          title="Sin permisos de plataforma"
          message={`Tu cuenta (${user.email}) no tiene permisos de Platform Owner. Solicita la asignacion del rol en platform_settings.`}
        />

        <div className="flex gap-2">
          <Link
            href="/"
            className="rounded-[var(--radius-base)] border border-border bg-surface-2 px-3 py-2 text-sm transition-colors duration-200 hover:bg-surface"
          >
            Volver al inicio
          </Link>
          <Link
            href="/tenants"
            className="rounded-[var(--radius-base)] border border-border bg-surface-2 px-3 py-2 text-sm transition-colors duration-200 hover:bg-surface"
          >
            Reintentar acceso
          </Link>
        </div>
      </Card>
    </div>
  );
}
