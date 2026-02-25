import { getSupabaseServerClient } from "@/lib/supabase/server";
import type { TenantBrandingRecord } from "@/lib/repos/types";

export async function getTenantBranding(tenantId: string): Promise<TenantBrandingRecord | null> {
  const supabase = await getSupabaseServerClient();
  const { data, error } = await supabase
    .from("tenant_branding")
    .select("tenant_id, display_name, logo_url, theme, updated_at")
    .eq("tenant_id", tenantId)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return data as TenantBrandingRecord | null;
}

export async function upsertTenantBranding(input: {
  tenantId: string;
  displayName: string;
  logoUrl: string;
}) {
  const supabase = await getSupabaseServerClient();

  const { error } = await supabase.from("tenant_branding").upsert(
    {
      tenant_id: input.tenantId,
      display_name: input.displayName || null,
      logo_url: input.logoUrl || null,
    },
    { onConflict: "tenant_id" },
  );

  if (error) {
    throw new Error(error.message);
  }
}
