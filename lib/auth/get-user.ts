import { cache } from "react";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const getUserCached = cache(async () => {
  const supabase = await createSupabaseServerClient();

  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error) {
    return null;
  }

  return user;
});

export async function getUser() {
  return getUserCached();
}
