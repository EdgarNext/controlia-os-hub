"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Command, LayoutDashboard, Plus } from "lucide-react";
import { getTenantSlugFromPathname } from "@/lib/navigation/route-meta";
import { KbdHint } from "./KbdHint";
import { Breadcrumbs } from "./Breadcrumbs";
import { PlatformBadge } from "./PlatformBadge";
import { TenantChip } from "./TenantChip";
import { UserMenu } from "./UserMenu";

type TopBarProps = {
  userEmail?: string | null;
};

export function TopBar({ userEmail }: TopBarProps) {
  const pathname = usePathname();
  const tenantSlug = getTenantSlugFromPathname(pathname);
  const isPlatformArea = pathname.startsWith("/tenants") || pathname.startsWith("/lab");

  return (
    <header className="sticky top-0 z-30 border-b border-border bg-surface/95 backdrop-blur">
      <div className="flex h-14 items-center gap-3 px-4 md:px-6">
        <div className="flex min-w-0 items-center gap-2">
          <span className="inline-flex h-8 w-8 items-center justify-center rounded-[calc(var(--radius-base)-4px)] border border-border bg-surface-2">
            <LayoutDashboard className="h-4 w-4" aria-hidden="true" />
          </span>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold">Controlia OS Hub</p>
          </div>
          {isPlatformArea ? <PlatformBadge /> : null}
        </div>

        <div className="min-w-0 flex-1">
          <Breadcrumbs />
        </div>

        <div className="ml-auto flex items-center gap-2">
          {tenantSlug ? <TenantChip tenantSlug={tenantSlug} /> : null}

          {isPlatformArea ? (
            <Link
              href="/tenants/new"
              className="inline-flex h-10 items-center gap-2 rounded-[var(--radius-base)] border border-border bg-surface-2 px-3 text-sm transition-colors duration-200 hover:bg-surface focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
            >
              <Plus className="h-4 w-4" aria-hidden="true" />
              <span className="hidden lg:inline">New Tenant</span>
            </Link>
          ) : null}

          <button
            type="button"
            className="hidden h-10 items-center gap-2 rounded-[var(--radius-base)] border border-border bg-surface-2 px-3 text-sm text-muted transition-colors duration-200 hover:text-foreground lg:inline-flex"
            aria-label="Command palette hint"
          >
            <Command className="h-4 w-4" aria-hidden="true" />
            Search
            <KbdHint keys="Ctrl K" />
          </button>

          <UserMenu userEmail={userEmail} />
        </div>
      </div>
    </header>
  );
}
