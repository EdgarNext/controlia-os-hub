export const THEME_COOKIE_NAME = "theme";

export const THEME_VALUES = ["light", "dark"] as const;

export type AppTheme = (typeof THEME_VALUES)[number];

export const DEFAULT_THEME: AppTheme = "light";

export function isAppTheme(value: unknown): value is AppTheme {
  return typeof value === "string" && THEME_VALUES.includes(value as AppTheme);
}
