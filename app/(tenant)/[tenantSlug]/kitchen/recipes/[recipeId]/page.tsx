import { Suspense } from "react";
import { StatePanel } from "@/components/ui/state-panel";
import { getCurrentTenantModulePageAccessMap, hasModulePageAccess } from "@/lib/auth/module-page-access";
import { calculateKitchenRecipeVersionCost } from "@/lib/kitchen/recipes/costing";
import {
  getKitchenRecipe,
  getKitchenRecipeUsageCountAsSubRecipe,
  listKitchenRecipeVersions,
  listKitchenRecipeIngredientItems,
  listKitchenRecipeLines,
  listKitchenRecipeUnits,
  listKitchenSubRecipeCandidates,
} from "@/lib/kitchen/recipes/queries";
import { getKitchenRecipeReadiness } from "@/lib/kitchen/recipes/readiness";
import { listPendingImportRowsForRecipe } from "@/lib/kitchen/recipes/import-queries";
import { formatKitchenUnit, formatQuantityWithUnit } from "@/lib/kitchen/formatters";
import {
  ActivateKitchenRecipeVersionForm,
  AddKitchenRecipeLineForm,
  CreateDraftFromActiveKitchenRecipeVersionForm,
  RecipeLineList,
  ResolvePendingRecipeIngredientForm,
  SaveKitchenRecipeSnapshotForm,
  SkipPendingRecipeIngredientForm,
} from "../_components/recipe-forms";
import { KitchenActionRowSkeleton, KitchenCardGridSkeleton, KitchenTableSkeleton } from "../../_components/kitchen-loading-skeletons";
import { resolveKitchenPage } from "../../_lib/page-access";

type KitchenRecipeDetailPageProps = {
  params: Promise<{ tenantSlug: string; recipeId: string }>;
};

export default async function KitchenRecipeDetailPage({ params }: KitchenRecipeDetailPageProps) {
  const { tenantSlug, recipeId } = await params;
  const result = await resolveKitchenPage(tenantSlug, "kitchen_recipes", "recipes");

  if (!result.ok) {
    return <StatePanel kind="permission" title="Sin permisos" message="No tienes acceso a recetas." />;
  }

  const [recipe, accessMap] = await Promise.all([
    getKitchenRecipe(result.tenant.tenantId, recipeId),
    getCurrentTenantModulePageAccessMap(result.tenant.tenantId, "kitchen_recipes"),
  ]);

  if (!recipe) {
    return <StatePanel kind="empty" title="Receta no encontrada" message="La receta no existe o no está disponible para tu tenant." />;
  }

  const canManage = hasModulePageAccess(accessMap.recipes ?? "none", "manage");
  const versions = await listKitchenRecipeVersions(result.tenant.tenantId, recipe.id);
  const version = versions.find((entry) => entry.status === "draft") ?? versions.find((entry) => entry.status === "active") ?? null;

  if (!version) {
    return <StatePanel kind="empty" title="Sin versiones" message="La receta no tiene versiones disponibles." />;
  }

  const linesPromise = listKitchenRecipeLines(result.tenant.tenantId, version.id);
  const itemsPromise = listKitchenRecipeIngredientItems(result.tenant.tenantId);
  const unitsPromise = listKitchenRecipeUnits(result.tenant.tenantId);
  const subRecipesPromise = listKitchenSubRecipeCandidates(result.tenant.tenantId, recipe.id);
  const costResultPromise = calculateKitchenRecipeVersionCost(result.tenant.tenantId, version.id);
  const usageCountPromise = getKitchenRecipeUsageCountAsSubRecipe(result.tenant.tenantId, recipe.id);
  const pendingImportRowsPromise = listPendingImportRowsForRecipe(result.tenant.tenantId, recipe.id);
  const readinessPromise = getKitchenRecipeReadiness(result.tenant.tenantId, recipe.id);

  return (
    <div className="space-y-4">
      <section className="rounded-[var(--radius-base)] border border-border bg-surface p-4">
        <h1 className="text-lg font-semibold text-foreground">{recipe.name}</h1>
        <p className="mt-2 text-sm text-muted">Versión v{version.version_number} · estado {version.status}</p>
      </section>

      <Suspense fallback={<RecipeOverviewFallback canManage={canManage} />}>
        <RecipeOverviewSection
          tenantSlug={result.tenant.tenantSlug}
          recipeId={recipe.id}
          recipeVersionId={version.id}
          versionStatus={version.status}
          canManage={canManage}
          costResultPromise={costResultPromise}
          usageCountPromise={usageCountPromise}
          readinessPromise={readinessPromise}
          yieldQuantity={Number(version.yield_quantity ?? 0)}
          yieldUnitCode={version.kitchen_inventory_units?.code?.toLowerCase() ?? null}
          servings={Number(version.servings ?? 0)}
        />
      </Suspense>

      <Suspense fallback={<KitchenTableSkeleton rows={4} columns={4} />}>
        <PendingImportsSection
          tenantSlug={result.tenant.tenantSlug}
          recipeId={recipe.id}
          canManage={canManage}
          pendingImportRowsPromise={pendingImportRowsPromise}
          itemsPromise={itemsPromise}
          unitsPromise={unitsPromise}
        />
      </Suspense>

      <Suspense fallback={<KitchenTableSkeleton rows={8} columns={6} />}>
        <RecipeLinesSection
          tenantSlug={result.tenant.tenantSlug}
          recipeId={recipe.id}
          canManage={canManage}
          versionStatus={version.status}
          baseYieldQuantity={Number(version.yield_quantity ?? 0)}
          yieldUnitCode={version.kitchen_inventory_units?.code?.toLowerCase() ?? null}
          linesPromise={linesPromise}
          costResultPromise={costResultPromise}
          unitsPromise={unitsPromise}
          servings={Number(version.servings ?? 0)}
        />
      </Suspense>

      <Suspense fallback={<KitchenActionRowSkeleton actions={1} />}>
        <AddRecipeLineSection
          tenantSlug={result.tenant.tenantSlug}
          recipeId={recipe.id}
          canManage={canManage}
          recipeVersion={version}
          itemsPromise={itemsPromise}
          unitsPromise={unitsPromise}
          subRecipesPromise={subRecipesPromise}
        />
      </Suspense>
    </div>
  );
}

async function RecipeOverviewSection({
  tenantSlug,
  recipeId,
  recipeVersionId,
  versionStatus,
  canManage,
  costResultPromise,
  usageCountPromise,
  readinessPromise,
  yieldQuantity,
  yieldUnitCode,
  servings,
}: {
  tenantSlug: string;
  recipeId: string;
  recipeVersionId: string;
  versionStatus: "draft" | "active" | "archived";
  canManage: boolean;
  costResultPromise: ReturnType<typeof calculateKitchenRecipeVersionCost>;
  usageCountPromise: ReturnType<typeof getKitchenRecipeUsageCountAsSubRecipe>;
  readinessPromise: ReturnType<typeof getKitchenRecipeReadiness>;
  yieldQuantity: number;
  yieldUnitCode: string | null;
  servings: number;
}) {
  const [costResult, readiness, usageCount] = await Promise.all([costResultPromise, readinessPromise, usageCountPromise]);
  const isReady = readiness?.readiness_status === "ready";
  const basis = buildRecipeCostPresentation({ yieldQuantity, yieldUnitCode, servings, costResult });
  const recipeTypeLabel = usageCount > 0 ? "Sub-receta / preparación interna" : "Receta final";
  const statusLabel = costResult.warnings.length > 0 ? "Con problemas" : "Completo";

  return (
    <>
      <section className="rounded-[var(--radius-base)] border border-border bg-surface p-4">
        <div className="flex flex-wrap items-center gap-2">
          <span className={`inline-flex rounded-full px-2 py-0.5 text-xs ${isReady ? "bg-success/20 text-success" : "bg-warning/20 text-warning"}`}>
            {isReady ? "Lista para eventos" : "Pendiente de completar"}
          </span>
          <span className="inline-flex rounded-full bg-surface-2 px-2 py-0.5 text-xs text-foreground">{recipeTypeLabel}</span>
          <span className="text-xs text-muted">{readiness?.readiness_reason ?? "Sin estado de readiness"}</span>
        </div>
        <div className="mt-3 grid gap-2 sm:grid-cols-3">
          <div className="rounded-[var(--radius-base)] border border-border bg-surface-2 p-3">
            <p className="text-xs text-muted">{basis.primaryCostLabel}</p>
            <p className="text-lg font-semibold text-foreground">
              ${basis.primaryCostValue.toLocaleString("es-MX", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </p>
          </div>
          <div className="rounded-[var(--radius-base)] border border-border bg-surface-2 p-3">
            <p className="text-xs text-muted">{basis.secondaryLabel}</p>
            <p className="text-lg font-semibold text-foreground">{basis.secondaryValue}</p>
          </div>
          <div className="rounded-[var(--radius-base)] border border-border bg-surface-2 p-3">
            <p className="text-xs text-muted">Estado de costeo</p>
            <p className={`text-lg font-semibold ${costResult.warnings.length > 0 ? "text-warning" : "text-success"}`}>{statusLabel}</p>
            <p className="mt-1 text-xs text-muted">{basis.baseCalculationText}</p>
          </div>
        </div>
        {usageCount > 0 ? <p className="mt-2 text-xs text-muted">Tipo inferido por uso real como sub-receta en otras recetas.</p> : null}

        {canManage ? (
          <div className="mt-3 flex flex-wrap gap-2">
            {versionStatus === "active" ? (
              <CreateDraftFromActiveKitchenRecipeVersionForm
                tenantSlug={tenantSlug}
                recipeId={recipeId}
                sourceVersionId={recipeVersionId}
              />
            ) : null}
            <ActivateKitchenRecipeVersionForm tenantSlug={tenantSlug} recipeId={recipeId} recipeVersionId={recipeVersionId} />
            <SaveKitchenRecipeSnapshotForm tenantSlug={tenantSlug} recipeId={recipeId} recipeVersionId={recipeVersionId} />
          </div>
        ) : null}
      </section>

      {costResult.warnings.length > 0 ? (
        <section className="rounded-[var(--radius-base)] border border-warning/50 bg-warning/10 p-4">
          <h2 className="text-sm font-semibold text-foreground">Warnings de costeo</h2>
          <ul className="mt-2 space-y-1 text-sm text-muted">
            {costResult.warnings.map((warning, index) => (
              <li key={`${warning.type}-${index}`}>• {warning.message}</li>
            ))}
          </ul>
        </section>
      ) : null}
    </>
  );
}

async function PendingImportsSection({
  tenantSlug,
  recipeId,
  canManage,
  pendingImportRowsPromise,
  itemsPromise,
  unitsPromise,
}: {
  tenantSlug: string;
  recipeId: string;
  canManage: boolean;
  pendingImportRowsPromise: ReturnType<typeof listPendingImportRowsForRecipe>;
  itemsPromise: ReturnType<typeof listKitchenRecipeIngredientItems>;
  unitsPromise: ReturnType<typeof listKitchenRecipeUnits>;
}) {
  const pendingImportRows = await pendingImportRowsPromise;
  if (pendingImportRows.length === 0) return null;

  const [items, units] = await Promise.all([itemsPromise, unitsPromise]);
  const unitByCode = new Map(units.map((unit) => [unit.code.toLowerCase(), unit.id]));

  return (
    <section className="rounded-[var(--radius-base)] border border-warning/40 bg-warning/10 p-4">
      <h2 className="text-sm font-semibold text-foreground">Ingredientes pendientes de capturar</h2>
      <p className="mt-1 text-xs text-muted">No se encontró insumo en inventario durante la importación inicial. Completa manualmente.</p>
      <div className="mt-2 space-y-2">
        {pendingImportRows.map((row) => (
          <div key={row.id} className="rounded border border-border bg-surface p-2">
            <p className="text-sm text-foreground">{row.ingredient_name ?? "Ingrediente sin nombre"}</p>
            <p className="text-xs text-muted">
              cantidad: {row.quantity ?? "—"} {row.unit_code ?? ""}
            </p>
            <p className="text-xs text-warning">Motivo: {row.validation_warnings?.[0] ?? "No se encontró insumo en inventario."}</p>
            {canManage ? (
              <div className="mt-2 space-y-2">
                <ResolvePendingRecipeIngredientForm
                  tenantSlug={tenantSlug}
                  recipeId={recipeId}
                  importRowId={row.id}
                  defaultQuantity={row.quantity}
                  defaultUnitId={unitByCode.get(String(row.unit_code ?? "").toLowerCase())}
                  items={items}
                  units={units}
                />
                <SkipPendingRecipeIngredientForm tenantSlug={tenantSlug} recipeId={recipeId} importRowId={row.id} />
                <a href={`/${tenantSlug}/kitchen/inventory/items`} className="inline-flex text-xs text-foreground underline underline-offset-2">
                  Crear insumo en inventario
                </a>
              </div>
            ) : null}
          </div>
        ))}
      </div>
    </section>
  );
}

async function RecipeLinesSection({
  tenantSlug,
  recipeId,
  canManage,
  versionStatus,
  baseYieldQuantity,
  yieldUnitCode,
  linesPromise,
  costResultPromise,
  unitsPromise,
  servings,
}: {
  tenantSlug: string;
  recipeId: string;
  canManage: boolean;
  versionStatus: string;
  baseYieldQuantity: number;
  yieldUnitCode: string | null;
  linesPromise: ReturnType<typeof listKitchenRecipeLines>;
  costResultPromise: ReturnType<typeof calculateKitchenRecipeVersionCost>;
  unitsPromise: ReturnType<typeof listKitchenRecipeUnits>;
  servings: number;
}) {
  const [lines, units, costResult] = await Promise.all([linesPromise, unitsPromise, costResultPromise]);

  if (lines.length === 0) {
    return <StatePanel kind="empty" title="Sin ingredientes" message="Agrega líneas de insumos o sub-recetas para costear esta receta." />;
  }

  const basis = buildRecipeCostPresentation({ yieldQuantity: baseYieldQuantity, yieldUnitCode, servings });
  const costLinesById = new Map(costResult.lines.map((line) => [line.lineId, line]));

  return (
    <section className="rounded-[var(--radius-base)] border border-border bg-surface p-4">
      <h2 className="text-sm font-semibold text-foreground">Ingredientes y sub-recetas</h2>
      <p className="mt-1 text-xs text-muted">
        Las cantidades se muestran por la base de cálculo de esta receta. Ejemplo: por litro, por porción, por charola o por pieza.
      </p>
      <div className="mt-2">
        <RecipeLineList
          tenantSlug={tenantSlug}
          recipeId={recipeId}
          canManage={canManage}
          lines={lines}
          baseYieldQuantity={baseYieldQuantity}
          quantityPerUnitLabel={basis.quantityPerUnitLabel}
          versionStatus={versionStatus as "draft" | "active" | "archived"}
          units={units}
          costLinesById={costLinesById}
        />
      </div>
    </section>
  );
}

async function AddRecipeLineSection({
  tenantSlug,
  recipeId,
  canManage,
  recipeVersion,
  itemsPromise,
  unitsPromise,
  subRecipesPromise,
}: {
  tenantSlug: string;
  recipeId: string;
  canManage: boolean;
  recipeVersion: Awaited<ReturnType<typeof listKitchenRecipeVersions>>[number];
  itemsPromise: ReturnType<typeof listKitchenRecipeIngredientItems>;
  unitsPromise: ReturnType<typeof listKitchenRecipeUnits>;
  subRecipesPromise: ReturnType<typeof listKitchenSubRecipeCandidates>;
}) {
  if (!canManage) {
    return <StatePanel kind="permission" title="Solo lectura" message="Tienes acceso read. Solicita manage para editar receta." />;
  }

  const [items, units, subRecipes] = await Promise.all([itemsPromise, unitsPromise, subRecipesPromise]);

  return (
    <AddKitchenRecipeLineForm
      tenantSlug={tenantSlug}
      recipeId={recipeId}
      recipeVersion={recipeVersion}
      items={items}
      units={units}
      subRecipes={subRecipes}
    />
  );
}

function RecipeOverviewFallback({ canManage }: { canManage: boolean }) {
  return (
    <div className="space-y-4" aria-live="polite" aria-busy="true">
      <KitchenCardGridSkeleton cards={3} />
      {canManage ? <KitchenActionRowSkeleton actions={3} /> : null}
    </div>
  );
}

function buildRecipeCostPresentation({
  yieldQuantity,
  yieldUnitCode,
  servings,
  costResult,
}: {
  yieldQuantity: number;
  yieldUnitCode: string | null;
  servings: number;
  costResult?: Awaited<ReturnType<typeof calculateKitchenRecipeVersionCost>>;
}) {
  const normalizedUnitCode = yieldUnitCode?.toLowerCase() ?? null;
  const hasUnit = Boolean(normalizedUnitCode);
  const hasServings = Number.isFinite(servings) && servings > 0;
  const isServingBased = !hasUnit && hasServings;
  const basisQuantity = isServingBased ? servings : yieldQuantity;
  const isSingleUnit = Number.isFinite(basisQuantity) && Math.abs(basisQuantity - 1) < 0.0001;
  const noun = resolveRecipeBasisNoun(normalizedUnitCode, servings);
  const formattedBasisText = hasUnit
    ? formatQuantityWithUnit(yieldQuantity, normalizedUnitCode, 4)
    : hasServings
      ? `${servings.toLocaleString("es-MX", { minimumFractionDigits: 0, maximumFractionDigits: 2 })} ${servings === 1 ? "porción" : "porciones"}`
      : "Lote";

  return {
    primaryCostLabel: hasUnit
      ? (isSingleUnit ? `Costo por ${noun}` : `Costo para ${formattedBasisText}`)
      : isServingBased
        ? (isSingleUnit ? "Costo por porción" : `Costo para ${formattedBasisText}`)
      : "Costo del lote",
    secondaryLabel: isSingleUnit ? "Base de cálculo" : hasUnit ? `Costo por ${noun}` : isServingBased ? "Costo por porción" : "Base de cálculo",
    secondaryValue: isSingleUnit
      ? formattedBasisText
      : hasUnit
        ? (costResult?.costPerYieldUnit == null
            ? "—"
            : `$${costResult.costPerYieldUnit.toLocaleString("es-MX", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`)
        : isServingBased
          ? (costResult?.costPerServing == null
              ? "—"
              : `$${costResult.costPerServing.toLocaleString("es-MX", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`)
        : formattedBasisText,
    quantityPerUnitLabel: hasUnit
      ? `Cantidad por ${noun}`
      : hasServings
        ? "Cantidad por porción"
        : "Cantidad por unidad de rendimiento",
    baseCalculationText: `Base de cálculo: ${formattedBasisText}`,
    noun,
    primaryCostValue:
      isSingleUnit && hasUnit && costResult?.costPerYieldUnit != null
        ? costResult.costPerYieldUnit
        : isSingleUnit && isServingBased && costResult?.costPerServing != null
          ? costResult.costPerServing
          : (costResult?.totalCost ?? 0),
  };
}

function resolveRecipeBasisNoun(yieldUnitCode: string | null, servings: number): string {
  if (yieldUnitCode?.includes("charol")) return "charola";
  if (yieldUnitCode === "l") return "litro";
  if (yieldUnitCode === "ml") return "ml";
  if (yieldUnitCode === "pza") return "pieza";
  if (yieldUnitCode) return formatKitchenUnit(yieldUnitCode);
  if (servings > 0) return "porción";
  return "lote";
}
