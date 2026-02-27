"use client";

import { useActionState } from "react";
import { signInAction, type SignInState } from "@/actions/auth/sign-in";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Field, Input } from "@/components/ui/input";

const initialState: SignInState = {
  error: null,
};

export function LoginForm() {
  const [state, formAction, isPending] = useActionState(signInAction, initialState);
  const errorId = state.error ? "login-form-error" : undefined;

  return (
    <Card>
      <form action={formAction} className="space-y-4">
        <Field label="Email" htmlFor="email">
          <Input
            id="email"
            type="email"
            name="email"
            required
            autoComplete="email"
            invalid={Boolean(state.error)}
            aria-describedby={errorId}
            placeholder="usuario@empresa.com"
          />
        </Field>

        <Field label="Contrasena" htmlFor="password">
          <Input
            id="password"
            type="password"
            name="password"
            required
            autoComplete="current-password"
            invalid={Boolean(state.error)}
            aria-describedby={errorId}
            placeholder="********"
          />
        </Field>

        {state.error ? (
          <p id="login-form-error" className="rounded-[var(--radius-base)] border border-danger/30 bg-surface-2 px-3 py-2 text-sm text-danger">
            {state.error}
          </p>
        ) : null}

        <Button type="submit" isLoading={isPending} className="w-full">
          Entrar
        </Button>
      </form>
    </Card>
  );
}
