import { StatePanel } from "@/components/ui/state-panel";
import { getCurrentTenantModulePageAccessMap, hasModulePageAccess } from "@/lib/auth/module-page-access";
import { calculateKitchenRecipeVersionCost } from "@/lib/kitchen/recipes/costing";
import {
  getKitchenRecipe,
  listKitchenRecipeVersions,
  listKitchenRecipeIngredientItems,
  listKitchenRecipeLines,
  listKitchenRecipeUnits,
  listKitchenSubRecipeCandidates,
} from "@/lib/kitchen/recipes/queries";
import { getKitchenRecipeReadiness } from "@/lib/kitchen/recipes/readiness";
import { listPendingImportRowsForRecipe } from "@/lib/kitchen/recipes/import-queries";
import {
  ActivateKitchenRecipeVersionForm,
  AddKitchenRecipeLineForm,
  CreateDraftFromActiveKitchenRecipeVersionForm,
  RecipeLineList,
  ResolvePendingRecipeIngredientForm,
  SaveKitchenRecipeSnapshotForm,
  SkipPendingRecipeIngredientForm,
} from "../_components/recipe-forms";
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

  const [lines, items, units, subRecipes, costResult, pendingImportRows, readiness] = await Promise.all([
    listKitchenRecipeLines(result.tenant.tenantId, version.id),
    listKitchenRecipeIngredientItems(result.tenant.tenantId),
    listKitchenRecipeUnits(result.tenant.tenantId),
    listKitchenSubRecipeCandidates(result.tenant.tenantId, recipe.id),
    calculateKitchenRecipeVersionCost(result.tenant.tenantId, version.id),
    listPendingImportRowsForRecipe(result.tenant.tenantId, recipe.id),
    getKitchenRecipeReadiness(result.tenant.tenantId, recipe.id),
  ]);
  const isReady = readiness?.readiness_status === "ready";
  const unitByCode = new Map(units.map((unit) => [unit.code.toLowerCase(), unit.id]));
  const baseServings = Number(version.servings ?? 0);
  const yieldUnitCode = version.kitchen_inventory_units?.code?.toLowerCase() ?? null;
  const baseLabel = (() => {
    if (yieldUnitCode?.includes("charol")) return baseServings === 1 ? "charola" : "charolas";
    if (yieldUnitCode === "l" || yieldUnitCode === "ml") return baseServings === 1 ? "litro" : "litros";
    if (yieldUnitCode === "pza") return baseServings === 1 ? "pieza" : "piezas";
    if (baseServings > 0) return baseServings === 1 ? "persona/porción" : "personas/porciones";
    return "unidades";
  })();
  const quantityPerUnitLabel = (() => {
    if (yieldUnitCode?.includes("charol")) return "Cantidad por charola";
    if (yieldUnitCode === "l" || yieldUnitCode === "ml") return "Cantidad por litro";
    if (yieldUnitCode === "pza") return "Cantidad por pieza";
    if (baseServings > 0) return "Cantidad por persona";
    return "Cantidad por unidad de rendimiento";
  })();
  const costPerBaseLabel = (() => {
    if (yieldUnitCode?.includes("charol")) return "Costo por charola";
    if (yieldUnitCode === "l" || yieldUnitCode === "ml") return "Costo por litro";
    if (yieldUnitCode === "pza") return "Costo por pieza";
    if (baseServings > 0) return "Costo por persona";
    return "Costo por unidad de rendimiento";
  })();

  return (
    <div className="space-y-4">
      <section className="rounded-[var(--radius-base)] border border-border bg-surface p-4">
        <h1 className="text-lg font-semibold text-foreground">{recipe.name}</h1>
        <p className="mt-2 text-sm text-muted">Versión v{version.version_number} · estado {version.status}</p>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <span className={`inline-flex rounded-full px-2 py-0.5 text-xs ${isReady ? "bg-success/20 text-success" : "bg-warning/20 text-warning"}`}>
            {isReady ? "Lista para eventos" : "Pendiente de completar"}
          </span>
          <span className="text-xs text-muted">{readiness?.readiness_reason ?? "Sin estado de readiness"}</span>
          {!isReady && canManage ? <span className="text-xs text-muted">CTA: Completar receta</span> : null}
        </div>
        <div className="mt-3 grid gap-2 sm:grid-cols-3">
          <div className="rounded-[var(--radius-base)] border border-border bg-surface-2 p-3">
            <p className="text-xs text-muted">Costo del rendimiento base</p>
            <p className="text-lg font-semibold text-foreground">
              ${costResult.totalCost.toLocaleString("es-MX", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </p>
          </div>
          <div className="rounded-[var(--radius-base)] border border-border bg-surface-2 p-3">
            <p className="text-xs text-muted">{costPerBaseLabel}</p>
            <p className="text-lg font-semibold text-foreground">
              {costResult.costPerServing == null
                ? "—"
                : `$${costResult.costPerServing.toLocaleString("es-MX", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
            </p>
          </div>
          <div className="rounded-[var(--radius-base)] border border-border bg-surface-2 p-3">
            <p className="text-xs text-muted">Rendimiento base</p>
            <p className="text-lg font-semibold text-foreground">
              {baseServings > 0 ? `${baseServings.toLocaleString("es-MX", { maximumFractionDigits: 2 })} ${baseLabel}` : "—"}
            </p>
          </div>
        </div>

        {canManage ? (
          <div className="mt-3 flex flex-wrap gap-2">
            {version.status === "active" ? (
              <CreateDraftFromActiveKitchenRecipeVersionForm
                tenantSlug={result.tenant.tenantSlug}
                recipeId={recipe.id}
                sourceVersionId={version.id}
              />
            ) : null}
            <ActivateKitchenRecipeVersionForm tenantSlug={result.tenant.tenantSlug} recipeId={recipe.id} recipeVersionId={version.id} />
            <SaveKitchenRecipeSnapshotForm tenantSlug={result.tenant.tenantSlug} recipeId={recipe.id} recipeVersionId={version.id} />
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

      {pendingImportRows.length > 0 ? (
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
                <p className="text-xs text-warning">
                  Motivo: {row.validation_warnings?.[0] ?? "No se encontró insumo en inventario."}
                </p>
                {canManage ? (
                  <div className="mt-2 space-y-2">
                    <ResolvePendingRecipeIngredientForm
                      tenantSlug={result.tenant.tenantSlug}
                      recipeId={recipe.id}
                      importRowId={row.id}
                      defaultQuantity={row.quantity}
                      defaultUnitId={unitByCode.get(String(row.unit_code ?? "").toLowerCase())}
                      items={items}
                      units={units}
                    />
                    <SkipPendingRecipeIngredientForm
                      tenantSlug={result.tenant.tenantSlug}
                      recipeId={recipe.id}
                      importRowId={row.id}
                    />
                    <a
                      href={`/${result.tenant.tenantSlug}/kitchen/inventory/items`}
                      className="inline-flex text-xs text-foreground underline underline-offset-2"
                    >
                      Crear insumo en inventario
                    </a>
                  </div>
                ) : null}
              </div>
            ))}
          </div>
          {canManage ? (
            <p className="mt-2 text-xs text-muted">Usa “Agregar línea” para capturar manualmente cada ingrediente pendiente.</p>
          ) : null}
        </section>
      ) : null}

      {lines.length === 0 ? (
        <StatePanel kind="empty" title="Sin ingredientes" message="Agrega líneas de insumos o sub-recetas para costear esta receta." />
      ) : (
        <section className="rounded-[var(--radius-base)] border border-border bg-surface p-4">
          <h2 className="text-sm font-semibold text-foreground">Ingredientes y sub-recetas</h2>
          <p className="mt-1 text-xs text-muted">
            La receta se edita por unidad mínima de rendimiento. Internamente se guarda cantidad total para el rendimiento base.
          </p>
          <div className="mt-2">
            <RecipeLineList
              tenantSlug={result.tenant.tenantSlug}
              recipeId={recipe.id}
              canManage={canManage}
              lines={lines}
              baseServings={baseServings}
              quantityPerUnitLabel={quantityPerUnitLabel}
              versionStatus={version.status}
              units={units}
            />
          </div>
        </section>
      )}

      {canManage ? (
        <AddKitchenRecipeLineForm
          tenantSlug={result.tenant.tenantSlug}
          recipeId={recipe.id}
          recipeVersion={version}
          items={items}
          units={units}
          subRecipes={subRecipes}
        />
      ) : (
        <StatePanel kind="permission" title="Solo lectura" message="Tienes acceso read. Solicita manage para editar receta." />
      )}
    </div>
  );
}
