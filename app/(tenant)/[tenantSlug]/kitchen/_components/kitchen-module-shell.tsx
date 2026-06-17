import type { ReactNode } from "react";

type KitchenModuleShellProps = {
  tenantSlug: string;
  children: ReactNode;
};

export function KitchenModuleShell({ tenantSlug, children }: KitchenModuleShellProps) {
  void tenantSlug;
  return <section>{children}</section>;
}
