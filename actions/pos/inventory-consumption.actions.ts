"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { resolveSalesPosPageActor } from "@/lib/auth/module-page-access";
import {
  simulateKitchenDispatchInventoryConsumption,
  setBindingActive,
  setMatcherActive,
  setRuleActive,
  saveInventorySettings,
  upsertBinding,
  upsertMatcher,
  upsertModifierRule,
} from "@/lib/pos/inventory-consumption/commands";
import { normalizeMatcherValue } from "@/lib/pos/inventory-consumption/normalizers";
import {
  getBindingById,
  getRecipeVersionPosConsumptionReadiness,
  getReadinessMap,
  listRecipeVersionsForInventory,
} from "@/lib/pos/inventory-consumption/queries";

function asTrimmed(value: FormDataEntryValue | null): string {
  return String(value ?? "").trim();
}

function asBoolean(value: FormDataEntryValue | null): boolean {
  return String(value ?? "") === "on";
}

function asNullable(value: FormDataEntryValue | null): string | null {
  const normalized = asTrimmed(value);
  return normalized.length > 0 ? normalized : null;
}

function revalidateInventoryPath(tenantSlug: string) {
  revalidatePath(`/${tenantSlug}/pos`);
  revalidatePath(`/${tenantSlug}/pos/inventory`);
}

export async function simulateInventoryConsumptionForKitchenDispatchAction(formData: FormData) {
  const tenantSlug = asTrimmed(formData.get("tenantSlug")).toLowerCase();
  const kitchenBatchId = asTrimmed(formData.get("kitchenBatchId"));
  if (!kitchenBatchId) throw new Error("kitchenBatchId es obligatorio.");

  const { tenant, user } = await resolveSalesPosPageActor(tenantSlug, "products", "manage");
  try {
    const result = await simulateKitchenDispatchInventoryConsumption({
      tenantId: tenant.tenantId,
      actorUserId: user.id,
      kitchenBatchId,
    });
    revalidateInventoryPath(tenant.tenantSlug);
    const status = result.created ? "created" : "existing";
    const params = new URLSearchParams({
      simStatus: status,
      simEventId: result.eventId,
      simBatchId: kitchenBatchId,
      simLines: String(result.linesInserted),
    });
    redirect(`/${tenant.tenantSlug}/pos/inventory?${params.toString()}`);
  } catch (error) {
    const params = new URLSearchParams({
      simStatus: "error",
      simBatchId: kitchenBatchId,
      simMessage: error instanceof Error ? error.message : "Simulation failed.",
    });
    redirect(`/${tenant.tenantSlug}/pos/inventory?${params.toString()}`);
  }
}

export async function saveInventorySettingsAction(formData: FormData) {
  const tenantSlug = asTrimmed(formData.get("tenantSlug")).toLowerCase();
  const enabled = asBoolean(formData.get("enabled"));
  const mode = asTrimmed(formData.get("mode")) || "simulation";
  const { tenant, user } = await resolveSalesPosPageActor(tenantSlug, "products", "manage");

  await saveInventorySettings({
    tenantId: tenant.tenantId,
    enabled,
    mode,
    actorUserId: user.id,
  });

  revalidateInventoryPath(tenant.tenantSlug);
}

export async function saveBindingAction(formData: FormData) {
  const tenantSlug = asTrimmed(formData.get("tenantSlug")).toLowerCase();
  const bindingId = asNullable(formData.get("bindingId"));
  const productId = asTrimmed(formData.get("productId"));
  const recipeId = asTrimmed(formData.get("recipeId"));
  const recipeVersionId = asTrimmed(formData.get("recipeVersionId"));
  const consumptionPolicy =
    asTrimmed(formData.get("consumptionPolicy")) === "disabled"
      ? "disabled"
      : "kitchen_dispatch";
  const isActive = asBoolean(formData.get("isActive"));
  const notes = asNullable(formData.get("notes"));

  if (!productId || !recipeId || !recipeVersionId) {
    throw new Error("Producto, receta y versión son obligatorios.");
  }

  const { tenant, user } = await resolveSalesPosPageActor(tenantSlug, "products", "manage");
  const [versions, readiness] = await Promise.all([
    listRecipeVersionsForInventory(tenant.tenantId),
    getReadinessMap(tenant.tenantId),
  ]);

  const version = versions.find((entry) => entry.id === recipeVersionId && entry.recipe_id === recipeId);
  if (!version) {
    throw new Error("La versión no pertenece a la receta seleccionada.");
  }

  const recipeReadiness = readiness.get(recipeId) ?? "incomplete";
  if (isActive && recipeReadiness !== "ready") {
    const posReadiness = await getRecipeVersionPosConsumptionReadiness({
      tenantId: tenant.tenantId,
      recipeId,
      recipeVersionId,
    });
    if (!posReadiness.usable) {
      throw new Error(
        `La receta no tiene líneas válidas para consumo POS: ${posReadiness.reasons.join(" ")}`,
      );
    }
  }

  await upsertBinding({
    tenantId: tenant.tenantId,
    actorUserId: user.id,
    bindingId,
    productId,
    recipeId,
    recipeVersionId,
    consumptionPolicy,
    isActive,
    notes,
  });

  revalidateInventoryPath(tenant.tenantSlug);
}

export async function toggleBindingActiveAction(formData: FormData) {
  const tenantSlug = asTrimmed(formData.get("tenantSlug")).toLowerCase();
  const bindingId = asTrimmed(formData.get("bindingId"));
  const isActive = asTrimmed(formData.get("nextState")) === "active";
  if (!bindingId) throw new Error("bindingId es obligatorio.");
  const { tenant, user } = await resolveSalesPosPageActor(tenantSlug, "products", "manage");
  if (isActive) {
    const binding = await getBindingById(tenant.tenantId, bindingId);
    if (!binding) throw new Error("Binding no encontrado para el tenant.");
    const readiness = await getReadinessMap(tenant.tenantId);
    const recipeReadiness = readiness.get(binding.recipe_id) ?? "incomplete";
    if (recipeReadiness !== "ready") {
      const posReadiness = await getRecipeVersionPosConsumptionReadiness({
        tenantId: tenant.tenantId,
        recipeId: binding.recipe_id,
        recipeVersionId: binding.recipe_version_id,
      });
      if (!posReadiness.usable) {
        throw new Error(
          `La receta no tiene líneas válidas para consumo POS: ${posReadiness.reasons.join(" ")}`,
        );
      }
    }
  }
  await setBindingActive({ tenantId: tenant.tenantId, actorUserId: user.id, bindingId, isActive });
  revalidateInventoryPath(tenant.tenantSlug);
}

export async function saveModifierRuleAction(formData: FormData) {
  const tenantSlug = asTrimmed(formData.get("tenantSlug")).toLowerCase();
  const ruleId = asNullable(formData.get("ruleId"));
  const name = asTrimmed(formData.get("name"));
  const ingredientInventoryItemId = asTrimmed(formData.get("ingredientInventoryItemId"));
  const operation = asTrimmed(formData.get("operation")) as "remove_base" | "add_delta" | "subtract_delta";
  const deltaQuantityRaw = asTrimmed(formData.get("deltaQuantity"));
  const deltaQuantity = deltaQuantityRaw ? Number(deltaQuantityRaw) : null;
  const deltaUnitId = asNullable(formData.get("deltaUnitId"));
  const appliesToProductId = asNullable(formData.get("appliesToProductId"));
  const notes = asNullable(formData.get("notes"));
  const isActive = asBoolean(formData.get("isActive"));

  if (!name || !ingredientInventoryItemId) {
    throw new Error("Nombre e ingrediente son obligatorios.");
  }
  if (!["remove_base", "add_delta", "subtract_delta"].includes(operation)) {
    throw new Error("Operación inválida.");
  }
  if (operation === "remove_base") {
    if (deltaQuantity != null) throw new Error("remove_base no acepta delta.");
  } else if (!deltaQuantity || !Number.isFinite(deltaQuantity) || deltaQuantity <= 0) {
    throw new Error("add_delta/subtract_delta requieren delta_quantity > 0.");
  }

  const { tenant, user } = await resolveSalesPosPageActor(tenantSlug, "products", "manage");
  await upsertModifierRule({
    tenantId: tenant.tenantId,
    actorUserId: user.id,
    ruleId,
    name,
    ingredientInventoryItemId,
    operation,
    deltaQuantity: operation === "remove_base" ? null : deltaQuantity,
    deltaUnitId: operation === "remove_base" ? null : deltaUnitId,
    appliesToProductId,
    isActive,
    notes,
  });

  revalidateInventoryPath(tenant.tenantSlug);
}

export async function toggleModifierRuleActiveAction(formData: FormData) {
  const tenantSlug = asTrimmed(formData.get("tenantSlug")).toLowerCase();
  const ruleId = asTrimmed(formData.get("ruleId"));
  const isActive = asTrimmed(formData.get("nextState")) === "active";
  if (!ruleId) throw new Error("ruleId es obligatorio.");
  const { tenant, user } = await resolveSalesPosPageActor(tenantSlug, "products", "manage");
  await setRuleActive({ tenantId: tenant.tenantId, actorUserId: user.id, ruleId, isActive });
  revalidateInventoryPath(tenant.tenantSlug);
}

export async function saveMatcherAction(formData: FormData) {
  const tenantSlug = asTrimmed(formData.get("tenantSlug")).toLowerCase();
  const matcherId = asNullable(formData.get("matcherId"));
  const ruleId = asTrimmed(formData.get("ruleId"));
  const matcherType = asTrimmed(formData.get("matcherType")) as
    | "modifier_option_id"
    | "modifier_option_name"
    | "normalized_text";
  const matcherValue = asTrimmed(formData.get("matcherValue"));
  const priorityRaw = asTrimmed(formData.get("priority"));
  const priority = priorityRaw ? Number(priorityRaw) : 100;
  const isActive = asBoolean(formData.get("isActive"));

  if (!ruleId || !matcherValue) {
    throw new Error("Regla y valor son obligatorios.");
  }
  if (!["modifier_option_id", "modifier_option_name", "normalized_text"].includes(matcherType)) {
    throw new Error("matcher_type inválido.");
  }
  if (!Number.isFinite(priority)) {
    throw new Error("priority inválido.");
  }

  const normalizedValue = normalizeMatcherValue(matcherValue);
  const { tenant, user } = await resolveSalesPosPageActor(tenantSlug, "products", "manage");
  await upsertMatcher({
    tenantId: tenant.tenantId,
    actorUserId: user.id,
    matcherId,
    ruleId,
    matcherType,
    matcherValue,
    normalizedValue,
    priority: Math.trunc(priority),
    isActive,
  });
  revalidateInventoryPath(tenant.tenantSlug);
}

export async function toggleMatcherActiveAction(formData: FormData) {
  const tenantSlug = asTrimmed(formData.get("tenantSlug")).toLowerCase();
  const matcherId = asTrimmed(formData.get("matcherId"));
  const isActive = asTrimmed(formData.get("nextState")) === "active";
  if (!matcherId) throw new Error("matcherId es obligatorio.");
  const { tenant, user } = await resolveSalesPosPageActor(tenantSlug, "products", "manage");
  await setMatcherActive({ tenantId: tenant.tenantId, actorUserId: user.id, matcherId, isActive });
  revalidateInventoryPath(tenant.tenantSlug);
}
