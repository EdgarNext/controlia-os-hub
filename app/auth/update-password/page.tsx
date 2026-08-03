import Link from "next/link";
import { UpdatePasswordForm } from "@/components/auth/UpdatePasswordForm";
import { requireUser } from "@/lib/auth/require-user";
import { resolveUserLandingPath } from "@/lib/auth/resolve-landing-path";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export default async function UpdatePasswordPage() {
  const user = await requireUser();
  const supabase = await createSupabaseServerClient();
  const cancelHref = await resolveUserLandingPath(supabase, user.id);

  return (
    <div className="mx-auto w-full max-w-md space-y-4 py-10">
      <header className="space-y-1 text-center">
        <h1 className="text-2xl font-semibold">Crear nueva contraseña</h1>
        <p className="text-sm text-muted">Elige una contraseña de al menos 8 caracteres.</p>
      </header>
      <div className="rounded-[var(--radius-base)] border border-border bg-surface-2 px-4 py-3 text-sm">
        <p className="text-xs uppercase tracking-wide text-muted">Usuario</p>
        <p className="mt-1 break-all font-medium text-foreground">{user.email ?? "Email no disponible"}</p>
      </div>
      <UpdatePasswordForm />
      <div className="flex justify-center">
        <Link
          href={cancelHref}
          className="inline-flex min-h-10 items-center justify-center rounded-[var(--radius-base)] border border-border bg-surface-2 px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-surface focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
        >
          Cancelar
        </Link>
      </div>
    </div>
  );
}
