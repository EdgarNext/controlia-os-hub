"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import type { TenantBrandingRecord } from "@/lib/repos/types";
import { saveTenantBrandingAction } from "../actions/brandingActions";

type BrandingFormProps = {
  tenantId: string;
  branding: TenantBrandingRecord | null;
};

export function BrandingForm({ tenantId, branding }: BrandingFormProps) {
  const [isPending, startTransition] = useTransition();

  return (
    <form
      className="space-y-4"
      onSubmit={(event) => {
        event.preventDefault();
        const formData = new FormData(event.currentTarget);
        formData.set("tenantId", tenantId);

        startTransition(async () => {
          const result = await saveTenantBrandingAction(formData);
          if (!result.ok) {
            toast.error(result.message);
            return;
          }

          toast.success(result.message);
        });
      }}
    >
      <label className="block space-y-1 text-sm">
        <span className="text-muted">Nombre para mostrar</span>
        <input
          name="display_name"
          defaultValue={branding?.display_name ?? ""}
          className="w-full rounded-[var(--radius-base)] border border-border bg-surface-2 px-3 py-2"
          placeholder="Nombre visible del tenant"
        />
      </label>

      <label className="block space-y-1 text-sm">
        <span className="text-muted">URL del logo</span>
        <input
          name="logo_url"
          type="url"
          defaultValue={branding?.logo_url ?? ""}
          className="w-full rounded-[var(--radius-base)] border border-border bg-surface-2 px-3 py-2"
          placeholder="https://..."
        />
      </label>

      {branding?.logo_url ? (
        <div className="rounded-[var(--radius-base)] border border-border bg-surface-2 p-3">
          <p className="mb-2 text-xs text-muted">Vista previa</p>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={branding.logo_url}
            alt="Logo del tenant"
            className="h-14 w-14 rounded-[var(--radius-base)] border border-border object-cover"
          />
        </div>
      ) : null}

      <Button type="submit" isLoading={isPending}>
        Guardar branding
      </Button>
    </form>
  );
}
