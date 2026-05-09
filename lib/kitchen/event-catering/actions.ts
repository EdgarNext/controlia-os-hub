"use server";

import { revalidatePath } from "next/cache";
import { resolveTenantModulePageActor } from "@/lib/auth/module-page-access";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { listKitchenRecipeReadiness } from "@/lib/kitchen/recipes/readiness";
import { toPositiveCateringNumber } from "./normalizers";
import { calculateCateringRequirements } from "./requirements";

function toText(value: FormDataEntryValue | null): string {
  return String(value ?? "").trim();
}

function toNonNegativeCateringNumber(rawValue: string, fieldLabel: string): number {
  const normalized = rawValue.replace(",", ".");
  const parsed = Number(normalized);
  if (!Number.isFinite(parsed) || parsed < 0) {
    throw new Error(`${fieldLabel} debe ser un número mayor o igual a 0.`);
  }
  return parsed;
}

function round4(value: number): number {
  return Number(value.toFixed(4));
}

function ceilToMultiple(value: number, multiple: number): number {
  if (multiple <= 0) return value;
  return Math.ceil(value / multiple) * multiple;
}

function toReversalType(value: string): "receipt" | "consumption" {
  if (value === "receipt" || value === "consumption") return value;
  throw new Error("Tipo de reversa inválido.");
}

function toReversalTargetType(value: string): "receipt_line" | "consumption_line" {
  if (value === "receipt_line" || value === "consumption_line") return value;
  throw new Error("Tipo de target de reversa inválido.");
}

function resolveLineBestTotal(line: {
  approved_total_cost?: number | null;
  quoted_total_cost?: number | null;
  preliminary_total_cost?: number | null;
  estimated_total_cost?: number | null;
}) {
  const approvedTotal = Number(line.approved_total_cost ?? 0);
  if (approvedTotal > 0) return approvedTotal;
  const quotedTotal = Number(line.quoted_total_cost ?? 0);
  if (quotedTotal > 0) return quotedTotal;
  const preliminaryTotal = Number(line.preliminary_total_cost ?? 0);
  if (preliminaryTotal > 0) return preliminaryTotal;
  return Number(line.estimated_total_cost ?? 0);
}

function resolveLineBestUnitPrice(line: {
  approved_unit_price?: number | null;
  quoted_unit_price?: number | null;
  preliminary_unit_price?: number | null;
  estimated_unit_cost?: number | null;
}) {
  const approvedUnitPrice = Number(line.approved_unit_price ?? 0);
  if (approvedUnitPrice > 0) return approvedUnitPrice;
  const quotedUnitPrice = Number(line.quoted_unit_price ?? 0);
  if (quotedUnitPrice > 0) return quotedUnitPrice;
  const preliminaryUnitPrice = Number(line.preliminary_unit_price ?? 0);
  if (preliminaryUnitPrice > 0) return preliminaryUnitPrice;
  return Number(line.estimated_unit_cost ?? 0);
}

function resolveEmbeddedEventId(value: unknown): string | undefined {
  if (Array.isArray(value)) {
    const first = value[0] as { event_id?: string } | undefined;
    return first?.event_id;
  }
  if (value && typeof value === "object" && "event_id" in value) {
    return (value as { event_id?: string }).event_id;
  }
  return undefined;
}

function isAllocationsTableMissing(errorMessage: string): boolean {
  return (
    errorMessage.includes("event_catering_inventory_allocations") &&
    (errorMessage.includes("schema cache") ||
      errorMessage.includes("does not exist") ||
      errorMessage.includes("Could not find the table"))
  );
}

async function recalculateRequisitionTotal(
  supabase: Awaited<ReturnType<typeof getSupabaseServerClient>>,
  tenantId: string,
  requisitionId: string,
) {
  const { data: rows, error: rowsError } = await supabase
    .from("event_catering_requisition_lines")
    .select("estimated_total_cost,preliminary_total_cost,quoted_total_cost,approved_total_cost")
    .eq("tenant_id", tenantId)
    .eq("requisition_id", requisitionId);
  if (rowsError) throw new Error(`No se pudo recalcular total de requisición: ${rowsError.message}`);
  const requisitionTotal = round4((rows ?? []).reduce((acc, row) => acc + resolveLineBestTotal(row), 0));
  const { error: updateReqError } = await supabase
    .from("event_catering_requisitions")
    .update({ estimated_total_cost: requisitionTotal })
    .eq("tenant_id", tenantId)
    .eq("id", requisitionId);
  if (updateReqError) throw new Error(`No se pudo actualizar total de requisición: ${updateReqError.message}`);
}

function revalidateCateringPaths(tenantSlug: string, eventId?: string, planId?: string) {
  revalidatePath(`/${tenantSlug}/kitchen/events`);
  revalidatePath(`/${tenantSlug}/kitchen/events/requisitions`);
  if (eventId) {
    revalidatePath(`/${tenantSlug}/kitchen/events/${eventId}/catering`);
    if (planId) revalidatePath(`/${tenantSlug}/kitchen/events/${eventId}/catering/${planId}`);
  }
}

async function upsertReservedAllocationFromReceiptLine(
  supabase: Awaited<ReturnType<typeof getSupabaseServerClient>>,
  input: {
    tenantId: string;
    userId: string;
    eventId: string;
    planId: string;
    requisitionId: string;
    receiptId: string;
    receiptLineId: string;
    requisitionLineId: string | null;
    itemId: string;
    locationId: string | null;
    unitId: string;
    quantity: number;
  },
) {
  const { data: existing, error: existingError } = await supabase
    .from("event_catering_inventory_allocations")
    .select("id")
    .eq("tenant_id", input.tenantId)
    .eq("receipt_line_id", input.receiptLineId)
    .limit(1)
    .maybeSingle();
  if (existingError) {
    if (isAllocationsTableMissing(existingError.message)) return;
    throw new Error(`No se pudo validar reserva previa por recepción: ${existingError.message}`);
  }
  if (existing?.id) return;

  const { error: insertError } = await supabase.from("event_catering_inventory_allocations").insert({
    tenant_id: input.tenantId,
    event_id: input.eventId,
    plan_id: input.planId,
    requirement_id: null,
    requisition_id: input.requisitionId,
    receipt_id: input.receiptId,
    receipt_line_id: input.receiptLineId,
    consumption_record_id: null,
    consumption_line_id: null,
    item_id: input.itemId,
    location_id: input.locationId,
    unit_id: input.unitId,
    allocated_quantity: round4(input.quantity),
    consumed_quantity: 0,
    released_quantity: 0,
    status: "reserved",
    source_type: "receipt",
    source_id: input.receiptLineId,
    notes: input.requisitionLineId ? `source_requisition_line:${input.requisitionLineId}` : "source_reception",
    created_by: input.userId,
  });
  if (insertError) {
    if (isAllocationsTableMissing(insertError.message)) return;
    throw new Error(`No se pudo crear reserva de inventario para recepción: ${insertError.message}`);
  }
}

async function persistCalculatedRequirements(
  supabase: Awaited<ReturnType<typeof getSupabaseServerClient>>,
  input: {
    tenantId: string;
    planId: string;
    userId: string;
    result: Awaited<ReturnType<typeof calculateCateringRequirements>>;
  },
) {
  const { error: deleteError } = await supabase
    .from("event_catering_requirements")
    .delete()
    .eq("tenant_id", input.tenantId)
    .eq("plan_id", input.planId);
  if (deleteError) throw new Error(`No se pudo limpiar requerimientos previos: ${deleteError.message}`);

  if (input.result.rows.length > 0) {
    const { error: insertError } = await supabase.from("event_catering_requirements").insert(
      input.result.rows.map((row) => ({
        tenant_id: input.tenantId,
        plan_id: input.planId,
        plan_recipe_id: null,
        item_id: row.item_id,
        unit_id: row.unit_id,
        required_quantity: row.required_quantity,
        available_quantity: row.available_quantity,
        shortage_quantity: row.shortage_quantity,
        estimated_unit_cost: row.estimated_unit_cost,
        estimated_total_cost: row.estimated_total_cost,
        source_payload: {
          ...row.source_payload,
          warnings: input.result.warnings,
        },
        created_by: input.userId,
      })),
    );
    if (insertError) throw new Error(`No se pudo guardar requerimientos recalculados: ${insertError.message}`);
  }
}

async function recalculateAndPersistCateringRequirements(
  supabase: Awaited<ReturnType<typeof getSupabaseServerClient>>,
  input: {
    tenantId: string;
    planId: string;
    userId: string;
  },
) {
  const result = await calculateCateringRequirements(input.tenantId, input.planId);
  await persistCalculatedRequirements(supabase, {
    tenantId: input.tenantId,
    planId: input.planId,
    userId: input.userId,
    result,
  });

  const { error: updateError } = await supabase
    .from("event_catering_plans")
    .update({ estimated_total_cost: result.estimatedTotalCost })
    .eq("tenant_id", input.tenantId)
    .eq("id", input.planId);
  if (updateError) throw new Error(`No se pudo actualizar costo estimado del plan: ${updateError.message}`);

  return result;
}

async function syncPlanStockAllocationsFromRequirements(
  supabase: Awaited<ReturnType<typeof getSupabaseServerClient>>,
  input: {
    tenantId: string;
    userId: string;
    eventId: string;
    planId: string;
  },
) {
  const { data: requirements, error: requirementsError } = await supabase
    .from("event_catering_requirements")
    .select("id,item_id,unit_id,required_quantity")
    .eq("tenant_id", input.tenantId)
    .eq("plan_id", input.planId)
    .gt("required_quantity", 0);
  if (requirementsError) throw new Error(`No se pudieron cargar requerimientos para apartar stock: ${requirementsError.message}`);
  if (!requirements || requirements.length === 0) return;

  const itemIds = [...new Set(requirements.map((row) => String(row.item_id)))];
  const [balancesRes, allocationsRes] = await Promise.all([
    supabase
      .from("kitchen_inventory_balances")
      .select("item_id,quantity")
      .eq("tenant_id", input.tenantId)
      .in("item_id", itemIds),
    supabase
      .from("event_catering_inventory_allocations")
      .select("id,item_id,plan_id,requirement_id,source_type,unit_id,allocated_quantity,consumed_quantity,released_quantity,status,created_at")
      .eq("tenant_id", input.tenantId)
      .in("item_id", itemIds)
      .in("status", ["reserved", "consumed"]),
  ]);
  if (balancesRes.error) throw new Error(`No se pudieron cargar balances para apartar stock: ${balancesRes.error.message}`);
  if (allocationsRes.error) {
    if (isAllocationsTableMissing(allocationsRes.error.message)) return;
    throw new Error(`No se pudieron cargar reservas para apartar stock: ${allocationsRes.error.message}`);
  }

  const physicalByItem = new Map<string, number>();
  for (const bal of balancesRes.data ?? []) {
    const itemId = String(bal.item_id);
    physicalByItem.set(itemId, round4((physicalByItem.get(itemId) ?? 0) + Number(bal.quantity ?? 0)));
  }

  type AllocationRow = {
    id: string;
    item_id: string;
    plan_id: string;
    requirement_id: string | null;
    source_type: string;
    unit_id: string;
    allocated_quantity: number | null;
    consumed_quantity: number | null;
    released_quantity: number | null;
    status: string;
    created_at: string;
  };
  const allocations = (allocationsRes.data ?? []) as AllocationRow[];

  const remainingQty = (row: AllocationRow) =>
    round4(
      Math.max(
        Number(row.allocated_quantity ?? 0) - Number(row.consumed_quantity ?? 0) - Number(row.released_quantity ?? 0),
        0,
      ),
    );

  const reservedOtherByItem = new Map<string, number>();
  const receiptReservedThisByItem = new Map<string, number>();
  const manualByPlanItemUnit = new Map<string, AllocationRow[]>();

  for (const row of allocations) {
    const remaining = remainingQty(row);
    if (remaining <= 0) continue;
    const itemId = String(row.item_id);
    if (String(row.plan_id) !== input.planId) {
      reservedOtherByItem.set(itemId, round4((reservedOtherByItem.get(itemId) ?? 0) + remaining));
      continue;
    }
    if (row.source_type === "receipt") {
      receiptReservedThisByItem.set(itemId, round4((receiptReservedThisByItem.get(itemId) ?? 0) + remaining));
      continue;
    }
    if (row.source_type === "manual") {
      const key = `${row.item_id}:${row.unit_id}`;
      manualByPlanItemUnit.set(key, [...(manualByPlanItemUnit.get(key) ?? []), row]);
    }
  }

  const requirementsByItem = new Map<string, Array<(typeof requirements)[number]>>();
  for (const req of requirements) {
    const itemId = String(req.item_id);
    requirementsByItem.set(itemId, [...(requirementsByItem.get(itemId) ?? []), req]);
  }

  for (const [itemId, itemRequirements] of requirementsByItem) {
    const physical = round4(physicalByItem.get(itemId) ?? 0);
    const reservedOther = round4(reservedOtherByItem.get(itemId) ?? 0);
    const receiptReservedThis = round4(receiptReservedThisByItem.get(itemId) ?? 0);
    const totalRequired = round4(itemRequirements.reduce((acc, req) => acc + Number(req.required_quantity ?? 0), 0));
    const freeStockExcludingOthersAndReceipts = round4(Math.max(physical - reservedOther - receiptReservedThis, 0));
    let pendingStockTarget = round4(Math.min(Math.max(totalRequired - receiptReservedThis, 0), freeStockExcludingOthersAndReceipts));

    for (const requirement of itemRequirements) {
      const requirementId = String(requirement.id);
      const requirementQty = round4(Number(requirement.required_quantity ?? 0));
      const target = round4(Math.min(requirementQty, pendingStockTarget));
      pendingStockTarget = round4(Math.max(pendingStockTarget - target, 0));
      const allocationKey = `${requirement.item_id}:${requirement.unit_id}`;

      const existing = [...(manualByPlanItemUnit.get(allocationKey) ?? [])].sort((a, b) =>
        String(a.created_at).localeCompare(String(b.created_at)),
      );
      const primary = existing[0];
      const duplicates = existing.slice(1);

      if (!primary) {
        if (target > 0) {
          const { error: insertError } = await supabase.from("event_catering_inventory_allocations").insert({
            tenant_id: input.tenantId,
            event_id: input.eventId,
            plan_id: input.planId,
            requirement_id: requirementId,
            requisition_id: null,
            receipt_id: null,
            receipt_line_id: null,
            consumption_record_id: null,
            consumption_line_id: null,
            item_id: requirement.item_id,
            location_id: null,
            unit_id: requirement.unit_id,
            allocated_quantity: target,
            consumed_quantity: 0,
            released_quantity: 0,
            status: "reserved",
            source_type: "manual",
            source_id: requirementId,
            notes: "stock_reserved_from_existing_inventory_for_plan",
            created_by: input.userId,
          });
          if (insertError) {
            if (isAllocationsTableMissing(insertError.message)) return;
            throw new Error(`No se pudo crear reserva de stock existente: ${insertError.message}`);
          }
        }
      } else {
        const consumed = round4(Number(primary.consumed_quantity ?? 0));
        const released = round4(Number(primary.released_quantity ?? 0));
        const nextAllocated = round4(consumed + released + target);
        const nextStatus = target > 0 ? "reserved" : consumed > 0 ? "consumed" : "released";
        const nextReleased = target > 0 ? released : round4(nextAllocated - consumed);
        const patch: Record<string, unknown> = {
          requirement_id: requirementId,
          allocated_quantity: nextAllocated,
          released_quantity: nextReleased,
          status: nextStatus,
          source_id: requirementId,
          notes: "stock_reserved_from_existing_inventory_for_plan",
        };
        if (nextStatus === "released") {
          patch.released_at = new Date().toISOString();
          patch.released_by = input.userId;
        }
        const { error: updateError } = await supabase
          .from("event_catering_inventory_allocations")
          .update(patch)
          .eq("tenant_id", input.tenantId)
          .eq("id", primary.id);
        if (updateError) {
          if (isAllocationsTableMissing(updateError.message)) return;
          throw new Error(`No se pudo actualizar reserva de stock existente: ${updateError.message}`);
        }
      }

      for (const duplicate of duplicates) {
        const duplicateRemaining = remainingQty(duplicate);
        if (duplicateRemaining <= 0) continue;
        const nextReleased = round4(Number(duplicate.released_quantity ?? 0) + duplicateRemaining);
        const { error: duplicateReleaseError } = await supabase
          .from("event_catering_inventory_allocations")
          .update({
            released_quantity: nextReleased,
            status: "released",
            released_at: new Date().toISOString(),
            released_by: input.userId,
            notes: "duplicate_manual_stock_allocation_released",
          })
          .eq("tenant_id", input.tenantId)
          .eq("id", duplicate.id);
        if (duplicateReleaseError) {
          if (isAllocationsTableMissing(duplicateReleaseError.message)) return;
          throw new Error(`No se pudo liberar reserva duplicada: ${duplicateReleaseError.message}`);
        }
      }
    }
  }
}

async function consumePlanAllocationsForItem(
  supabase: Awaited<ReturnType<typeof getSupabaseServerClient>>,
  input: {
    tenantId: string;
    planId: string;
    itemId: string;
    quantityToConsume: number;
    userId: string;
    consumptionRecordId: string;
    consumptionLineId: string;
  },
) {
  let pending = round4(Math.max(input.quantityToConsume, 0));
  if (pending <= 0) return;

  const { data: allocations, error: allocationsError } = await supabase
    .from("event_catering_inventory_allocations")
    .select("id,allocated_quantity,consumed_quantity,released_quantity")
    .eq("tenant_id", input.tenantId)
    .eq("plan_id", input.planId)
    .eq("item_id", input.itemId)
    .eq("status", "reserved")
    .order("created_at", { ascending: true });
  if (allocationsError) {
    if (isAllocationsTableMissing(allocationsError.message)) return;
    throw new Error(`No se pudieron cargar reservas para consumo: ${allocationsError.message}`);
  }

  for (const allocation of allocations ?? []) {
    if (pending <= 0) break;
    const available = Math.max(
      Number(allocation.allocated_quantity ?? 0) -
        Number(allocation.consumed_quantity ?? 0) -
        Number(allocation.released_quantity ?? 0),
      0,
    );
    if (available <= 0) continue;
    const consumeNow = Math.min(available, pending);
    const nextConsumed = round4(Number(allocation.consumed_quantity ?? 0) + consumeNow);
    const remaining = Math.max(
      Number(allocation.allocated_quantity ?? 0) - nextConsumed - Number(allocation.released_quantity ?? 0),
      0,
    );
    const nextStatus = remaining <= 0 ? "consumed" : "reserved";

    const { error: updateError } = await supabase
      .from("event_catering_inventory_allocations")
      .update({
        consumed_quantity: nextConsumed,
        status: nextStatus,
        consumption_record_id: input.consumptionRecordId,
        consumption_line_id: input.consumptionLineId,
      })
      .eq("tenant_id", input.tenantId)
      .eq("id", allocation.id);
    if (updateError) {
      if (isAllocationsTableMissing(updateError.message)) return;
      throw new Error(`No se pudo consumir reserva de inventario: ${updateError.message}`);
    }

    pending = round4(pending - consumeNow);
  }
}

async function releasePlanAllocations(
  supabase: Awaited<ReturnType<typeof getSupabaseServerClient>>,
  input: {
    tenantId: string;
    planId: string;
    userId: string;
    reason: string;
  },
) {
  const { data: allocations, error: allocationsError } = await supabase
    .from("event_catering_inventory_allocations")
    .select("id,allocated_quantity,consumed_quantity,released_quantity")
    .eq("tenant_id", input.tenantId)
    .eq("plan_id", input.planId)
    .eq("status", "reserved");
  if (allocationsError) {
    if (isAllocationsTableMissing(allocationsError.message)) return;
    throw new Error(`No se pudieron cargar reservas para liberar: ${allocationsError.message}`);
  }

  for (const allocation of allocations ?? []) {
    const remaining = Math.max(
      Number(allocation.allocated_quantity ?? 0) -
        Number(allocation.consumed_quantity ?? 0) -
        Number(allocation.released_quantity ?? 0),
      0,
    );
    if (remaining <= 0) continue;
    const { error: releaseError } = await supabase
      .from("event_catering_inventory_allocations")
      .update({
        released_quantity: round4(Number(allocation.released_quantity ?? 0) + remaining),
        status: "released",
        released_at: new Date().toISOString(),
        released_by: input.userId,
        notes: input.reason,
      })
      .eq("tenant_id", input.tenantId)
      .eq("id", allocation.id);
    if (releaseError) {
      if (isAllocationsTableMissing(releaseError.message)) return;
      throw new Error(`No se pudo liberar reserva de inventario: ${releaseError.message}`);
    }
  }
}

async function releaseRequisitionAllocations(
  supabase: Awaited<ReturnType<typeof getSupabaseServerClient>>,
  input: {
    tenantId: string;
    requisitionId: string;
    userId: string;
    reason: string;
  },
) {
  const { data: allocations, error: allocationsError } = await supabase
    .from("event_catering_inventory_allocations")
    .select("id,allocated_quantity,consumed_quantity,released_quantity")
    .eq("tenant_id", input.tenantId)
    .eq("requisition_id", input.requisitionId)
    .eq("status", "reserved");
  if (allocationsError) {
    if (isAllocationsTableMissing(allocationsError.message)) return;
    throw new Error(`No se pudieron cargar reservas de requisición para liberar: ${allocationsError.message}`);
  }

  for (const allocation of allocations ?? []) {
    const remaining = Math.max(
      Number(allocation.allocated_quantity ?? 0) -
        Number(allocation.consumed_quantity ?? 0) -
        Number(allocation.released_quantity ?? 0),
      0,
    );
    if (remaining <= 0) continue;
    const { error: releaseError } = await supabase
      .from("event_catering_inventory_allocations")
      .update({
        released_quantity: round4(Number(allocation.released_quantity ?? 0) + remaining),
        status: "released",
        released_at: new Date().toISOString(),
        released_by: input.userId,
        notes: input.reason,
      })
      .eq("tenant_id", input.tenantId)
      .eq("id", allocation.id);
    if (releaseError) {
      if (isAllocationsTableMissing(releaseError.message)) return;
      throw new Error(`No se pudo liberar reserva de requisición: ${releaseError.message}`);
    }
  }
}

export async function createCateringPlanAction(formData: FormData): Promise<void> {
  const tenantSlug = toText(formData.get("tenantSlug")).toLowerCase();
  const eventId = toText(formData.get("eventId"));
  const name = toText(formData.get("name"));
  const plannedGuestCountRaw = toText(formData.get("plannedGuestCount"));
  const notes = toText(formData.get("notes"));
  if (!tenantSlug || !eventId) throw new Error("Tenant y evento son obligatorios.");

  const { tenant, user } = await resolveTenantModulePageActor(tenantSlug, "event_catering", "plans", "manage");
  const plannedGuestCountInput = plannedGuestCountRaw
    ? toPositiveCateringNumber(plannedGuestCountRaw, "Invitados planeados")
    : null;
  const supabase = await getSupabaseServerClient();

  const { data: eventRow, error: eventError } = await supabase
    .from("events")
    .select("id,expected_attendance")
    .eq("tenant_id", tenant.tenantId)
    .eq("id", eventId)
    .maybeSingle();
  if (eventError || !eventRow) throw new Error("Evento inválido para el tenant.");
  const eventExpectedAttendance =
    eventRow.expected_attendance != null && Number(eventRow.expected_attendance) > 0
      ? Number(eventRow.expected_attendance)
      : null;
  const plannedGuestCount = plannedGuestCountInput ?? eventExpectedAttendance;

  const { data: plan, error: insertError } = await supabase
    .from("event_catering_plans")
    .insert({
      tenant_id: tenant.tenantId,
      event_id: eventId,
      name: name || null,
      status: "draft",
      planned_guest_count: plannedGuestCount,
      notes: notes || null,
      created_by: user.id,
    })
    .select("id")
    .single();
  if (insertError || !plan) throw new Error(`No se pudo crear plan: ${insertError?.message ?? "error"}`);

  revalidateCateringPaths(tenant.tenantSlug, eventId, plan.id);
}

export async function updateCateringPlanAction(formData: FormData): Promise<void> {
  const tenantSlug = toText(formData.get("tenantSlug")).toLowerCase();
  const planId = toText(formData.get("planId"));
  const name = toText(formData.get("name"));
  const status = toText(formData.get("status"));
  const plannedGuestCountRaw = toText(formData.get("plannedGuestCount"));
  const notes = toText(formData.get("notes"));
  if (!tenantSlug || !planId) throw new Error("Tenant y plan son obligatorios.");

  const { tenant, user } = await resolveTenantModulePageActor(tenantSlug, "event_catering", "plans", "manage");
  const supabase = await getSupabaseServerClient();

  const patch: Record<string, unknown> = {};
  if (name) patch.name = name;
  if (status) patch.status = status;
  if (plannedGuestCountRaw) patch.planned_guest_count = toPositiveCateringNumber(plannedGuestCountRaw, "Invitados planeados");
  if (notes) patch.notes = notes;

  const { data: updated, error: updateError } = await supabase
    .from("event_catering_plans")
    .update(patch)
    .eq("tenant_id", tenant.tenantId)
    .eq("id", planId)
    .select("id,event_id")
    .single();
  if (updateError || !updated) throw new Error(`No se pudo actualizar plan: ${updateError?.message ?? "error"}`);

  if (status === "canceled") {
    await releasePlanAllocations(supabase, {
      tenantId: tenant.tenantId,
      planId: updated.id,
      userId: user.id,
      reason: `Plan cancelado ${new Date().toISOString()}`,
    });
  }

  revalidateCateringPaths(tenant.tenantSlug, updated.event_id, updated.id);
}

export async function addReadyRecipeToCateringPlanAction(formData: FormData): Promise<void> {
  const tenantSlug = toText(formData.get("tenantSlug")).toLowerCase();
  const planId = toText(formData.get("planId"));
  const recipeId = toText(formData.get("recipeId"));
  const plannedServingsRaw = toText(formData.get("plannedServings"));
  if (!tenantSlug || !planId || !recipeId) throw new Error("Tenant, plan y receta son obligatorios.");

  const { tenant, user } = await resolveTenantModulePageActor(tenantSlug, "event_catering", "plans", "manage");
  const supabase = await getSupabaseServerClient();

  const readiness = await listKitchenRecipeReadiness(tenant.tenantId);
  const recipeReadiness = readiness.find((recipe) => recipe.recipe_id === recipeId);
  if (!recipeReadiness || recipeReadiness.readiness_status !== "ready") {
    throw new Error("Solo se pueden agregar recetas con readiness ready.");
  }
  if (/^test\b/i.test(recipeReadiness.recipe_name)) {
    throw new Error("No se permiten recetas TEST en planes de catering.");
  }

  const [{ data: plan, error: planError }, { data: activeVersion, error: versionError }] = await Promise.all([
    supabase
      .from("event_catering_plans")
      .select("id,event_id,planned_guest_count")
      .eq("tenant_id", tenant.tenantId)
      .eq("id", planId)
      .maybeSingle(),
    supabase
      .from("kitchen_recipe_versions")
      .select("id,servings")
      .eq("tenant_id", tenant.tenantId)
      .eq("recipe_id", recipeId)
      .eq("status", "active")
      .maybeSingle(),
  ]);
  if (planError || !plan) throw new Error("Plan inválido para el tenant.");
  if (versionError || !activeVersion) throw new Error("La receta no tiene versión activa.");

  const plannedServings = plannedServingsRaw
    ? toPositiveCateringNumber(plannedServingsRaw, "Base de cálculo planeada")
    : Number(plan.planned_guest_count ?? 0);
  if (!(plannedServings > 0)) {
    throw new Error("Base de cálculo planeada inválida. Captura una cantidad mayor a 0.");
  }

  const { data: snapshot } = await supabase
    .from("kitchen_recipe_cost_snapshots")
    .select("id,total_cost")
    .eq("tenant_id", tenant.tenantId)
    .eq("recipe_id", recipeId)
    .eq("recipe_version_id", activeVersion.id)
    .eq("snapshot_type", "current")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const baseServings = Number(activeVersion.servings ?? 0);
  const multiplier = baseServings > 0 ? plannedServings / baseServings : 1;
  const baseCost = Number(snapshot?.total_cost ?? 0);
  const estimatedCost = baseCost > 0 ? Number((baseCost * multiplier).toFixed(4)) : 0;

  const { error: upsertError } = await supabase.from("event_catering_plan_recipes").upsert(
    {
      tenant_id: tenant.tenantId,
      plan_id: planId,
      recipe_id: recipeId,
      recipe_version_id: activeVersion.id,
      snapshot_id: snapshot?.id ?? null,
      planned_servings: plannedServings,
      multiplier,
      estimated_cost: estimatedCost,
      created_by: user.id,
    },
    { onConflict: "tenant_id,plan_id,recipe_id,recipe_version_id" },
  );
  if (upsertError) throw new Error(`No se pudo agregar receta al plan: ${upsertError.message}`);

  const { data: recipes } = await supabase
    .from("event_catering_plan_recipes")
    .select("estimated_cost")
    .eq("tenant_id", tenant.tenantId)
    .eq("plan_id", planId);
  const estimatedTotal = (recipes ?? []).reduce((acc, recipe) => acc + Number(recipe.estimated_cost ?? 0), 0);
  await supabase
    .from("event_catering_plans")
    .update({ estimated_total_cost: estimatedTotal })
    .eq("tenant_id", tenant.tenantId)
    .eq("id", planId);

  revalidateCateringPaths(tenant.tenantSlug, plan.event_id, plan.id);
}

export async function removeRecipeFromCateringPlanAction(formData: FormData): Promise<void> {
  const tenantSlug = toText(formData.get("tenantSlug")).toLowerCase();
  const planId = toText(formData.get("planId"));
  const planRecipeId = toText(formData.get("planRecipeId"));
  if (!tenantSlug || !planId || !planRecipeId) throw new Error("Datos incompletos para remover receta.");

  const { tenant } = await resolveTenantModulePageActor(tenantSlug, "event_catering", "plans", "manage");
  const supabase = await getSupabaseServerClient();
  const { data: plan, error: planError } = await supabase
    .from("event_catering_plans")
    .select("id,event_id")
    .eq("tenant_id", tenant.tenantId)
    .eq("id", planId)
    .maybeSingle();
  if (planError || !plan) throw new Error("Plan inválido para el tenant.");

  const { error: deleteError } = await supabase
    .from("event_catering_plan_recipes")
    .delete()
    .eq("tenant_id", tenant.tenantId)
    .eq("id", planRecipeId)
    .eq("plan_id", planId);
  if (deleteError) throw new Error(`No se pudo remover receta del plan: ${deleteError.message}`);

  const { data: recipes } = await supabase
    .from("event_catering_plan_recipes")
    .select("estimated_cost")
    .eq("tenant_id", tenant.tenantId)
    .eq("plan_id", planId);
  const estimatedTotal = (recipes ?? []).reduce((acc, recipe) => acc + Number(recipe.estimated_cost ?? 0), 0);
  await supabase
    .from("event_catering_plans")
    .update({ estimated_total_cost: estimatedTotal })
    .eq("tenant_id", tenant.tenantId)
    .eq("id", planId);

  revalidateCateringPaths(tenant.tenantSlug, plan.event_id, plan.id);
}

export async function updatePlanRecipeServingsAction(formData: FormData): Promise<void> {
  const tenantSlug = toText(formData.get("tenantSlug")).toLowerCase();
  const planId = toText(formData.get("planId"));
  const planRecipeId = toText(formData.get("planRecipeId"));
  const plannedServings = toPositiveCateringNumber(toText(formData.get("plannedServings")), "Porciones planeadas");
  if (!tenantSlug || !planId || !planRecipeId) throw new Error("Datos incompletos para actualizar porciones.");

  const { tenant } = await resolveTenantModulePageActor(tenantSlug, "event_catering", "plans", "manage");
  const supabase = await getSupabaseServerClient();

  const { data: plan, error: planError } = await supabase
    .from("event_catering_plans")
    .select("id,event_id")
    .eq("tenant_id", tenant.tenantId)
    .eq("id", planId)
    .maybeSingle();
  if (planError || !plan) throw new Error("Plan inválido para el tenant.");

  const { data: planRecipe, error: planRecipeError } = await supabase
    .from("event_catering_plan_recipes")
    .select("id,recipe_id,recipe_version_id")
    .eq("tenant_id", tenant.tenantId)
    .eq("id", planRecipeId)
    .eq("plan_id", planId)
    .maybeSingle();
  if (planRecipeError || !planRecipe) throw new Error("Receta del plan inválida para el tenant.");

  const [{ data: activeVersion }, { data: snapshot }] = await Promise.all([
    supabase
      .from("kitchen_recipe_versions")
      .select("id,servings")
      .eq("tenant_id", tenant.tenantId)
      .eq("id", planRecipe.recipe_version_id)
      .maybeSingle(),
    supabase
      .from("kitchen_recipe_cost_snapshots")
      .select("id,total_cost")
      .eq("tenant_id", tenant.tenantId)
      .eq("recipe_id", planRecipe.recipe_id)
      .eq("recipe_version_id", planRecipe.recipe_version_id)
      .eq("snapshot_type", "current")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  const baseServings = Number(activeVersion?.servings ?? 0);
  const multiplier = baseServings > 0 ? plannedServings / baseServings : 1;
  const baseCost = Number(snapshot?.total_cost ?? 0);
  const estimatedCost = baseCost > 0 ? Number((baseCost * multiplier).toFixed(4)) : 0;

  const { error: updateError } = await supabase
    .from("event_catering_plan_recipes")
    .update({
      planned_servings: plannedServings,
      multiplier,
      estimated_cost: estimatedCost,
      snapshot_id: snapshot?.id ?? null,
    })
    .eq("tenant_id", tenant.tenantId)
    .eq("id", planRecipeId)
    .eq("plan_id", planId);
  if (updateError) throw new Error(`No se pudo actualizar porciones: ${updateError.message}`);

  const { data: recipes } = await supabase
    .from("event_catering_plan_recipes")
    .select("estimated_cost")
    .eq("tenant_id", tenant.tenantId)
    .eq("plan_id", planId);
  const estimatedTotal = (recipes ?? []).reduce((acc, recipe) => acc + Number(recipe.estimated_cost ?? 0), 0);
  await supabase
    .from("event_catering_plans")
    .update({ estimated_total_cost: estimatedTotal })
    .eq("tenant_id", tenant.tenantId)
    .eq("id", planId);

  revalidateCateringPaths(tenant.tenantSlug, plan.event_id, plan.id);
}

export async function recalculateCateringRequirementsAction(formData: FormData): Promise<void> {
  const tenantSlug = toText(formData.get("tenantSlug")).toLowerCase();
  const planId = toText(formData.get("planId"));
  if (!tenantSlug || !planId) throw new Error("Tenant y plan son obligatorios.");

  const { tenant, user } = await resolveTenantModulePageActor(tenantSlug, "event_catering", "requirements", "manage");
  const supabase = await getSupabaseServerClient();
  const { data: plan, error: planError } = await supabase
    .from("event_catering_plans")
    .select("id,event_id")
    .eq("tenant_id", tenant.tenantId)
    .eq("id", planId)
    .maybeSingle();
  if (planError || !plan) throw new Error("Plan inválido para el tenant.");

  await recalculateAndPersistCateringRequirements(supabase, {
    tenantId: tenant.tenantId,
    planId: plan.id,
    userId: user.id,
  });

  revalidateCateringPaths(tenant.tenantSlug, plan.event_id, plan.id);
}

export async function generateCateringRequisitionFromShortagesAction(formData: FormData): Promise<void> {
  const tenantSlug = toText(formData.get("tenantSlug")).toLowerCase();
  const planId = toText(formData.get("planId"));
  if (!tenantSlug || !planId) throw new Error("Tenant y plan son obligatorios.");

  const { tenant, user } = await resolveTenantModulePageActor(tenantSlug, "event_catering", "requisitions", "manage");
  const supabase = await getSupabaseServerClient();

  const { data: plan, error: planError } = await supabase
    .from("event_catering_plans")
    .select("id,event_id")
    .eq("tenant_id", tenant.tenantId)
    .eq("id", planId)
    .maybeSingle();
  if (planError || !plan) throw new Error("Plan inválido para el tenant.");

  await recalculateAndPersistCateringRequirements(supabase, {
    tenantId: tenant.tenantId,
    planId: plan.id,
    userId: user.id,
  });

  await syncPlanStockAllocationsFromRequirements(supabase, {
    tenantId: tenant.tenantId,
    userId: user.id,
    eventId: plan.event_id,
    planId: plan.id,
  });

  await recalculateAndPersistCateringRequirements(supabase, {
    tenantId: tenant.tenantId,
    planId: plan.id,
    userId: user.id,
  });

  const { data: shortages, error: shortagesError } = await supabase
    .from("event_catering_requirements")
    .select("id,item_id,unit_id,shortage_quantity,estimated_unit_cost")
    .eq("tenant_id", tenant.tenantId)
    .eq("plan_id", plan.id)
    .gt("shortage_quantity", 0);
  if (shortagesError) throw new Error(`No fue posible cargar faltantes del plan: ${shortagesError.message}`);
  if (!shortages || shortages.length === 0) {
    throw new Error("El plan no tiene faltantes; no se generó requisición.");
  }

  const itemIds = [...new Set(shortages.map((row) => row.item_id))];
  const { data: itemsData, error: itemsError } = await supabase
    .from("kitchen_inventory_items")
    .select("id,default_supplier_id")
    .eq("tenant_id", tenant.tenantId)
    .in("id", itemIds);
  if (itemsError) throw new Error(`No fue posible cargar proveedores por defecto de insumos: ${itemsError.message}`);
  const supplierByItem = new Map((itemsData ?? []).map((row) => [row.id, row.default_supplier_id]));

  const { data: purchaseOptions, error: purchaseOptionsError } = await supabase
    .from("kitchen_inventory_purchase_options")
    .select(
      "id,item_id,supplier_id,purchase_unit_id,inventory_unit_id,quantity_per_purchase_unit,min_purchase_quantity,purchase_multiple,is_default,is_active",
    )
    .eq("tenant_id", tenant.tenantId)
    .eq("is_active", true)
    .eq("is_default", true)
    .in("item_id", itemIds);
  if (purchaseOptionsError) throw new Error(`No fue posible cargar opciones de compra: ${purchaseOptionsError.message}`);
  const purchaseOptionByItem = new Map((purchaseOptions ?? []).map((row) => [row.item_id, row]));

  const purchaseOptionIds = (purchaseOptions ?? []).map((row) => row.id);
  const { data: currentSupplierPrices, error: currentSupplierPricesError } = await supabase
    .from("kitchen_inventory_supplier_prices")
    .select("id,item_id,supplier_id,purchase_option_id,purchase_unit_id,price_per_purchase_unit,is_current")
    .eq("tenant_id", tenant.tenantId)
    .eq("is_current", true)
    .in("item_id", itemIds);
  if (currentSupplierPricesError) throw new Error(`No fue posible cargar precios de proveedor actuales: ${currentSupplierPricesError.message}`);
  const currentByPurchaseOption = new Map(
    (currentSupplierPrices ?? [])
      .filter((row) => row.purchase_option_id && purchaseOptionIds.includes(row.purchase_option_id))
      .map((row) => [row.purchase_option_id as string, row]),
  );
  const currentByItemSupplier = new Map(
    (currentSupplierPrices ?? []).map((row) => [`${row.item_id}:${row.supplier_id ?? "none"}`, row]),
  );

  let requisitionId: string;
  const { data: existingDraft, error: existingDraftError } = await supabase
    .from("event_catering_requisitions")
    .select("id")
    .eq("tenant_id", tenant.tenantId)
    .eq("plan_id", plan.id)
    .eq("status", "draft")
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (existingDraftError) throw new Error(`No fue posible buscar requisición draft existente: ${existingDraftError.message}`);

  const estimatedTotalCost = round4(
    shortages.reduce(
      (acc, row) => acc + Number(row.shortage_quantity ?? 0) * Number(row.estimated_unit_cost ?? 0),
      0,
    ),
  );

  if (existingDraft?.id) {
    requisitionId = existingDraft.id;
    const { error: deleteLinesError } = await supabase
      .from("event_catering_requisition_lines")
      .delete()
      .eq("tenant_id", tenant.tenantId)
      .eq("requisition_id", requisitionId);
    if (deleteLinesError) throw new Error(`No se pudieron reemplazar líneas de requisición draft: ${deleteLinesError.message}`);

    const { error: updateReqError } = await supabase
      .from("event_catering_requisitions")
      .update({
        estimated_total_cost: estimatedTotalCost,
        notes: `Requisición sugerida regenerada desde faltantes del plan ${plan.id}`,
      })
      .eq("tenant_id", tenant.tenantId)
      .eq("id", requisitionId);
    if (updateReqError) throw new Error(`No se pudo actualizar requisición draft: ${updateReqError.message}`);
  } else {
    const { data: createdReq, error: createReqError } = await supabase
      .from("event_catering_requisitions")
      .insert({
        tenant_id: tenant.tenantId,
        plan_id: plan.id,
        status: "draft",
        estimated_total_cost: estimatedTotalCost,
        notes: `Requisición sugerida generada desde faltantes del plan ${plan.id}`,
        created_by: user.id,
      })
      .select("id")
      .single();
    if (createReqError || !createdReq) throw new Error(`No se pudo crear requisición draft: ${createReqError?.message ?? "error"}`);
    requisitionId = createdReq.id;
  }

  const rows = shortages.map((row) => {
    const requested = Number(row.shortage_quantity ?? 0);
    const unitCost = Number(row.estimated_unit_cost ?? 0);
    const purchaseOption = purchaseOptionByItem.get(row.item_id);
    let requestedPurchaseQuantity: number | null = null;
    let expectedInventoryQuantity: number | null = null;
    let expectedSurplusQuantity: number | null = null;
    let purchaseWarning: string | null = null;
    let preliminaryUnitPrice: number | null = null;
    let preliminaryTotalCost: number | null = null;
    let priceSource: string | null = null;
    let supplierPriceId: string | null = null;

    if (purchaseOption) {
      const quantityPerPurchaseUnit = Number(purchaseOption.quantity_per_purchase_unit ?? 0);
      const minPurchaseQuantity = Number(purchaseOption.min_purchase_quantity ?? 1);
      const purchaseMultiple = Number(purchaseOption.purchase_multiple ?? 1);
      if (quantityPerPurchaseUnit > 0) {
        const rawPurchaseQuantity = requested / quantityPerPurchaseUnit;
        const roundedByMultiple = ceilToMultiple(rawPurchaseQuantity, purchaseMultiple);
        requestedPurchaseQuantity = round4(Math.max(roundedByMultiple, minPurchaseQuantity));
        expectedInventoryQuantity = round4(requestedPurchaseQuantity * quantityPerPurchaseUnit);
        expectedSurplusQuantity = round4(Math.max(expectedInventoryQuantity - requested, 0));

        const supplierId = purchaseOption.supplier_id ?? supplierByItem.get(row.item_id) ?? null;
        const supplierPrice =
          currentByPurchaseOption.get(purchaseOption.id) ??
          currentByItemSupplier.get(`${row.item_id}:${supplierId ?? "none"}`) ??
          null;
        if (supplierPrice) {
          preliminaryUnitPrice = Number(supplierPrice.price_per_purchase_unit ?? 0);
          preliminaryTotalCost = requestedPurchaseQuantity != null ? round4(requestedPurchaseQuantity * preliminaryUnitPrice) : null;
          priceSource = "supplier_price_current";
          supplierPriceId = supplierPrice.id;
        } else {
          preliminaryUnitPrice = unitCost;
          preliminaryTotalCost = requestedPurchaseQuantity != null ? round4(requestedPurchaseQuantity * preliminaryUnitPrice) : null;
          priceSource = "estimated_fallback";
          purchaseWarning = purchaseWarning ?? "Sin precio proveedor actual; se usó costo estimado.";
        }
      } else {
        purchaseWarning = "Sin opción de compra configurada";
      }
    } else {
      purchaseWarning = "Sin opción de compra configurada";
    }

    if (!purchaseOption) {
      preliminaryUnitPrice = unitCost;
      preliminaryTotalCost = round4(requested * preliminaryUnitPrice);
      priceSource = "estimated_fallback";
    }

    return {
      tenant_id: tenant.tenantId,
      requisition_id: requisitionId,
      item_id: row.item_id,
      unit_id: row.unit_id,
      requested_quantity: requested,
      purchase_option_id: purchaseOption?.id ?? null,
      purchase_unit_id: purchaseOption?.purchase_unit_id ?? null,
      requested_purchase_quantity: requestedPurchaseQuantity,
      expected_inventory_quantity: expectedInventoryQuantity,
      expected_surplus_quantity: expectedSurplusQuantity,
      purchase_warning: purchaseWarning,
      preliminary_unit_price: preliminaryUnitPrice,
      quoted_unit_price: null,
      approved_unit_price: null,
      preliminary_total_cost: preliminaryTotalCost,
      quoted_total_cost: null,
      approved_total_cost: null,
      price_source: priceSource,
      supplier_price_id: supplierPriceId,
      quoted_at: null,
      quoted_by: null,
      estimated_unit_cost: unitCost,
      estimated_total_cost: round4(requested * unitCost),
      supplier_id: purchaseOption?.supplier_id ?? supplierByItem.get(row.item_id) ?? null,
      notes: `source_requirement:${row.id}`,
      created_by: user.id,
    };
  });

  const { error: insertLinesError } = await supabase
    .from("event_catering_requisition_lines")
    .insert(rows);
  if (insertLinesError) throw new Error(`No se pudieron crear líneas de requisición: ${insertLinesError.message}`);

  await recalculateRequisitionTotal(supabase, tenant.tenantId, requisitionId);

  revalidateCateringPaths(tenant.tenantSlug, plan.event_id, plan.id);
  revalidatePath(`/${tenant.tenantSlug}/kitchen/events/requisitions`);
  revalidatePath(`/${tenant.tenantSlug}/kitchen/events/requisitions/${requisitionId}`);
}

export async function updateCateringRequisitionLineAction(formData: FormData): Promise<void> {
  const tenantSlug = toText(formData.get("tenantSlug")).toLowerCase();
  const requisitionId = toText(formData.get("requisitionId"));
  const lineId = toText(formData.get("lineId"));
  const requestedQuantity = toPositiveCateringNumber(toText(formData.get("requestedQuantity")), "Cantidad solicitada");
  if (!tenantSlug || !requisitionId || !lineId) throw new Error("Datos incompletos para actualizar línea.");

  const { tenant } = await resolveTenantModulePageActor(tenantSlug, "event_catering", "requisitions", "manage");
  const supabase = await getSupabaseServerClient();

  const { data: requisition, error: requisitionError } = await supabase
    .from("event_catering_requisitions")
    .select("id,status,plan_id,event_catering_plans:event_catering_plans!event_catering_requisitions_tenant_plan_fkey(event_id)")
    .eq("tenant_id", tenant.tenantId)
    .eq("id", requisitionId)
    .maybeSingle();
  if (requisitionError || !requisition) throw new Error("Requisición inválida para el tenant.");
  if (requisition.status !== "draft") {
    throw new Error("Solo se pueden editar líneas cuando la requisición está en draft.");
  }

  const { data: line, error: lineError } = await supabase
    .from("event_catering_requisition_lines")
    .select("id,estimated_unit_cost,purchase_option_id,preliminary_unit_price,quoted_unit_price,approved_unit_price")
    .eq("tenant_id", tenant.tenantId)
    .eq("requisition_id", requisition.id)
    .eq("id", lineId)
    .maybeSingle();
  if (lineError || !line) throw new Error("Línea inválida para la requisición.");

  const estimatedUnitCost = Number(line.estimated_unit_cost ?? 0);
  const estimatedTotalCost = round4(requestedQuantity * estimatedUnitCost);

  let purchasePatch: Record<string, unknown> = {};
  if (line.purchase_option_id) {
    const { data: option } = await supabase
      .from("kitchen_inventory_purchase_options")
      .select("quantity_per_purchase_unit,min_purchase_quantity,purchase_multiple")
      .eq("tenant_id", tenant.tenantId)
      .eq("id", line.purchase_option_id)
      .eq("is_active", true)
      .maybeSingle();
    if (option) {
      const quantityPerPurchaseUnit = Number(option.quantity_per_purchase_unit ?? 0);
      const minPurchaseQuantity = Number(option.min_purchase_quantity ?? 1);
      const purchaseMultiple = Number(option.purchase_multiple ?? 1);
      if (quantityPerPurchaseUnit > 0) {
        const rawPurchaseQty = requestedQuantity / quantityPerPurchaseUnit;
        const roundedPurchaseQty = Math.max(ceilToMultiple(rawPurchaseQty, purchaseMultiple), minPurchaseQuantity);
        const expectedInventoryQuantity = round4(roundedPurchaseQty * quantityPerPurchaseUnit);
        purchasePatch = {
          requested_purchase_quantity: round4(roundedPurchaseQty),
          expected_inventory_quantity: expectedInventoryQuantity,
          expected_surplus_quantity: round4(Math.max(expectedInventoryQuantity - requestedQuantity, 0)),
          purchase_warning: null,
        };
      } else {
        purchasePatch = {
          requested_purchase_quantity: null,
          expected_inventory_quantity: null,
          expected_surplus_quantity: null,
          purchase_warning: "Sin opción de compra configurada",
        };
      }
    }
  }

  const { error: updateLineError } = await supabase
    .from("event_catering_requisition_lines")
    .update({
      requested_quantity: requestedQuantity,
      estimated_total_cost: estimatedTotalCost,
      preliminary_total_cost:
        line.preliminary_unit_price != null
          ? round4(requestedQuantity * Number(line.preliminary_unit_price))
          : null,
      quoted_total_cost:
        line.quoted_unit_price != null
          ? round4(requestedQuantity * Number(line.quoted_unit_price))
          : null,
      approved_total_cost:
        line.approved_unit_price != null
          ? round4(requestedQuantity * Number(line.approved_unit_price))
          : null,
      notes: `line-updated:${new Date().toISOString()}`,
      ...purchasePatch,
    })
    .eq("tenant_id", tenant.tenantId)
    .eq("requisition_id", requisition.id)
    .eq("id", line.id);
  if (updateLineError) throw new Error(`No se pudo actualizar línea de requisición: ${updateLineError.message}`);

  await recalculateRequisitionTotal(supabase, tenant.tenantId, requisition.id);

  revalidateCateringPaths(tenant.tenantSlug);
  revalidatePath(`/${tenant.tenantSlug}/kitchen/events/requisitions`);
  revalidatePath(`/${tenant.tenantSlug}/kitchen/events/requisitions/${requisition.id}`);
}

export async function updateRequisitionLinePurchaseOptionAction(formData: FormData): Promise<void> {
  const tenantSlug = toText(formData.get("tenantSlug")).toLowerCase();
  const requisitionId = toText(formData.get("requisitionId"));
  const lineId = toText(formData.get("lineId"));
  const purchaseOptionId = toText(formData.get("purchaseOptionId"));
  if (!tenantSlug || !requisitionId || !lineId || !purchaseOptionId) {
    throw new Error("Datos incompletos para cambiar presentación.");
  }

  const { tenant } = await resolveTenantModulePageActor(tenantSlug, "event_catering", "requisitions", "manage");
  const supabase = await getSupabaseServerClient();

  const { data: requisition, error: requisitionError } = await supabase
    .from("event_catering_requisitions")
    .select("id,status,plan_id,event_catering_plans:event_catering_plans!event_catering_requisitions_tenant_plan_fkey(event_id)")
    .eq("tenant_id", tenant.tenantId)
    .eq("id", requisitionId)
    .maybeSingle();
  if (requisitionError || !requisition) throw new Error("Requisición inválida para el tenant.");
  if (requisition.status !== "draft" && requisition.status !== "reviewed") {
    throw new Error("Solo se puede cambiar presentación en requisiciones draft o reviewed.");
  }

  const { data: line, error: lineError } = await supabase
    .from("event_catering_requisition_lines")
    .select("id,item_id,requested_quantity,estimated_unit_cost")
    .eq("tenant_id", tenant.tenantId)
    .eq("requisition_id", requisition.id)
    .eq("id", lineId)
    .maybeSingle();
  if (lineError || !line) throw new Error("Línea inválida para la requisición.");

  const { data: option, error: optionError } = await supabase
    .from("kitchen_inventory_purchase_options")
    .select("id,item_id,supplier_id,purchase_unit_id,quantity_per_purchase_unit,min_purchase_quantity,purchase_multiple,is_active")
    .eq("tenant_id", tenant.tenantId)
    .eq("id", purchaseOptionId)
    .eq("is_active", true)
    .maybeSingle();
  if (optionError || !option) throw new Error("Opción de compra inválida para el tenant.");
  if (option.item_id !== line.item_id) throw new Error("La opción de compra no corresponde al insumo de la línea.");

  const { data: item, error: itemError } = await supabase
    .from("kitchen_inventory_items")
    .select("id,default_supplier_id")
    .eq("tenant_id", tenant.tenantId)
    .eq("id", line.item_id)
    .maybeSingle();
  if (itemError || !item) throw new Error("No se pudo validar insumo de la línea.");

  const requestedQuantity = Number(line.requested_quantity ?? 0);
  const quantityPerPurchaseUnit = Number(option.quantity_per_purchase_unit ?? 0);
  const minPurchaseQuantity = Number(option.min_purchase_quantity ?? 1);
  const purchaseMultiple = Number(option.purchase_multiple ?? 1);

  let requestedPurchaseQuantity: number | null = null;
  let expectedInventoryQuantity: number | null = null;
  let expectedSurplusQuantity: number | null = null;
  let purchaseWarning: string | null = null;
  if (quantityPerPurchaseUnit > 0) {
    const rawPurchaseQty = requestedQuantity / quantityPerPurchaseUnit;
    const roundedPurchaseQty = Math.max(ceilToMultiple(rawPurchaseQty, purchaseMultiple), minPurchaseQuantity);
    requestedPurchaseQuantity = round4(roundedPurchaseQty);
    expectedInventoryQuantity = round4(roundedPurchaseQty * quantityPerPurchaseUnit);
    expectedSurplusQuantity = round4(Math.max(expectedInventoryQuantity - requestedQuantity, 0));
  } else {
    purchaseWarning = "Sin opción de compra configurada";
  }

  const supplierId = option.supplier_id ?? item.default_supplier_id ?? null;
  const { data: currentSupplierPrice, error: currentSupplierPriceError } = await supabase
    .from("kitchen_inventory_supplier_prices")
    .select("id,price_per_purchase_unit")
    .eq("tenant_id", tenant.tenantId)
    .eq("item_id", line.item_id)
    .eq("is_current", true)
    .eq("purchase_option_id", option.id)
    .limit(1)
    .maybeSingle();
  if (currentSupplierPriceError) throw new Error(`No se pudo validar precio proveedor actual: ${currentSupplierPriceError.message}`);

  const fallbackUnitCost = Number(line.estimated_unit_cost ?? 0);
  const preliminaryUnitPrice =
    currentSupplierPrice != null ? Number(currentSupplierPrice.price_per_purchase_unit ?? 0) : fallbackUnitCost;
  const preliminaryTotalCost =
    requestedPurchaseQuantity != null ? round4(requestedPurchaseQuantity * preliminaryUnitPrice) : round4(requestedQuantity * fallbackUnitCost);
  const priceSource = currentSupplierPrice != null ? "supplier_price_current" : "estimated_fallback";
  if (!currentSupplierPrice) {
    purchaseWarning = purchaseWarning ?? "Sin precio proveedor actual; se usó costo estimado.";
  }

  const { error: updateLineError } = await supabase
    .from("event_catering_requisition_lines")
    .update({
      purchase_option_id: option.id,
      supplier_id: supplierId,
      purchase_unit_id: option.purchase_unit_id,
      requested_purchase_quantity: requestedPurchaseQuantity,
      expected_inventory_quantity: expectedInventoryQuantity,
      expected_surplus_quantity: expectedSurplusQuantity,
      supplier_price_id: currentSupplierPrice?.id ?? null,
      preliminary_unit_price: preliminaryUnitPrice,
      preliminary_total_cost: preliminaryTotalCost,
      price_source: priceSource,
      purchase_warning: purchaseWarning,
      notes: `purchase-option-updated:${new Date().toISOString()}`,
    })
    .eq("tenant_id", tenant.tenantId)
    .eq("requisition_id", requisition.id)
    .eq("id", line.id);
  if (updateLineError) throw new Error(`No se pudo actualizar presentación de línea: ${updateLineError.message}`);

  await recalculateRequisitionTotal(supabase, tenant.tenantId, requisition.id);

  revalidateCateringPaths(tenant.tenantSlug);
  revalidatePath(`/${tenant.tenantSlug}/kitchen/events/requisitions`);
  revalidatePath(`/${tenant.tenantSlug}/kitchen/events/requisitions/${requisition.id}`);
}

export async function markCateringRequisitionReviewedAction(formData: FormData): Promise<void> {
  const tenantSlug = toText(formData.get("tenantSlug")).toLowerCase();
  const requisitionId = toText(formData.get("requisitionId"));
  if (!tenantSlug || !requisitionId) throw new Error("Tenant y requisición son obligatorios.");

  const { tenant } = await resolveTenantModulePageActor(tenantSlug, "event_catering", "requisitions", "manage");
  const supabase = await getSupabaseServerClient();

  const { data: requisition, error: reqError } = await supabase
    .from("event_catering_requisitions")
    .select("id,status,plan_id,event_catering_plans:event_catering_plans!event_catering_requisitions_tenant_plan_fkey(event_id)")
    .eq("tenant_id", tenant.tenantId)
    .eq("id", requisitionId)
    .maybeSingle();
  if (reqError || !requisition) throw new Error("Requisición inválida para el tenant.");
  if (requisition.status !== "draft") throw new Error("Solo se puede marcar revisada desde estado draft.");

  const { error: updateError } = await supabase
    .from("event_catering_requisitions")
    .update({
      status: "reviewed",
      notes: `Marcada como reviewed ${new Date().toISOString()}`,
    })
    .eq("tenant_id", tenant.tenantId)
    .eq("id", requisition.id);
  if (updateError) throw new Error(`No se pudo actualizar estatus a reviewed: ${updateError.message}`);

  revalidateCateringPaths(tenant.tenantSlug);
  revalidatePath(`/${tenant.tenantSlug}/kitchen/events/requisitions`);
  revalidatePath(`/${tenant.tenantSlug}/kitchen/events/requisitions/${requisition.id}`);
}

export async function approveCateringRequisitionAction(formData: FormData): Promise<void> {
  const tenantSlug = toText(formData.get("tenantSlug")).toLowerCase();
  const requisitionId = toText(formData.get("requisitionId"));
  if (!tenantSlug || !requisitionId) throw new Error("Tenant y requisición son obligatorios.");

  const { tenant } = await resolveTenantModulePageActor(tenantSlug, "event_catering", "requisitions", "manage");
  const supabase = await getSupabaseServerClient();

  const { data: requisition, error: reqError } = await supabase
    .from("event_catering_requisitions")
    .select("id,status,plan_id,event_catering_plans:event_catering_plans!event_catering_requisitions_tenant_plan_fkey(event_id)")
    .eq("tenant_id", tenant.tenantId)
    .eq("id", requisitionId)
    .maybeSingle();
  if (reqError || !requisition) throw new Error("Requisición inválida para el tenant.");
  if (requisition.status !== "reviewed") throw new Error("Solo se puede aprobar desde estado reviewed.");

  const { data: lines, error: linesError } = await supabase
    .from("event_catering_requisition_lines")
    .select("id,requested_quantity,requested_purchase_quantity,quoted_unit_price,preliminary_unit_price,estimated_unit_cost")
    .eq("tenant_id", tenant.tenantId)
    .eq("requisition_id", requisition.id);
  if (linesError) throw new Error(`No se pudieron cargar líneas para aprobar precios: ${linesError.message}`);

  if ((lines ?? []).length > 0) {
    const updates = (lines ?? []).map((line) => {
      const approvedUnitPrice = Number(
        line.quoted_unit_price ?? line.preliminary_unit_price ?? line.estimated_unit_cost ?? 0,
      );
      const quantityBase = Number(line.requested_purchase_quantity ?? line.requested_quantity ?? 0);
      return {
        id: line.id,
        approved_unit_price: approvedUnitPrice,
        approved_total_cost: round4(quantityBase * approvedUnitPrice),
      };
    });
    for (const patch of updates) {
      const { error: lineUpdateError } = await supabase
        .from("event_catering_requisition_lines")
        .update({
          approved_unit_price: patch.approved_unit_price,
          approved_total_cost: patch.approved_total_cost,
        })
        .eq("tenant_id", tenant.tenantId)
        .eq("requisition_id", requisition.id)
        .eq("id", patch.id);
      if (lineUpdateError) {
        throw new Error(`No se pudo aprobar precio de línea: ${lineUpdateError.message}`);
      }
    }
  }

  const { error: updateError } = await supabase
    .from("event_catering_requisitions")
    .update({
      status: "approved",
      notes: `Aprobada ${new Date().toISOString()} (no descuenta inventario)`,
    })
    .eq("tenant_id", tenant.tenantId)
    .eq("id", requisition.id);
  if (updateError) throw new Error(`No se pudo aprobar requisición: ${updateError.message}`);

  await recalculateRequisitionTotal(supabase, tenant.tenantId, requisition.id);

  const { data: plan, error: planError } = await supabase
    .from("event_catering_plans")
    .select("id,status")
    .eq("tenant_id", tenant.tenantId)
    .eq("id", requisition.plan_id)
    .maybeSingle();
  if (planError || !plan) throw new Error("No se pudo validar plan de catering asociado a la requisición.");

  if (plan.status === "draft") {
    const { error: planUpdateError } = await supabase
      .from("event_catering_plans")
      .update({
        status: "planned",
        notes: `Plan marcado como planned por aprobación de requisición ${requisition.id}.`,
      })
      .eq("tenant_id", tenant.tenantId)
      .eq("id", plan.id)
      .eq("status", "draft");
    if (planUpdateError) {
      throw new Error(`No se pudo actualizar plan a planned tras aprobar requisición: ${planUpdateError.message}`);
    }
  }

  revalidateCateringPaths(tenant.tenantSlug);
  revalidatePath(`/${tenant.tenantSlug}/kitchen/events/requisitions`);
  revalidatePath(`/${tenant.tenantSlug}/kitchen/events/requisitions/${requisition.id}`);
}

export async function updateCateringRequisitionLineQuoteAction(formData: FormData): Promise<void> {
  const tenantSlug = toText(formData.get("tenantSlug")).toLowerCase();
  const requisitionId = toText(formData.get("requisitionId"));
  const lineId = toText(formData.get("lineId"));
  const quotedUnitPrice = toPositiveCateringNumber(toText(formData.get("quotedUnitPrice")), "Precio cotizado");
  const supplierId = toText(formData.get("supplierId"));
  const notes = toText(formData.get("notes"));
  if (!tenantSlug || !requisitionId || !lineId) throw new Error("Datos incompletos para cotizar línea.");

  const { tenant, user } = await resolveTenantModulePageActor(tenantSlug, "event_catering", "requisitions", "manage");
  const supabase = await getSupabaseServerClient();

  const { data: requisition, error: requisitionError } = await supabase
    .from("event_catering_requisitions")
    .select("id,status,plan_id,event_catering_plans:event_catering_plans!event_catering_requisitions_tenant_plan_fkey(event_id)")
    .eq("tenant_id", tenant.tenantId)
    .eq("id", requisitionId)
    .maybeSingle();
  if (requisitionError || !requisition) throw new Error("Requisición inválida para el tenant.");
  if (requisition.status !== "draft" && requisition.status !== "reviewed") {
    throw new Error("Solo se puede cotizar cuando la requisición está en draft o reviewed.");
  }

  const { data: line, error: lineError } = await supabase
    .from("event_catering_requisition_lines")
    .select("id,requested_quantity,requested_purchase_quantity")
    .eq("tenant_id", tenant.tenantId)
    .eq("requisition_id", requisition.id)
    .eq("id", lineId)
    .maybeSingle();
  if (lineError || !line) throw new Error("Línea inválida para la requisición.");

  if (supplierId) {
    const { data: supplierRow, error: supplierError } = await supabase
      .from("kitchen_inventory_suppliers")
      .select("id")
      .eq("tenant_id", tenant.tenantId)
      .eq("id", supplierId)
      .maybeSingle();
    if (supplierError || !supplierRow) throw new Error("Proveedor inválido para el tenant.");
  }

  const quantityBase = Number(line.requested_purchase_quantity ?? line.requested_quantity ?? 0);
  const quotedTotalCost = round4(quantityBase * quotedUnitPrice);
  const { error: updateLineError } = await supabase
    .from("event_catering_requisition_lines")
    .update({
      quoted_unit_price: quotedUnitPrice,
      quoted_total_cost: quotedTotalCost,
      quoted_at: new Date().toISOString(),
      quoted_by: user.id,
      supplier_id: supplierId || null,
      notes: notes || null,
      price_source: "quoted_manual",
    })
    .eq("tenant_id", tenant.tenantId)
    .eq("requisition_id", requisition.id)
    .eq("id", line.id);
  if (updateLineError) throw new Error(`No se pudo actualizar cotización de línea: ${updateLineError.message}`);

  await recalculateRequisitionTotal(supabase, tenant.tenantId, requisition.id);

  revalidateCateringPaths(tenant.tenantSlug);
  revalidatePath(`/${tenant.tenantSlug}/kitchen/events/requisitions`);
  revalidatePath(`/${tenant.tenantSlug}/kitchen/events/requisitions/${requisition.id}`);
}

export async function refreshCateringRequisitionQuotedPricesAction(formData: FormData): Promise<void> {
  const tenantSlug = toText(formData.get("tenantSlug")).toLowerCase();
  const requisitionId = toText(formData.get("requisitionId"));
  if (!tenantSlug || !requisitionId) throw new Error("Tenant y requisición son obligatorios.");

  const { tenant, user } = await resolveTenantModulePageActor(tenantSlug, "event_catering", "requisitions", "manage");
  const supabase = await getSupabaseServerClient();

  const { data: requisition, error: requisitionError } = await supabase
    .from("event_catering_requisitions")
    .select("id,status")
    .eq("tenant_id", tenant.tenantId)
    .eq("id", requisitionId)
    .maybeSingle();
  if (requisitionError || !requisition) throw new Error("Requisición inválida para el tenant.");
  if (requisition.status !== "draft" && requisition.status !== "reviewed") {
    throw new Error("Solo se puede actualizar cotización en requisiciones draft o reviewed.");
  }

  const { data: lines, error: linesError } = await supabase
    .from("event_catering_requisition_lines")
    .select("id,requested_quantity,requested_purchase_quantity,preliminary_unit_price,estimated_unit_cost")
    .eq("tenant_id", tenant.tenantId)
    .eq("requisition_id", requisition.id);
  if (linesError) throw new Error(`No se pudieron cargar líneas para actualizar cotización: ${linesError.message}`);

  const quotedAt = new Date().toISOString();
  for (const line of lines ?? []) {
    const quantityBase = Number(line.requested_purchase_quantity ?? line.requested_quantity ?? 0);
    const overrideRaw = toText(formData.get(`quotedUnitPrice:${line.id}`));
    const overrideValue = overrideRaw ? Number(overrideRaw) : Number.NaN;
    const quotedUnitPrice = Number.isFinite(overrideValue) && overrideValue >= 0
      ? round4(overrideValue)
      : Number(line.preliminary_unit_price ?? line.estimated_unit_cost ?? 0);
    const quotedTotalCost = round4(quantityBase * quotedUnitPrice);
    const { error: updateLineError } = await supabase
      .from("event_catering_requisition_lines")
      .update({
        quoted_unit_price: quotedUnitPrice,
        quoted_total_cost: quotedTotalCost,
        quoted_at: quotedAt,
        quoted_by: user.id,
        price_source: "quoted_bulk_refresh",
        notes: `quoted-bulk-refresh:${quotedAt}`,
      })
      .eq("tenant_id", tenant.tenantId)
      .eq("requisition_id", requisition.id)
      .eq("id", line.id);
    if (updateLineError) throw new Error(`No se pudo actualizar cotización de línea: ${updateLineError.message}`);
  }

  await recalculateRequisitionTotal(supabase, tenant.tenantId, requisition.id);

  revalidateCateringPaths(tenant.tenantSlug);
  revalidatePath(`/${tenant.tenantSlug}/kitchen/events/requisitions`);
  revalidatePath(`/${tenant.tenantSlug}/kitchen/events/requisitions/${requisition.id}`);
}

export async function updateCateringRequisitionLineSupplierAction(formData: FormData): Promise<void> {
  const tenantSlug = toText(formData.get("tenantSlug")).toLowerCase();
  const requisitionId = toText(formData.get("requisitionId"));
  const lineId = toText(formData.get("lineId"));
  const supplierId = toText(formData.get("supplierId"));
  if (!tenantSlug || !requisitionId || !lineId) throw new Error("Datos incompletos para actualizar proveedor.");

  const { tenant } = await resolveTenantModulePageActor(tenantSlug, "event_catering", "requisitions", "manage");
  const supabase = await getSupabaseServerClient();

  const { data: requisition, error: requisitionError } = await supabase
    .from("event_catering_requisitions")
    .select("id,status,plan_id,event_catering_plans:event_catering_plans!event_catering_requisitions_tenant_plan_fkey(event_id)")
    .eq("tenant_id", tenant.tenantId)
    .eq("id", requisitionId)
    .maybeSingle();
  if (requisitionError || !requisition) throw new Error("Requisición inválida para el tenant.");
  if (requisition.status !== "draft" && requisition.status !== "reviewed") {
    throw new Error("Solo se puede actualizar proveedor en draft o reviewed.");
  }

  if (supplierId) {
    const { data: supplierRow, error: supplierError } = await supabase
      .from("kitchen_inventory_suppliers")
      .select("id")
      .eq("tenant_id", tenant.tenantId)
      .eq("id", supplierId)
      .maybeSingle();
    if (supplierError || !supplierRow) throw new Error("Proveedor inválido para el tenant.");
  }

  const { error: updateLineError } = await supabase
    .from("event_catering_requisition_lines")
    .update({ supplier_id: supplierId || null })
    .eq("tenant_id", tenant.tenantId)
    .eq("requisition_id", requisition.id)
    .eq("id", lineId);
  if (updateLineError) throw new Error(`No se pudo actualizar proveedor de línea: ${updateLineError.message}`);

  await recalculateRequisitionTotal(supabase, tenant.tenantId, requisition.id);

  revalidateCateringPaths(tenant.tenantSlug);
  revalidatePath(`/${tenant.tenantSlug}/kitchen/events/requisitions`);
  revalidatePath(`/${tenant.tenantSlug}/kitchen/events/requisitions/${requisition.id}`);
}

export async function createPurchaseReceiptFromRequisitionAction(formData: FormData): Promise<void> {
  const tenantSlug = toText(formData.get("tenantSlug")).toLowerCase();
  const requisitionId = toText(formData.get("requisitionId"));
  if (!tenantSlug || !requisitionId) throw new Error("Tenant y requisición son obligatorios.");

  const { tenant, user } = await resolveTenantModulePageActor(tenantSlug, "event_catering", "requisitions", "manage");
  const supabase = await getSupabaseServerClient();
  const { data: requisition, error: reqError } = await supabase
    .from("event_catering_requisitions")
    .select("id,status,plan_id,event_catering_plans:event_catering_plans!event_catering_requisitions_tenant_plan_fkey(event_id)")
    .eq("tenant_id", tenant.tenantId)
    .eq("id", requisitionId)
    .maybeSingle();
  if (reqError || !requisition) throw new Error("Requisición inválida para el tenant.");
  if (requisition.status !== "approved") throw new Error("Solo se puede crear recepción desde requisiciones approved.");

  const { data: existingReceipts, error: existingReceiptsError } = await supabase
    .from("event_catering_purchase_receipts")
    .select("id,status")
    .eq("tenant_id", tenant.tenantId)
    .eq("requisition_id", requisition.id)
    .in("status", ["draft", "received"])
    .order("created_at", { ascending: false });
  if (existingReceiptsError) throw new Error(`No se pudo validar recepciones existentes: ${existingReceiptsError.message}`);
  const existingDraft = (existingReceipts ?? []).find((receipt) => receipt.status === "draft");
  const existingReceived = (existingReceipts ?? []).find((receipt) => receipt.status === "received");
  if (existingDraft) {
    throw new Error("Ya existe una recepción en borrador. Continúa esa recepción.");
  }
  if (existingReceived) {
    throw new Error("Esta requisición ya tiene una recepción confirmada. Para diferencias usa correcciones o flujo de recepción parcial cuando esté disponible.");
  }

  const [{ data: lines, error: linesError }, { data: locations, error: locationsError }] = await Promise.all([
    supabase
      .from("event_catering_requisition_lines")
      .select(
        "id,item_id,unit_id,supplier_id,requested_quantity,requested_purchase_quantity,expected_inventory_quantity,approved_unit_price,approved_total_cost,quoted_unit_price,quoted_total_cost,preliminary_unit_price,preliminary_total_cost,estimated_unit_cost,estimated_total_cost,purchase_unit_id",
      )
      .eq("tenant_id", tenant.tenantId)
      .eq("requisition_id", requisition.id),
    supabase
      .from("kitchen_inventory_locations")
      .select("id")
      .eq("tenant_id", tenant.tenantId)
      .eq("is_active", true)
      .order("created_at", { ascending: true })
      .limit(1),
  ]);
  if (linesError) throw new Error(`No se pudieron cargar líneas de requisición: ${linesError.message}`);
  if (!lines || lines.length === 0) throw new Error("La requisición no tiene líneas para recibir.");
  if (locationsError || !locations || locations.length === 0) {
    throw new Error("No hay ubicación de inventario activa para recibir compra.");
  }
  const defaultLocationId = locations[0].id;

  const invalidLine = lines.find((line) => {
    const requestedQuantity = Number(line.requested_quantity ?? 0);
    const expectedInventoryQuantity = Number(line.expected_inventory_quantity ?? requestedQuantity);
    const lineExpectedTotal = resolveLineBestTotal(line);
    const fallbackUnitPrice = resolveLineBestUnitPrice(line);
    const fallbackPurchaseQuantity = Number(line.requested_purchase_quantity ?? 0);
    const fallbackTotal = fallbackPurchaseQuantity > 0 ? fallbackPurchaseQuantity * fallbackUnitPrice : 0;
    return !line.item_id || !line.unit_id || requestedQuantity <= 0 || expectedInventoryQuantity <= 0 || Math.max(lineExpectedTotal, fallbackTotal) <= 0;
  });
  if (invalidLine) {
    throw new Error("La requisición tiene líneas sin insumo, unidad, cantidad recibible o precio válido. Corrige la requisición antes de crear recepción.");
  }

  const receiptLines = lines.map((line) => {
    const receivedQuantity = Number(line.expected_inventory_quantity ?? line.requested_quantity ?? 0);
    const explicitLineTotal = resolveLineBestTotal(line);
    const fallbackUnitPrice = resolveLineBestUnitPrice(line);
    const purchaseQuantityBase = Number(line.requested_purchase_quantity ?? 0);
    const fallbackLineTotal = purchaseQuantityBase > 0 ? purchaseQuantityBase * fallbackUnitPrice : 0;
    const lineExpectedTotal = round4(explicitLineTotal > 0 ? explicitLineTotal : fallbackLineTotal);
    const derivedInventoryUnitCost = round4(lineExpectedTotal / receivedQuantity);
    return {
      tenant_id: tenant.tenantId,
      receipt_id: "",
      requisition_line_id: line.id,
      item_id: line.item_id,
      location_id: defaultLocationId,
      unit_id: line.unit_id,
      received_quantity: round4(receivedQuantity),
      received_unit_cost: derivedInventoryUnitCost,
      received_total_cost: lineExpectedTotal,
      purchase_unit_id: line.purchase_unit_id ?? null,
      received_purchase_quantity: line.requested_purchase_quantity ?? null,
      expected_inventory_quantity: line.expected_inventory_quantity ?? null,
      variance_quantity:
        line.expected_inventory_quantity == null ? null : round4(receivedQuantity - Number(line.expected_inventory_quantity)),
      notes: `source_requisition_line:${line.id}`,
      created_by: user.id,
    };
  });
  const receiptTotal = round4(
    receiptLines.reduce((acc, line) => acc + Number(line.received_total_cost ?? 0), 0),
  );
  if (receiptLines.length === 0 || receiptTotal <= 0) {
    throw new Error("La recepción esperada no tiene líneas o total válido mayor a 0.");
  }

  const uniqueSupplierIds = Array.from(
    new Set(
      lines
        .map((line) => line.supplier_id)
        .filter((supplierId): supplierId is string => supplierId != null),
    ),
  );
  const receiptSupplierId = uniqueSupplierIds.length === 1 ? uniqueSupplierIds[0] : null;
  const { data: receipt, error: createReceiptError } = await supabase
    .from("event_catering_purchase_receipts")
    .insert({
      tenant_id: tenant.tenantId,
      requisition_id: requisition.id,
      supplier_id: receiptSupplierId,
      status: "draft",
      total_received_cost: receiptTotal,
      notes:
        uniqueSupplierIds.length > 1
          ? `Recepción multi-proveedor creada desde requisición ${requisition.id}`
          : `Recepción creada desde requisición ${requisition.id}`,
      created_by: user.id,
    })
    .select("id")
    .single();
  if (createReceiptError || !receipt) {
    throw new Error(`No se pudo crear recepción: ${createReceiptError?.message ?? "error"}`);
  }

  const receiptLinesToInsert = receiptLines.map((line) => ({ ...line, receipt_id: receipt.id }));
  const { error: insertLinesError } = await supabase.from("event_catering_purchase_receipt_lines").insert(receiptLinesToInsert);
  if (insertLinesError) {
    await supabase
      .from("event_catering_purchase_receipts")
      .update({
        status: "canceled",
        notes: `auto_canceled_failed_line_creation:${new Date().toISOString()}:${insertLinesError.message}`,
      })
      .eq("tenant_id", tenant.tenantId)
      .eq("id", receipt.id)
      .eq("status", "draft");
    throw new Error(`No se pudieron crear líneas de recepción: ${insertLinesError.message}`);
  }

  const eventId = resolveEmbeddedEventId(requisition.event_catering_plans);
  revalidateCateringPaths(tenant.tenantSlug, eventId, requisition.plan_id);
  revalidatePath(`/${tenant.tenantSlug}/kitchen/events/requisitions`);
  revalidatePath(`/${tenant.tenantSlug}/kitchen/events/requisitions/${requisition.id}`);
  revalidatePath(`/${tenant.tenantSlug}/kitchen/events/requisitions/${requisition.id}/receipts/${receipt.id}`);
}

export async function updatePurchaseReceiptLineAction(formData: FormData): Promise<void> {
  const tenantSlug = toText(formData.get("tenantSlug")).toLowerCase();
  const receiptId = toText(formData.get("receiptId"));
  const lineId = toText(formData.get("lineId"));
  const locationId = toText(formData.get("locationId"));
  const receivedQuantityRaw = toText(formData.get("receivedQuantity"));
  const receivedUnitCostRaw = toText(formData.get("receivedUnitCost"));
  const receivedPurchaseQuantityRaw = toText(formData.get("receivedPurchaseQuantity"));
  if (!tenantSlug || !receiptId || !lineId || !locationId) throw new Error("Datos incompletos para actualizar línea de recepción.");

  const { tenant } = await resolveTenantModulePageActor(tenantSlug, "event_catering", "requisitions", "manage");
  const supabase = await getSupabaseServerClient();
  const { data: receipt, error: receiptError } = await supabase
    .from("event_catering_purchase_receipts")
    .select("id,status,requisition_id")
    .eq("tenant_id", tenant.tenantId)
    .eq("id", receiptId)
    .maybeSingle();
  if (receiptError || !receipt) throw new Error("Recepción inválida para el tenant.");
  if (receipt.status !== "draft") throw new Error("Solo se pueden editar recepciones en draft.");

  const [{ data: location, error: locationError }, { data: line, error: lineError }] = await Promise.all([
    supabase
      .from("kitchen_inventory_locations")
      .select("id")
      .eq("tenant_id", tenant.tenantId)
      .eq("id", locationId)
      .maybeSingle(),
    supabase
      .from("event_catering_purchase_receipt_lines")
      .select("id,expected_inventory_quantity,requisition_line_id")
      .eq("tenant_id", tenant.tenantId)
      .eq("receipt_id", receipt.id)
      .eq("id", lineId)
      .maybeSingle(),
  ]);
  if (locationError || !location) throw new Error("Ubicación inválida para el tenant.");
  if (lineError || !line) throw new Error("Línea de recepción inválida.");

  let receivedQuantity: number | null = null;
  let receivedUnitCost: number | null = null;
  let receivedTotalCost: number | null = null;
  let receivedPurchaseQuantity: number | null = null;

  if (receivedPurchaseQuantityRaw) {
    receivedPurchaseQuantity = toPositiveCateringNumber(receivedPurchaseQuantityRaw, "Cantidad recibida de compra");
    const { data: requisitionLine, error: requisitionLineError } = await supabase
      .from("event_catering_requisition_lines")
      .select(
        "id,requested_purchase_quantity,expected_inventory_quantity,approved_unit_price,quoted_unit_price,preliminary_unit_price,estimated_unit_cost",
      )
      .eq("tenant_id", tenant.tenantId)
      .eq("id", line.requisition_line_id)
      .maybeSingle();
    if (requisitionLineError || !requisitionLine) {
      throw new Error("No se pudo resolver referencia de compra para la línea de recepción.");
    }

    const purchaseUnitPrice = Number(
      requisitionLine.approved_unit_price ??
      requisitionLine.quoted_unit_price ??
      requisitionLine.preliminary_unit_price ??
      requisitionLine.estimated_unit_cost ??
      0,
    );
    const requestedPurchaseQuantity = Number(requisitionLine.requested_purchase_quantity ?? 0);
    const expectedInventoryQuantity = Number(requisitionLine.expected_inventory_quantity ?? 0);
    if (requestedPurchaseQuantity <= 0 || expectedInventoryQuantity <= 0) {
      throw new Error("No se puede convertir cantidad de compra a inventario para esta línea.");
    }

    const inventoryPerPurchaseUnit = expectedInventoryQuantity / requestedPurchaseQuantity;
    receivedQuantity = round4(receivedPurchaseQuantity * inventoryPerPurchaseUnit);
    receivedTotalCost = round4(receivedPurchaseQuantity * purchaseUnitPrice);
    receivedUnitCost = receivedQuantity > 0 ? round4(receivedTotalCost / receivedQuantity) : 0;
  } else {
    receivedQuantity = toPositiveCateringNumber(receivedQuantityRaw, "Cantidad recibida");
    receivedUnitCost = toPositiveCateringNumber(receivedUnitCostRaw, "Costo unitario recibido");
    receivedTotalCost = round4(receivedQuantity * receivedUnitCost);
  }

  const varianceQuantity =
    line.expected_inventory_quantity == null
      ? null
      : round4(receivedQuantity - Number(line.expected_inventory_quantity));
  const { error: updateLineError } = await supabase
    .from("event_catering_purchase_receipt_lines")
    .update({
      location_id: locationId,
      received_quantity: receivedQuantity,
      received_unit_cost: receivedUnitCost,
      received_total_cost: receivedTotalCost,
      received_purchase_quantity: receivedPurchaseQuantity,
      variance_quantity: varianceQuantity,
    })
    .eq("tenant_id", tenant.tenantId)
    .eq("receipt_id", receipt.id)
    .eq("id", line.id);
  if (updateLineError) throw new Error(`No se pudo actualizar línea de recepción: ${updateLineError.message}`);

  const { data: allLines, error: allLinesError } = await supabase
    .from("event_catering_purchase_receipt_lines")
    .select("received_total_cost")
    .eq("tenant_id", tenant.tenantId)
    .eq("receipt_id", receipt.id);
  if (allLinesError) throw new Error(`No se pudo recalcular total de recepción: ${allLinesError.message}`);
  const totalReceivedCost = round4((allLines ?? []).reduce((acc, row) => acc + Number(row.received_total_cost ?? 0), 0));

  const { error: updateReceiptError } = await supabase
    .from("event_catering_purchase_receipts")
    .update({ total_received_cost: totalReceivedCost })
    .eq("tenant_id", tenant.tenantId)
    .eq("id", receipt.id);
  if (updateReceiptError) throw new Error(`No se pudo actualizar total de recepción: ${updateReceiptError.message}`);

  revalidatePath(`/${tenant.tenantSlug}/kitchen/events/requisitions/${receipt.requisition_id}`);
  revalidatePath(`/${tenant.tenantSlug}/kitchen/events/requisitions/${receipt.requisition_id}/receipts/${receipt.id}`);
}

export async function updatePurchaseReceiptLinesBulkAction(formData: FormData): Promise<void> {
  const tenantSlug = toText(formData.get("tenantSlug")).toLowerCase();
  const receiptId = toText(formData.get("receiptId"));
  if (!tenantSlug || !receiptId) throw new Error("Tenant y recepción son obligatorios.");

  const { tenant } = await resolveTenantModulePageActor(tenantSlug, "event_catering", "requisitions", "manage");
  const supabase = await getSupabaseServerClient();
  const { data: receipt, error: receiptError } = await supabase
    .from("event_catering_purchase_receipts")
    .select("id,status,requisition_id")
    .eq("tenant_id", tenant.tenantId)
    .eq("id", receiptId)
    .maybeSingle();
  if (receiptError || !receipt) throw new Error("Recepción inválida para el tenant.");
  if (receipt.status !== "draft") throw new Error("Solo se pueden editar recepciones en draft.");

  const { data: lines, error: linesError } = await supabase
    .from("event_catering_purchase_receipt_lines")
    .select("id,requisition_line_id,expected_inventory_quantity")
    .eq("tenant_id", tenant.tenantId)
    .eq("receipt_id", receipt.id);
  if (linesError) throw new Error(`No se pudieron cargar líneas de recepción: ${linesError.message}`);
  if (!lines || lines.length === 0) throw new Error("La recepción no tiene líneas para actualizar.");

  const requisitionLineIds = [...new Set(lines.map((line) => line.requisition_line_id))];
  const { data: requisitionLines, error: requisitionLinesError } = await supabase
    .from("event_catering_requisition_lines")
    .select(
      "id,requested_purchase_quantity,expected_inventory_quantity,approved_unit_price,quoted_unit_price,preliminary_unit_price,estimated_unit_cost",
    )
    .eq("tenant_id", tenant.tenantId)
    .in("id", requisitionLineIds);
  if (requisitionLinesError) {
    throw new Error(`No se pudieron cargar referencias de requisición: ${requisitionLinesError.message}`);
  }
  const requisitionLineById = new Map((requisitionLines ?? []).map((row) => [row.id, row]));

  const allLocationIds = Array.from(
    new Set(
      Array.from(formData.keys())
        .filter((key) => key.startsWith("locationId:"))
        .map((key) => toText(formData.get(key)))
        .filter(Boolean),
    ),
  );
  if (allLocationIds.length > 0) {
    const { data: validLocations, error: locationsError } = await supabase
      .from("kitchen_inventory_locations")
      .select("id")
      .eq("tenant_id", tenant.tenantId)
      .in("id", allLocationIds);
    if (locationsError) throw new Error(`No se pudieron validar ubicaciones: ${locationsError.message}`);
    const validLocationIds = new Set((validLocations ?? []).map((row) => row.id));
    for (const locationId of allLocationIds) {
      if (!validLocationIds.has(locationId)) throw new Error("Ubicación inválida para el tenant.");
    }
  }

  for (const line of lines) {
    const receivedPurchaseQuantityRaw = toText(formData.get(`receivedPurchaseQuantity:${line.id}`));
    const locationId = toText(formData.get(`locationId:${line.id}`));
    if (!receivedPurchaseQuantityRaw || !locationId) continue;

    const receivedPurchaseQuantity = toPositiveCateringNumber(receivedPurchaseQuantityRaw, "Cantidad recibida de compra");
    const requisitionLine = requisitionLineById.get(line.requisition_line_id);
    if (!requisitionLine) {
      throw new Error("No se pudo resolver referencia de compra para la línea de recepción.");
    }
    const purchaseUnitPrice = Number(
      requisitionLine.approved_unit_price ??
        requisitionLine.quoted_unit_price ??
        requisitionLine.preliminary_unit_price ??
        requisitionLine.estimated_unit_cost ??
        0,
    );
    const requestedPurchaseQuantity = Number(requisitionLine.requested_purchase_quantity ?? 0);
    const expectedInventoryQuantity = Number(requisitionLine.expected_inventory_quantity ?? 0);
    if (requestedPurchaseQuantity <= 0 || expectedInventoryQuantity <= 0) {
      throw new Error("No se puede convertir cantidad de compra a inventario para una línea.");
    }
    const inventoryPerPurchaseUnit = expectedInventoryQuantity / requestedPurchaseQuantity;
    const receivedQuantity = round4(receivedPurchaseQuantity * inventoryPerPurchaseUnit);
    const receivedTotalCost = round4(receivedPurchaseQuantity * purchaseUnitPrice);
    const receivedUnitCost = receivedQuantity > 0 ? round4(receivedTotalCost / receivedQuantity) : 0;
    const varianceQuantity =
      line.expected_inventory_quantity == null
        ? null
        : round4(receivedQuantity - Number(line.expected_inventory_quantity));

    const { error: updateLineError } = await supabase
      .from("event_catering_purchase_receipt_lines")
      .update({
        location_id: locationId,
        received_quantity: receivedQuantity,
        received_unit_cost: receivedUnitCost,
        received_total_cost: receivedTotalCost,
        received_purchase_quantity: receivedPurchaseQuantity,
        variance_quantity: varianceQuantity,
      })
      .eq("tenant_id", tenant.tenantId)
      .eq("receipt_id", receipt.id)
      .eq("id", line.id);
    if (updateLineError) throw new Error(`No se pudo actualizar línea de recepción: ${updateLineError.message}`);
  }

  const { data: allLines, error: allLinesError } = await supabase
    .from("event_catering_purchase_receipt_lines")
    .select("received_total_cost")
    .eq("tenant_id", tenant.tenantId)
    .eq("receipt_id", receipt.id);
  if (allLinesError) throw new Error(`No se pudo recalcular total de recepción: ${allLinesError.message}`);
  const totalReceivedCost = round4((allLines ?? []).reduce((acc, row) => acc + Number(row.received_total_cost ?? 0), 0));

  const { error: updateReceiptError } = await supabase
    .from("event_catering_purchase_receipts")
    .update({ total_received_cost: totalReceivedCost })
    .eq("tenant_id", tenant.tenantId)
    .eq("id", receipt.id);
  if (updateReceiptError) throw new Error(`No se pudo actualizar total de recepción: ${updateReceiptError.message}`);

  revalidatePath(`/${tenant.tenantSlug}/kitchen/events/requisitions/${receipt.requisition_id}`);
  revalidatePath(`/${tenant.tenantSlug}/kitchen/events/requisitions/${receipt.requisition_id}/receipts/${receipt.id}`);
}

export async function markPurchaseReceiptReceivedAction(formData: FormData): Promise<void> {
  const tenantSlug = toText(formData.get("tenantSlug")).toLowerCase();
  const receiptId = toText(formData.get("receiptId"));
  if (!tenantSlug || !receiptId) throw new Error("Tenant y recepción son obligatorios.");

  const { tenant, user } = await resolveTenantModulePageActor(tenantSlug, "event_catering", "requisitions", "manage");
  const supabase = await getSupabaseServerClient();
  const { data: receipt, error: receiptError } = await supabase
    .from("event_catering_purchase_receipts")
    .select("id,status,requisition_id")
    .eq("tenant_id", tenant.tenantId)
    .eq("id", receiptId)
    .maybeSingle();
  if (receiptError || !receipt) throw new Error("Recepción inválida para el tenant.");
  if (receipt.status !== "draft") throw new Error("Solo se puede confirmar una recepción en draft.");

  const { data: requisition, error: requisitionError } = await supabase
    .from("event_catering_requisitions")
    .select("id,status,plan_id,event_catering_plans:event_catering_plans!event_catering_requisitions_tenant_plan_fkey(event_id)")
    .eq("tenant_id", tenant.tenantId)
    .eq("id", receipt.requisition_id)
    .maybeSingle();
  if (requisitionError || !requisition) throw new Error("La recepción referencia una requisición inválida.");
  if (requisition.status !== "approved") throw new Error("Solo se puede confirmar recepción contra requisiciones approved.");

  const { data: lines, error: linesError } = await supabase
    .from("event_catering_purchase_receipt_lines")
    .select("id,requisition_line_id,item_id,location_id,unit_id,received_quantity,received_unit_cost,inventory_movement_id,received_total_cost")
    .eq("tenant_id", tenant.tenantId)
    .eq("receipt_id", receipt.id)
    .order("created_at", { ascending: true });
  if (linesError) throw new Error(`No se pudieron cargar líneas de recepción: ${linesError.message}`);
  if (!lines || lines.length === 0) throw new Error("La recepción no tiene líneas.");

  for (const line of lines) {
    if (!line.item_id || !line.location_id || !line.unit_id || Number(line.received_quantity) <= 0) {
      throw new Error("Todas las líneas deben tener insumo, ubicación, unidad y cantidad recibida > 0.");
    }
  }

  for (const line of lines) {
    if (line.inventory_movement_id) continue;
    const idempotencyKey = `event-catering-receipt:${line.id}`;
    const { data: rpcData, error: rpcError } = await supabase.rpc("kitchen_inventory_record_movement", {
      p_tenant_id: tenant.tenantId,
      p_item_id: line.item_id,
      p_location_id: line.location_id,
      p_unit_id: line.unit_id,
      p_movement_type: "purchase",
      p_quantity: Number(line.received_quantity),
      p_unit_cost: Number(line.received_unit_cost ?? 0),
      p_reason: `Recepción de compra desde requisición ${requisition.id}`,
      p_source_type: "event",
      p_source_id: line.id,
      p_idempotency_key: idempotencyKey,
      p_occurred_at: new Date().toISOString(),
    });
    if (rpcError) throw new Error(`No se pudo registrar movimiento de recepción: ${rpcError.message}`);
    const movementId =
      Array.isArray(rpcData) && rpcData[0]?.movement_id ? String(rpcData[0].movement_id) : null;
    if (!movementId) throw new Error("La RPC no devolvió movement_id para una línea de recepción.");

    const { error: lineUpdateError } = await supabase
      .from("event_catering_purchase_receipt_lines")
      .update({ inventory_movement_id: movementId })
      .eq("tenant_id", tenant.tenantId)
      .eq("receipt_id", receipt.id)
      .eq("id", line.id);
    if (lineUpdateError) throw new Error(`No se pudo guardar movimiento de inventario en recepción: ${lineUpdateError.message}`);
  }

  const { data: refreshedLines, error: refreshedLinesError } = await supabase
    .from("event_catering_purchase_receipt_lines")
    .select("received_total_cost")
    .eq("tenant_id", tenant.tenantId)
    .eq("receipt_id", receipt.id);
  if (refreshedLinesError) throw new Error(`No se pudo recalcular total final de recepción: ${refreshedLinesError.message}`);
  const totalReceivedCost = round4(
    (refreshedLines ?? []).reduce((acc, row) => acc + Number(row.received_total_cost ?? 0), 0),
  );
  if (totalReceivedCost <= 0) {
    throw new Error("La recepción no tiene total recibido válido mayor a 0.");
  }

  const { error: updateReceiptError } = await supabase
    .from("event_catering_purchase_receipts")
    .update({
      status: "received",
      received_at: new Date().toISOString(),
      received_by: user.id,
      total_received_cost: totalReceivedCost,
    })
    .eq("tenant_id", tenant.tenantId)
    .eq("id", receipt.id)
    .eq("status", "draft");
  if (updateReceiptError) throw new Error(`No se pudo confirmar recepción: ${updateReceiptError.message}`);

  const eventId = resolveEmbeddedEventId(requisition.event_catering_plans) ?? null;
  if (eventId) {
    for (const line of lines) {
      await upsertReservedAllocationFromReceiptLine(supabase, {
        tenantId: tenant.tenantId,
        userId: user.id,
        eventId,
        planId: requisition.plan_id,
        requisitionId: requisition.id,
        receiptId: receipt.id,
        receiptLineId: line.id,
        requisitionLineId: line.requisition_line_id ?? null,
        itemId: line.item_id,
        locationId: line.location_id,
        unitId: line.unit_id,
        quantity: Number(line.received_quantity ?? 0),
      });
    }

    await syncPlanStockAllocationsFromRequirements(supabase, {
      tenantId: tenant.tenantId,
      userId: user.id,
      eventId,
      planId: requisition.plan_id,
    });
    await recalculateAndPersistCateringRequirements(supabase, {
      tenantId: tenant.tenantId,
      planId: requisition.plan_id,
      userId: user.id,
    });
  }

  const eventIdForRevalidate = resolveEmbeddedEventId(requisition.event_catering_plans);
  revalidateCateringPaths(tenant.tenantSlug, eventIdForRevalidate, requisition.plan_id);
  revalidatePath(`/${tenant.tenantSlug}/kitchen/events/requisitions`);
  revalidatePath(`/${tenant.tenantSlug}/kitchen/events/requisitions/${requisition.id}`);
  revalidatePath(`/${tenant.tenantSlug}/kitchen/events/requisitions/${requisition.id}/receipts/${receipt.id}`);
}

export async function cancelPurchaseReceiptAction(formData: FormData): Promise<void> {
  const tenantSlug = toText(formData.get("tenantSlug")).toLowerCase();
  const receiptId = toText(formData.get("receiptId"));
  if (!tenantSlug || !receiptId) throw new Error("Tenant y recepción son obligatorios.");

  const { tenant } = await resolveTenantModulePageActor(tenantSlug, "event_catering", "requisitions", "manage");
  const supabase = await getSupabaseServerClient();
  const { data: receipt, error: receiptError } = await supabase
    .from("event_catering_purchase_receipts")
    .select("id,status,requisition_id")
    .eq("tenant_id", tenant.tenantId)
    .eq("id", receiptId)
    .maybeSingle();
  if (receiptError || !receipt) throw new Error("Recepción inválida para el tenant.");
  if (receipt.status !== "draft") throw new Error("Solo se puede cancelar una recepción en draft.");

  const { error: updateError } = await supabase
    .from("event_catering_purchase_receipts")
    .update({
      status: "canceled",
      notes: `Recepción cancelada ${new Date().toISOString()}`,
    })
    .eq("tenant_id", tenant.tenantId)
    .eq("id", receipt.id);
  if (updateError) throw new Error(`No se pudo cancelar recepción: ${updateError.message}`);

  revalidatePath(`/${tenant.tenantSlug}/kitchen/events/requisitions`);
  revalidatePath(`/${tenant.tenantSlug}/kitchen/events/requisitions/${receipt.requisition_id}`);
  revalidatePath(`/${tenant.tenantSlug}/kitchen/events/requisitions/${receipt.requisition_id}/receipts/${receipt.id}`);
}

export async function createConsumptionDraftFromPlanAction(formData: FormData): Promise<void> {
  const tenantSlug = toText(formData.get("tenantSlug")).toLowerCase();
  const planId = toText(formData.get("planId"));
  if (!tenantSlug || !planId) throw new Error("Tenant y plan son obligatorios.");

  const { tenant, user } = await resolveTenantModulePageActor(tenantSlug, "event_catering", "consumption", "manage");
  const supabase = await getSupabaseServerClient();

  const { data: plan, error: planError } = await supabase
    .from("event_catering_plans")
    .select("id,event_id,status")
    .eq("tenant_id", tenant.tenantId)
    .eq("id", planId)
    .maybeSingle();
  if (planError || !plan) throw new Error("Plan inválido para el tenant.");
  if (plan.status === "canceled") throw new Error("No se puede crear consumo para un plan cancelado.");

  const { data: existingDraft, error: existingDraftError } = await supabase
    .from("event_catering_consumption_records")
    .select("id")
    .eq("tenant_id", tenant.tenantId)
    .eq("plan_id", plan.id)
    .eq("status", "draft")
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (existingDraftError) throw new Error(`No se pudo validar consumo draft existente: ${existingDraftError.message}`);
  if (existingDraft?.id) {
    revalidatePath(`/${tenant.tenantSlug}/kitchen/events/consumption`);
    revalidatePath(`/${tenant.tenantSlug}/kitchen/events/${plan.event_id}/catering/${plan.id}/consumption`);
    revalidatePath(`/${tenant.tenantSlug}/kitchen/events/${plan.event_id}/catering/${plan.id}/consumption/${existingDraft.id}`);
    throw new Error("Ya existe un consumo en borrador. Ábrelo o usa Regenerar propuesta.");
  }

  const { data: requirements, error: reqError } = await supabase
    .from("event_catering_requirements")
    .select("id,item_id,unit_id,required_quantity,available_quantity,estimated_unit_cost")
    .eq("tenant_id", tenant.tenantId)
    .eq("plan_id", plan.id);
  if (reqError) throw new Error(`No fue posible cargar requerimientos del plan: ${reqError.message}`);
  if (!requirements || requirements.length === 0) throw new Error("El plan no tiene requerimientos para generar consumo draft.");

  const { data: created, error: createError } = await supabase
    .from("event_catering_consumption_records")
    .insert({
      tenant_id: tenant.tenantId,
      plan_id: plan.id,
      event_id: plan.event_id,
      status: "draft",
      notes: `Consumo draft generado desde requirements del plan ${plan.id}`,
      created_by: user.id,
    })
    .select("id")
    .single();
  if (createError || !created) throw new Error(`No se pudo crear consumo draft: ${createError?.message ?? "error"}`);

  const rows = requirements.map((row) => {
    const plannedQuantity = Number(row.required_quantity ?? 0);
    const unitCost = Number(row.estimated_unit_cost ?? 0);
    return {
      tenant_id: tenant.tenantId,
      consumption_record_id: created.id,
      requirement_id: row.id,
      item_id: row.item_id,
      location_id: null,
      unit_id: row.unit_id,
      planned_quantity: round4(plannedQuantity),
      consumed_quantity: 0,
      waste_quantity: 0,
      leftover_quantity: 0,
      available_quantity: round4(Number(row.available_quantity ?? 0)),
      unit_cost: round4(unitCost),
      total_cost: 0,
      notes: null,
      created_by: user.id,
    };
  });
  const { error: insertLinesError } = await supabase.from("event_catering_consumption_lines").insert(rows);
  if (insertLinesError) throw new Error(`No se pudieron crear líneas de consumo draft: ${insertLinesError.message}`);

  revalidatePath(`/${tenant.tenantSlug}/kitchen/events/consumption`);
  revalidatePath(`/${tenant.tenantSlug}/kitchen/events/${plan.event_id}/catering/${plan.id}/consumption`);
  revalidatePath(`/${tenant.tenantSlug}/kitchen/events/${plan.event_id}/catering/${plan.id}/consumption/${created.id}`);
}

export async function regenerateConsumptionDraftFromPlanAction(formData: FormData): Promise<void> {
  const tenantSlug = toText(formData.get("tenantSlug")).toLowerCase();
  const planId = toText(formData.get("planId"));
  const confirmRegenerate = toText(formData.get("confirmRegenerate"));
  if (!tenantSlug || !planId) throw new Error("Tenant y plan son obligatorios.");
  if (confirmRegenerate !== "true") throw new Error("Debes confirmar regenerar propuesta.");

  const { tenant, user } = await resolveTenantModulePageActor(tenantSlug, "event_catering", "consumption", "manage");
  const supabase = await getSupabaseServerClient();
  const { data: plan, error: planError } = await supabase
    .from("event_catering_plans")
    .select("id,event_id,status")
    .eq("tenant_id", tenant.tenantId)
    .eq("id", planId)
    .maybeSingle();
  if (planError || !plan) throw new Error("Plan inválido para el tenant.");
  if (plan.status === "canceled") throw new Error("No se puede regenerar consumo para un plan cancelado.");

  const { data: draft, error: draftError } = await supabase
    .from("event_catering_consumption_records")
    .select("id,status")
    .eq("tenant_id", tenant.tenantId)
    .eq("plan_id", plan.id)
    .eq("status", "draft")
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (draftError) throw new Error(`No se pudo cargar consumo draft: ${draftError.message}`);
  if (!draft) throw new Error("No existe consumo en borrador para regenerar.");

  const { data: requirements, error: reqError } = await supabase
    .from("event_catering_requirements")
    .select("id,item_id,unit_id,required_quantity,available_quantity,estimated_unit_cost")
    .eq("tenant_id", tenant.tenantId)
    .eq("plan_id", plan.id);
  if (reqError) throw new Error(`No fue posible cargar requerimientos del plan: ${reqError.message}`);
  if (!requirements || requirements.length === 0) throw new Error("El plan no tiene requerimientos para regenerar consumo.");

  const { error: deleteLinesError } = await supabase
    .from("event_catering_consumption_lines")
    .delete()
    .eq("tenant_id", tenant.tenantId)
    .eq("consumption_record_id", draft.id);
  if (deleteLinesError) throw new Error(`No se pudieron borrar líneas anteriores de consumo: ${deleteLinesError.message}`);

  const rows = requirements.map((row) => {
    const plannedQuantity = Number(row.required_quantity ?? 0);
    const unitCost = Number(row.estimated_unit_cost ?? 0);
    return {
      tenant_id: tenant.tenantId,
      consumption_record_id: draft.id,
      requirement_id: row.id,
      item_id: row.item_id,
      location_id: null,
      unit_id: row.unit_id,
      planned_quantity: round4(plannedQuantity),
      consumed_quantity: 0,
      waste_quantity: 0,
      leftover_quantity: 0,
      available_quantity: round4(Number(row.available_quantity ?? 0)),
      unit_cost: round4(unitCost),
      total_cost: 0,
      notes: "consumption_draft_regenerated_from_requirements",
      created_by: user.id,
    };
  });
  const { error: insertLinesError } = await supabase.from("event_catering_consumption_lines").insert(rows);
  if (insertLinesError) throw new Error(`No se pudieron regenerar líneas de consumo: ${insertLinesError.message}`);

  const { error: updateRecordError } = await supabase
    .from("event_catering_consumption_records")
    .update({ notes: "consumption_draft_regenerated_from_requirements", updated_at: new Date().toISOString() })
    .eq("tenant_id", tenant.tenantId)
    .eq("id", draft.id)
    .eq("status", "draft");
  if (updateRecordError) throw new Error(`No se pudo marcar regeneración de consumo: ${updateRecordError.message}`);

  revalidatePath(`/${tenant.tenantSlug}/kitchen/events/consumption`);
  revalidatePath(`/${tenant.tenantSlug}/kitchen/events/${plan.event_id}/catering/${plan.id}/consumption`);
  revalidatePath(`/${tenant.tenantSlug}/kitchen/events/${plan.event_id}/catering/${plan.id}/consumption/${draft.id}`);
}

export async function updateConsumptionLineAction(formData: FormData): Promise<void> {
  const tenantSlug = toText(formData.get("tenantSlug")).toLowerCase();
  const consumptionId = toText(formData.get("consumptionId"));
  const lineId = toText(formData.get("lineId"));
  const locationId = toText(formData.get("locationId"));
  const consumedQuantity = toNonNegativeCateringNumber(toText(formData.get("consumedQuantity")), "Cantidad consumida");
  const wasteQuantity = toNonNegativeCateringNumber(toText(formData.get("wasteQuantity")), "Cantidad de merma");
  const leftoverQuantity = toNonNegativeCateringNumber(toText(formData.get("leftoverQuantity")), "Cantidad sobrante");
  const unitCostRaw = toText(formData.get("unitCost"));
  const notes = toText(formData.get("notes"));
  if (!tenantSlug || !consumptionId || !lineId) throw new Error("Datos incompletos para actualizar línea de consumo.");

  const { tenant } = await resolveTenantModulePageActor(tenantSlug, "event_catering", "consumption", "manage");
  const supabase = await getSupabaseServerClient();
  const { data: record, error: recordError } = await supabase
    .from("event_catering_consumption_records")
    .select("id,status,plan_id,event_id")
    .eq("tenant_id", tenant.tenantId)
    .eq("id", consumptionId)
    .maybeSingle();
  if (recordError || !record) throw new Error("Consumo inválido para el tenant.");
  if (record.status !== "draft") throw new Error("Solo se puede editar consumo en status draft.");

  const { data: line, error: lineError } = await supabase
    .from("event_catering_consumption_lines")
    .select("id,item_id,unit_id,unit_cost")
    .eq("tenant_id", tenant.tenantId)
    .eq("consumption_record_id", record.id)
    .eq("id", lineId)
    .maybeSingle();
  if (lineError || !line) throw new Error("Línea de consumo inválida para el tenant.");

  if (locationId) {
    const { data: location, error: locationError } = await supabase
      .from("kitchen_inventory_locations")
      .select("id")
      .eq("tenant_id", tenant.tenantId)
      .eq("id", locationId)
      .maybeSingle();
    if (locationError || !location) throw new Error("Ubicación inválida para el tenant.");
  }

  const [{ data: item, error: itemError }, { data: unit, error: unitError }] = await Promise.all([
    supabase
      .from("kitchen_inventory_items")
      .select("id")
      .eq("tenant_id", tenant.tenantId)
      .eq("id", line.item_id)
      .maybeSingle(),
    supabase
      .from("kitchen_inventory_units")
      .select("id")
      .eq("tenant_id", tenant.tenantId)
      .eq("id", line.unit_id)
      .maybeSingle(),
  ]);
  if (itemError || !item) throw new Error("Insumo inválido para el tenant.");
  if (unitError || !unit) throw new Error("Unidad inválida para el tenant.");

  const unitCost = unitCostRaw
    ? toNonNegativeCateringNumber(unitCostRaw, "Costo unitario")
    : Number(line.unit_cost ?? 0);

  const { error: updateError } = await supabase
    .from("event_catering_consumption_lines")
    .update({
      location_id: locationId || null,
      consumed_quantity: round4(consumedQuantity),
      waste_quantity: round4(wasteQuantity),
      leftover_quantity: round4(leftoverQuantity),
      unit_cost: round4(unitCost),
      total_cost: round4((consumedQuantity + wasteQuantity) * unitCost),
      notes: notes || null,
    })
    .eq("tenant_id", tenant.tenantId)
    .eq("consumption_record_id", record.id)
    .eq("id", lineId);
  if (updateError) throw new Error(`No se pudo actualizar línea de consumo: ${updateError.message}`);

  revalidatePath(`/${tenant.tenantSlug}/kitchen/events/consumption`);
  revalidatePath(`/${tenant.tenantSlug}/kitchen/events/${record.event_id}/catering/${record.plan_id}/consumption`);
  revalidatePath(`/${tenant.tenantSlug}/kitchen/events/${record.event_id}/catering/${record.plan_id}/consumption/${record.id}`);
}

export async function applyPlannedQuantitiesToConsumptionAction(formData: FormData): Promise<void> {
  const tenantSlug = toText(formData.get("tenantSlug")).toLowerCase();
  const consumptionId = toText(formData.get("consumptionId"));
  if (!tenantSlug || !consumptionId) throw new Error("Tenant y consumo son obligatorios.");

  const { tenant } = await resolveTenantModulePageActor(tenantSlug, "event_catering", "consumption", "manage");
  const supabase = await getSupabaseServerClient();
  const { data: record, error: recordError } = await supabase
    .from("event_catering_consumption_records")
    .select("id,status,plan_id,event_id")
    .eq("tenant_id", tenant.tenantId)
    .eq("id", consumptionId)
    .maybeSingle();
  if (recordError || !record) throw new Error("Consumo inválido para el tenant.");
  if (record.status !== "draft") throw new Error("Solo se pueden aplicar cantidades planeadas a un consumo draft.");

  const { data: lines, error: linesError } = await supabase
    .from("event_catering_consumption_lines")
    .select("id,planned_quantity,unit_cost")
    .eq("tenant_id", tenant.tenantId)
    .eq("consumption_record_id", record.id);
  if (linesError) throw new Error(`No se pudieron cargar líneas de consumo: ${linesError.message}`);

  for (const line of lines ?? []) {
    const plannedQuantity = Number(line.planned_quantity ?? 0);
    const unitCost = Number(line.unit_cost ?? 0);
    const { error: updateError } = await supabase
      .from("event_catering_consumption_lines")
      .update({
        consumed_quantity: round4(plannedQuantity),
        waste_quantity: 0,
        leftover_quantity: 0,
        total_cost: round4(plannedQuantity * unitCost),
      })
      .eq("tenant_id", tenant.tenantId)
      .eq("consumption_record_id", record.id)
      .eq("id", line.id);
    if (updateError) throw new Error(`No se pudo aplicar cantidad planeada: ${updateError.message}`);
  }

  revalidatePath(`/${tenant.tenantSlug}/kitchen/events/consumption`);
  revalidatePath(`/${tenant.tenantSlug}/kitchen/events/${record.event_id}/catering/${record.plan_id}/consumption`);
  revalidatePath(`/${tenant.tenantSlug}/kitchen/events/${record.event_id}/catering/${record.plan_id}/consumption/${record.id}`);
}

export async function bulkAssignConsumptionLocationAction(formData: FormData): Promise<void> {
  const tenantSlug = toText(formData.get("tenantSlug")).toLowerCase();
  const consumptionId = toText(formData.get("consumptionId"));
  const locationId = toText(formData.get("locationId"));
  const applyTo = toText(formData.get("applyTo")) || "missing_location";
  if (!tenantSlug || !consumptionId || !locationId) throw new Error("Tenant, consumo y ubicación son obligatorios.");

  const { tenant } = await resolveTenantModulePageActor(tenantSlug, "event_catering", "consumption", "manage");
  const supabase = await getSupabaseServerClient();
  const [{ data: record, error: recordError }, { data: location, error: locationError }] = await Promise.all([
    supabase
      .from("event_catering_consumption_records")
      .select("id,status,plan_id,event_id")
      .eq("tenant_id", tenant.tenantId)
      .eq("id", consumptionId)
      .maybeSingle(),
    supabase
      .from("kitchen_inventory_locations")
      .select("id")
      .eq("tenant_id", tenant.tenantId)
      .eq("id", locationId)
      .maybeSingle(),
  ]);
  if (recordError || !record) throw new Error("Consumo inválido para el tenant.");
  if (record.status !== "draft") throw new Error("Solo se pueden asignar ubicaciones en consumo draft.");
  if (locationError || !location) throw new Error("Ubicación inválida para el tenant.");

  let query = supabase
    .from("event_catering_consumption_lines")
    .update({ location_id: location.id })
    .eq("tenant_id", tenant.tenantId)
    .eq("consumption_record_id", record.id);
  if (applyTo === "missing_location") query = query.is("location_id", null);
  const { error: updateError } = await query;
  if (updateError) throw new Error(`No se pudo asignar ubicación masiva: ${updateError.message}`);

  revalidatePath(`/${tenant.tenantSlug}/kitchen/events/consumption`);
  revalidatePath(`/${tenant.tenantSlug}/kitchen/events/${record.event_id}/catering/${record.plan_id}/consumption`);
  revalidatePath(`/${tenant.tenantSlug}/kitchen/events/${record.event_id}/catering/${record.plan_id}/consumption/${record.id}`);
}

export async function autoAssignConsumptionLocationsAction(formData: FormData): Promise<void> {
  const tenantSlug = toText(formData.get("tenantSlug")).toLowerCase();
  const consumptionId = toText(formData.get("consumptionId"));
  if (!tenantSlug || !consumptionId) throw new Error("Tenant y consumo son obligatorios.");

  const { tenant } = await resolveTenantModulePageActor(tenantSlug, "event_catering", "consumption", "manage");
  const supabase = await getSupabaseServerClient();
  const { data: record, error: recordError } = await supabase
    .from("event_catering_consumption_records")
    .select("id,status,plan_id,event_id")
    .eq("tenant_id", tenant.tenantId)
    .eq("id", consumptionId)
    .maybeSingle();
  if (recordError || !record) throw new Error("Consumo inválido para el tenant.");
  if (record.status !== "draft") throw new Error("Solo se puede auto-asignar ubicación en consumo draft.");

  const { data: lines, error: linesError } = await supabase
    .from("event_catering_consumption_lines")
    .select("id,item_id,location_id,consumed_quantity,waste_quantity")
    .eq("tenant_id", tenant.tenantId)
    .eq("consumption_record_id", record.id);
  if (linesError) throw new Error(`No se pudieron cargar líneas para auto-asignar: ${linesError.message}`);
  const itemIds = [...new Set((lines ?? []).map((line) => line.item_id))];
  if (itemIds.length === 0) return;

  const [{ data: balances, error: balancesError }, { data: allocations, error: allocationsError }] = await Promise.all([
    supabase
      .from("kitchen_inventory_balances")
      .select("item_id,location_id,quantity")
      .eq("tenant_id", tenant.tenantId)
      .in("item_id", itemIds),
    supabase
      .from("event_catering_inventory_allocations")
      .select("plan_id,item_id,location_id,allocated_quantity,consumed_quantity,released_quantity,status")
      .eq("tenant_id", tenant.tenantId)
      .in("item_id", itemIds)
      .eq("status", "reserved"),
  ]);
  if (balancesError) throw new Error(`No se pudieron cargar balances para auto-asignar: ${balancesError.message}`);
  if (allocationsError && !isAllocationsTableMissing(allocationsError.message)) {
    throw new Error(`No se pudieron cargar reservas para auto-asignar: ${allocationsError.message}`);
  }

  const physical = new Map<string, number>();
  for (const balance of balances ?? []) {
    physical.set(`${balance.item_id}:${balance.location_id}`, Number(balance.quantity ?? 0));
  }
  const reservedThis = new Map<string, number>();
  const reservedOther = new Map<string, number>();
  for (const allocation of allocations ?? []) {
    const remaining = Math.max(
      Number(allocation.allocated_quantity ?? 0) -
        Number(allocation.consumed_quantity ?? 0) -
        Number(allocation.released_quantity ?? 0),
      0,
    );
    if (remaining <= 0 || !allocation.location_id) continue;
    const key = `${allocation.item_id}:${allocation.location_id}`;
    if (allocation.plan_id === record.plan_id) {
      reservedThis.set(key, (reservedThis.get(key) ?? 0) + remaining);
    } else {
      reservedOther.set(key, (reservedOther.get(key) ?? 0) + remaining);
    }
  }

  const locationsByItem = new Map<string, Set<string>>();
  for (const balance of balances ?? []) {
    if (!balance.location_id) continue;
    const bucket = locationsByItem.get(balance.item_id) ?? new Set<string>();
    bucket.add(balance.location_id);
    locationsByItem.set(balance.item_id, bucket);
  }

  for (const line of lines ?? []) {
    const totalOut = round4(Number(line.consumed_quantity ?? 0) + Number(line.waste_quantity ?? 0));
    if (totalOut <= 0 || line.location_id) continue;
    const candidates = [...(locationsByItem.get(line.item_id) ?? new Set<string>())]
      .map((locationId) => {
        const key = `${line.item_id}:${locationId}`;
        const physicalQty = Number(physical.get(key) ?? 0);
        const thisQty = Number(reservedThis.get(key) ?? 0);
        const otherQty = Number(reservedOther.get(key) ?? 0);
        return {
          locationId,
          reservedThis: thisQty,
          availableForThisPlan: round4(physicalQty - otherQty + thisQty),
        };
      })
      .filter((candidate) => candidate.availableForThisPlan >= totalOut)
      .sort((a, b) => b.reservedThis - a.reservedThis || b.availableForThisPlan - a.availableForThisPlan);
    const selected = candidates[0];
    if (!selected) continue;
    const { error: updateError } = await supabase
      .from("event_catering_consumption_lines")
      .update({ location_id: selected.locationId })
      .eq("tenant_id", tenant.tenantId)
      .eq("consumption_record_id", record.id)
      .eq("id", line.id);
    if (updateError) throw new Error(`No se pudo auto-asignar ubicación: ${updateError.message}`);
  }

  revalidatePath(`/${tenant.tenantSlug}/kitchen/events/consumption`);
  revalidatePath(`/${tenant.tenantSlug}/kitchen/events/${record.event_id}/catering/${record.plan_id}/consumption`);
  revalidatePath(`/${tenant.tenantSlug}/kitchen/events/${record.event_id}/catering/${record.plan_id}/consumption/${record.id}`);
}

export async function cancelConsumptionDraftAction(formData: FormData): Promise<void> {
  const tenantSlug = toText(formData.get("tenantSlug")).toLowerCase();
  const consumptionId = toText(formData.get("consumptionId"));
  if (!tenantSlug || !consumptionId) throw new Error("Tenant y consumo son obligatorios.");

  const { tenant, user } = await resolveTenantModulePageActor(tenantSlug, "event_catering", "consumption", "manage");
  const supabase = await getSupabaseServerClient();
  const { data: record, error: recordError } = await supabase
    .from("event_catering_consumption_records")
    .select("id,status,plan_id,event_id")
    .eq("tenant_id", tenant.tenantId)
    .eq("id", consumptionId)
    .maybeSingle();
  if (recordError || !record) throw new Error("Consumo inválido para el tenant.");
  if (record.status !== "draft") throw new Error("Solo se puede cancelar un consumo draft.");

  const { error: cancelError } = await supabase
    .from("event_catering_consumption_records")
    .update({
      status: "canceled",
      canceled_at: new Date().toISOString(),
      canceled_by: user.id,
      notes: `Consumo cancelado ${new Date().toISOString()}`,
    })
    .eq("tenant_id", tenant.tenantId)
    .eq("id", record.id);
  if (cancelError) throw new Error(`No se pudo cancelar consumo draft: ${cancelError.message}`);

  revalidatePath(`/${tenant.tenantSlug}/kitchen/events/consumption`);
  revalidatePath(`/${tenant.tenantSlug}/kitchen/events/${record.event_id}/catering/${record.plan_id}/consumption`);
  revalidatePath(`/${tenant.tenantSlug}/kitchen/events/${record.event_id}/catering/${record.plan_id}/consumption/${record.id}`);
}

export async function confirmConsumptionRecordAction(formData: FormData): Promise<void> {
  const tenantSlug = toText(formData.get("tenantSlug")).toLowerCase();
  const consumptionId = toText(formData.get("consumptionId"));
  if (!tenantSlug || !consumptionId) throw new Error("Tenant y consumo son obligatorios.");

  const { tenant, user } = await resolveTenantModulePageActor(tenantSlug, "event_catering", "consumption", "manage");
  const supabase = await getSupabaseServerClient();
  const { data: record, error: recordError } = await supabase
    .from("event_catering_consumption_records")
    .select("id,event_id,plan_id")
    .eq("tenant_id", tenant.tenantId)
    .eq("id", consumptionId)
    .maybeSingle();
  if (recordError || !record) throw new Error("Consumo inválido para el tenant.");

  const { error: rpcError } = await supabase.rpc("event_catering_confirm_consumption", {
    p_consumption_record_id: record.id,
  });
  if (rpcError) throw new Error(`No se pudo confirmar consumo: ${rpcError.message}`);

  const { data: consumedLines, error: consumedLinesError } = await supabase
    .from("event_catering_consumption_lines")
    .select("id,item_id,consumed_quantity,waste_quantity")
    .eq("tenant_id", tenant.tenantId)
    .eq("consumption_record_id", record.id);
  if (consumedLinesError) throw new Error(`No se pudo cargar líneas consumidas para reservas: ${consumedLinesError.message}`);
  for (const line of consumedLines ?? []) {
    const outQty = Number(line.consumed_quantity ?? 0) + Number(line.waste_quantity ?? 0);
    if (outQty <= 0) continue;
    await consumePlanAllocationsForItem(supabase, {
      tenantId: tenant.tenantId,
      planId: record.plan_id,
      itemId: line.item_id,
      quantityToConsume: outQty,
      userId: user.id,
      consumptionRecordId: record.id,
      consumptionLineId: line.id,
    });
  }

  revalidatePath(`/${tenant.tenantSlug}/kitchen/events/consumption`);
  revalidatePath(`/${tenant.tenantSlug}/kitchen/events/${record.event_id}/catering/${record.plan_id}/consumption`);
  revalidatePath(`/${tenant.tenantSlug}/kitchen/events/${record.event_id}/catering/${record.plan_id}/consumption/${record.id}`);
}

export async function createInventoryReversalDraftAction(formData: FormData): Promise<void> {
  const tenantSlug = toText(formData.get("tenantSlug")).toLowerCase();
  const reversalType = toReversalType(toText(formData.get("reversalType")));
  const targetType = toReversalTargetType(toText(formData.get("targetType")));
  const targetId = toText(formData.get("targetId"));
  const reason = toText(formData.get("reason"));
  const notes = toText(formData.get("notes"));
  if (!tenantSlug || !targetId) throw new Error("Tenant y target de reversa son obligatorios.");
  if (reason.length < 8) throw new Error("Debes capturar un motivo de al menos 8 caracteres.");

  const pageKey = reversalType === "receipt" ? "requisitions" : "consumption";
  const { tenant, user } = await resolveTenantModulePageActor(tenantSlug, "event_catering", pageKey, "manage");
  const supabase = await getSupabaseServerClient();

  const { data: duplicate, error: duplicateError } = await supabase
    .from("event_catering_inventory_reversals")
    .select("id,status")
    .eq("tenant_id", tenant.tenantId)
    .eq("target_type", targetType)
    .eq("target_id", targetId)
    .in("status", ["draft", "applied"])
    .limit(1)
    .maybeSingle();
  if (duplicateError) throw new Error(`No se pudo validar duplicado de reversa: ${duplicateError.message}`);
  if (duplicate) throw new Error("Ya existe una reversa draft/applied para este target.");

  let originalMovements: Array<{
    movement_id: string;
    item_id: string;
    location_id: string;
    unit_id: string;
    quantity: number;
    unit_cost: number;
    total_cost: number;
  }> = [];

  if (targetType === "receipt_line") {
    if (reversalType !== "receipt") throw new Error("Target receipt_line requiere reversalType=receipt.");
    const { data: line, error: lineError } = await supabase
      .from("event_catering_purchase_receipt_lines")
      .select("id,inventory_movement_id")
      .eq("tenant_id", tenant.tenantId)
      .eq("id", targetId)
      .maybeSingle();
    if (lineError || !line) throw new Error("Línea de recepción inválida para el tenant.");
    if (!line.inventory_movement_id) throw new Error("La línea de recepción no tiene movimiento original para reversar.");

    const { data: movement, error: movementError } = await supabase
      .from("kitchen_inventory_movements")
      .select("id,item_id,location_id,unit_id,quantity,unit_cost,total_cost")
      .eq("tenant_id", tenant.tenantId)
      .eq("id", line.inventory_movement_id)
      .maybeSingle();
    if (movementError || !movement) throw new Error("Movimiento original de recepción no encontrado.");
    originalMovements = [
      {
        movement_id: movement.id,
        item_id: movement.item_id,
        location_id: movement.location_id,
        unit_id: movement.unit_id,
        quantity: Number(movement.quantity ?? 0),
        unit_cost: Number(movement.unit_cost ?? 0),
        total_cost: Number(movement.total_cost ?? 0),
      },
    ];
  }

  if (targetType === "consumption_line") {
    if (reversalType !== "consumption") throw new Error("Target consumption_line requiere reversalType=consumption.");
    const { data: line, error: lineError } = await supabase
      .from("event_catering_consumption_lines")
      .select("id,consumption_movement_id,waste_movement_id")
      .eq("tenant_id", tenant.tenantId)
      .eq("id", targetId)
      .maybeSingle();
    if (lineError || !line) throw new Error("Línea de consumo inválida para el tenant.");

    const movementIds = [line.consumption_movement_id, line.waste_movement_id].filter((value): value is string => Boolean(value));
    if (movementIds.length === 0) throw new Error("La línea de consumo no tiene movimientos originales para reversar.");

    const { data: movements, error: movementsError } = await supabase
      .from("kitchen_inventory_movements")
      .select("id,item_id,location_id,unit_id,quantity,unit_cost,total_cost")
      .eq("tenant_id", tenant.tenantId)
      .in("id", movementIds);
    if (movementsError) throw new Error(`No se pudieron cargar movimientos originales: ${movementsError.message}`);
    if (!movements || movements.length !== movementIds.length) {
      throw new Error("No se encontraron todos los movimientos originales de la línea de consumo.");
    }
    originalMovements = movements.map((movement) => ({
      movement_id: movement.id,
      item_id: movement.item_id,
      location_id: movement.location_id,
      unit_id: movement.unit_id,
      quantity: Number(movement.quantity ?? 0),
      unit_cost: Number(movement.unit_cost ?? 0),
      total_cost: Number(movement.total_cost ?? 0),
    }));
  }

  const { data: reversal, error: reversalError } = await supabase
    .from("event_catering_inventory_reversals")
    .insert({
      tenant_id: tenant.tenantId,
      reversal_type: reversalType,
      target_type: targetType,
      target_id: targetId,
      status: "draft",
      reason,
      notes: notes || null,
      created_by: user.id,
    })
    .select("id")
    .single();
  if (reversalError || !reversal) throw new Error(`No se pudo crear draft de reversa: ${reversalError?.message ?? "error"}`);

  const reversalLines = originalMovements.map((movement) => ({
    tenant_id: tenant.tenantId,
    reversal_id: reversal.id,
    original_movement_id: movement.movement_id,
    item_id: movement.item_id,
    location_id: movement.location_id,
    unit_id: movement.unit_id,
    quantity: round4(movement.quantity),
    unit_cost: round4(movement.unit_cost),
    total_cost: round4(movement.total_cost),
    notes: `source_target:${targetType}:${targetId}`,
    created_by: user.id,
  }));
  const { error: reversalLinesError } = await supabase.from("event_catering_inventory_reversal_lines").insert(reversalLines);
  if (reversalLinesError) throw new Error(`No se pudieron crear líneas del draft de reversa: ${reversalLinesError.message}`);

  revalidatePath(`/${tenant.tenantSlug}/kitchen/events/corrections`);
}

export async function cancelInventoryReversalDraftAction(formData: FormData): Promise<void> {
  const tenantSlug = toText(formData.get("tenantSlug")).toLowerCase();
  const reversalId = toText(formData.get("reversalId"));
  if (!tenantSlug || !reversalId) throw new Error("Tenant y reversa son obligatorios.");

  const supabase = await getSupabaseServerClient();
  const { tenant, user } = await resolveTenantModulePageActor(tenantSlug, "event_catering", "requisitions", "manage");
  const { data: reversal, error: reversalError } = await supabase
    .from("event_catering_inventory_reversals")
    .select("id,status,reversal_type")
    .eq("tenant_id", tenant.tenantId)
    .eq("id", reversalId)
    .maybeSingle();
  if (reversalError || !reversal) throw new Error("Reversa inválida para el tenant.");
  if (reversal.status !== "draft") throw new Error("Solo se puede cancelar una reversa en draft.");
  if (reversal.reversal_type === "consumption") {
    await resolveTenantModulePageActor(tenantSlug, "event_catering", "consumption", "manage");
  }

  const { error: cancelError } = await supabase
    .from("event_catering_inventory_reversals")
    .update({
      status: "canceled",
      canceled_at: new Date().toISOString(),
      canceled_by: user.id,
    })
    .eq("tenant_id", tenant.tenantId)
    .eq("id", reversal.id);
  if (cancelError) throw new Error(`No se pudo cancelar reversa draft: ${cancelError.message}`);

  revalidatePath(`/${tenant.tenantSlug}/kitchen/events/corrections`);
}

export async function applyConsumptionReversalAction(formData: FormData): Promise<void> {
  const tenantSlug = toText(formData.get("tenantSlug")).toLowerCase();
  const reversalId = toText(formData.get("reversalId"));
  if (!tenantSlug || !reversalId) throw new Error("Tenant y reversa son obligatorios.");

  const { tenant } = await resolveTenantModulePageActor(tenantSlug, "event_catering", "consumption", "manage");
  const supabase = await getSupabaseServerClient();
  const { data: reversal, error: reversalError } = await supabase
    .from("event_catering_inventory_reversals")
    .select("id,reversal_type,status,target_type,target_id")
    .eq("tenant_id", tenant.tenantId)
    .eq("id", reversalId)
    .maybeSingle();
  if (reversalError || !reversal) throw new Error("Reversa inválida para el tenant.");
  if (reversal.reversal_type !== "consumption") throw new Error("Esta acción solo aplica reversas de consumo.");
  if (reversal.status !== "draft") throw new Error("Solo se puede aplicar una reversa en draft.");

  const { error: rpcError } = await supabase.rpc("event_catering_apply_consumption_reversal", {
    p_reversal_id: reversal.id,
  });
  if (rpcError) throw new Error(`No se pudo aplicar reversa de consumo: ${rpcError.message}`);

  revalidatePath(`/${tenant.tenantSlug}/kitchen/events/corrections`);
  revalidatePath(`/${tenant.tenantSlug}/kitchen/events/corrections/${reversal.id}`);
  if (reversal.target_type === "consumption_line") {
    const { data: line } = await supabase
      .from("event_catering_consumption_lines")
      .select("consumption_record_id")
      .eq("tenant_id", tenant.tenantId)
      .eq("id", reversal.target_id)
      .maybeSingle();
    if (line?.consumption_record_id) {
      const { data: record } = await supabase
        .from("event_catering_consumption_records")
        .select("id,plan_id,event_id")
        .eq("tenant_id", tenant.tenantId)
        .eq("id", line.consumption_record_id)
        .maybeSingle();
      if (record) {
        revalidatePath(`/${tenant.tenantSlug}/kitchen/events/consumption`);
        revalidatePath(`/${tenant.tenantSlug}/kitchen/events/${record.event_id}/catering/${record.plan_id}`);
        revalidatePath(`/${tenant.tenantSlug}/kitchen/events/${record.event_id}/catering/${record.plan_id}/consumption`);
        revalidatePath(
          `/${tenant.tenantSlug}/kitchen/events/${record.event_id}/catering/${record.plan_id}/consumption/${record.id}`,
        );
      }
    }
  }
}

export async function applyReceiptReversalAction(formData: FormData): Promise<void> {
  const tenantSlug = toText(formData.get("tenantSlug")).toLowerCase();
  const reversalId = toText(formData.get("reversalId"));
  if (!tenantSlug || !reversalId) throw new Error("Tenant y reversa son obligatorios.");

  const { tenant } = await resolveTenantModulePageActor(tenantSlug, "event_catering", "requisitions", "manage");
  const supabase = await getSupabaseServerClient();
  const { data: reversal, error: reversalError } = await supabase
    .from("event_catering_inventory_reversals")
    .select("id,reversal_type,status,target_type,target_id")
    .eq("tenant_id", tenant.tenantId)
    .eq("id", reversalId)
    .maybeSingle();
  if (reversalError || !reversal) throw new Error("Reversa inválida para el tenant.");
  if (reversal.reversal_type !== "receipt") throw new Error("Esta acción solo aplica reversas de recepción.");
  if (reversal.status !== "draft") throw new Error("Solo se puede aplicar una reversa en draft.");

  const { error: rpcError } = await supabase.rpc("event_catering_apply_receipt_reversal", {
    p_reversal_id: reversal.id,
  });
  if (rpcError) throw new Error(`No se pudo aplicar reversa de recepción: ${rpcError.message}`);

  revalidatePath(`/${tenant.tenantSlug}/kitchen/events/corrections`);
  revalidatePath(`/${tenant.tenantSlug}/kitchen/events/corrections/${reversal.id}`);

  if (reversal.target_type === "receipt_line") {
    const { data: receiptLine } = await supabase
      .from("event_catering_purchase_receipt_lines")
      .select("receipt_id,requisition_line_id")
      .eq("tenant_id", tenant.tenantId)
      .eq("id", reversal.target_id)
      .maybeSingle();
    if (receiptLine) {
      const [{ data: receipt }, { data: reqLine }] = await Promise.all([
        supabase
          .from("event_catering_purchase_receipts")
          .select("id,requisition_id")
          .eq("tenant_id", tenant.tenantId)
          .eq("id", receiptLine.receipt_id)
          .maybeSingle(),
        supabase
          .from("event_catering_requisition_lines")
          .select("id,requisition_id")
          .eq("tenant_id", tenant.tenantId)
          .eq("id", receiptLine.requisition_line_id)
          .maybeSingle(),
      ]);
      const requisitionId = receipt?.requisition_id ?? reqLine?.requisition_id;
      if (requisitionId) {
        revalidatePath(`/${tenant.tenantSlug}/kitchen/events/requisitions`);
        revalidatePath(`/${tenant.tenantSlug}/kitchen/events/requisitions/${requisitionId}`);
        if (receipt?.id) {
          revalidatePath(`/${tenant.tenantSlug}/kitchen/events/requisitions/${requisitionId}/receipts/${receipt.id}`);
        }
      }
    }
  }
}

export async function cancelCateringRequisitionAction(formData: FormData): Promise<void> {
  const tenantSlug = toText(formData.get("tenantSlug")).toLowerCase();
  const requisitionId = toText(formData.get("requisitionId"));
  if (!tenantSlug || !requisitionId) throw new Error("Tenant y requisición son obligatorios.");

  const { tenant, user } = await resolveTenantModulePageActor(tenantSlug, "event_catering", "requisitions", "manage");
  const supabase = await getSupabaseServerClient();

  const { data: requisition, error: reqError } = await supabase
    .from("event_catering_requisitions")
    .select("id,status,plan_id,event_catering_plans:event_catering_plans!event_catering_requisitions_tenant_plan_fkey(event_id)")
    .eq("tenant_id", tenant.tenantId)
    .eq("id", requisitionId)
    .maybeSingle();
  if (reqError || !requisition) throw new Error("Requisición inválida para el tenant.");
  if (requisition.status !== "draft" && requisition.status !== "reviewed") {
    throw new Error("Solo se puede cancelar requisición en draft o reviewed.");
  }

  const { error: updateError } = await supabase
    .from("event_catering_requisitions")
    .update({
      status: "canceled",
      notes: `Cancelada ${new Date().toISOString()}`,
    })
    .eq("tenant_id", tenant.tenantId)
    .eq("id", requisition.id);
  if (updateError) throw new Error(`No se pudo cancelar requisición: ${updateError.message}`);

  await releaseRequisitionAllocations(supabase, {
    tenantId: tenant.tenantId,
    requisitionId: requisition.id,
    userId: user.id,
    reason: `Requisición cancelada ${new Date().toISOString()}`,
  });

  revalidateCateringPaths(tenant.tenantSlug);
  revalidatePath(`/${tenant.tenantSlug}/kitchen/events/requisitions`);
  revalidatePath(`/${tenant.tenantSlug}/kitchen/events/requisitions/${requisition.id}`);
}
