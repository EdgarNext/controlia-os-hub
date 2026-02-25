"use server";

import { revalidatePath } from "next/cache";
import { archiveTenant, createTenant, updateTenant } from "@/lib/repos/tenantsRepo";
import { logAuditEvent } from "@/lib/repos/auditRepo";
import { requirePlatformOwner } from "@/lib/auth/require-platform-owner";
import { ActionState, isTenantStatus, normalizeSlug } from "./shared";

export async function createTenantAction(formData: FormData): Promise<ActionState> {
  const { user } = await requirePlatformOwner();

  const name = String(formData.get("name") ?? "").trim();
  const slug = normalizeSlug(String(formData.get("slug") ?? ""));

  if (!name || !slug) {
    return { ok: false, message: "Nombre y slug son obligatorios." };
  }

  try {
    const tenant = await createTenant({ name, slug, createdBy: user.id });

    await logAuditEvent({
      actorUserId: user.id,
      tenantId: tenant.id,
      eventType: "tenant.created",
      entityType: "tenant",
      entityId: tenant.id,
      payload: { name, slug },
    });

    revalidatePath("/tenants");

    return {
      ok: true,
      message: "Tenant creado correctamente.",
      redirectTo: `/tenants/${tenant.id}`,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "No se pudo crear el tenant.";
    return { ok: false, message };
  }
}

export async function updateTenantAction(formData: FormData): Promise<ActionState> {
  const { user } = await requirePlatformOwner();

  const tenantId = String(formData.get("tenantId") ?? "");
  const name = String(formData.get("name") ?? "").trim();
  const slug = normalizeSlug(String(formData.get("slug") ?? ""));
  const status = String(formData.get("status") ?? "");

  if (!tenantId || !name || !slug || !isTenantStatus(status)) {
    return { ok: false, message: "Datos inválidos para actualizar el tenant." };
  }

  try {
    await updateTenant({ tenantId, name, slug, status });

    await logAuditEvent({
      actorUserId: user.id,
      tenantId,
      eventType: "tenant.updated",
      entityType: "tenant",
      entityId: tenantId,
      payload: { name, slug, status },
    });

    revalidatePath("/tenants");
    revalidatePath(`/tenants/${tenantId}`);

    return { ok: true, message: "Tenant actualizado." };
  } catch (error) {
    const message = error instanceof Error ? error.message : "No se pudo actualizar el tenant.";
    return { ok: false, message };
  }
}

export async function archiveTenantAction(formData: FormData): Promise<ActionState> {
  const { user } = await requirePlatformOwner();

  const tenantId = String(formData.get("tenantId") ?? "");

  if (!tenantId) {
    return { ok: false, message: "Tenant inválido." };
  }

  try {
    await archiveTenant(tenantId);

    await logAuditEvent({
      actorUserId: user.id,
      tenantId,
      eventType: "tenant.archived",
      entityType: "tenant",
      entityId: tenantId,
      payload: { status: "archived" },
    });

    revalidatePath("/tenants");
    revalidatePath(`/tenants/${tenantId}`);

    return { ok: true, message: "Tenant archivado." };
  } catch (error) {
    const message = error instanceof Error ? error.message : "No se pudo archivar el tenant.";
    return { ok: false, message };
  }
}
