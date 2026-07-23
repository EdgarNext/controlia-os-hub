"use client";

import Link from "next/link";
import Image from "next/image";
import { LayoutDashboard, Plus } from "lucide-react";
import { Breadcrumbs } from "./Breadcrumbs";
import { PlatformBadge } from "./PlatformBadge";
import { TenantLocalClock } from "./TenantLocalClock";
import { UserMenu } from "./UserMenu";
import type { AppTheme } from "@/lib/theme/constants";
import type { TenantBranding } from "@/lib/navigation/tenant-branding";

type TopBarProps = {
  userEmail?: string | null;
  theme: AppTheme;
  variant: "platform" | "tenant";
  brandName?: string;
  tenantBranding?: TenantBranding | null;
  initialLocalTime: string;
  initialDateTime: string;
};

export function TopBar({
  userEmail,
  theme,
  variant,
  brandName,
  tenantBranding,
  initialLocalTime,
  initialDateTime,
}: TopBarProps) {
  const isPlatform = variant === "platform";

  return (
    <header className="sticky top-0 z-30 border-b border-border bg-surface/95 backdrop-blur">
      <div className="flex h-14 items-center gap-3 px-4 md:px-6">
        <div className="flex min-w-0 items-center gap-2">
          {isPlatform || !tenantBranding ? (
            <span className="inline-flex h-8 w-8 items-center justify-center rounded-[calc(var(--radius-base)-4px)] border border-border bg-surface-2">
              <LayoutDashboard className="h-4 w-4" aria-hidden="true" />
            </span>
          ) : (
            <span className="inline-flex h-8 max-w-20 items-center justify-center overflow-hidden rounded-[calc(var(--radius-base)-4px)] border border-border bg-surface-2 px-1">
              <Image src={tenantBranding.logoSrc} alt={tenantBranding.logoAlt} width={86} height={37} className="h-7 w-auto object-contain" priority />
            </span>
          )}
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold">{isPlatform ? "Controlia OS Hub" : brandName}</p>
          </div>
          {isPlatform ? <PlatformBadge /> : null}
        </div>

        <div className="min-w-0 flex-1">
          <Breadcrumbs tenantName={isPlatform ? undefined : brandName} />
        </div>

        <div className="ml-auto flex items-center gap-2">
          {isPlatform ? (
            <Link
              href="/tenants/new"
              className="inline-flex h-10 items-center gap-2 rounded-[var(--radius-base)] border border-border bg-surface-2 px-3 text-sm transition-colors duration-200 hover:bg-surface focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
            >
              <Plus className="h-4 w-4" aria-hidden="true" />
              <span className="hidden lg:inline">New Tenant</span>
            </Link>
          ) : null}

          <TenantLocalClock initialText={initialLocalTime} initialDateTime={initialDateTime} />

          <UserMenu userEmail={userEmail} initialTheme={theme} />
        </div>
      </div>
    </header>
  );
}
