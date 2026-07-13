"use client";

import { useActionState, useState } from "react";
import {
  createOrIssueClaimAction,
  type DeviceModuleKey,
  type IssueClaimFormState,
  type PosKioskOption,
} from "@/actions/pos/devices/actions";
import {
  RETAIL_CLAIM_DEVICE_ROLES,
  type RetailClaimDeviceRole,
} from "@/lib/pos/device-claims";
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
  canManageSalesPosDevices: boolean;
  canManageRetailPosDevices: boolean;
};

function formatClaimExpiry(value: string): string {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }

  const year = parsed.getUTCFullYear();
  const month = String(parsed.getUTCMonth() + 1).padStart(2, "0");
  const day = String(parsed.getUTCDate()).padStart(2, "0");
  const hours = String(parsed.getUTCHours()).padStart(2, "0");
  const minutes = String(parsed.getUTCMinutes()).padStart(2, "0");

  return `${year}-${month}-${day} ${hours}:${minutes} UTC`;
}

export function DeviceClaimCreator({
  tenantSlug,
  kiosks,
  canManageSalesPosDevices,
  canManageRetailPosDevices,
}: DeviceClaimCreatorProps) {
  const [state, formAction, isPending] = useActionState(createOrIssueClaimAction, initialState);
  const [copied, setCopied] = useState(false);
  const allowedModuleKeys: DeviceModuleKey[] = [
    ...(canManageSalesPosDevices ? (["sales_pos"] as const) : []),
    ...(canManageRetailPosDevices ? (["retail_pos"] as const) : []),
  ];
  const [moduleKey, setModuleKey] = useState<DeviceModuleKey>(allowedModuleKeys[0] ?? "sales_pos");
  const [deviceRole, setDeviceRole] = useState<RetailClaimDeviceRole>(RETAIL_CLAIM_DEVICE_ROLES[0]);
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

        {allowedModuleKeys.length > 1 ? (
          <div className="space-y-1">
            <Label htmlFor="moduleKey">Módulo</Label>
            <select
              id="moduleKey"
              name="moduleKey"
              value={moduleKey}
              onChange={(event) => setModuleKey(event.target.value as DeviceModuleKey)}
              className="h-11 w-full rounded-[var(--radius-base)] border border-border bg-surface-2 px-3 text-sm text-foreground outline-none transition-colors focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/30"
              aria-invalid={Boolean(state.fieldErrors.moduleKey) || undefined}
            >
              {allowedModuleKeys.map((allowedModuleKey) => (
                <option key={allowedModuleKey} value={allowedModuleKey}>
                  {allowedModuleKey}
                </option>
              ))}
            </select>
            {state.fieldErrors.moduleKey ? <p className="text-sm text-danger">{state.fieldErrors.moduleKey}</p> : null}
          </div>
        ) : (
          <div className="space-y-1">
            <input type="hidden" name="moduleKey" value={moduleKey} />
            <Label>Módulo</Label>
            <div className="rounded-[var(--radius-base)] border border-border bg-surface-2 px-3 py-3 text-sm text-foreground">
              {moduleKey}
            </div>
          </div>
        )}

        {moduleKey === "sales_pos" ? (
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
              {kiosks.length > 0 ? "Selecciona un kiosco" : "No hay kioscos operativos"}
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
        ) : (
          <div className="space-y-1">
            <Label htmlFor="deviceRole">Rol retail</Label>
            <select
              id="deviceRole"
              name="deviceRole"
              value={deviceRole}
              onChange={(event) => setDeviceRole(event.target.value as RetailClaimDeviceRole)}
              className="h-11 w-full rounded-[var(--radius-base)] border border-border bg-surface-2 px-3 text-sm text-foreground outline-none transition-colors focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/30"
              aria-invalid={Boolean(state.fieldErrors.deviceRole) || undefined}
            >
              {RETAIL_CLAIM_DEVICE_ROLES.map((role) => (
                <option key={role} value={role}>
                  {role}
                </option>
              ))}
            </select>
            {state.fieldErrors.deviceRole ? <p className="text-sm text-danger">{state.fieldErrors.deviceRole}</p> : null}
          </div>
        )}

        <Field
          label="Nombre del dispositivo"
          htmlFor="name"
          errorText={state.fieldErrors.name}
          helpText={
            moduleKey === "sales_pos"
              ? "Ejemplo: Tablet Pixel SN 3003 o Raspberry Pi ID 2"
              : "Ejemplo: Caja mostrador norte o Backoffice inventario"
          }
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
          Emitir código de claim
        </Button>
      </form>

      {claimResult ? (
        <div className="space-y-4 rounded-[var(--radius-base)] border border-border bg-surface p-4">
          <StatePanel
            kind="empty"
            title="Código de pairing generado"
            message={
              claimResult.moduleKey === "retail_pos"
                ? `Equipo ${claimResult.deviceName} listo para ${claimResult.deviceRole}.`
                : `Equipo ${claimResult.deviceName} asignado a ${claimResult.kioskName}.`
            }
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
            <p>
              Módulo: <span className="font-medium text-foreground">{claimResult.moduleKey}</span>
            </p>
            {claimResult.deviceRole ? (
              <p className="mt-2">
                Rol retail: <span className="font-medium text-foreground">{claimResult.deviceRole}</span>
              </p>
            ) : null}
            <p>Vence: <span className="font-medium text-foreground">{formatClaimExpiry(claimResult.claimExpiresAt)}</span></p>
            <p className="mt-2">En el POS local abre Activación, captura tenant y este código para completar el claiming.</p>
          </div>
        </div>
      ) : null}
    </div>
  );
}
