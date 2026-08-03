import { type NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const allowedNextPaths = new Set(["/auth/update-password"]);

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  const requestedNext = request.nextUrl.searchParams.get("next") ?? "/";
  const nextPath = allowedNextPaths.has(requestedNext) ? requestedNext : "/";

  if (!code) {
    return NextResponse.redirect(new URL("/auth/login?error=invalid_recovery_link", request.url));
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) {
    return NextResponse.redirect(new URL("/auth/login?error=invalid_recovery_link", request.url));
  }

  return NextResponse.redirect(new URL(nextPath, request.url));
}
