"use client";

import { useActionState } from "react";
import { Upload } from "lucide-react";
import { Button } from "@/components/ui/button";

type CsvImportSummary = {
  created: number;
  updated: number;
  ignored: number;
  errors: string[];
};

type CsvImportState = {
  error: string | null;
  summary: CsvImportSummary | null;
};

type CatalogCsvImportCardProps = {
  action: (previousState: CsvImportState, formData: FormData) => Promise<CsvImportState>;
  tenantSlug: string;
  title: string;
  description: string;
};

const initialState: CsvImportState = {
  error: null,
  summary: null,
};

export function CatalogCsvImportCard({
  action,
  tenantSlug,
  title,
  description,
}: CatalogCsvImportCardProps) {
  const [state, formAction, isPending] = useActionState(action, initialState);

  return (
    <form action={formAction} className="space-y-3 rounded-[var(--radius-base)] border border-border bg-surface p-4">
      <input type="hidden" name="tenantSlug" value={tenantSlug} />

      <div>
        <p className="text-sm font-semibold text-foreground">{title}</p>
        <p className="text-xs text-muted">{description}</p>
      </div>

      <label className="block space-y-1 text-sm">
        <span className="text-muted">Archivo CSV</span>
        <input
          type="file"
          name="file"
          accept=".csv,text/csv"
          required
          className="w-full rounded-[var(--radius-base)] border border-border bg-surface-2 px-3 py-2 text-sm"
        />
      </label>

      {state.error ? (
        <p className="rounded-[var(--radius-base)] border border-danger/40 bg-danger-soft px-3 py-2 text-sm text-danger">
          {state.error}
        </p>
      ) : null}

      {state.summary ? (
        <div className="space-y-2 rounded-[var(--radius-base)] border border-border bg-surface-2 p-3 text-sm">
          <p className="font-medium text-foreground">Resultado de importación</p>
          <div className="grid gap-2 text-muted sm:grid-cols-3">
            <p>Creadas: {state.summary.created}</p>
            <p>Actualizadas: {state.summary.updated}</p>
            <p>Ignoradas: {state.summary.ignored}</p>
          </div>
          {state.summary.errors.length > 0 ? (
            <div className="space-y-1">
              <p className="text-xs font-medium text-danger">Errores por fila</p>
              <ul className="space-y-1 text-xs text-danger">
                {state.summary.errors.map((error) => (
                  <li key={error}>{error}</li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
      ) : null}

      <Button type="submit" variant="secondary" isLoading={isPending}>
        <Upload className="h-4 w-4" aria-hidden="true" />
        Subir CSV
      </Button>
    </form>
  );
}
