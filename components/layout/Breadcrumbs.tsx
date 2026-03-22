"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronRight } from "lucide-react";
import { getTenantDomainMetaByPathname } from "@/lib/navigation/tenant-domain";
import { buildBreadcrumbs } from "@/lib/navigation/breadcrumbs";

export function Breadcrumbs() {
  const pathname = usePathname();
  const crumbs = buildBreadcrumbs(pathname);
  const domainMeta = getTenantDomainMetaByPathname(pathname);

  return (
    <nav aria-label="Breadcrumb" className="hidden min-w-0 md:flex md:items-center md:gap-2">
      {domainMeta ? (
        <span
          className="inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.08em]"
          style={{
            borderColor: `color-mix(in oklab, var(${domainMeta.accentToken}) 24%, var(--border))`,
            backgroundColor: `color-mix(in oklab, var(${domainMeta.accentToken}) 8%, var(--surface))`,
            color: "var(--foreground)",
          }}
        >
          <span
            className="h-1.5 w-1.5 rounded-full"
            aria-hidden="true"
            style={{ backgroundColor: `var(${domainMeta.accentToken})` }}
          />
          {domainMeta.label}
        </span>
      ) : null}
      <ol className="flex min-w-0 items-center gap-1 text-xs text-muted">
        {crumbs.map((crumb, index) => {
          const isLast = index === crumbs.length - 1;

          return (
            <li key={crumb.href} className="flex min-w-0 items-center gap-1">
              {isLast ? (
                <span className="truncate text-foreground">{crumb.label}</span>
              ) : (
                <Link href={crumb.href} className="truncate transition-colors duration-200 hover:text-foreground">
                  {crumb.label}
                </Link>
              )}
              {!isLast ? <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" /> : null}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
