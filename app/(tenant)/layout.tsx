import type { ReactNode } from "react";
import { requireUser } from "@/lib/auth/require-user";

// Depende de cookies/session; no cacheable.
export const dynamic = "force-dynamic";

export default async function TenantLayout({ children }: { children: ReactNode }) {
  await requireUser();
  return children;
}
