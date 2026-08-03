"use client";

import { useActionState } from "react";
import { requestPasswordResetAction, type PasswordResetState } from "@/actions/auth/reset-password";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Field, Input } from "@/components/ui/input";

const initialState: PasswordResetState = { error: null, success: null };

export function ResetPasswordRequestForm() {
  const [state, formAction, isPending] = useActionState(requestPasswordResetAction, initialState);

  return (
    <Card>
      <form action={formAction} className="space-y-4">
        <Field label="Email" htmlFor="email">
          <Input id="email" type="email" name="email" required autoComplete="email" placeholder="usuario@empresa.com" />
        </Field>
        {state.error ? <p className="rounded-[var(--radius-base)] border border-danger/30 bg-surface-2 px-3 py-2 text-sm text-danger">{state.error}</p> : null}
        {state.success ? <p className="rounded-[var(--radius-base)] border border-success/30 bg-surface-2 px-3 py-2 text-sm text-success">{state.success}</p> : null}
        <Button type="submit" isLoading={isPending} className="w-full">
          Enviar enlace
        </Button>
      </form>
    </Card>
  );
}
