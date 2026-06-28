import type { ReactNode } from "react";
import { isTenantAccessDeniedError } from "@/app/(tenant)/lib/access-errors";
import { PosReportsSubnav } from "@/components/pos/reports/PosReportsSubnav";
import { StatePanel } from "@/components/ui/state-panel";
import { resolveSalesPosTypePageContext } from "@/lib/auth/tenant-pos-access";

type PosReportsLayoutProps = {
  children: ReactNode;
  params: Promise<{ tenantSlug: string }>;
};

export default async function PosReportsLayout({ children, params }: PosReportsLayoutProps) {
  const { tenantSlug } = await params;

  try {
    await resolveSalesPosTypePageContext(tenantSlug, "reports", ["variants"], "read");
  } catch (error) {
    if (isTenantAccessDeniedError(error)) {
      return (
        <StatePanel
          kind="permission"
          title="Sin acceso a reportes POS avanzados"
          message="Este tenant no tiene habilitada la experiencia de reportes basada en POS configurable."
        />
      );
    }

    throw error;
  }

  return (
    <div className="space-y-4">
      <PosReportsSubnav tenantSlug={tenantSlug} />
      {children}
    </div>
  );
}
