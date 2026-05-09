import type { ReactNode } from "react";
import { KitchenModuleShell } from "./_components/kitchen-module-shell";

type KitchenLayoutProps = {
  children: ReactNode;
  params: Promise<{ tenantSlug: string }>;
};

export default async function KitchenLayout({ children, params }: KitchenLayoutProps) {
  const { tenantSlug } = await params;
  return <KitchenModuleShell tenantSlug={tenantSlug}>{children}</KitchenModuleShell>;
}
