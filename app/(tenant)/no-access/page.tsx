import Link from "next/link";
import { LockKeyhole } from "lucide-react";
import { PageFrame } from "@/components/layout/PageFrame";

export default function NoAccessPage() {
  return (
    <PageFrame mode="reading">
      <div className="space-y-4 rounded-[var(--radius-base)] border border-border bg-surface p-6">
        <div className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-border bg-surface-2">
          <LockKeyhole className="h-5 w-5 text-warning" aria-hidden="true" />
        </div>
        <h1 className="text-xl font-semibold">Sin acceso a tenant</h1>
        <p className="text-sm text-muted">
          Tu usuario no tiene membresías activas. Contacta a un administrador de plataforma.
        </p>
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
