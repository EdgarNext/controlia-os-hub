"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BarChart3, Building2, FlaskConical, ShoppingBasket, Store, Users } from "lucide-react";
import type { NavItem } from "@/lib/navigation/platform-nav";
import { cn } from "@/lib/ui/cn";

type SidebarItemProps = {
  item: NavItem;
  collapsed: boolean;
  onNavigate?: () => void;
};

export function SidebarItem({ item, collapsed, onNavigate }: SidebarItemProps) {
  const pathname = usePathname();
  const isActive = item.match === "exact" ? pathname === item.href : pathname.startsWith(item.href);
  const Icon =
    item.iconKey === "tenants"
      ? Building2
      : item.iconKey === "lab"
        ? FlaskConical
        : item.iconKey === "users"
          ? Users
          : item.iconKey === "reports"
            ? BarChart3
            : item.iconKey === "catalog"
              ? ShoppingBasket
              : Store;

  return (
    <Link
      href={item.href}
      title={collapsed ? item.label : undefined}
      onClick={onNavigate}
      className={cn(
        "group relative flex min-h-10 items-center gap-3 rounded-[var(--radius-base)] px-3 py-2 text-sm transition-all duration-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary",
        isActive ? "bg-surface-2 text-foreground" : "text-muted hover:bg-surface-2 hover:text-foreground",
      )}
    >
      <span
        aria-hidden="true"
        className={cn(
          "absolute left-0 top-1/2 h-6 w-1 -translate-y-1/2 rounded-r-full bg-primary transition-opacity duration-200",
          isActive ? "opacity-100" : "opacity-0 group-hover:opacity-70",
        )}
      />
      <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
      <span className={cn("truncate transition-opacity duration-200", collapsed ? "w-0 opacity-0" : "opacity-100")}>{item.label}</span>
      {collapsed ? <span className="sr-only">{item.label}</span> : null}
    </Link>
  );
}
