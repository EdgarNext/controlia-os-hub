import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth/require-user";
import { getSupabaseServerClient } from "@/lib/supabase/server";

export async function requirePlatformOwner() {
  const user = await requireUser();
  const supabase = await getSupabaseServerClient();

  const { data, error } = await supabase.rpc("is_platform_owner");

  if (error || !data) {
    redirect("/auth/forbidden");
  }

  return { supabase, user };
}
