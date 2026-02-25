import { type NextRequest } from "next/server";
import { updateSupabaseSession } from "@/lib/supabase/update-session";

// Framework entrypoint: Next.js runs only this `proxy.ts`.
export async function proxy(request: NextRequest) {
  return updateSupabaseSession(request);
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
