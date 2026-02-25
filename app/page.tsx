import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth/require-user";
import { resolveUserLandingPath } from "@/lib/auth/resolve-landing-path";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export default async function HomePage() {
  const user = await requireUser();
  const supabase = await createSupabaseServerClient();

  const landingPath = await resolveUserLandingPath(supabase, user.id);
  redirect(landingPath);
}
