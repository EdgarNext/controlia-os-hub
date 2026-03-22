"use client";

import { useActionState, useState } from "react";
import {
  disableDeviceAction,
  reissueClaimAction,
  type DisableDeviceFormState,
  type IssueClaimFormState,
  type PosKioskOption,
} from "@/actions/pos/devices/actions";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { StatePanel } from "@/components/ui/state-panel";

const initialDisableState: DisableDeviceFormState = {
  error: null,
  done: false,
};

const initialReissueState: IssueClaimFormState = {
  error: null,
  fieldErrors: {},
  result: null,
};

type DeviceDetailActionsProps = {
  tenantSlug: string;
  deviceRecordId: string;
  kioskId: string;
  deviceName: string;
  kiosks: PosKioskOption[];
  disabled: boolean;
};

export function DeviceDetailActions({
  tenantSlug,
  deviceRecordId,
  kioskId,
  deviceName,
  kiosks,
  disabled,
}: DeviceDetailActionsProps) {
  const [disableState, disableFormAction, disablePending] = useActionState(disableDeviceAction, initialDisableState);
  const [reissueState, reissueFormAction, reissuePending] = useActionState(reissueClaimAction, initialReissueState);
  const [copied, setCopied] = useState(false);
  const reissueResult = reissueState.result;

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
      <section id="reclaim" className="space-y-3 rounded-[var(--radius-base)] border border-border bg-surface p-4">
        <h2 className="text-sm font-semibold text-foreground">Reemitir claim</h2>
        <p className="text-sm text-muted">
          Esta acción invalida credenciales activas y mueve el equipo a estado pendiente hasta completar un nuevo pairing.
        </p>

        <form action={reissueFormAction} className="space-y-3">
          <input type="hidden" name="tenantSlug" value={tenantSlug} />
          <input type="hidden" name="deviceRecordId" value={deviceRecordId} />

          <div className="space-y-1">
            <Label htmlFor="kioskId">Kiosco destino</Label>
            <select
              id="kioskId"
              name="kioskId"
              defaultValue={kioskId}
              className="h-11 w-full rounded-[var(--radius-base)] border border-border bg-surface-2 px-3 text-sm text-foreground outline-none transition-colors focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/30"
              aria-invalid={Boolean(reissueState.fieldErrors.kioskId) || undefined}
              required
            >
              {kiosks.map((kiosk) => (
                <option key={kiosk.id} value={kiosk.id}>
                  {kiosk.name ?? `Kiosco ${kiosk.number}`}
                </option>
              ))}
            </select>
            {reissueState.fieldErrors.kioskId ? (
              <p className="text-sm text-danger">{reissueState.fieldErrors.kioskId}</p>
            ) : null}
          </div>

          <Field label="Nombre del dispositivo" htmlFor="name" errorText={reissueState.fieldErrors.name}>
            <Input id="name" name="name" defaultValue={deviceName} invalid={Boolean(reissueState.fieldErrors.name)} required />
          </Field>

          <Field
            label="Confirmación"
            htmlFor="confirmPhrase"
            errorText={reissueState.fieldErrors.confirmPhrase}
            helpText="Escribe RECLAMAR para autorizar la rotación de credenciales."
          >
            <Input
              id="confirmPhrase"
              name="confirmPhrase"
              placeholder="RECLAMAR"
              invalid={Boolean(reissueState.fieldErrors.confirmPhrase)}
              required
            />
          </Field>

          {reissueState.error ? (
            <StatePanel kind="error" title="No se pudo reemitir el claim" message={reissueState.error} />
          ) : null}

          <Button type="submit" variant="warning" isLoading={reissuePending}>
            Reemitir claim
          </Button>
        </form>

        {reissueResult ? (
          <div className="space-y-3 rounded-[var(--radius-base)] border border-border bg-surface-2 p-3">
            <p className="text-sm font-medium text-foreground">Nuevo código generado</p>
            <div className="flex flex-col gap-2 sm:flex-row">
              <Input value={reissueResult.claimCode} readOnly className="font-mono tracking-[0.16em]" />
              <Button type="button" variant="secondary" onClick={() => handleCopy(reissueResult.claimCode)}>
                {copied ? "Copiado" : "Copiar código"}
              </Button>
            </div>
            <p className="text-xs text-muted">Vence: {new Date(reissueResult.claimExpiresAt).toLocaleString("es-MX")}</p>
          </div>
        ) : null}
      </section>

      <section id="desactivar" className="space-y-3 rounded-[var(--radius-base)] border border-danger/40 bg-danger/10 p-4">
        <h2 className="text-sm font-semibold text-foreground">Desactivar dispositivo</h2>
        <p className="text-sm text-muted">
          La desactivación bloquea autenticación de sync hasta volver a emitir claim y completar pairing.
        </p>

        {disabled ? (
          <StatePanel kind="warning" title="Dispositivo ya desactivado" message="Este equipo ya está en estado disabled." />
        ) : (
          <form action={disableFormAction} className="space-y-3">
            <input type="hidden" name="tenantSlug" value={tenantSlug} />
            <input type="hidden" name="deviceRecordId" value={deviceRecordId} />

            <Field
              label="Confirmación"
              htmlFor="confirmDisable"
              helpText="Escribe DESACTIVAR para confirmar esta acción."
            >
              <Input id="confirmDisable" name="confirmPhrase" placeholder="DESACTIVAR" required />
            </Field>

            {disableState.error ? (
              <StatePanel kind="error" title="No se pudo desactivar" message={disableState.error} />
            ) : null}

            {disableState.done ? (
              <StatePanel
                kind="warning"
                title="Dispositivo desactivado"
                message="El dispositivo quedó inhabilitado para sincronización hasta nuevo claim."
              />
            ) : null}

            <Button type="submit" variant="danger" isLoading={disablePending}>
              Desactivar dispositivo
            </Button>
          </form>
        )}
      </section>
    </div>
  );
}
