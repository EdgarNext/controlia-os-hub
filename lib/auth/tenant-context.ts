import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth/require-user";
import { getSupabaseServerClient } from "@/lib/supabase/server";

type TenantContext = {
  tenantId: string;
  tenantSlug: string;
  tenantName: string;
  userEmail: string | null;
};

type MembershipRow = {
  tenant_id: string;
  tenants: { id: string; slug: string; name: string } | { id: string; slug: string; name: string }[] | null;
};

function getTenantFromMembership(row: MembershipRow) {
  return Array.isArray(row.tenants) ? row.tenants[0] ?? null : row.tenants;
}

export async function resolveTenantContextBySlug(tenantSlug: string): Promise<TenantContext> {
  const normalizedSlug = tenantSlug.trim().toLowerCase();
  const user = await requireUser();
  const supabase = await getSupabaseServerClient();

  const { data, error } = await supabase
    .from("tenant_memberships")
    .select("tenant_id, tenants!inner(id, slug, name)")
    .eq("user_id", user.id)
    .eq("tenants.slug", normalizedSlug)
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new Error(`Unable to resolve tenant from slug: ${error.message}`);
  }

  if (!data) {
    notFound();
  }

  const tenant = getTenantFromMembership(data as MembershipRow);

  if (!tenant) {
    notFound();
  }

  return {
    tenantId: tenant.id,
    tenantSlug: tenant.slug,
    tenantName: tenant.name,
    userEmail: user.email ?? null,
  };
}
