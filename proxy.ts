import { type NextRequest } from "next/server";
import { updateSupabaseSession } from "@/lib/supabase/update-session";

// Framework entrypoint: Next.js runs only this `proxy.ts`.
export async function proxy(request: NextRequest) {
  return updateSupabaseSession(request);
}

export const config = {
  matcher: [
    "/((?!_next/|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
