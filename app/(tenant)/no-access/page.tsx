import Link from "next/link";
import { PageFrame } from "@/components/layout/PageFrame";
import { StatePanel } from "@/components/ui/state-panel";

export default function NoAccessPage() {
  return (
    <PageFrame mode="reading">
      <div className="space-y-4 rounded-[var(--radius-base)] border border-border bg-surface p-6">
        <StatePanel
          kind="permission"
          title="Sin acceso al tenant"
          message="Tu usuario no tiene membresias activas. Contacta a un administrador de plataforma."
        />
        <Link
          href="/auth/forbidden"
          className="inline-flex rounded-[var(--radius-base)] border border-border bg-surface-2 px-3 py-2 text-sm"
        >
          Ver estado de acceso
        </Link>
      </div>
    </PageFrame>
  );
}
