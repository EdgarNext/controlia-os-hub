import type { SupabaseClient } from "@supabase/supabase-js";

type TenantMembershipRow = {
  tenant_id: string;
  tenants: { slug: string } | { slug: string }[] | null;
};

function extractSlug(row: TenantMembershipRow): string | null {
  const tenants = Array.isArray(row.tenants) ? row.tenants[0] : row.tenants;
  return tenants?.slug ?? null;
}

export async function resolveUserLandingPath(
  supabase: SupabaseClient,
  userId: string,
): Promise<string> {
  const { data: isPlatformOwner, error: ownerError } = await supabase.rpc("is_platform_owner");

  if (ownerError) {
    throw new Error(`Unable to determine platform owner role: ${ownerError.message}`);
  }

  if (isPlatformOwner) {
    return "/tenants";
  }

  const { data: membership, error: membershipError } = await supabase
    .from("tenant_memberships")
    .select("tenant_id, tenants!inner(slug)")
    .eq("user_id", userId)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (membershipError) {
    throw new Error(`Unable to resolve tenant membership: ${membershipError.message}`);
  }

  if (!membership) {
    return "/no-access";
  }

  const slug = extractSlug(membership as TenantMembershipRow);

  if (!slug) {
    return "/no-access";
  }

  return `/${slug}/dashboard`;
}
