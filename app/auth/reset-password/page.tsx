import Link from "next/link";
import { ResetPasswordRequestForm } from "@/components/auth/ResetPasswordRequestForm";

export default function ResetPasswordRequestPage() {
  return (
    <div className="mx-auto w-full max-w-md space-y-4 py-10">
      <header className="space-y-1 text-center">
        <h1 className="text-2xl font-semibold">Restablecer contraseña</h1>
        <p className="text-sm text-muted">Te enviaremos un enlace para crear una nueva contraseña.</p>
      </header>
      <ResetPasswordRequestForm />
      <p className="text-center text-sm text-muted">
        <Link href="/auth/login" className="text-primary hover:underline">
          Volver al inicio de sesión
        </Link>
      </p>
    </div>
  );
}
