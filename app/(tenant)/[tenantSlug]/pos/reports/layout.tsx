import type { ReactNode } from "react";
import { isTenantAccessDeniedError } from "@/app/(tenant)/lib/access-errors";
import { PosReportsSubnav } from "@/components/pos/reports/PosReportsSubnav";
import { StatePanel } from "@/components/ui/state-panel";
import { resolveSalesPosPageContext } from "@/lib/auth/module-page-access";

type PosReportsLayoutProps = {
  children: ReactNode;
  params: Promise<{ tenantSlug: string }>;
};

export default async function PosReportsLayout({ children, params }: PosReportsLayoutProps) {
  const { tenantSlug } = await params;
  let tenantPosType: "simple" | "variants" | "retail" | "unknown";

  try {
    const tenant = await resolveSalesPosPageContext(tenantSlug, "reports", "read");
    tenantPosType = tenant.posType;
  } catch (error) {
    if (isTenantAccessDeniedError(error)) {
      return (
        <StatePanel
          kind="permission"
          title="Sin acceso a reportes POS"
          message="Tu usuario no tiene permisos para consultar reportes POS en este tenant."
        />
      );
    }

    throw error;
  }

  if (tenantPosType === "retail") {
    return (
      <StatePanel
        kind="permission"
        title="Sin acceso a reportes POS"
        message="Este tenant no usa la experiencia de reportes basada en sales_pos."
      />
    );
  }

  return (
    <div className="space-y-4">
      <PosReportsSubnav tenantSlug={tenantSlug} posType={tenantPosType} />
      {children}
    </div>
  );
}
