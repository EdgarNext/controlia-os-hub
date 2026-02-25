"use client";

import Link from "next/link";
import { cn } from "@/lib/ui/cn";

export type SegmentedTab = {
  key: string;
  label: string;
  href: string;
};

type SegmentedTabsProps = {
  tabs: SegmentedTab[];
  activeKey: string;
};

export function SegmentedTabs({ tabs, activeKey }: SegmentedTabsProps) {
  return (
    <nav className="segmented-tabs inline-flex flex-wrap gap-1 rounded-[var(--radius-base)] border border-border bg-surface p-1">
      {tabs.map((tab) => {
        const isActive = tab.key === activeKey;

        return (
          <Link
            key={tab.key}
            href={tab.href}
            className={cn(
              "inline-flex min-h-9 items-center rounded-[calc(var(--radius-base)-6px)] px-3 text-sm transition-all duration-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary",
              isActive ? "bg-surface-2 text-foreground shadow-[inset_0_0_0_1px_var(--border)]" : "text-muted hover:text-foreground",
            )}
          >
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
