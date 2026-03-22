"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BarChart3,
  Building2,
  FlaskConical,
  MonitorSmartphone,
  Package,
  ShoppingBasket,
  Store,
  Tags,
  Users,
} from "lucide-react";
import type { NavItem } from "@/lib/navigation/platform-nav";
import { cn } from "@/lib/ui/cn";

type SidebarItemProps = {
  item: NavItem;
  collapsed: boolean;
  accentToken?: string;
  onNavigate?: () => void;
};

export function SidebarItem({ item, collapsed, accentToken, onNavigate }: SidebarItemProps) {
  const pathname = usePathname();
  const isActive = item.match === "exact" ? pathname === item.href : pathname.startsWith(item.href);
  const hasChildren = (item.children?.length ?? 0) > 0;
  const Icon =
    item.iconKey === "tenants"
      ? Building2
      : item.iconKey === "lab"
        ? FlaskConical
      : item.iconKey === "users"
        ? Users
        : item.iconKey === "devices"
          ? MonitorSmartphone
          : item.iconKey === "categories"
            ? Tags
            : item.iconKey === "products"
              ? Package
          : item.iconKey === "reports"
            ? BarChart3
            : item.iconKey === "catalog"
              ? ShoppingBasket
              : Store;

  return (
    <div className="space-y-1">
      <Link
        href={item.href}
        title={collapsed ? item.label : undefined}
        onClick={onNavigate}
        aria-current={isActive ? "page" : undefined}
        className={cn(
          "group relative flex min-h-10 items-center gap-3 rounded-[calc(var(--radius-base)-6px)] px-3 py-2 text-sm transition-all duration-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary",
          isActive
            ? "bg-[var(--nav-item-active)] font-semibold text-[var(--nav-item-active-text)]"
            : "text-muted hover:bg-[var(--nav-item-hover)] hover:text-foreground",
        )}
      >
        <span
          aria-hidden="true"
          className={cn(
            "absolute left-0 top-1/2 h-6 w-1 -translate-y-1/2 rounded-r-full transition-opacity duration-200",
            isActive ? "opacity-100" : "opacity-0 group-hover:opacity-70",
          )}
          style={{ backgroundColor: `var(${accentToken ?? "--primary"})` }}
        />
        <Icon className={cn("h-4 w-4 shrink-0 transition-colors duration-200", isActive ? "text-foreground/90" : "text-muted")} aria-hidden="true" />
        <span className={cn("truncate transition-opacity duration-200", collapsed ? "w-0 opacity-0" : "opacity-100")}>{item.label}</span>
        {collapsed ? <span className="sr-only">{item.label}</span> : null}
      </Link>

      {!collapsed && hasChildren ? (
        <div className="ml-8 space-y-1 border-l border-border pl-4">
          {item.children?.map((child) => {
            const childActive = child.match === "exact" ? pathname === child.href : pathname.startsWith(child.href);
            return (
              <Link
                key={child.href}
                href={child.href}
                onClick={onNavigate}
                aria-current={childActive ? "page" : undefined}
                className={cn(
                  "block rounded-[calc(var(--radius-base)-6px)] px-2 py-1.5 text-sm transition-colors duration-200",
                  childActive
                    ? "bg-[var(--nav-item-hover)] font-medium text-[var(--nav-item-active-text)]"
                    : "text-muted hover:bg-[var(--nav-item-hover)] hover:text-foreground",
                )}
              >
                {child.label}
              </Link>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
