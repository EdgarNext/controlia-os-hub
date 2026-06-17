"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { SelectField } from "@/components/ui/select-field";
import { formatKitchenUnit, formatKitchenUnitOptionLabel } from "@/lib/kitchen/formatters";
import {
  activateKitchenRecipeVersionAction,
  addKitchenRecipeLineAction,
  createDraftFromActiveKitchenRecipeVersionAction,
  createKitchenRecipeAction,
  removeKitchenRecipeLineAction,
  resolvePendingRecipeIngredientAction,
  saveKitchenRecipeCostSnapshotAction,
  skipPendingRecipeIngredientAction,
  updateKitchenRecipeLineAction,
  type KitchenRecipeActionState,
} from "@/lib/kitchen/recipes/actions";
import type { KitchenInventoryItem, KitchenInventoryUnit } from "@/lib/kitchen/inventory/types";
import type { KitchenRecipeLine, KitchenRecipeVersion } from "@/lib/kitchen/recipes/types";

const initialState: KitchenRecipeActionState = { ok: true, message: "" };

function splitRecipeLineNotes(rawNotes: string | null | undefined): { visibleNotes: string; technicalNotes: string } {
  const lines = (rawNotes ?? "")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

  const technical: string[] = [];
  const visible: string[] = [];

  for (const line of lines) {
    if (line.startsWith("import-row:") || line.includes("unit_conversion_")) {
      technical.push(line);
      continue;
    }
    visible.push(line);
  }

  return {
    visibleNotes: visible.join("\n"),
    technicalNotes: technical.join("\n"),
  };
}

export function CreateKitchenRecipeForm({
  tenantSlug,
  units,
}: {
  tenantSlug: string;
  units: KitchenInventoryUnit[];
}) {
  const [state, action, pending] = useActionState(createKitchenRecipeAction, initialState);

  return (
    <form action={action} className="space-y-3 rounded-[var(--radius-base)] border border-border bg-surface p-4">
      <input type="hidden" name="tenantSlug" value={tenantSlug} />
      <p className="text-sm font-semibold text-foreground">Nueva receta</p>
      <div className="grid gap-2 md:grid-cols-2">
        <div className="space-y-1">
          <Label htmlFor="recipe-name">Nombre</Label>
          <Input id="recipe-name" name="name" required />
        </div>
        <div className="space-y-1">
          <Label htmlFor="recipe-category">Categoría</Label>
          <Input id="recipe-category" name="category" placeholder="Plato fuerte" />
        </div>
        <div className="space-y-1">
          <Label htmlFor="recipe-yield">Rendimiento</Label>
          <Input id="recipe-yield" name="yieldQuantity" type="number" min="0.0001" step="0.0001" defaultValue="1" required />
        </div>
        <div className="space-y-1">
          <SelectField
            id="recipe-yield-unit"
            name="yieldUnitId"
            label="Unidad rendimiento"
            defaultValue=""
            options={units.map((unit) => ({ value: unit.id, label: formatKitchenUnitOptionLabel(unit) }))}
            placeholder="Sin unidad"
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor="recipe-servings">Porciones</Label>
          <Input id="recipe-servings" name="servings" type="number" min="0.0001" step="0.0001" placeholder="Opcional" />
        </div>
        <div className="space-y-1">
          <Label htmlFor="recipe-description">Descripción</Label>
          <Input id="recipe-description" name="description" placeholder="Opcional" />
        </div>
      </div>
      {state.message ? <p className={`text-xs ${state.ok ? "text-success" : "text-danger"}`}>{state.message}</p> : null}
      <Button type="submit" isLoading={pending}>Crear receta</Button>
    </form>
  );
}

export function AddKitchenRecipeLineForm({
  tenantSlug,
  recipeId,
  recipeVersion,
  items,
  units,
  subRecipes,
}: {
  tenantSlug: string;
  recipeId: string;
  recipeVersion: KitchenRecipeVersion;
  items: KitchenInventoryItem[];
  units: KitchenInventoryUnit[];
  subRecipes: KitchenRecipeVersion[];
}) {
  const [state, action, pending] = useActionState(addKitchenRecipeLineAction, initialState);

  return (
    <form action={action} className="space-y-3 rounded-[var(--radius-base)] border border-border bg-surface p-4">
      <input type="hidden" name="tenantSlug" value={tenantSlug} />
      <input type="hidden" name="recipeId" value={recipeId} />
      <input type="hidden" name="recipeVersionId" value={recipeVersion.id} />
      <p className="text-sm font-semibold text-foreground">Agregar línea</p>
      <div className="grid gap-2 md:grid-cols-2">
        <div className="space-y-1">
          <SelectField
            id="line-type"
            name="lineType"
            label="Tipo"
            defaultValue="inventory_item"
            options={[
              { value: "inventory_item", label: "Insumo" },
              { value: "sub_recipe", label: "Sub-receta" },
            ]}
          />
        </div>
        <div className="space-y-1">
          <SearchableSelect
            id="line-item"
            name="itemId"
            label="Insumo"
            placeholder="Selecciona insumo"
            options={items.map((item) => ({ value: item.id, label: item.name }))}
          />
        </div>
        <div className="space-y-1">
          <SearchableSelect
            id="line-subrecipe"
            name="subRecipeVersionId"
            label="Sub-receta activa"
            placeholder="Selecciona sub-receta"
            options={subRecipes.map((version) => ({
              value: version.id,
              label: `Receta ${version.recipe_id.slice(0, 8)} · v${version.version_number}`,
            }))}
          />
        </div>
        <div className="space-y-1">
          <SearchableSelect
            id="line-unit"
            name="unitId"
            label="Unidad"
            placeholder="Selecciona unidad"
            required
            options={units.map((unit) => ({ value: unit.id, label: formatKitchenUnitOptionLabel(unit) }))}
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor="line-qty">Cantidad</Label>
          <Input id="line-qty" name="quantity" type="number" min="0.0001" step="0.0001" required />
        </div>
        <div className="space-y-1">
          <Label htmlFor="line-waste">Merma %</Label>
          <Input id="line-waste" name="wastePercent" type="number" min="0" max="99.99" step="0.01" defaultValue="0" />
        </div>
      </div>
      {state.message ? <p className={`text-xs ${state.ok ? "text-success" : "text-danger"}`}>{state.message}</p> : null}
      <Button type="submit" variant="secondary" isLoading={pending}>Agregar línea</Button>
    </form>
  );
}

export function RemoveKitchenRecipeLineForm({
  tenantSlug,
  recipeId,
  lineId,
}: {
  tenantSlug: string;
  recipeId: string;
  lineId: string;
}) {
  const [state, action, pending] = useActionState(removeKitchenRecipeLineAction, initialState);

  return (
    <form action={action}>
      <input type="hidden" name="tenantSlug" value={tenantSlug} />
      <input type="hidden" name="recipeId" value={recipeId} />
      <input type="hidden" name="lineId" value={lineId} />
      <Button type="submit" variant="secondary" isLoading={pending}>Quitar</Button>
      {state.message && !state.ok ? <p className="text-xs text-danger">{state.message}</p> : null}
    </form>
  );
}

export function ActivateKitchenRecipeVersionForm({
  tenantSlug,
  recipeId,
  recipeVersionId,
}: {
  tenantSlug: string;
  recipeId: string;
  recipeVersionId: string;
}) {
  const [state, action, pending] = useActionState(activateKitchenRecipeVersionAction, initialState);
  return (
    <form action={action} className="flex items-center gap-2">
      <input type="hidden" name="tenantSlug" value={tenantSlug} />
      <input type="hidden" name="recipeId" value={recipeId} />
      <input type="hidden" name="recipeVersionId" value={recipeVersionId} />
      <Button type="submit" variant="secondary" isLoading={pending}>Activar versión</Button>
      {state.message ? <p className={`text-xs ${state.ok ? "text-success" : "text-danger"}`}>{state.message}</p> : null}
    </form>
  );
}

export function CreateDraftFromActiveKitchenRecipeVersionForm({
  tenantSlug,
  recipeId,
  sourceVersionId,
}: {
  tenantSlug: string;
  recipeId: string;
  sourceVersionId: string;
}) {
  const [state, action, pending] = useActionState(createDraftFromActiveKitchenRecipeVersionAction, initialState);
  return (
    <form action={action} className="flex items-center gap-2">
      <input type="hidden" name="tenantSlug" value={tenantSlug} />
      <input type="hidden" name="recipeId" value={recipeId} />
      <input type="hidden" name="sourceVersionId" value={sourceVersionId} />
      <Button type="submit" variant="secondary" isLoading={pending}>Crear borrador desde activa</Button>
      {state.message ? <p className={`text-xs ${state.ok ? "text-success" : "text-danger"}`}>{state.message}</p> : null}
    </form>
  );
}

export function SaveKitchenRecipeSnapshotForm({
  tenantSlug,
  recipeId,
  recipeVersionId,
}: {
  tenantSlug: string;
  recipeId: string;
  recipeVersionId: string;
}) {
  const [state, action, pending] = useActionState(saveKitchenRecipeCostSnapshotAction, initialState);
  return (
    <form action={action} className="flex items-center gap-2">
      <input type="hidden" name="tenantSlug" value={tenantSlug} />
      <input type="hidden" name="recipeId" value={recipeId} />
      <input type="hidden" name="recipeVersionId" value={recipeVersionId} />
      <input type="hidden" name="snapshotType" value="current" />
      <Button type="submit" isLoading={pending}>Guardar snapshot</Button>
      {state.message ? <p className={`text-xs ${state.ok ? "text-success" : "text-danger"}`}>{state.message}</p> : null}
    </form>
  );
}

export function RecipeLineList({
  tenantSlug,
  recipeId,
  baseYieldQuantity,
  quantityPerUnitLabel,
  versionStatus,
  canManage,
  lines,
  units,
  costLinesById,
}: {
  tenantSlug: string;
  recipeId: string;
  baseYieldQuantity: number;
  quantityPerUnitLabel: string;
  versionStatus: KitchenRecipeVersion["status"];
  canManage: boolean;
  lines: KitchenRecipeLine[];
  units: KitchenInventoryUnit[];
  costLinesById: Map<string, { unitCostApplied: number | null; unitCostUnitCode: string | null; lineCost: number; warning?: string }>;
}) {
  const canEditLines = canManage && versionStatus === "draft" && baseYieldQuantity > 0;

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[1080px] text-left text-sm">
        <thead className="text-xs uppercase tracking-[0.08em] text-muted">
          <tr>
            <th className="py-2">Tipo</th>
            <th className="py-2">Nombre</th>
            <th className="py-2">{quantityPerUnitLabel}</th>
            <th className="py-2">Unidad</th>
            <th className="py-2">Costo unitario aplicado</th>
            <th className="py-2">Costo en receta</th>
            <th className="py-2">Merma</th>
            <th className="py-2">Acciones</th>
          </tr>
        </thead>
        <tbody>
          {lines.map((line) => {
            const totalQuantity = Number(line.quantity);
            const perUnitQuantity = baseYieldQuantity > 0 ? totalQuantity / baseYieldQuantity : totalQuantity;
            const costLine = costLinesById.get(line.id);
            const appliedUnitCost = costLine?.unitCostApplied;
            const appliedUnitCode = costLine?.unitCostUnitCode;
            const costWarning = costLine?.warning;
            return (
              <tr key={line.id} className="border-t border-border align-top">
                <td className="py-2">{line.line_type === "inventory_item" ? "Insumo" : "Sub-receta"}</td>
                <td className="py-2">{line.line_type === "inventory_item" ? (line.kitchen_inventory_items?.name ?? "Insumo") : (line.sub_recipe_version?.kitchen_recipe_recipes?.name ?? "Sub-receta")}</td>
                <td className="py-2">{Number(perUnitQuantity).toLocaleString("es-MX", { minimumFractionDigits: 2, maximumFractionDigits: 4 })}</td>
                <td className="py-2">{(line.kitchen_inventory_units?.code ?? "ud").toLowerCase()}</td>
                <td className="py-2">
                  {costWarning ? (
                    <span className="text-warning">{costWarning === "Falta conversión de unidad" || costWarning === "Falta conversión de sub-receta" ? "Falta conversión/costo" : "No calculable"}</span>
                  ) : appliedUnitCost == null ? (
                    <span className="text-muted">No calculable</span>
                  ) : (
                    `$${appliedUnitCost.toLocaleString("es-MX", {
                      minimumFractionDigits: appliedUnitCost === 0 ? 2 : 2,
                      maximumFractionDigits: appliedUnitCost !== 0 && Math.abs(appliedUnitCost) < 0.01 ? 6 : 4,
                    })}/${formatKitchenUnit(appliedUnitCode)}`
                  )}
                </td>
                <td className="py-2">
                  {costWarning ? (
                    <span className="text-warning">{costWarning === "Falta conversión de unidad" || costWarning === "Falta conversión de sub-receta" ? "Falta conversión/costo" : "No calculable"}</span>
                  ) : (
                    `$${Number(costLine?.lineCost ?? 0).toLocaleString("es-MX", { minimumFractionDigits: 2, maximumFractionDigits: 4 })}`
                  )}
                </td>
                <td className="py-2">{Number(line.waste_percent).toLocaleString("es-MX", { minimumFractionDigits: 0, maximumFractionDigits: 2 })}%</td>
                <td className="py-2 space-y-2">
                  {canEditLines ? (
                    <UpdateKitchenRecipeLineForm
                      tenantSlug={tenantSlug}
                      recipeId={recipeId}
                      line={line}
                      units={units}
                      perUnitQuantity={perUnitQuantity}
                      quantityPerUnitLabel={quantityPerUnitLabel}
                    />
                  ) : null}
                  {canManage ? <RemoveKitchenRecipeLineForm tenantSlug={tenantSlug} recipeId={recipeId} lineId={line.id} /> : <span className="text-muted">Solo lectura</span>}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      {!canEditLines ? (
        <p className="mt-2 text-xs text-muted">Las líneas se pueden editar solo en versiones draft con base de rendimiento válida.</p>
      ) : (
        <p className="mt-2 text-xs text-muted">Guarda snapshot después de ajustar cantidades para actualizar el costeo.</p>
      )}
    </div>
  );
}

function UpdateKitchenRecipeLineForm({
  tenantSlug,
  recipeId,
  line,
  units,
  perUnitQuantity,
  quantityPerUnitLabel,
}: {
  tenantSlug: string;
  recipeId: string;
  line: KitchenRecipeLine;
  units: KitchenInventoryUnit[];
  perUnitQuantity: number;
  quantityPerUnitLabel: string;
}) {
  const [state, action, pending] = useActionState(updateKitchenRecipeLineAction, initialState);
  const { visibleNotes, technicalNotes } = splitRecipeLineNotes(line.notes);
  return (
    <form action={action} className="grid gap-2 rounded border border-border bg-surface-2 p-2 md:grid-cols-4">
      <input type="hidden" name="tenantSlug" value={tenantSlug} />
      <input type="hidden" name="recipeId" value={recipeId} />
      <input type="hidden" name="lineId" value={line.id} />
      <Input
        name="quantityPerYieldUnit"
        type="number"
        min="0"
        step="0.0001"
        defaultValue={Number(perUnitQuantity).toFixed(4)}
        aria-label={quantityPerUnitLabel}
      />
      <SelectField
        name="unitId"
        defaultValue={line.unit_id}
        options={units.map((unit) => ({ value: unit.id, label: formatKitchenUnitOptionLabel(unit) }))}
      />
      <Input
        name="wastePercent"
        type="number"
        min="0"
        max="99.99"
        step="0.01"
        defaultValue={Number(line.waste_percent ?? 0)}
        aria-label="Merma"
      />
      <Button type="submit" variant="secondary" isLoading={pending}>Guardar línea</Button>
      <input type="hidden" name="technicalNotes" value={technicalNotes} />
      <Input name="notes" placeholder="Notas (opcional)" defaultValue={visibleNotes} className="md:col-span-4" />
      {state.message ? <p className={`md:col-span-4 text-xs ${state.ok ? "text-success" : "text-danger"}`}>{state.message}</p> : null}
    </form>
  );
}

export function ResolvePendingRecipeIngredientForm({
  tenantSlug,
  recipeId,
  importRowId,
  defaultQuantity,
  defaultUnitId,
  items,
  units,
}: {
  tenantSlug: string;
  recipeId: string;
  importRowId: string;
  defaultQuantity: number | null;
  defaultUnitId?: string;
  items: KitchenInventoryItem[];
  units: KitchenInventoryUnit[];
}) {
  const [state, action, pending] = useActionState(resolvePendingRecipeIngredientAction, initialState);
  return (
    <form action={action} className="grid gap-2 rounded border border-border bg-surface-2 p-2 md:grid-cols-5">
      <input type="hidden" name="tenantSlug" value={tenantSlug} />
      <input type="hidden" name="recipeId" value={recipeId} />
      <input type="hidden" name="importRowId" value={importRowId} />
      <SearchableSelect
        name="itemId"
        placeholder="Selecciona insumo"
        required
        className="md:col-span-2"
        options={items.map((item) => ({ value: item.id, label: item.name }))}
      />
      <SearchableSelect
        name="unitId"
        placeholder="Unidad"
        defaultValue={defaultUnitId ?? ""}
        required
        options={units.map((unit) => ({ value: unit.id, label: formatKitchenUnitOptionLabel(unit) }))}
      />
      <Input name="quantity" type="number" min="0.0001" step="0.0001" defaultValue={defaultQuantity ?? undefined} required />
      <Input name="wastePercent" type="number" min="0" max="99.99" step="0.01" defaultValue="0" />
      <Button type="submit" variant="secondary" isLoading={pending}>Agregar a receta</Button>
      {state.message ? <p className={`md:col-span-5 text-xs ${state.ok ? "text-success" : "text-danger"}`}>{state.message}</p> : null}
    </form>
  );
}

export function SkipPendingRecipeIngredientForm({
  tenantSlug,
  recipeId,
  importRowId,
}: {
  tenantSlug: string;
  recipeId: string;
  importRowId: string;
}) {
  const [state, action, pending] = useActionState(skipPendingRecipeIngredientAction, initialState);
  return (
    <form action={action} className="mt-2 flex flex-wrap items-center gap-2">
      <input type="hidden" name="tenantSlug" value={tenantSlug} />
      <input type="hidden" name="recipeId" value={recipeId} />
      <input type="hidden" name="importRowId" value={importRowId} />
      <Input name="skipReason" placeholder="Motivo de omisión" className="h-8 w-56" />
      <Button type="submit" variant="secondary" isLoading={pending}>Omitir</Button>
      {state.message ? <p className={`text-xs ${state.ok ? "text-success" : "text-danger"}`}>{state.message}</p> : null}
    </form>
  );
}
