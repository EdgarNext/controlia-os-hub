"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

type VenueNavTabsProps = {
  tenantSlug: string;
};

const tabs = [
  { key: "overview", label: "Overview", href: (tenantSlug: string) => `/${tenantSlug}/venue`, exact: true },
  { key: "rooms", label: "Rooms", href: (tenantSlug: string) => `/${tenantSlug}/venue/rooms`, exact: false },
  { key: "equipment", label: "Equipment", href: (tenantSlug: string) => `/${tenantSlug}/venue/equipment`, exact: false },
];

export function VenueNavTabs({ tenantSlug }: VenueNavTabsProps) {
  const pathname = usePathname();

  return (
    <nav className="flex flex-wrap items-center gap-2" aria-label="Venue sections">
      {tabs.map((tab) => {
        const href = tab.href(tenantSlug);
        const isActive = tab.exact ? pathname === href : pathname.startsWith(href);

        return (
          <Link
            key={tab.key}
            href={href}
            className={[
              "rounded-[var(--radius-base)] border px-3 py-1.5 text-sm transition-colors",
              isActive
                ? "border-primary bg-primary text-primary-foreground"
                : "border-border bg-surface-2 text-foreground hover:bg-surface",
            ].join(" ")}
          >
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
