"use server";

import { revalidatePath } from "next/cache";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { logAuditEvent } from "@/lib/repos/auditRepo";
import { requirePlatformOwner } from "@/lib/auth/require-platform-owner";

export type ModuleCatalogActionState = {
  ok: boolean;
  message: string;
};

function normalizeModuleKey(value: FormDataEntryValue | null): string {
  return String(value ?? "").trim().toLowerCase();
}

function normalizeTenantId(value: FormDataEntryValue | null): string {
  return String(value ?? "").trim();
}

function normalizeEnabled(value: FormDataEntryValue | null): boolean | null {
  const normalized = String(value ?? "").trim().toLowerCase();
  if (normalized === "true") return true;
  if (normalized === "false") return false;
  return null;
}

export async function setTenantModuleStateAction(
  _previousState: ModuleCatalogActionState,
  formData: FormData,
): Promise<ModuleCatalogActionState> {
  const { user } = await requirePlatformOwner();

  const moduleKey = normalizeModuleKey(formData.get("moduleKey"));
  const tenantId = normalizeTenantId(formData.get("tenantId"));
  const enabled = normalizeEnabled(formData.get("enabled"));

  if (!moduleKey || !tenantId || enabled === null) {
    return {
      ok: false,
      message: "Faltan datos para actualizar el módulo.",
    };
  }

  try {
    const supabase = await getSupabaseServerClient();

    const { data: tenant, error: tenantError } = await supabase
      .from("tenants")
      .select("id, slug, name")
      .eq("id", tenantId)
      .limit(1)
      .maybeSingle<{ id: string; slug: string; name: string }>();

    if (tenantError) {
      throw new Error(`No se pudo resolver el tenant: ${tenantError.message}`);
    }

    if (!tenant) {
      return {
        ok: false,
        message: "El tenant seleccionado no existe.",
      };
    }

    const { data: module, error: moduleError } = await supabase
      .from("modules_catalog")
      .select("module_key, name")
      .eq("module_key", moduleKey)
      .limit(1)
      .maybeSingle<{ module_key: string; name: string }>();

    if (moduleError) {
      throw new Error(`No se pudo resolver el módulo: ${moduleError.message}`);
    }

    if (!module) {
      return {
        ok: false,
        message: "El módulo seleccionado no existe.",
      };
    }

    const { error: upsertError } = await supabase.from("tenant_modules").upsert(
      {
        tenant_id: tenant.id,
        module_key: module.module_key,
        enabled,
      },
      { onConflict: "tenant_id,module_key" },
    );

    if (upsertError) {
      throw new Error(`No se pudo actualizar la asignación del módulo: ${upsertError.message}`);
    }

    await logAuditEvent({
      actorUserId: user.id,
      tenantId: tenant.id,
      eventType: enabled ? "tenant_module.enabled" : "tenant_module.disabled",
      entityType: "tenant_module",
      entityId: tenant.id,
      payload: {
        moduleKey: module.module_key,
        moduleName: module.name,
        tenantSlug: tenant.slug,
        enabled,
      },
    });

    revalidatePath("/catalog");
    revalidatePath("/tenants");
    revalidatePath(`/tenants/${tenant.id}`);

    return {
      ok: true,
      message: enabled
        ? `Módulo ${module.name} activado para ${tenant.name}.`
        : `Módulo ${module.name} desactivado para ${tenant.name}.`,
    };
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error ? error.message : "No se pudo actualizar el módulo.",
    };
  }
}
