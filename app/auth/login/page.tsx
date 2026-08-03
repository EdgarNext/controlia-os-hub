import { requireGuest } from "@/lib/auth/require-guest";
import { LoginForm } from "@/components/auth/LoginForm";

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ reset?: string; error?: string }> }) {
  await requireGuest();
  const params = await searchParams;

  return (
    <div className="mx-auto w-full max-w-md space-y-4 py-10">
      <header className="space-y-1 text-center">
        <h1 className="text-2xl font-semibold">Iniciar sesion</h1>
        <p className="text-sm text-muted">Accede al hub de Controlia OS.</p>
      </header>
      {params.reset === "success" ? (
        <p className="rounded-[var(--radius-base)] border border-success/30 bg-surface-2 px-3 py-2 text-sm text-success">
          Contraseña actualizada. Ya puedes iniciar sesión.
        </p>
      ) : null}
      {params.error === "invalid_recovery_link" ? (
        <p className="rounded-[var(--radius-base)] border border-danger/30 bg-surface-2 px-3 py-2 text-sm text-danger">
          El enlace de recuperación no es válido o ya expiró.
        </p>
      ) : null}
      <LoginForm />
    </div>
  );
}
