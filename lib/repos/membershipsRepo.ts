import { getSupabaseServerClient } from "@/lib/supabase/server";
import type { TenantMembershipRecord, TenantRole, UserLookupResult } from "@/lib/repos/types";

export async function listTenantMemberships(tenantId: string): Promise<TenantMembershipRecord[]> {
  const supabase = await getSupabaseServerClient();
  const { data, error } = await supabase.rpc("platform_list_tenant_members", {
    p_tenant_id: tenantId,
  });

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []) as TenantMembershipRecord[];
}

export async function findUserByEmail(email: string): Promise<UserLookupResult | null> {
  const supabase = await getSupabaseServerClient();
  const { data, error } = await supabase.rpc("platform_find_user_by_email", {
    p_email: email,
  });

  if (error) {
    throw new Error(error.message);
  }

  const first = (data ?? [])[0] as UserLookupResult | undefined;
  return first ?? null;
}

export async function addTenantMembership(input: {
  tenantId: string;
  userId: string;
  role: TenantRole;
  createdBy: string;
}) {
  const supabase = await getSupabaseServerClient();
  const { error } = await supabase.from("tenant_memberships").insert({
    tenant_id: input.tenantId,
    user_id: input.userId,
    role: input.role,
    created_by: input.createdBy,
  });

  if (error) {
    throw new Error(error.message);
  }
}

export async function updateTenantMembershipRole(input: {
  membershipId: string;
  role: TenantRole;
}) {
  const supabase = await getSupabaseServerClient();
  const { error } = await supabase
    .from("tenant_memberships")
    .update({ role: input.role })
    .eq("id", input.membershipId);

  if (error) {
    throw new Error(error.message);
  }
}

export async function removeTenantMembership(membershipId: string) {
  const supabase = await getSupabaseServerClient();
  const { error } = await supabase.from("tenant_memberships").delete().eq("id", membershipId);

  if (error) {
    throw new Error(error.message);
  }
}
