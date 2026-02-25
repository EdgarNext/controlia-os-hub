"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { LogOut, Moon, Sun, User } from "lucide-react";
import { signOutAction } from "@/actions/auth/sign-out";
import { setThemeAction } from "@/actions/preferences/set-theme";
import { DEFAULT_THEME, isAppTheme, type AppTheme } from "@/lib/theme/constants";

type UserMenuProps = {
  userEmail?: string | null;
};

export function UserMenu({ userEmail }: UserMenuProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [isThemePending, startThemeTransition] = useTransition();
  const [isSignOutPending, startSignOutTransition] = useTransition();
  const [theme, setTheme] = useState<AppTheme>(() => {
    if (typeof document === "undefined") {
      return DEFAULT_THEME;
    }

    const current = document.documentElement.dataset.theme;
    return isAppTheme(current) ? current : DEFAULT_THEME;
  });

  const toggleTheme = () => {
    const nextTheme: AppTheme = theme === "dark" ? "light" : "dark";

    startThemeTransition(async () => {
      const result = await setThemeAction(nextTheme);
      if (!result.ok) {
        return;
      }

      setTheme(result.theme);
      document.documentElement.dataset.theme = result.theme;
      setOpen(false);
      router.refresh();
    });
  };

  return (
    <div className="relative">
      <button
        type="button"
        className="inline-flex h-10 min-w-10 items-center justify-center rounded-[var(--radius-base)] border border-border bg-surface px-3 text-sm transition-colors duration-200 hover:bg-surface-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
        onClick={() => setOpen((prev) => !prev)}
        aria-label="Open user menu"
        aria-expanded={open}
      >
        <User className="h-4 w-4" aria-hidden="true" />
      </button>

      <div
        className={`absolute right-0 top-12 z-40 w-64 rounded-[var(--radius-base)] border border-border bg-surface p-2 shadow-[var(--shadow-soft)] transition-all duration-200 ${
          open ? "translate-y-0 opacity-100" : "pointer-events-none -translate-y-1 opacity-0"
        }`}
      >
        <div className="mb-2 rounded-[calc(var(--radius-base)-4px)] bg-surface-2 px-3 py-2 text-xs text-muted">
          {userEmail ?? "Platform user"}
        </div>

        <button
          type="button"
          disabled={isThemePending}
          className="mb-1 flex min-h-10 w-full items-center gap-2 rounded-[calc(var(--radius-base)-4px)] px-3 py-2 text-sm transition-colors duration-200 hover:bg-surface-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:opacity-60"
          onClick={toggleTheme}
        >
          {theme === "dark" ? <Sun className="h-4 w-4" aria-hidden="true" /> : <Moon className="h-4 w-4" aria-hidden="true" />}
          {theme === "dark" ? "Switch to light" : "Switch to dark"}
        </button>

        <button
          type="button"
          disabled={isSignOutPending}
          className="flex min-h-10 w-full items-center gap-2 rounded-[calc(var(--radius-base)-4px)] px-3 py-2 text-sm transition-colors duration-200 hover:bg-surface-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:opacity-60"
          onClick={() => {
            startSignOutTransition(async () => {
              setOpen(false);
              await signOutAction();
            });
          }}
        >
          <LogOut className="h-4 w-4" aria-hidden="true" />
          {isSignOutPending ? "Closing session..." : "Logout"}
        </button>
      </div>
    </div>
  );
}
