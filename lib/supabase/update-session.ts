import { createServerClient } from "@supabase/ssr";
import { type NextRequest, NextResponse } from "next/server";
import { perfMark, perfMeasure } from "@/lib/observability/perf";
import { getSupabaseConfig } from "./config";

function hasSupabaseAuthCookie(request: NextRequest) {
  return request.cookies.getAll().some((cookie) => cookie.name.startsWith("sb-") && cookie.name.includes("auth-token"));
}

export async function updateSupabaseSession(request: NextRequest) {
  const startMark = perfMark("updateSupabaseSession");
  const { url, publishableKey } = getSupabaseConfig();

  try {
    let response = NextResponse.next({
      request: {
        headers: request.headers,
      },
    });

    const supabase = createServerClient(url, publishableKey, {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({
            request,
          });
          cookiesToSet.forEach(({ name, value, options }) => {
            response.cookies.set(name, value, options);
          });
        },
      },
    });

    if (!hasSupabaseAuthCookie(request)) {
      return response;
    }

    await supabase.auth.getUser();

    return response;
  } finally {
    perfMeasure("updateSupabaseSession", startMark);
  }
}
