import { cache } from "react";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth/require-user";
import { getCurrentTenantModuleRoleMap, type TenantModuleRole } from "@/lib/auth/module-role-access";
import { perfMark, perfMeasure } from "@/lib/observability/perf";
import { resolveTenantPosType, type TenantPosType } from "@/lib/auth/tenant-pos-type";
import type { TenantRole } from "@/lib/repos/types";
import { getSupabaseServerClient } from "@/lib/supabase/server";

type TenantModuleRow = {
  module_key: string;
  enabled: boolean;
  config: Record<string, unknown> | null;
};

export type TenantContext = {
  tenantId: string;
  tenantSlug: string;
  tenantName: string;
  tenantRole: TenantRole;
  enabledModuleKeys: string[];
  moduleConfigsByKey: Record<string, Record<string, unknown>>;
  moduleRoleByKey: Record<string, TenantModuleRole>;
  posType: TenantPosType;
  isPlatformOwner: boolean;
  userEmail: string | null;
};

type MembershipRow = {
  tenant_id: string;
  role: TenantRole;
  tenants: { id: string; slug: string; name: string } | { id: string; slug: string; name: string }[] | null;
};

function getTenantFromMembership(row: MembershipRow) {
  return Array.isArray(row.tenants) ? row.tenants[0] ?? null : row.tenants;
}

const resolveTenantContextBySlugCached = cache(async (normalizedSlug: string): Promise<TenantContext> => {
  const startMark = perfMark("resolveTenantContextBySlug");

  try {
    const user = await requireUser();
    const supabase = await getSupabaseServerClient();
    const { data: isPlatformOwnerData } = await supabase.rpc("is_platform_owner");
    const isPlatformOwner = Boolean(isPlatformOwnerData);

    const { data, error } = await supabase
      .from("tenant_memberships")
      .select("tenant_id, role, tenants!inner(id, slug, name)")
      .eq("user_id", user.id)
      .eq("tenants.slug", normalizedSlug)
      .limit(1)
      .maybeSingle();

    if (error) {
      throw new Error(`Unable to resolve tenant from slug: ${error.message}`);
    }

    let tenantRole: TenantRole = "viewer";
    let tenant = data ? getTenantFromMembership(data as MembershipRow) : null;

    if (data) {
      tenantRole = (data as MembershipRow).role;
    }

    if (!tenant && isPlatformOwner) {
      const { data: tenantData, error: tenantError } = await supabase
        .from("tenants")
        .select("id, slug, name")
        .eq("slug", normalizedSlug)
        .limit(1)
        .maybeSingle();

      if (tenantError) {
        throw new Error(`Unable to resolve platform owner tenant from slug: ${tenantError.message}`);
      }

      tenant = tenantData;
      tenantRole = "admin";
    }

    if (!tenant) {
      notFound();
    }

    let enabledModuleKeys: string[] = [];

    const { data: tenantModules, error: modulesError } = await supabase
      .from("tenant_modules")
      .select("module_key, enabled, config")
      .eq("tenant_id", tenant.id);

    const moduleConfigsByKey: Record<string, Record<string, unknown>> = {};
    if (!modulesError) {
      const moduleRows = (tenantModules ?? []) as TenantModuleRow[];
      const moduleKeys = moduleRows.filter((row) => row.enabled).map((row) => row.module_key);

      for (const row of moduleRows) {
        moduleConfigsByKey[row.module_key] =
          row.config && typeof row.config === "object" ? row.config : {};
      }

      enabledModuleKeys = moduleKeys;
    }

    const posType = resolveTenantPosType({
      enabledModuleKeys,
      moduleConfigsByKey,
    });

    const rawModuleRoleByKey = await getCurrentTenantModuleRoleMap(tenant.id);
    const moduleRoleByKey = enabledModuleKeys.reduce<Record<string, TenantModuleRole>>((accumulator, moduleKey) => {
      accumulator[moduleKey] = rawModuleRoleByKey[moduleKey] ?? "none";
      return accumulator;
    }, {});

    return {
      tenantId: tenant.id,
      tenantSlug: tenant.slug,
      tenantName: tenant.name,
      tenantRole,
      enabledModuleKeys,
      moduleConfigsByKey,
      moduleRoleByKey,
      posType,
      isPlatformOwner,
      userEmail: user.email ?? null,
    };
  } finally {
    perfMeasure("resolveTenantContextBySlug", startMark);
  }
});

export async function resolveTenantContextBySlug(tenantSlug: string): Promise<TenantContext> {
  return resolveTenantContextBySlugCached(tenantSlug.trim().toLowerCase());
}
