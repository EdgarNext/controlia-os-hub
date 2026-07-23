"use client";

import Link from "next/link";
import { useDeferredValue, useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { StatePanel } from "@/components/ui/state-panel";
import { formatKitchenUnit } from "@/lib/kitchen/formatters";
import { getRecipeStatusLabel, getRecipeVersionStatusLabel } from "./recipe-status-labels";

type RecipeListRow = {
  id: string;
  name: string;
  normalizedName: string;
  category: string | null;
  recipeStatus: string;
  readinessStatus: string | null;
  readinessReason: string | null;
  pendingIngredientCount: number;
  hasSnapshot: boolean;
  hasWarnings: boolean;
  isTest: boolean;
  versionNumber: number | null;
  versionStatus: string | null;
  yieldQuantity: number;
  yieldUnitCode: string | null;
  costPerYieldUnit: number | null;
  snapshotCreatedAt: string | null;
};

type RecipesListInteractiveProps = {
  tenantSlug: string;
  rows: RecipeListRow[];
  initialFilters: {
    q: string;
    status: string;
    category: string;
  };
};

export function RecipesListInteractive({ tenantSlug, rows, initialFilters }: RecipesListInteractiveProps) {
  const [qInput, setQInput] = useState(initialFilters.q);
  const [statusFilter, setStatusFilter] = useState(initialFilters.status);
  const [categoryFilter, setCategoryFilter] = useState(initialFilters.category);

  const deferredQInput = useDeferredValue(qInput);
  const isFiltering = deferredQInput !== qInput;

  const categoryOptions = useMemo(() => {
    const unique = new Set<string>();
    for (const row of rows) {
      if (row.category) unique.add(row.category);
    }
    return [...unique].sort((a, b) => a.localeCompare(b, "es-MX"));
  }, [rows]);

  const statusOptions = useMemo(() => {
    const unique = new Set<string>();
    for (const row of rows) {
      if (row.recipeStatus) unique.add(row.recipeStatus);
    }
    return [...unique].sort((a, b) => a.localeCompare(b, "es-MX"));
  }, [rows]);

  const filteredRows = useMemo(() => {
    const q = deferredQInput.trim().toLocaleLowerCase("es-MX");

    return rows.filter((row) => {
      if (statusFilter && row.recipeStatus !== statusFilter) return false;
      if (categoryFilter && (row.category ?? "") !== categoryFilter) return false;

      if (!q) return true;

      const haystack = [row.name, row.normalizedName, row.category ?? "", row.recipeStatus]
        .join(" ")
        .toLocaleLowerCase("es-MX");

      return haystack.includes(q);
    });
  }, [rows, deferredQInput, statusFilter, categoryFilter]);

  const activeFilters = useMemo(() => {
    const list: Array<{ key: "q" | "status" | "category"; label: string }> = [];
    const q = qInput.trim();
    if (q) list.push({ key: "q", label: `Búsqueda: ${q}` });
    if (statusFilter) list.push({ key: "status", label: `Estado: ${getRecipeStatusLabel(statusFilter)}` });
    if (categoryFilter) list.push({ key: "category", label: `Categoría: ${categoryFilter}` });
    return list;
  }, [qInput, statusFilter, categoryFilter]);

  const clearAll = () => {
    setQInput("");
    setStatusFilter("");
    setCategoryFilter("");
  };

  const clearOne = (key: "q" | "status" | "category") => {
    if (key === "q") setQInput("");
    if (key === "status") setStatusFilter("");
    if (key === "category") setCategoryFilter("");
  };

  return (
    <>
      <section className="rounded-[var(--radius-base)] border border-border bg-surface p-4">
        <div className="flex flex-wrap items-end gap-3">
          <div className="min-w-[260px] flex-1">
            <label htmlFor="recipes-filter-q" className="text-xs text-muted">
              Buscar receta
            </label>
            <input
              id="recipes-filter-q"
              value={qInput}
              onChange={(event) => setQInput(event.target.value)}
              placeholder="Nombre de receta"
              className="mt-1 h-10 w-full rounded-[var(--radius-base)] border border-border bg-surface-2 px-3 text-sm text-foreground outline-none transition-colors placeholder:text-muted focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary"
            />
          </div>

          <div className="min-w-[220px]">
            <label htmlFor="recipes-filter-status" className="text-xs text-muted">
              Estado
            </label>
            <select
              id="recipes-filter-status"
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value)}
              className="mt-1 h-10 w-full rounded-[var(--radius-base)] border border-border bg-surface-2 px-3 text-sm text-foreground"
            >
              <option value="">Todos</option>
                  {statusOptions.map((status) => (
                    <option key={status} value={status}>
                      {getRecipeStatusLabel(status)}
                </option>
              ))}
            </select>
          </div>

          <div className="min-w-[220px]">
            <label htmlFor="recipes-filter-category" className="text-xs text-muted">
              Categoría
            </label>
            <select
              id="recipes-filter-category"
              value={categoryFilter}
              onChange={(event) => setCategoryFilter(event.target.value)}
              className="mt-1 h-10 w-full rounded-[var(--radius-base)] border border-border bg-surface-2 px-3 text-sm text-foreground"
            >
              <option value="">Todas</option>
              {categoryOptions.map((category) => (
                <option key={category} value={category}>
                  {category}
                </option>
              ))}
            </select>
          </div>

          <button
            type="button"
            onClick={clearAll}
            className="h-10 rounded-[var(--radius-base)] border border-border bg-surface px-3 text-sm text-foreground"
          >
            Limpiar filtros
          </button>
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
          <span className="text-muted">Resultados: {filteredRows.length.toLocaleString("es-MX")}</span>
              {isFiltering ? <span className="rounded-full bg-surface-2 px-2 py-0.5 text-primary" role="status">Actualizando resultados…</span> : null}
        </div>

        {activeFilters.length > 0 ? (
          <div className="mt-3 flex flex-wrap gap-2">
            {activeFilters.map((chip) => (
              <button
                key={chip.key}
                type="button"
                onClick={() => clearOne(chip.key)}
                aria-label={`Quitar ${chip.label}`}
                className="inline-flex items-center gap-1 rounded-full border border-border bg-surface-2 px-3 py-1 text-xs text-foreground"
              >
                <span>{chip.label}</span>
                <span aria-hidden="true">×</span>
              </button>
            ))}
          </div>
        ) : null}
      </section>

      {filteredRows.length === 0 ? (
        <StatePanel
          kind="empty"
          title="Sin resultados"
          message="No encontramos recetas con los filtros actuales. Ajusta o limpia filtros."
        />
      ) : (
        <section className="rounded-[var(--radius-base)] border border-border bg-surface p-4">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[980px] text-left text-sm">
              <thead className="text-xs uppercase tracking-[0.08em] text-muted">
                <tr>
                  <th className="py-2">Receta</th>
                  <th className="py-2">Categoría</th>
                  <th className="py-2">Estado operativo</th>
                  <th className="py-2">Base de cálculo</th>
                  <th className="py-2">Costo por unidad de rendimiento</th>
                  <th className="py-2">Versión activa</th>
                  <th className="py-2">Pendientes críticos</th>
                  <th className="py-2">Último costeo</th>
                </tr>
              </thead>
              <tbody>
                {filteredRows.map((row) => {
                  const ready = row.readinessStatus === "ready" && row.versionStatus === "active";
                  return (
                    <tr key={row.id} className="border-t border-border">
                      <td className="py-2 align-top">
                        <div className="max-w-[20ch] whitespace-normal break-words">
                          <Link className="text-foreground underline underline-offset-2" href={`/${tenantSlug}/kitchen/recipes/${row.id}`}>
                            {row.name}
                          </Link>
                        </div>
                      </td>
                      <td className="py-2 text-foreground">{row.category ?? "Sin categoría"}</td>
                      <td className="py-2">
                        <div className="flex flex-wrap gap-1">
                          {ready ? <Badge variant="success">Lista para eventos</Badge> : <Badge variant="warning">Pendiente de completar</Badge>}
                          {!row.versionNumber ? <Badge variant="danger">Sin versión activa</Badge> : null}
                          {!row.hasSnapshot ? <Badge variant="warning">Sin costeo actual</Badge> : null}
                          {row.hasWarnings ? <Badge variant="warning">Con alertas de costeo</Badge> : null}
                          {row.isTest ? <Badge variant="warning">TEST</Badge> : null}
                        </div>
                        <p className="mt-1 text-xs text-muted">{row.readinessReason ?? getRecipeStatusLabel(row.recipeStatus)}</p>
                      </td>
                      <td className="py-2 text-foreground">
                        {Number(row.yieldQuantity).toLocaleString("es-MX", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} {formatKitchenUnit(row.yieldUnitCode)}
                      </td>
                      <td className="py-2 text-foreground">
                        {row.costPerYieldUnit != null
                          ? `$${row.costPerYieldUnit.toLocaleString("es-MX", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                          : "—"}
                      </td>
                      <td className="py-2 text-foreground">{row.versionNumber != null ? `v${row.versionNumber} (${getRecipeVersionStatusLabel(row.versionStatus)})` : "—"}</td>
                      <td className="py-2 text-foreground">{row.pendingIngredientCount}</td>
                      <td className="py-2 text-muted">{row.snapshotCreatedAt ? new Date(row.snapshotCreatedAt).toLocaleString("es-MX") : "—"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <p className="mt-3 text-xs text-muted">
            Una receta lista para eventos necesita versión activa, ingredientes completos y costeo sin alertas críticas.
          </p>
        </section>
      )}
    </>
  );
}
