import type { ReactNode } from "react";
import { AppShell } from "@/components/layout/AppShell";
import { resolveTenantContextBySlug } from "@/lib/auth/tenant-context";
import { getTenantNav } from "@/lib/navigation/tenant-nav";

type TenantSlugLayoutProps = {
  children: ReactNode;
  params: Promise<{ tenantSlug: string }>;
};

export default async function TenantSlugLayout({ children, params }: TenantSlugLayoutProps) {
  const { tenantSlug } = await params;
  const tenant = await resolveTenantContextBySlug(tenantSlug);

  return (
    <AppShell navSections={getTenantNav(tenant.tenantSlug)} userEmail={tenant.userEmail}>
      {children}
    </AppShell>
  );
}
