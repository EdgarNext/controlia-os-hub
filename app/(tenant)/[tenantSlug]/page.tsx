import { redirect } from "next/navigation";
import { resolveTenantContextBySlug } from "@/lib/auth/tenant-context";
import { resolveTenantLaunchHref } from "@/lib/navigation/module-launch";

export default async function TenantRootPage({ params }: { params: Promise<{ tenantSlug: string }> }) {
  const { tenantSlug } = await params;
  const tenant = await resolveTenantContextBySlug(tenantSlug);
  redirect(
    resolveTenantLaunchHref({
      tenantSlug: tenant.tenantSlug,
      enabledModuleKeys: tenant.enabledModuleKeys,
      moduleRoleByKey: tenant.moduleRoleByKey,
    }),
  );
}
