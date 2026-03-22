"use client";

import { useActionState, useState } from "react";
import {
  createOrIssueClaimAction,
  type IssueClaimFormState,
  type PosKioskOption,
} from "@/actions/pos/devices/actions";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { StatePanel } from "@/components/ui/state-panel";

const initialState: IssueClaimFormState = {
  error: null,
  fieldErrors: {},
  result: null,
};

type DeviceClaimCreatorProps = {
  tenantSlug: string;
  kiosks: PosKioskOption[];
};

export function DeviceClaimCreator({ tenantSlug, kiosks }: DeviceClaimCreatorProps) {
  const [state, formAction, isPending] = useActionState(createOrIssueClaimAction, initialState);
  const [copied, setCopied] = useState(false);
  const claimResult = state.result;

  async function handleCopy(value: string) {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  }

  return (
    <div className="space-y-4">
      <form action={formAction} className="space-y-4 rounded-[var(--radius-base)] border border-border bg-surface p-4">
        <input type="hidden" name="tenantSlug" value={tenantSlug} />

        <div className="space-y-1">
          <Label htmlFor="kioskId">Kiosco destino</Label>
          <select
            id="kioskId"
            name="kioskId"
            defaultValue=""
            className="h-11 w-full rounded-[var(--radius-base)] border border-border bg-surface-2 px-3 text-sm text-foreground outline-none transition-colors focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/30"
            aria-invalid={Boolean(state.fieldErrors.kioskId) || undefined}
            aria-describedby={state.fieldErrors.kioskId ? "kioskId-error" : undefined}
            required
          >
            <option value="" disabled>
              Selecciona un kiosco
            </option>
            {kiosks.map((kiosk) => (
              <option key={kiosk.id} value={kiosk.id}>
                {kiosk.name ?? `Kiosco ${kiosk.number}`}
              </option>
            ))}
          </select>
          {state.fieldErrors.kioskId ? (
            <p id="kioskId-error" className="text-sm text-danger">
              {state.fieldErrors.kioskId}
            </p>
          ) : null}
        </div>

        <Field
          label="Nombre del dispositivo"
          htmlFor="name"
          errorText={state.fieldErrors.name}
          helpText="Ejemplo: Tablet Pixel SN 3003 o Raspberry Pi ID 2"
        >
          <Input
            id="name"
            name="name"
            placeholder="Nombre operativo del equipo"
            invalid={Boolean(state.fieldErrors.name)}
            aria-describedby={state.fieldErrors.name ? "name-error" : "name-help"}
            required
            maxLength={120}
          />
        </Field>

        {state.error ? <StatePanel kind="error" title="No se pudo emitir el claim" message={state.error} /> : null}

        <Button type="submit" isLoading={isPending}>
          Emitir código de pairing
        </Button>
      </form>

      {claimResult ? (
        <div className="space-y-4 rounded-[var(--radius-base)] border border-border bg-surface p-4">
          <StatePanel
            kind="empty"
            title="Código de pairing generado"
            message={`Equipo ${claimResult.deviceName} asignado a ${claimResult.kioskName}.`}
          />

          <div className="space-y-1">
            <Label htmlFor="claimCode">Código de claim</Label>
            <div className="flex flex-col gap-2 sm:flex-row">
              <Input id="claimCode" value={claimResult.claimCode} readOnly className="font-mono tracking-[0.16em]" />
              <Button type="button" variant="secondary" onClick={() => handleCopy(claimResult.claimCode)}>
                {copied ? "Copiado" : "Copiar código"}
              </Button>
            </div>
          </div>

          <div className="rounded-[var(--radius-base)] border border-border bg-surface-2 p-3 text-sm text-muted">
            <p>Vence: <span className="font-medium text-foreground">{new Date(claimResult.claimExpiresAt).toLocaleString("es-MX")}</span></p>
            <p className="mt-2">En el POS local abre Activación, captura tenant y este código para completar el pairing.</p>
          </div>
        </div>
      ) : null}
    </div>
  );
}
