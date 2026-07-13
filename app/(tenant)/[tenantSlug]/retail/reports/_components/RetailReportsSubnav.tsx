"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { SegmentedTabs, type SegmentedTab } from "@/components/layout/SegmentedTabs";

type RetailReportsSubnavProps = {
  tenantSlug: string;
};

function buildHref(basePath: string, query: string) {
  return query ? `${basePath}?${query}` : basePath;
}

function resolveActiveKey(pathname: string) {
  if (pathname.includes("/retail/reports/cash")) {
    return "cash";
  }

  if (pathname.endsWith("/retail/reports/sales")) {
    return "sales";
  }

  if (pathname.endsWith("/retail/reports/products")) {
    return "products";
  }

  return "overview";
}

export function RetailReportsSubnav({ tenantSlug }: RetailReportsSubnavProps) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const query = searchParams.toString();
  const activeKey = resolveActiveKey(pathname);

  const tabs: SegmentedTab[] = [
    {
      key: "overview",
      label: "Resumen",
      href: buildHref(`/${tenantSlug}/retail/reports`, query),
    },
    {
      key: "sales",
      label: "Ventas",
      href: buildHref(`/${tenantSlug}/retail/reports/sales`, query),
    },
    {
      key: "cash",
      label: "Caja",
      href: buildHref(`/${tenantSlug}/retail/reports/cash`, query),
    },
    {
      key: "products",
      label: "Productos",
      href: buildHref(`/${tenantSlug}/retail/reports/products`, query),
    },
  ];

  return (
    <div className="-mx-1 overflow-x-auto px-1 pb-1">
      <SegmentedTabs tabs={tabs} activeKey={activeKey} />
    </div>
  );
}
