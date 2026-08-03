"use client";

import { useActionState } from "react";
import { updatePasswordAction, type PasswordResetState } from "@/actions/auth/reset-password";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Field, Input } from "@/components/ui/input";

const initialState: PasswordResetState = { error: null, success: null };

export function UpdatePasswordForm() {
  const [state, formAction, isPending] = useActionState(updatePasswordAction, initialState);

  return (
    <Card>
      <form action={formAction} className="space-y-4">
        <Field label="Nueva contraseña" htmlFor="password">
          <Input id="password" type="password" name="password" required minLength={8} autoComplete="new-password" />
        </Field>
        <Field label="Confirmar contraseña" htmlFor="passwordConfirmation">
          <Input id="passwordConfirmation" type="password" name="passwordConfirmation" required minLength={8} autoComplete="new-password" />
        </Field>
        {state.error ? <p className="rounded-[var(--radius-base)] border border-danger/30 bg-surface-2 px-3 py-2 text-sm text-danger">{state.error}</p> : null}
        <Button type="submit" isLoading={isPending} className="w-full">
          Guardar contraseña
        </Button>
      </form>
    </Card>
  );
}
