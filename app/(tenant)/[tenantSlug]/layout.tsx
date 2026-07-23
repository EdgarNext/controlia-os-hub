import type { ReactNode } from "react";
import { AppShell } from "@/components/layout/AppShell";
import { resolveTenantContextBySlug } from "@/lib/auth/tenant-context";
import { getTenantNav } from "@/lib/navigation/tenant-nav";
import { getThemeFromCookies } from "@/actions/preferences/set-theme";
import type { Metadata } from "next";
import { getTenantBranding } from "@/lib/navigation/tenant-branding";

// Depende de cookies/session; no cacheable.
export const dynamic = "force-dynamic";

type TenantSlugLayoutProps = {
  children: ReactNode;
  params: Promise<{ tenantSlug: string }>;
};

export async function generateMetadata({ params }: TenantSlugLayoutProps): Promise<Metadata> {
  const { tenantSlug } = await params;
  const tenant = await resolveTenantContextBySlug(tenantSlug);

  return {
    title: {
      default: tenant.tenantName,
      template: `${tenant.tenantName} · %s`,
    },
  };
}

export default async function TenantSlugLayout({ children, params }: TenantSlugLayoutProps) {
  const { tenantSlug } = await params;
  const tenant = await resolveTenantContextBySlug(tenantSlug);
  const navSections = await getTenantNav(tenant);
  const theme = await getThemeFromCookies();

  return (
    <AppShell
      variant="tenant"
      navSections={navSections}
      userEmail={tenant.userEmail}
      theme={theme}
      brandName={tenant.tenantName}
      tenantBranding={getTenantBranding(tenant.tenantSlug)}
    >
      {children}
    </AppShell>
  );
}
