"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  getCatalogV2CategoriesPath,
  getCatalogV2ModifiersPath,
  getCatalogV2ProductsPath,
  getCatalogV2RootPath,
} from "@/lib/pos/catalog-v2/paths";

type CatalogV2NavTabsProps = {
  tenantSlug: string;
};

function isActivePath(pathname: string, href: string) {
  const segments = href.split("/").filter(Boolean);
  const isRootHref = segments[segments.length - 1] === "catalog-v2";
  return isRootHref ? pathname === href : pathname === href || pathname.startsWith(`${href}/`);
}

export function CatalogV2NavTabs({ tenantSlug }: CatalogV2NavTabsProps) {
  const pathname = usePathname();

  const items = [
    { href: getCatalogV2RootPath(tenantSlug), label: "Inicio" },
    { href: getCatalogV2CategoriesPath(tenantSlug), label: "Categorías" },
    { href: getCatalogV2ModifiersPath(tenantSlug), label: "Modificadores" },
    { href: getCatalogV2ProductsPath(tenantSlug), label: "Productos" },
  ];

  return (
    <nav className="flex flex-wrap gap-2" aria-label="Navegación catálogo V2">
      {items.map((item) => {
        const active = isActivePath(pathname, item.href);

        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "inline-flex items-center justify-center rounded-[var(--radius-base)] border px-3 py-1.5 text-sm font-medium transition-colors duration-200",
              active
                ? "border-primary bg-primary text-primary-foreground"
                : "border-border bg-surface-2 text-foreground hover:bg-surface",
            )}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
