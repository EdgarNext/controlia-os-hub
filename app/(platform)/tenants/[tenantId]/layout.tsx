import type { ReactNode } from "react";
import { notFound } from "next/navigation";
import { getTenantById } from "@/lib/repos/tenantsRepo";
import { TenantDetailTabs } from "../components/TenantDetailTabs";
import { TenantTitle } from "../components/TenantTitle";

type TenantLayoutProps = {
  children: ReactNode;
  params: Promise<{ tenantId: string }>;
};

export default async function TenantLayout({ children, params }: TenantLayoutProps) {
  const { tenantId } = await params;
  const tenant = await getTenantById(tenantId);

  if (!tenant) {
    notFound();
  }

  return (
    <div className="space-y-6">
      <TenantTitle tenant={tenant} />
      <TenantDetailTabs tenantId={tenant.id} />
      {children}
    </div>
  );
}
