"use client";

import { useActionState } from "react";
import { createKioskAction, type CreateKioskFormState } from "@/actions/pos/devices/actions";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/input";
import { StatePanel } from "@/components/ui/state-panel";

const initialState: CreateKioskFormState = {
  error: null,
  fieldErrors: {},
  values: {
    name: "",
  },
  nextNumber: null,
  result: null,
};

type CreateKioskFormProps = {
  tenantSlug: string;
  nextNumber: number;
};

export function CreateKioskForm({ tenantSlug, nextNumber }: CreateKioskFormProps) {
  const [state, formAction, isPending] = useActionState(createKioskAction, initialState);
  const displayedNextNumber = state.nextNumber ?? nextNumber;

  return (
    <section className="space-y-3 rounded-[var(--radius-base)] border border-border bg-surface p-4">
      <h2 className="text-sm font-semibold text-foreground">Registrar kiosco</h2>
      <p className="text-sm text-muted">Primero crea el kiosco operativo. Después podrás emitir el claim para un dispositivo.</p>

      <form action={formAction} className="space-y-3">
        <input type="hidden" name="tenantSlug" value={tenantSlug} />

        <div className="rounded-[var(--radius-base)] border border-border bg-surface-2 px-3 py-2">
          <p className="text-xs font-medium uppercase tracking-[0.08em] text-muted">Número de kiosco</p>
          <p className="mt-1 text-lg font-semibold text-foreground">{displayedNextNumber}</p>
          <p className="mt-1 text-sm text-muted">Se asignará automáticamente el siguiente número disponible.</p>
        </div>

        <Field label="Nombre visible" htmlFor="name" errorText={state.fieldErrors.name} helpText="Ejemplo: Barra terraza.">
          <Input id="name" name="name" defaultValue={state.values.name} maxLength={120} invalid={Boolean(state.fieldErrors.name)} />
        </Field>

        {state.error ? <StatePanel kind="error" title="No se pudo crear el kiosco" message={state.error} /> : null}
        {state.result ? (
          <StatePanel
            kind="empty"
            title="Kiosco creado"
            message={`Kiosco ${state.result.number} ${state.result.name ? `(${state.result.name})` : ""} registrado correctamente.`}
          />
        ) : null}

        <Button type="submit" variant="secondary" isLoading={isPending}>
          Crear kiosco
        </Button>
      </form>
    </section>
  );
}
