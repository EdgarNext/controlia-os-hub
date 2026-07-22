"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { resolveTenantModulePageActor } from "@/lib/auth/module-page-access";
import {
  parseNumericInput,
  type PriceUpdateDraftLine,
} from "@/lib/kitchen/inventory/price-update-drafts";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import type { KitchenInventoryActionState } from "./actions";

function toTrimmedString(input: FormDataEntryValue | null): string {
  return String(input ?? "").trim();
}

function buildPriceUpdatePaths(tenantSlug: string): string[] {
  return [
    `/${tenantSlug}/kitchen`,
    `/${tenantSlug}/kitchen/inventory`,
    `/${tenantSlug}/kitchen/inventory/items`,
    `/${tenantSlug}/kitchen/inventory/presentaciones-precios`,
    `/${tenantSlug}/kitchen/inventory/price-updates`,
    `/${tenantSlug}/kitchen/events`,
    `/${tenantSlug}/kitchen/events/requisitions`,
    `/${tenantSlug}/kitchen/recipes/costing`,
  ];
}

export async function applyKitchenInventoryPriceUpdateBatchAction(
  _previousState: KitchenInventoryActionState,
  formData: FormData,
): Promise<KitchenInventoryActionState> {
  try {
    const tenantSlug = toTrimmedString(formData.get("tenantSlug")).toLowerCase();
    const supplierId = toTrimmedString(formData.get("supplierId"));
    const invoiceRef = toTrimmedString(formData.get("invoiceRef"));
    const invoiceDate = toTrimmedString(formData.get("invoiceDate"));
    const notes = toTrimmedString(formData.get("notes"));
    const idempotencyKey = toTrimmedString(formData.get("idempotencyKey")) || randomUUID();
    const linesRaw = toTrimmedString(formData.get("linesJson"));

    if (!tenantSlug || !supplierId || !invoiceRef || !invoiceDate) {
      return { ok: false, message: "Proveedor, referencia y fecha de factura son obligatorios." };
    }
    if (!linesRaw) {
      return { ok: false, message: "Agrega al menos una línea con precio nuevo." };
    }

    const parsedLines = JSON.parse(linesRaw) as PriceUpdateDraftLine[];
    const normalizedLines = parsedLines
      .map((line) => {
        const itemId = String(line.itemId ?? "").trim();
        const notes = String(line.notes ?? "").trim();
        const usedForCosting = line.usedForCosting !== false;
        const newPrice = parseNumericInput(line.newPrice);

        if (line.mode === "new_purchase_option") {
          return {
            mode: "new_purchase_option" as const,
            itemId,
            newPurchaseOption: {
              purchaseUnitId: String(line.newPurchaseOption?.purchaseUnitId ?? "").trim(),
              quantityPerPurchaseUnit: parseNumericInput(line.newPurchaseOption?.quantityPerPurchaseUnit),
              inventoryUnitId: String(line.newPurchaseOption?.inventoryUnitId ?? "").trim(),
            },
            newPrice,
            usedForCosting,
            notes,
          };
        }

        return {
          mode: "existing_purchase_option" as const,
          itemId,
          purchaseOptionId: String(line.purchaseOptionId ?? "").trim(),
          newPrice,
          usedForCosting,
          notes,
        };
      })
      .filter((line) => {
        if (!line.itemId) return false;
        if (line.mode === "new_purchase_option") {
          return (
            Boolean(line.newPurchaseOption.purchaseUnitId) &&
            Boolean(line.newPurchaseOption.inventoryUnitId) &&
            Number.isFinite(line.newPurchaseOption.quantityPerPurchaseUnit) &&
            (line.newPurchaseOption.quantityPerPurchaseUnit ?? 0) > 0 &&
            Number.isFinite(line.newPrice) &&
            (line.newPrice ?? 0) > 0
          );
        }
        return Boolean(line.purchaseOptionId) && (line.newPrice == null || (Number.isFinite(line.newPrice) && line.newPrice >= 0));
      });

    if (normalizedLines.length === 0) {
      return { ok: false, message: "Solo se aplican líneas con insumo y datos válidos para la factura." };
    }

    const costingCountByItem = new Map<string, number>();
    for (const line of normalizedLines) {
      costingCountByItem.set(line.itemId, (costingCountByItem.get(line.itemId) ?? 0) + (line.usedForCosting ? 1 : 0));
    }
    const invalidItem = Array.from(costingCountByItem.entries()).find(([, total]) => total !== 1);
    if (invalidItem) {
      return {
        ok: false,
        message: "Cada insumo debe dejar exactamente una presentación marcada como fuente de costeo dentro de la factura.",
      };
    }

    const { tenant, user } = await resolveTenantModulePageActor(tenantSlug, "kitchen_inventory", "items", "manage");
    const supabase = await getSupabaseServerClient();
    const { data, error } = await supabase.rpc("apply_kitchen_inventory_price_update_batch_v2", {
      p_tenant_id: tenant.tenantId,
      p_supplier_id: supplierId,
      p_invoice_ref: invoiceRef,
      p_invoice_date: invoiceDate,
      p_notes: notes || null,
      p_idempotency_key: idempotencyKey,
      p_created_by: user.id,
      p_lines: normalizedLines,
    });

    if (error) {
      throw new Error(error.message);
    }

    for (const path of buildPriceUpdatePaths(tenant.tenantSlug)) {
      revalidatePath(path);
    }

    const response = (data as {
      line_count?: number;
      created_purchase_option_count?: number;
      updated_price_count?: number;
    } | null) ?? {
      line_count: normalizedLines.length,
      created_purchase_option_count: 0,
      updated_price_count: normalizedLines.length,
    };
    const lineCount = Number(response.line_count ?? normalizedLines.length);
    const createdPurchaseOptionCount = Number(response.created_purchase_option_count ?? 0);
    const updatedPriceCount = Number(response.updated_price_count ?? lineCount);
    return {
      ok: true,
      message:
        createdPurchaseOptionCount > 0
          ? `Factura aplicada. Se creó ${createdPurchaseOptionCount.toLocaleString("es-MX")} nueva(s) presentación(es) y se actualizaron ${updatedPriceCount.toLocaleString("es-MX")} precio(s).`
          : `Factura aplicada. ${lineCount.toLocaleString("es-MX")} línea(s) actualizadas sin tocar inventario físico.`,
    };
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error ? error.message : "No se pudo aplicar la factura de actualización de precios.",
    };
  }
}
