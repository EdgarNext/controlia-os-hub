import { redirect } from "next/navigation";
import { resolveUserLandingPath } from "@/lib/auth/resolve-landing-path";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function requireGuest() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    const landingPath = await resolveUserLandingPath(supabase, user.id);
    redirect(landingPath);
  }
}
