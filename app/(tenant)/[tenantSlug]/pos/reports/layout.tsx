import type { ReactNode } from "react";
import { PosReportsSubnav } from "@/components/pos/reports/PosReportsSubnav";

type PosReportsLayoutProps = {
  children: ReactNode;
  params: Promise<{ tenantSlug: string }>;
};

export default async function PosReportsLayout({ children, params }: PosReportsLayoutProps) {
  const { tenantSlug } = await params;

  return (
    <div className="space-y-4">
      <PosReportsSubnav tenantSlug={tenantSlug} />
      {children}
    </div>
  );
}
