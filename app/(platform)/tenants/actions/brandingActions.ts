"use server";

import { revalidatePath } from "next/cache";
import { upsertTenantBranding } from "@/lib/repos/brandingRepo";
import { logAuditEvent } from "@/lib/repos/auditRepo";
import { requirePlatformOwner } from "@/lib/auth/require-platform-owner";
import type { ActionState } from "./shared";

export async function saveTenantBrandingAction(formData: FormData): Promise<ActionState> {
  const { user } = await requirePlatformOwner();

  const tenantId = String(formData.get("tenantId") ?? "");
  const displayName = String(formData.get("display_name") ?? "").trim();
  const logoUrl = String(formData.get("logo_url") ?? "").trim();

  if (!tenantId) {
    return { ok: false, message: "Tenant inválido." };
  }

  try {
    await upsertTenantBranding({ tenantId, displayName, logoUrl });

    await logAuditEvent({
      actorUserId: user.id,
      tenantId,
      eventType: "tenant.branding.updated",
      entityType: "tenant_branding",
      entityId: tenantId,
      payload: { displayName, logoUrl },
    });

    revalidatePath(`/tenants/${tenantId}`);
    revalidatePath(`/tenants/${tenantId}/branding`);

    return { ok: true, message: "Branding actualizado." };
  } catch (error) {
    const message = error instanceof Error ? error.message : "No se pudo guardar branding.";
    return { ok: false, message };
  }
}
