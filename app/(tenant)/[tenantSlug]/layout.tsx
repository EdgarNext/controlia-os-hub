import type { ReactNode } from "react";
import { AppShell } from "@/components/layout/AppShell";
import { resolveTenantContextBySlug } from "@/lib/auth/tenant-context";
import { getTenantNav } from "@/lib/navigation/tenant-nav";
import { getThemeFromCookies } from "@/actions/preferences/set-theme";

// Depende de cookies/session; no cacheable.
export const dynamic = "force-dynamic";

type TenantSlugLayoutProps = {
  children: ReactNode;
  params: Promise<{ tenantSlug: string }>;
};

export default async function TenantSlugLayout({ children, params }: TenantSlugLayoutProps) {
  const { tenantSlug } = await params;
  const tenant = await resolveTenantContextBySlug(tenantSlug);
  const navSections = await getTenantNav(tenant);
  const theme = await getThemeFromCookies();

  return (
    <AppShell navSections={navSections} userEmail={tenant.userEmail} theme={theme}>
      {children}
    </AppShell>
  );
}
