import { requireGuest } from "@/lib/auth/require-guest";
import { LoginForm } from "@/components/auth/LoginForm";

export default async function LoginPage() {
  await requireGuest();

  return (
    <div className="mx-auto w-full max-w-md space-y-4 py-10">
      <header className="space-y-1 text-center">
        <h1 className="text-2xl font-semibold">Iniciar sesion</h1>
        <p className="text-sm text-muted">Accede al hub de Controlia OS.</p>
      </header>
      <LoginForm />
    </div>
  );
}
