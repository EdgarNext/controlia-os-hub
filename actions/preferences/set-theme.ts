"use server";

import { cookies } from "next/headers";
import { DEFAULT_THEME, isAppTheme, THEME_COOKIE_NAME, type AppTheme } from "@/lib/theme/constants";

const THEME_COOKIE_MAX_AGE = 60 * 60 * 24 * 365;

export async function setThemeAction(theme: string): Promise<{ ok: true; theme: AppTheme } | { ok: false; message: string }> {
  if (!isAppTheme(theme)) {
    return { ok: false, message: "Invalid theme value." };
  }

  const cookieStore = await cookies();
  cookieStore.set(THEME_COOKIE_NAME, theme, {
    path: "/",
    maxAge: THEME_COOKIE_MAX_AGE,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
  });

  return { ok: true, theme };
}

export async function getThemeFromCookies(): Promise<AppTheme> {
  const cookieStore = await cookies();
  const theme = cookieStore.get(THEME_COOKIE_NAME)?.value;

  return isAppTheme(theme) ? theme : DEFAULT_THEME;
}
