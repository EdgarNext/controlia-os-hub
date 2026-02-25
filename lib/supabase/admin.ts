import { createClient } from "@supabase/supabase-js";
import { getSupabaseServiceRoleConfig } from "./config";

export function getSupabaseAdminClient() {
  const { url, serviceRoleKey } = getSupabaseServiceRoleConfig();

  return createClient(url, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}
