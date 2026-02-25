"use client";

import { useActionState, useEffect } from "react";
import { toast } from "sonner";
import { signInAction, type SignInState } from "@/actions/auth/sign-in";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

const initialState: SignInState = {
  error: null,
};

export function LoginForm() {
  const [state, formAction, isPending] = useActionState(signInAction, initialState);

  useEffect(() => {
    if (state.error) {
      toast.error(state.error);
    }
  }, [state.error]);

  return (
    <Card>
      <form action={formAction} className="space-y-4">
        <label className="block space-y-1 text-sm">
          <span className="text-muted">Email</span>
          <input
            type="email"
            name="email"
            required
            autoComplete="email"
            className="w-full rounded-[var(--radius-base)] border border-border bg-surface-2 px-3 py-2"
            placeholder="you@company.com"
          />
        </label>

        <label className="block space-y-1 text-sm">
          <span className="text-muted">Password</span>
          <input
            type="password"
            name="password"
            required
            autoComplete="current-password"
            className="w-full rounded-[var(--radius-base)] border border-border bg-surface-2 px-3 py-2"
            placeholder="********"
          />
        </label>

        {state.error ? (
          <p className="rounded-[var(--radius-base)] border border-danger/30 bg-surface-2 px-3 py-2 text-sm text-danger">
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
