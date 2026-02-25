"use client";

import { useEffect, useState } from "react";
import { PanelLeftClose, PanelLeftOpen } from "lucide-react";
import type { NavSection } from "@/lib/navigation/platform-nav";
import { cn } from "@/lib/ui/cn";
import { SidebarItem } from "./SidebarItem";

type SidebarProps = {
  sections: NavSection[];
};

const STORAGE_KEY = "controlia.sidebar.collapsed";

export function Sidebar({ sections }: SidebarProps) {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    window.localStorage.setItem(STORAGE_KEY, collapsed ? "1" : "0");
  }, [collapsed]);

  return (
    <>
      <aside
        className={cn(
          "hidden border-r border-border bg-surface md:flex md:min-h-[calc(100vh-56px)] md:flex-col md:transition-[width] md:duration-300",
          collapsed ? "md:w-[72px]" : "md:w-[260px]",
        )}
      >
        <div className="flex h-14 items-center justify-end border-b border-border px-3">
          <button
            type="button"
            onClick={() => setCollapsed((prev) => !prev)}
            className="inline-flex h-9 w-9 items-center justify-center rounded-[var(--radius-base)] border border-border bg-surface-2 text-muted transition-colors duration-200 hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            {collapsed ? <PanelLeftOpen className="h-4 w-4" aria-hidden="true" /> : <PanelLeftClose className="h-4 w-4" aria-hidden="true" />}
          </button>
        </div>

        <nav className="space-y-4 p-3">
          {sections.map((section) => (
            <section key={section.id} className="space-y-2">
              <p className={cn("px-2 text-[11px] font-medium uppercase tracking-wide text-muted transition-opacity duration-200", collapsed && "opacity-0")}>
                {section.label}
              </p>
              <div className="space-y-1">
                {section.items.map((item) => (
                  <SidebarItem key={item.href} item={item} collapsed={collapsed} />
                ))}
              </div>
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
            "relative h-full w-[84%] max-w-[320px] border-r border-border bg-surface p-3 transition-transform duration-300",
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
              <p className="px-2 text-[11px] font-medium uppercase tracking-wide text-muted">{section.label}</p>
              <div className="space-y-1">
                {section.items.map((item) => (
                  <SidebarItem key={item.href} item={item} collapsed={false} onNavigate={() => setMobileOpen(false)} />
                ))}
              </div>
            </section>
          ))}
        </aside>
      </div>
    </>
  );
}
