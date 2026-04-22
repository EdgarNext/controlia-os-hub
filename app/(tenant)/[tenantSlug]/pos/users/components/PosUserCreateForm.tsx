"use client";

import { useActionState } from "react";
import { createPosUserAction, type CreatePosUserFormState, type PosUserRole } from "@/actions/pos/users/actions";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { StatePanel } from "@/components/ui/state-panel";

const initialState: CreatePosUserFormState = {
  error: null,
  fieldErrors: {},
  values: {
    name: "",
    role: "cashier",
  },
  result: null,
};

const roleOptions: Array<{ value: PosUserRole; label: string; description: string }> = [
  {
    value: "cashier",
    label: "Cashier",
    description: "Opera ventas, pagos y login offline básico.",
  },
  {
    value: "supervisor",
    label: "Supervisor",
    description: "Puede apoyar en operaciones y overrides supervisados.",
  },
  {
    value: "admin",
    label: "Admin",
    description: "Uso operativo avanzado para el tenant POS.",
  },
];

type PosUserCreateFormProps = {
  tenantSlug: string;
};

export function PosUserCreateForm({ tenantSlug }: PosUserCreateFormProps) {
  const [state, formAction, isPending] = useActionState(createPosUserAction, initialState);

  return (
    <section className="space-y-4 rounded-[var(--radius-base)] border border-border bg-surface p-4">
      <div className="space-y-1">
        <h2 className="text-base font-semibold text-foreground">Crear usuario POS</h2>
        <p className="text-sm text-muted">
          El PIN se guarda como hash compatible con Edge para login offline. No se muestra de nuevo por seguridad.
        </p>
      </div>

      <form action={formAction} className="space-y-4">
        <input type="hidden" name="tenantSlug" value={tenantSlug} />

        <Field
          label="Nombre"
          htmlFor="name"
          errorText={state.fieldErrors.name}
          helpText="Ejemplo: Ana, Luis, Caja 1."
        >
          <Input
            id="name"
            name="name"
            defaultValue={state.values.name}
            placeholder="Nombre del usuario POS"
            invalid={Boolean(state.fieldErrors.name)}
            maxLength={120}
            autoComplete="off"
            required
          />
        </Field>

        <div className="space-y-1">
          <Label htmlFor="role">Rol</Label>
          <select
            id="role"
            name="role"
            defaultValue={state.values.role}
            className="h-11 w-full rounded-[var(--radius-base)] border border-border bg-surface-2 px-3 text-sm text-foreground outline-none transition-colors focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/30"
            aria-invalid={Boolean(state.fieldErrors.role) || undefined}
            aria-describedby={state.fieldErrors.role ? "role-error" : "role-help"}
            required
          >
            {roleOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          {state.fieldErrors.role ? (
            <p id="role-error" className="text-sm text-danger">
              {state.fieldErrors.role}
            </p>
          ) : (
            <p id="role-help" className="text-sm text-muted">
              {roleOptions.map((option) => `${option.label}: ${option.description}`).join(" · ")}
            </p>
          )}
        </div>

        <Field
          label="PIN"
          htmlFor="pin"
          errorText={state.fieldErrors.pin}
          helpText="Usa un PIN privado de al menos 4 caracteres. Se sincronizará a los dispositivos POS."
        >
          <Input
            id="pin"
            name="pin"
            type="password"
            inputMode="numeric"
            placeholder="PIN"
            invalid={Boolean(state.fieldErrors.pin)}
            autoComplete="new-password"
            required
            minLength={4}
          />
        </Field>

        {state.error ? (
          <StatePanel kind="error" title="No se pudo crear el usuario POS" message={state.error} />
        ) : null}

        {state.result ? (
          <StatePanel
            kind="empty"
            title="Usuario POS creado"
            message={`${state.result.name} quedó registrado como ${state.result.role}. Sincroniza el dispositivo POS para verlo offline.`}
          />
        ) : null}

        <Button type="submit" variant="secondary" isLoading={isPending}>
          Crear usuario POS
        </Button>
      </form>
    </section>
  );
}
