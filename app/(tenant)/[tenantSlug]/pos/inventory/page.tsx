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
  getRecipeVersionPosConsumptionReadiness,
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

export default async function PosInventoryPage({ params }: PageProps) {
  const { tenantSlug } = await params;
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
      </Card>
    </div>
  );
}
