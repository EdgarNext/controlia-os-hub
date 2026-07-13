import type { ReactNode } from "react";
import { isTenantAccessDeniedError } from "@/app/(tenant)/lib/access-errors";
import { StatePanel } from "@/components/ui/state-panel";
import { resolveRetailPosTypePageContext } from "@/lib/auth/tenant-pos-access";
import { RetailReportsSubnav } from "./_components/RetailReportsSubnav";

type RetailReportsLayoutProps = {
  children: ReactNode;
  params: Promise<{ tenantSlug: string }>;
};

export default async function RetailReportsLayout({ children, params }: RetailReportsLayoutProps) {
  const { tenantSlug } = await params;

  try {
    await resolveRetailPosTypePageContext(tenantSlug, "catalog", "read");
  } catch (error) {
    if (isTenantAccessDeniedError(error)) {
      return (
        <StatePanel
          kind="permission"
          title="Sin acceso a reportes retail"
          message="Tu usuario no tiene permisos para consultar reportes de retail POS en este tenant."
        />
      );
    }

    throw error;
  }

  return (
    <div className="space-y-4">
      <RetailReportsSubnav tenantSlug={tenantSlug} />
      {children}
    </div>
  );
}
