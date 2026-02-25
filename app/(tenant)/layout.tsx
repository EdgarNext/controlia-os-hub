import type { ReactNode } from "react";
import { requireUser } from "@/lib/auth/require-user";

export default async function TenantLayout({ children }: { children: ReactNode }) {
  await requireUser();
  return children;
}
