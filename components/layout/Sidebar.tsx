"use client";

import { useMemo, useState, useSyncExternalStore } from "react";
import { ChevronDown, PanelLeftClose, PanelLeftOpen } from "lucide-react";
import { usePathname } from "next/navigation";
import type { NavDomain, NavItem, NavSection } from "@/lib/navigation/platform-nav";
import { getTenantSlugFromPathname } from "@/lib/navigation/route-meta";
import { cn } from "@/lib/ui/cn";
import { SidebarItem } from "./SidebarItem";

type SidebarProps = {
  sections: NavSection[];
};

const STORAGE_KEY = "controlia.sidebar.collapsed";
const STORAGE_EVENT = "controlia:storage";

function subscribeStorage(onStoreChange: () => void) {
  if (typeof window === "undefined") {
    return () => {};
  }

  const handler = () => onStoreChange();
  window.addEventListener("storage", handler);
  window.addEventListener(STORAGE_EVENT, handler);

  return () => {
    window.removeEventListener("storage", handler);
    window.removeEventListener(STORAGE_EVENT, handler);
  };
}

function dispatchStorageChange() {
  if (typeof window === "undefined") {
    return;
  }
  window.dispatchEvent(new Event(STORAGE_EVENT));
}

function readStorageValue(key: string | null, fallback: string) {
  if (typeof window === "undefined" || !key) {
    return fallback;
  }
  return window.localStorage.getItem(key) ?? fallback;
}

function isNavLinkActive(pathname: string, href: string, match: "exact" | "prefix" = "prefix") {
  return match === "exact" ? pathname === href : pathname.startsWith(href);
}

function isNavItemActive(pathname: string, item: NavItem) {
  if (isNavLinkActive(pathname, item.href, item.match ?? "prefix")) {
    return true;
  }

  return (item.children ?? []).some((child) =>
    isNavLinkActive(pathname, child.href, child.match ?? "prefix"),
  );
}

function isDomainActive(pathname: string, domain: NavDomain) {
  return domain.items.some((item) => isNavItemActive(pathname, item));
}

export function Sidebar({ sections }: SidebarProps) {
  const pathname = usePathname();
  const tenantSlug = getTenantSlugFromPathname(pathname);
  const domainStorageKey = tenantSlug ? `controlia.sidebar.domains.${tenantSlug}` : null;
  const collapsedSnapshot = useSyncExternalStore(
    subscribeStorage,
    () => readStorageValue(STORAGE_KEY, "0"),
    () => "0",
  );
  const collapsed = collapsedSnapshot === "1";
  const [mobileOpen, setMobileOpen] = useState(false);
  const domainSnapshot = useSyncExternalStore(
    subscribeStorage,
    () => readStorageValue(domainStorageKey, "{}"),
    () => "{}",
  );
  const domainExpandedState = useMemo(() => {
    try {
      return JSON.parse(domainSnapshot) as Record<string, boolean>;
    } catch {
      return {};
    }
  }, [domainSnapshot]);

  function persistCollapsed(nextCollapsed: boolean) {
    if (typeof window === "undefined") {
      return;
    }
    window.localStorage.setItem(STORAGE_KEY, nextCollapsed ? "1" : "0");
    dispatchStorageChange();
  }

  function toggleDomain(domainKey: string) {
    if (typeof window === "undefined" || !domainStorageKey) {
      return;
    }

    const nextState = {
      ...domainExpandedState,
      [domainKey]: domainExpandedState[domainKey] === false,
    };
    window.localStorage.setItem(domainStorageKey, JSON.stringify(nextState));
    dispatchStorageChange();
  }

  function renderDomain(domain: NavDomain, mobile: boolean) {
    const isExpanded = domainExpandedState[domain.key] !== false;
    const domainActive = isDomainActive(pathname, domain);
    const contentOpen = collapsed && !mobile ? true : isExpanded;
    const contentId = mobile ? `mobile-sidebar-domain-${domain.key}` : `sidebar-domain-${domain.key}`;

    return (
      <div className="space-y-1">
        <button
          type="button"
          onClick={() => toggleDomain(domain.key)}
          className={cn(
            "group flex w-full items-center justify-between rounded-[calc(var(--radius-base)-6px)] px-2 py-1 text-[11px] font-medium uppercase tracking-wide text-muted transition-colors duration-200 hover:bg-[var(--nav-item-hover)] hover:text-foreground",
            domainActive && "border-l bg-[var(--nav-item-hover)] text-foreground",
            collapsed && !mobile && "hidden",
          )}
          style={
            domainActive
              ? {
                  borderLeftColor: `color-mix(in oklab, var(${domain.accentToken}) 38%, transparent)`,
                }
              : undefined
          }
          aria-expanded={isExpanded}
          aria-controls={contentId}
        >
          <span className="inline-flex items-center gap-2">
            <span
              className={cn("h-1.5 w-1.5 rounded-full opacity-75 transition-opacity duration-200", domainActive && "opacity-100")}
              aria-hidden="true"
              style={{ backgroundColor: `var(${domain.accentToken})` }}
            />
            {domain.label}
          </span>
          <ChevronDown
            className={cn("h-3.5 w-3.5 transition-transform duration-200", isExpanded ? "rotate-0" : "-rotate-90")}
            aria-hidden="true"
          />
        </button>

        <div
          className="grid"
          style={{
            gridTemplateRows: contentOpen ? "1fr" : "0fr",
            transition: "grid-template-rows var(--transition-base)",
          }}
        >
          <div id={contentId} className="overflow-hidden">
            <div
              className={cn(
                "space-y-1",
                domainActive && contentOpen && "ml-2 border-l pl-2",
              )}
              style={{
                borderLeftColor:
                  domainActive && contentOpen
                    ? `color-mix(in oklab, var(${domain.accentToken}) 25%, transparent)`
                    : undefined,
                animation: `${contentOpen ? "collapse-down" : "collapse-up"} var(--transition-base) both`,
              }}
            >
              {domain.items.map((item) => (
                <SidebarItem
                  key={item.href}
                  item={item}
                  collapsed={collapsed && !mobile}
                  onNavigate={mobile ? () => setMobileOpen(false) : undefined}
                  accentToken={item.accentToken ?? domain.accentToken}
                />
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
      <aside
        className={cn(
          "hidden border-r border-[var(--sidebar-border)] bg-[var(--sidebar-bg)] md:flex md:h-full md:flex-col md:transition-[width] md:duration-300",
          collapsed ? "md:w-[72px]" : "md:w-[260px]",
        )}
      >
        <div className="flex h-14 items-center justify-end border-b border-[var(--sidebar-border)] px-3">
          <button
            type="button"
            onClick={() => persistCollapsed(!collapsed)}
            className="inline-flex h-9 w-9 items-center justify-center rounded-[var(--radius-base)] border border-border bg-surface-2 text-muted transition-colors duration-200 hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            {collapsed ? <PanelLeftOpen className="h-4 w-4" aria-hidden="true" /> : <PanelLeftClose className="h-4 w-4" aria-hidden="true" />}
          </button>
        </div>

        <nav className="flex-1 space-y-4 overflow-y-auto p-3">
          {sections.map((section) => (
            <section key={section.id} className="space-y-2">
              {section.domains?.length ? (
                <div className="space-y-2">
                  {section.domains.map((domain, index) => (
                    <div key={domain.key} className={cn(index > 0 ? "mt-6" : null)}>
                      {renderDomain(domain, false)}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="space-y-1">
                  <p
                    className={cn(
                      "px-2 text-[11px] font-medium uppercase tracking-wide text-muted transition-opacity duration-200",
                      collapsed && "opacity-0",
                    )}
                  >
                    {section.label}
                  </p>
                  {section.items?.map((item) => (
                    <SidebarItem key={item.href} item={item} collapsed={collapsed} accentToken={item.accentToken} />
                  ))}
                </div>
              )}
            </section>
          ))}
        </nav>
      </aside>

      <button
        type="button"
        className="fixed bottom-4 right-4 z-40 inline-flex h-11 w-11 items-center justify-center rounded-full border border-border bg-surface shadow-[var(--shadow-soft)] md:hidden"
        onClick={() => setMobileOpen(true)}
        aria-label="Open navigation"
      >
        <PanelLeftOpen className="h-5 w-5" aria-hidden="true" />
      </button>

      <div className={cn("fixed inset-0 z-50 md:hidden", mobileOpen ? "pointer-events-auto" : "pointer-events-none")} aria-hidden={!mobileOpen}>
        <button
          type="button"
          className={cn("absolute inset-0 bg-bg-veil transition-opacity duration-200", mobileOpen ? "opacity-100" : "opacity-0")}
          onClick={() => setMobileOpen(false)}
          aria-label="Close navigation"
        />

        <aside
          className={cn(
            "relative h-full w-[84%] max-w-[320px] border-r border-[var(--sidebar-border)] bg-[var(--sidebar-bg)] p-3 transition-transform duration-300",
            mobileOpen ? "translate-x-0" : "-translate-x-full",
          )}
        >
          <div className="mb-3 flex h-11 items-center justify-between">
            <p className="text-sm font-semibold">Navigation</p>
            <button
              type="button"
              onClick={() => setMobileOpen(false)}
              className="inline-flex h-9 w-9 items-center justify-center rounded-[var(--radius-base)] border border-border bg-surface-2"
              aria-label="Close drawer"
            >
              <PanelLeftClose className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>
          {sections.map((section) => (
            <section key={section.id} className="space-y-2">
              {section.domains?.length ? (
                <div className="space-y-2">
                  {section.domains.map((domain, index) => (
                    <div key={domain.key} className={cn(index > 0 ? "mt-6" : null)}>
                      {renderDomain(domain, true)}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="space-y-1">
                  <p className="px-2 text-[11px] font-medium uppercase tracking-wide text-muted">{section.label}</p>
                  {section.items?.map((item) => (
                    <SidebarItem
                      key={item.href}
                      item={item}
                      collapsed={false}
                      onNavigate={() => setMobileOpen(false)}
                      accentToken={item.accentToken}
                    />
                  ))}
                </div>
              )}
            </section>
          ))}
        </aside>
      </div>
    </>
  );
}
