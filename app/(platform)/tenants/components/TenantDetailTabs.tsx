"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { SegmentedTabs } from "@/components/layout/SegmentedTabs";

type TenantDetailTabsProps = {
  tenantId: string;
};

const tabs = [
  { key: "overview", label: "Resumen", href: (id: string) => `/tenants/${id}` },
  { key: "users", label: "Usuarios", href: (id: string) => `/tenants/${id}/users` },
  { key: "branding", label: "Branding", href: (id: string) => `/tenants/${id}/branding` },
  { key: "modules", label: "Modulos", href: (id: string) => `/tenants/${id}?tab=modules` },
] as const;

export function TenantDetailTabs({ tenantId }: TenantDetailTabsProps) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const modulesPath = `/tenants/${tenantId}`;

  const active =
    pathname === `${modulesPath}/users`
      ? "users"
      : pathname === `${modulesPath}/branding`
        ? "branding"
      : pathname === modulesPath && searchParams.get("tab") === "modules"
          ? "modules"
          : "overview";

  return <SegmentedTabs tabs={tabs.map((tab) => ({ key: tab.key, label: tab.label, href: tab.href(tenantId) }))} activeKey={active} />;
}
