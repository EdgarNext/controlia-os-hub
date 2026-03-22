import { cache } from "react";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth/require-user";
import { perfMark, perfMeasure } from "@/lib/observability/perf";
import type { TenantRole } from "@/lib/repos/types";
import { getSupabaseServerClient } from "@/lib/supabase/server";

type TenantModuleRow = {
  module_key: string;
  enabled: boolean;
};

export type TenantContext = {
  tenantId: string;
  tenantSlug: string;
  tenantName: string;
  tenantRole: TenantRole;
  enabledModuleKeys: string[];
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
      .select("module_key, enabled")
      .eq("tenant_id", tenant.id);

    if (!modulesError) {
      const moduleKeys = ((tenantModules ?? []) as TenantModuleRow[])
        .filter((row) => row.enabled)
        .map((row) => row.module_key);

      enabledModuleKeys = moduleKeys;
    }

    return {
      tenantId: tenant.id,
      tenantSlug: tenant.slug,
      tenantName: tenant.name,
      tenantRole,
      enabledModuleKeys,
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
