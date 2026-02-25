"use server";

import { revalidatePath } from "next/cache";
import {
  addTenantMembership,
  findUserByEmail,
  removeTenantMembership,
  updateTenantMembershipRole,
} from "@/lib/repos/membershipsRepo";
import { logAuditEvent } from "@/lib/repos/auditRepo";
import { requirePlatformOwner } from "@/lib/auth/require-platform-owner";
import { ActionState, isTenantRole } from "./shared";

function revalidateMembershipPaths(tenantId: string) {
  revalidatePath("/tenants");
  revalidatePath(`/tenants/${tenantId}`);
  revalidatePath(`/tenants/${tenantId}/users`);
}

export async function addTenantMembershipAction(formData: FormData): Promise<ActionState> {
  const { user } = await requirePlatformOwner();

  const tenantId = String(formData.get("tenantId") ?? "");
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const role = String(formData.get("role") ?? "");

  if (!tenantId || !email || !isTenantRole(role)) {
    return { ok: false, message: "Datos inválidos para agregar usuario." };
  }

  try {
    const targetUser = await findUserByEmail(email);

    if (!targetUser) {
      return { ok: false, message: "Usuario no existe en Auth" };
    }

    await addTenantMembership({
      tenantId,
      userId: targetUser.user_id,
      role,
      createdBy: user.id,
    });

    await logAuditEvent({
      actorUserId: user.id,
      tenantId,
      eventType: "tenant.member.added",
      entityType: "tenant_membership",
      entityId: targetUser.user_id,
      payload: { email: targetUser.email, role },
    });

    revalidateMembershipPaths(tenantId);

    return { ok: true, message: "Usuario agregado al tenant." };
  } catch (error) {
    const message = error instanceof Error ? error.message : "No se pudo agregar el usuario.";
    return { ok: false, message };
  }
}

export async function updateTenantMembershipRoleAction(formData: FormData): Promise<ActionState> {
  const { user } = await requirePlatformOwner();

  const tenantId = String(formData.get("tenantId") ?? "");
  const membershipId = String(formData.get("membershipId") ?? "");
  const role = String(formData.get("role") ?? "");

  if (!tenantId || !membershipId || !isTenantRole(role)) {
    return { ok: false, message: "Datos inválidos para actualizar el rol." };
  }

  try {
    await updateTenantMembershipRole({ membershipId, role });

    await logAuditEvent({
      actorUserId: user.id,
      tenantId,
      eventType: "tenant.member.role_updated",
      entityType: "tenant_membership",
      entityId: membershipId,
      payload: { role },
    });

    revalidateMembershipPaths(tenantId);

    return { ok: true, message: "Rol actualizado." };
  } catch (error) {
    const message = error instanceof Error ? error.message : "No se pudo actualizar el rol.";
    return { ok: false, message };
  }
}

export async function removeTenantMembershipAction(formData: FormData): Promise<ActionState> {
  const { user } = await requirePlatformOwner();

  const tenantId = String(formData.get("tenantId") ?? "");
  const membershipId = String(formData.get("membershipId") ?? "");
  const userId = String(formData.get("userId") ?? "");

  if (!tenantId || !membershipId) {
    return { ok: false, message: "Datos inválidos para remover membership." };
  }

  try {
    await removeTenantMembership(membershipId);

    await logAuditEvent({
      actorUserId: user.id,
      tenantId,
      eventType: "tenant.member.removed",
      entityType: "tenant_membership",
      entityId: membershipId,
      payload: { userId: userId || null },
    });

    revalidateMembershipPaths(tenantId);

    return { ok: true, message: "Membership removida." };
  } catch (error) {
    const message = error instanceof Error ? error.message : "No se pudo remover la membership.";
    return { ok: false, message };
  }
}
