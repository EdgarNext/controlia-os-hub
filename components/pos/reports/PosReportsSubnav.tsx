"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { SegmentedTabs, type SegmentedTab } from "@/components/layout/SegmentedTabs";

type PosReportsSubnavProps = {
  tenantSlug: string;
};

function buildHref(basePath: string, query: string) {
  return query ? `${basePath}?${query}` : basePath;
}

function resolveActiveKey(pathname: string) {
  if (pathname.endsWith("/pos/reports/alerts")) {
    return "alerts";
  }

  if (pathname.endsWith("/pos/reports/cashier-shift")) {
    return "cashier-shift";
  }

  if (pathname.endsWith("/pos/reports/cashiers")) {
    return "cashiers";
  }

  if (pathname.endsWith("/pos/reports/products")) {
    return "products";
  }

  if (pathname.endsWith("/pos/reports/sales")) {
    return "sales";
  }

  return "overview";
}

export function PosReportsSubnav({ tenantSlug }: PosReportsSubnavProps) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const query = searchParams.toString();
  const activeKey = resolveActiveKey(pathname);

  const tabs: SegmentedTab[] = [
    {
      key: "overview",
      label: "Resumen",
      href: buildHref(`/${tenantSlug}/pos/reports`, query),
    },
    {
      key: "sales",
      label: "Ventas",
      href: buildHref(`/${tenantSlug}/pos/reports/sales`, query),
    },
    {
      key: "products",
      label: "Productos",
      href: buildHref(`/${tenantSlug}/pos/reports/products`, query),
    },
    {
      key: "cashiers",
      label: "Cajeros",
      href: buildHref(`/${tenantSlug}/pos/reports/cashiers`, query),
    },
    {
      key: "cashier-shift",
      label: "Cortes",
      href: buildHref(`/${tenantSlug}/pos/reports/cashier-shift`, query),
    },
    {
      key: "alerts",
      label: "Alertas",
      href: buildHref(`/${tenantSlug}/pos/reports/alerts`, query),
    },
  ];

  return (
    <div className="-mx-1 overflow-x-auto px-1 pb-1">
      <SegmentedTabs tabs={tabs} activeKey={activeKey} />
    </div>
  );
}
