import Link from "next/link";
import {
  saveBindingAction,
  saveInventorySettingsAction,
  saveMatcherAction,
  saveModifierRuleAction,
  simulateInventoryConsumptionForKitchenDispatchAction,
  toggleBindingActiveAction,
  toggleMatcherActiveAction,
  toggleModifierRuleActiveAction,
} from "@/actions/pos/inventory-consumption.actions";
import { CatalogSectionHeader } from "@/components/pos/catalog/CatalogSectionHeader";
import { Card } from "@/components/ui/card";
import { StatePanel } from "@/components/ui/state-panel";
import {
  getCurrentTenantModulePageAccessMap,
  hasModulePageAccess,
  resolveSalesPosPageContext,
} from "@/lib/auth/module-page-access";
import {
  getPosInventorySimulationEventDetail,
  getRecipeVersionPosConsumptionReadiness,
  listPosInventorySimulationEvents,
  getPosInventorySettings,
  getReadinessMap,
  type InventoryItemForRuleSelect,
  listBindings,
  listInventoryItemsForRules,
  listMatchers,
  listPosProductsForInventory,
  listRecipeVersionsForInventory,
  listRecipesForInventory,
  listRules,
} from "@/lib/pos/inventory-consumption/queries";

type PageProps = {
  params: Promise<{ tenantSlug: string }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

const TARGET_INGREDIENTS = [
  "carne",
  "mortadela",
  "queso de puerco",
  "jamon",
  "huevo",
  "aguacate",
  "chorizo",
];

const EXCLUDED_INGREDIENTS = ["lechuga", "tomate", "mayonesa"];

function getSingleSearchParam(
  params: Record<string, string | string[] | undefined>,
  key: string,
): string | null {
  const value = params[key];
  if (Array.isArray(value)) return value[0] ?? null;
  return typeof value === "string" && value.trim().length > 0 ? value : null;
}

export default async function PosInventoryPage({ params, searchParams }: PageProps) {
  const { tenantSlug } = await params;
  const resolvedSearchParams = (await searchParams) ?? {};
  const tenant = await resolveSalesPosPageContext(tenantSlug, "products", "read");
  const accessMap = await getCurrentTenantModulePageAccessMap(tenant.tenantId, "sales_pos");
  const canManage = hasModulePageAccess(accessMap.products ?? "none", "manage");

  const [settings, products, recipes, recipeVersions, bindings, rules, matchers, readiness] = await Promise.all([
    getPosInventorySettings(tenant.tenantId),
    listPosProductsForInventory(tenant.tenantId),
    listRecipesForInventory(tenant.tenantId),
    listRecipeVersionsForInventory(tenant.tenantId),
    listBindings(tenant.tenantId),
    listRules(tenant.tenantId),
    listMatchers(tenant.tenantId),
    getReadinessMap(tenant.tenantId),
  ]);
  const simulationEvents = await listPosInventorySimulationEvents(tenant.tenantId, 25);
  const simulationDetails = await Promise.all(
    simulationEvents.slice(0, 10).map((event) => getPosInventorySimulationEventDetail(tenant.tenantId, event.event_id)),
  );
  const simulationDetailsByEvent = new Map(
    simulationDetails
      .filter((detail) => detail.event)
      .map((detail) => [detail.event!.event_id, detail]),
  );
  const inventoryItems = await listInventoryItemsForRules(tenant.tenantId);
  const [recipePosReadinessEntries, bindingPosReadinessEntries] = await Promise.all([
    Promise.all(
      recipes.map(async (recipe) => {
        const version = recipeVersions.find((entry) => entry.recipe_id === recipe.id);
        if (!version) {
          return [
            recipe.id,
            {
              usable: false,
              reasons: ["Sin versión seleccionable."],
              lineCount: 0,
              invalidLineCount: 0,
              unresolvedIngredientCount: 0,
            },
          ] as [string, Awaited<ReturnType<typeof getRecipeVersionPosConsumptionReadiness>>];
        }
        const posReadiness = await getRecipeVersionPosConsumptionReadiness({
          tenantId: tenant.tenantId,
          recipeId: recipe.id,
          recipeVersionId: version.id,
        });
        return [recipe.id, posReadiness] as [string, Awaited<ReturnType<typeof getRecipeVersionPosConsumptionReadiness>>];
      }),
    ),
    Promise.all(
      bindings.map(async (binding) => {
        const posReadiness = await getRecipeVersionPosConsumptionReadiness({
          tenantId: tenant.tenantId,
          recipeId: binding.recipe_id,
          recipeVersionId: binding.recipe_version_id,
        });
        return [binding.id, posReadiness] as [string, Awaited<ReturnType<typeof getRecipeVersionPosConsumptionReadiness>>];
      }),
    ),
  ]);
  const recipePosReadiness = new Map(recipePosReadinessEntries);
  const bindingPosReadiness = new Map(bindingPosReadinessEntries);

  const activeProducts = products.filter((p) => p.deleted_at == null && p.is_active);
  const preparedProducts = activeProducts.filter((p) => p.class === "food");
  const activeBindings = bindings.filter((entry) => entry.is_active);
  const boundProductIds = new Set(activeBindings.map((entry) => entry.product_id));
  const unboundPreparedCount = preparedProducts.filter((product) => !boundProductIds.has(product.id)).length;
  const activeRules = rules.filter((entry) => entry.is_active);
  const activeMatchers = matchers.filter((entry) => entry.is_active);
  const simulationCalculatedCount = simulationEvents.filter((event) => event.status === "calculated").length;
  const simulationErrorCount = simulationEvents.filter((event) => event.status === "error").length;
  const simulationWarningCount = simulationEvents.reduce((sum, event) => sum + event.warning_count, 0);
  const simStatus = getSingleSearchParam(resolvedSearchParams, "simStatus");
  const simEventId = getSingleSearchParam(resolvedSearchParams, "simEventId");
  const simBatchId = getSingleSearchParam(resolvedSearchParams, "simBatchId");
  const simLines = getSingleSearchParam(resolvedSearchParams, "simLines");
  const simMessage = getSingleSearchParam(resolvedSearchParams, "simMessage");

  return (
    <div className="space-y-6">
      <CatalogSectionHeader
        title="POS · Inventario por Recetas"
        description={`Tenant: ${tenant.tenantName}. Configura vínculos producto→receta y reglas determinísticas de modificadores.`}
      />

      <StatePanel
        kind="warning"
        title="Modo simulación"
        message="Esta fase no descuenta inventario real. Solo prepara configuración y estructura de cálculo."
      />

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card className="space-y-1">
          <p className="text-xs uppercase tracking-[0.12em] text-muted">Productos comida sin binding</p>
          <p className="text-2xl font-semibold">{unboundPreparedCount}</p>
        </Card>
        <Card className="space-y-1">
          <p className="text-xs uppercase tracking-[0.12em] text-muted">Bindings activos</p>
          <p className="text-2xl font-semibold">{activeBindings.length}</p>
        </Card>
        <Card className="space-y-1">
          <p className="text-xs uppercase tracking-[0.12em] text-muted">Reglas activas</p>
          <p className="text-2xl font-semibold">{activeRules.length}</p>
        </Card>
        <Card className="space-y-1">
          <p className="text-xs uppercase tracking-[0.12em] text-muted">Matchers activos</p>
          <p className="text-2xl font-semibold">{activeMatchers.length}</p>
        </Card>
      </div>

      <Card className="space-y-3">
        <h2 className="text-lg font-semibold">1) Configuración</h2>
        <p className="text-sm text-muted">
          Solo se permite <strong>disabled</strong> o <strong>simulation</strong> en esta fase. El modo
          <strong> active </strong>
          queda bloqueado hasta Prompt 6.
        </p>
        <form action={saveInventorySettingsAction} className="grid gap-3 md:grid-cols-4">
          <input type="hidden" name="tenantSlug" value={tenant.tenantSlug} />
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" name="enabled" defaultChecked={settings?.enabled ?? false} disabled={!canManage} />
            Habilitado
          </label>
          <label className="text-sm">
            Modo
            <select name="mode" defaultValue={settings?.mode ?? "simulation"} disabled={!canManage} className="mt-1 w-full rounded border px-2 py-1">
              <option value="disabled">disabled</option>
              <option value="simulation">simulation</option>
            </select>
          </label>
          <div className="text-sm text-muted md:col-span-2">
            consume_prepared_on: <code>{settings?.consume_prepared_on ?? "kitchen_dispatch"}</code>
          </div>
          {canManage ? (
            <button className="rounded border px-3 py-2 text-sm font-medium md:col-span-4">Guardar configuración</button>
          ) : null}
        </form>
      </Card>

      <Card className="space-y-3">
        <h2 className="text-lg font-semibold">2) Bindings producto → receta</h2>
        <p className="text-sm text-muted">
          Se recomienda activar recetas con <code>ready</code> o con consumo POS usable.
          El consumo POS no requiere snapshot de costo; solo líneas válidas de receta.
        </p>
        <form action={saveBindingAction} className="grid gap-3 md:grid-cols-3">
          <input type="hidden" name="tenantSlug" value={tenant.tenantSlug} />
          <label className="text-sm">
            Producto POS
            <select name="productId" required disabled={!canManage} className="mt-1 w-full rounded border px-2 py-1">
              <option value="">Selecciona</option>
              {preparedProducts.map((product) => (
                <option key={product.id} value={product.id}>
                  {product.name}
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm">
            Receta
            <select name="recipeId" required disabled={!canManage} className="mt-1 w-full rounded border px-2 py-1">
              <option value="">Selecciona</option>
              {recipes.map((recipe) => (
                <option key={recipe.id} value={recipe.id}>
                  {recipe.name} · readiness {readiness.get(recipe.id) ?? "n/a"} · POS{" "}
                  {recipePosReadiness.get(recipe.id)?.usable ? "usable" : "no usable"}
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm">
            Versión receta
            <select name="recipeVersionId" required disabled={!canManage} className="mt-1 w-full rounded border px-2 py-1">
              <option value="">Selecciona</option>
              {recipeVersions.map((version) => (
                <option key={version.id} value={version.id}>
                  {version.recipe_id} · v{version.version_number} · {version.status}
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm">
            Policy
            <select name="consumptionPolicy" defaultValue="kitchen_dispatch" disabled={!canManage} className="mt-1 w-full rounded border px-2 py-1">
              <option value="kitchen_dispatch">kitchen_dispatch</option>
              <option value="disabled">disabled</option>
            </select>
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" name="isActive" defaultChecked />
            Activo
          </label>
          <label className="text-sm md:col-span-3">
            Notes
            <input name="notes" className="mt-1 w-full rounded border px-2 py-1" />
          </label>
          {canManage ? <button className="rounded border px-3 py-2 text-sm font-medium md:col-span-3">Guardar binding</button> : null}
        </form>

        <div className="overflow-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-muted">
                <th>Producto</th><th>Receta</th><th>Versión</th><th>Readiness</th><th>POS consumo</th><th>Policy</th><th>Activo</th><th>Acción</th>
              </tr>
            </thead>
            <tbody>
              {bindings.map((binding) => (
                <tr key={binding.id} className="border-t">
                  <td>{binding.product_name ?? binding.product_id}</td>
                  <td>{binding.recipe_name ?? binding.recipe_id}</td>
                  <td>{binding.recipe_version_number ?? "-"}</td>
                  <td>{readiness.get(binding.recipe_id) ?? "n/a"}</td>
                  <td>
                    {bindingPosReadiness.get(binding.id)?.usable ? "usable" : "no usable"}
                    {bindingPosReadiness.get(binding.id)?.usable
                      ? ` · ${bindingPosReadiness.get(binding.id)?.lineCount ?? 0} líneas`
                      : ` · ${(bindingPosReadiness.get(binding.id)?.reasons ?? []).join(" ")}`}
                  </td>
                  <td>{binding.consumption_policy}</td>
                  <td>{binding.is_active ? "Sí" : "No"}</td>
                  <td>
                    {canManage ? (
                      <form action={toggleBindingActiveAction}>
                        <input type="hidden" name="tenantSlug" value={tenant.tenantSlug} />
                        <input type="hidden" name="bindingId" value={binding.id} />
                        <input type="hidden" name="nextState" value={binding.is_active ? "inactive" : "active"} />
                        <button className="rounded border px-2 py-1">{binding.is_active ? "Desactivar" : "Activar"}</button>
                      </form>
                    ) : "-"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <Card className="space-y-3">
        <h2 className="text-lg font-semibold">3) Reglas de modificadores</h2>
        <p className="text-sm text-muted">
          Ingredientes objetivo fase actual: {TARGET_INGREDIENTS.join(", ")}. Excluidos: {EXCLUDED_INGREDIENTS.join(", ")}.
        </p>
        <form action={saveModifierRuleAction} className="grid gap-3 md:grid-cols-3">
          <input type="hidden" name="tenantSlug" value={tenant.tenantSlug} />
          <label className="text-sm">Nombre<input name="name" required className="mt-1 w-full rounded border px-2 py-1" /></label>
          <label className="text-sm">
            Ingrediente inventario
            <select name="ingredientInventoryItemId" required className="mt-1 w-full rounded border px-2 py-1" disabled={!canManage}>
              <option value="">Selecciona</option>
              {inventoryItems.map((item: InventoryItemForRuleSelect) => (
                <option key={item.id} value={item.id}>{item.name}</option>
              ))}
            </select>
          </label>
          <label className="text-sm">
            Operación
            <select name="operation" className="mt-1 w-full rounded border px-2 py-1" defaultValue="remove_base" disabled={!canManage}>
              <option value="remove_base">remove_base</option>
              <option value="add_delta">add_delta</option>
              <option value="subtract_delta">subtract_delta</option>
            </select>
          </label>
          <label className="text-sm">Delta quantity<input name="deltaQuantity" type="number" step="0.0001" className="mt-1 w-full rounded border px-2 py-1" /></label>
          <label className="text-sm">
            Delta unidad
            <select name="deltaUnitId" className="mt-1 w-full rounded border px-2 py-1" disabled={!canManage}>
              <option value="">(sin unidad)</option>
              {inventoryItems
                .map((item: InventoryItemForRuleSelect) => ({
                  unitId: item.default_unit_id as string | null,
                  code: Array.isArray(item.kitchen_inventory_units)
                    ? item.kitchen_inventory_units[0]?.code ?? undefined
                    : item.kitchen_inventory_units?.code ?? undefined,
                }))
                .filter((row) => row.unitId && row.code)
                .filter(
                  (row, index, arr) =>
                    arr.findIndex((candidate) => candidate.unitId === row.unitId) === index,
                )
                .map((row) => (
                  <option key={row.unitId as string} value={row.unitId as string}>
                    {row.code}
                  </option>
                ))}
            </select>
          </label>
          <label className="text-sm">
            Producto específico (opcional)
            <select name="appliesToProductId" className="mt-1 w-full rounded border px-2 py-1" disabled={!canManage}>
              <option value="">General</option>
              {preparedProducts.map((product) => (
                <option key={product.id} value={product.id}>{product.name}</option>
              ))}
            </select>
          </label>
          <label className="text-sm md:col-span-2">Notes<input name="notes" className="mt-1 w-full rounded border px-2 py-1" /></label>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="isActive" defaultChecked /> Activa</label>
          {canManage ? <button className="rounded border px-3 py-2 text-sm font-medium md:col-span-3">Guardar regla</button> : null}
        </form>

        <div className="overflow-auto">
          <table className="w-full text-sm">
            <thead><tr className="text-left text-muted"><th>Regla</th><th>Ingrediente</th><th>Operación</th><th>Delta</th><th>Activa</th><th>Acción</th></tr></thead>
            <tbody>
              {rules.map((rule) => (
                <tr key={rule.id} className="border-t">
                  <td>{rule.name}</td><td>{rule.ingredient_name ?? rule.ingredient_inventory_item_id}</td><td>{rule.operation}</td>
                  <td>{rule.delta_quantity ?? "-"}</td><td>{rule.is_active ? "Sí" : "No"}</td>
                  <td>
                    {canManage ? (
                      <form action={toggleModifierRuleActiveAction}>
                        <input type="hidden" name="tenantSlug" value={tenant.tenantSlug} />
                        <input type="hidden" name="ruleId" value={rule.id} />
                        <input type="hidden" name="nextState" value={rule.is_active ? "inactive" : "active"} />
                        <button className="rounded border px-2 py-1">{rule.is_active ? "Desactivar" : "Activar"}</button>
                      </form>
                    ) : "-"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <Card className="space-y-3">
        <h2 className="text-lg font-semibold">4) Matchers / aliases</h2>
        <p className="text-sm text-muted">
          Normalización aplicada al guardar: trim + lowercase + sin acentos + sin dobles espacios.
        </p>
        <form action={saveMatcherAction} className="grid gap-3 md:grid-cols-3">
          <input type="hidden" name="tenantSlug" value={tenant.tenantSlug} />
          <label className="text-sm">
            Regla
            <select name="ruleId" required className="mt-1 w-full rounded border px-2 py-1" disabled={!canManage}>
              <option value="">Selecciona</option>
              {rules.map((rule) => (
                <option key={rule.id} value={rule.id}>{rule.name}</option>
              ))}
            </select>
          </label>
          <label className="text-sm">
            matcher_type
            <select name="matcherType" className="mt-1 w-full rounded border px-2 py-1" defaultValue="normalized_text" disabled={!canManage}>
              <option value="modifier_option_id">modifier_option_id</option>
              <option value="modifier_option_name">modifier_option_name</option>
              <option value="normalized_text">normalized_text</option>
            </select>
          </label>
          <label className="text-sm">matcher_value<input name="matcherValue" required className="mt-1 w-full rounded border px-2 py-1" /></label>
          <label className="text-sm">priority<input name="priority" type="number" defaultValue={100} className="mt-1 w-full rounded border px-2 py-1" /></label>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="isActive" defaultChecked /> Activo</label>
          {canManage ? <button className="rounded border px-3 py-2 text-sm font-medium md:col-span-3">Guardar matcher</button> : null}
        </form>

        <div className="overflow-auto">
          <table className="w-full text-sm">
            <thead><tr className="text-left text-muted"><th>Regla</th><th>Tipo</th><th>Valor</th><th>Normalizado</th><th>Activo</th><th>Acción</th></tr></thead>
            <tbody>
              {matchers.map((matcher) => (
                <tr key={matcher.id} className="border-t">
                  <td>{matcher.rule_name ?? matcher.rule_id}</td><td>{matcher.matcher_type}</td><td>{matcher.matcher_value}</td><td>{matcher.normalized_value}</td><td>{matcher.is_active ? "Sí" : "No"}</td>
                  <td>
                    {canManage ? (
                      <form action={toggleMatcherActiveAction}>
                        <input type="hidden" name="tenantSlug" value={tenant.tenantSlug} />
                        <input type="hidden" name="matcherId" value={matcher.id} />
                        <input type="hidden" name="nextState" value={matcher.is_active ? "inactive" : "active"} />
                        <button className="rounded border px-2 py-1">{matcher.is_active ? "Desactivar" : "Activar"}</button>
                      </form>
                    ) : "-"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <Card className="space-y-2">
        <h2 className="text-lg font-semibold">Sugerencias iniciales (determinísticas)</h2>
        <p className="text-sm text-muted">Puedes cargar manualmente aliases sugeridos como: sin jamón, jamón extra, sin mortadela, mortadela extra, etc.</p>
        <Link href={`/${tenant.tenantSlug}/pos/catalog-v2/modifiers`} className="text-sm text-primary hover:underline">
          Revisar modifier options en catálogo v2
        </Link>
      </Card>

      <Card className="space-y-3">
        <h2 className="text-lg font-semibold">5) Simulación manual por kitchen dispatch</h2>
        <p className="text-sm text-muted">
          Ejecuta cálculo simulado para un `kitchen_ticket_batch.id` específico. No crea movimientos reales.
        </p>
        <form action={simulateInventoryConsumptionForKitchenDispatchAction} className="grid gap-3 md:grid-cols-3">
          <input type="hidden" name="tenantSlug" value={tenant.tenantSlug} />
          <label className="text-sm md:col-span-2">
            kitchen_batch_id
            <input
              name="kitchenBatchId"
              required
              placeholder="UUID del kitchen_ticket_batch"
              className="mt-1 w-full rounded border px-2 py-1"
              disabled={!canManage}
            />
          </label>
          {canManage ? (
            <button className="self-end rounded border px-3 py-2 text-sm font-medium">
              Simular dispatch
            </button>
          ) : null}
        </form>
        {simStatus ? (
          <div
            className={`rounded border p-3 text-sm ${
              simStatus === "error"
                ? "border-red-300 bg-red-50 text-red-800"
                : "border-emerald-300 bg-emerald-50 text-emerald-800"
            }`}
          >
            {simStatus === "created"
              ? `Simulación creada para batch ${simBatchId ?? "n/a"} · event ${simEventId ?? "n/a"} · líneas ${simLines ?? "0"}.`
              : null}
            {simStatus === "existing"
              ? `Idempotencia aplicada: ya existía evento para batch ${simBatchId ?? "n/a"} · event ${simEventId ?? "n/a"} · líneas ${simLines ?? "0"}.`
              : null}
            {simStatus === "error" ? `Error al simular batch ${simBatchId ?? "n/a"}: ${simMessage ?? "Sin detalle."}` : null}
          </div>
        ) : null}
      </Card>

      <Card className="space-y-3">
        <h2 className="text-lg font-semibold">6) Simulaciones de consumo</h2>
        <p className="text-sm text-muted">
          Vista de preview/logs tenant-scoped. Simulación: no descuenta inventario real ni crea movimientos.
        </p>

        <div className="grid gap-3 md:grid-cols-4">
          <div className="rounded border p-3">
            <p className="text-xs uppercase tracking-[0.12em] text-muted">Events simulation</p>
            <p className="text-xl font-semibold">{simulationEvents.length}</p>
          </div>
          <div className="rounded border p-3">
            <p className="text-xs uppercase tracking-[0.12em] text-muted">Calculated</p>
            <p className="text-xl font-semibold">{simulationCalculatedCount}</p>
          </div>
          <div className="rounded border p-3">
            <p className="text-xs uppercase tracking-[0.12em] text-muted">Error</p>
            <p className="text-xl font-semibold">{simulationErrorCount}</p>
          </div>
          <div className="rounded border p-3">
            <p className="text-xs uppercase tracking-[0.12em] text-muted">Warnings</p>
            <p className="text-xl font-semibold">{simulationWarningCount}</p>
          </div>
        </div>

        {simulationEvents.length <= 0 ? (
          <p className="text-sm text-muted">No hay eventos de simulación para este tenant.</p>
        ) : (
          <div className="space-y-2">
            {simulationEvents.map((event) => {
              const detail = simulationDetailsByEvent.get(event.event_id);
              const skippedPreview = event.skipped_items
                .slice(0, 3)
                .map((item) => `${item.productId} (${item.reason})`)
                .join(", ");
              return (
                <details key={event.event_id} className="rounded border p-3">
                  <summary className="cursor-pointer list-none">
                    <div className="flex flex-wrap items-center gap-2 text-sm">
                      <span className="font-semibold">{event.status}</span>
                      <span className="text-muted">· {new Date(event.created_at).toLocaleString("es-MX")}</span>
                      <span className="text-muted">· batch {event.kitchen_batch_id ?? event.source_id}</span>
                      <span className="text-muted">· líneas {event.line_count}</span>
                      <span className="text-muted">· warnings {event.warning_count}</span>
                    </div>
                    <p className="mt-1 text-xs text-muted">
                      {event.product_names.length > 0
                        ? `Productos: ${event.product_names.join(", ")}`
                        : "Sin productos resueltos"}
                    </p>
                  </summary>

                  <div className="mt-3 space-y-3 text-sm">
                    <div className="grid gap-2 md:grid-cols-2">
                      <p><span className="font-medium">Event:</span> {event.event_id}</p>
                      <p><span className="font-medium">Idempotency:</span> {event.idempotency_key}</p>
                      <p><span className="font-medium">Trigger:</span> {event.trigger_type}</p>
                      <p><span className="font-medium">Source:</span> {event.source_type} / {event.source_id}</p>
                      <p><span className="font-medium">Sales account:</span> {event.sales_account_id ?? "-"}</p>
                      <p><span className="font-medium">Ingredientes distintos:</span> {event.distinct_inventory_item_count}</p>
                    </div>

                    {event.error_message ? (
                      <p className="rounded border border-red-300 bg-red-50 p-2 text-red-800">
                        Error: {event.error_message}
                      </p>
                    ) : null}

                    {event.unmatched_modifiers.length > 0 ? (
                      <p className="rounded border border-amber-300 bg-amber-50 p-2 text-amber-800">
                        Unmatched modifiers: {event.unmatched_modifiers.map((row) => row.sourceModifierText).join(", ")}
                      </p>
                    ) : null}

                    {event.skipped_items.length > 0 ? (
                      <p className="rounded border border-amber-300 bg-amber-50 p-2 text-amber-800">
                        Productos skipped (sin binding/qty inválida): {skippedPreview}
                      </p>
                    ) : null}

                    <div className="overflow-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="text-left text-muted">
                            <th>Producto</th>
                            <th>Ingrediente</th>
                            <th>Cantidad</th>
                            <th>Reason</th>
                            <th>Rule</th>
                            <th>Source modifier</th>
                            <th>Warning</th>
                            <th>Movement</th>
                          </tr>
                        </thead>
                        <tbody>
                          {(detail?.lines ?? []).map((line) => (
                            <tr key={line.line_id} className="border-t">
                              <td>{line.product_name ?? line.product_id ?? "-"}</td>
                              <td>{line.inventory_item_name ?? line.inventory_item_id ?? "-"}</td>
                              <td>{line.quantity} {line.unit_code ?? line.unit_id ?? ""}</td>
                              <td>{line.reason}</td>
                              <td>{line.modifier_rule_name ?? line.modifier_rule_id ?? "-"}</td>
                              <td>{line.source_modifier_text ?? "-"}</td>
                              <td>{line.warning_message ?? "-"}</td>
                              <td>{line.movement_id ?? "null"}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    <p className="text-xs text-muted">
                      Simulación: no descuenta inventario y `movement_id` debe permanecer `null`.
                    </p>
                  </div>
                </details>
              );
            })}
          </div>
        )}
      </Card>
    </div>
  );
}
