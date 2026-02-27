import type { ReactNode } from "react";
import { AppShell } from "@/components/layout/AppShell";
import { requirePlatformOwner } from "@/lib/auth/require-platform-owner";
import { platformNav } from "@/lib/navigation/platform-nav";

// Depende de cookies/session; no cacheable.
export const dynamic = "force-dynamic";

export default async function PlatformLayout({ children }: { children: ReactNode }) {
  const { user } = await requirePlatformOwner();

  return (
    <AppShell navSections={platformNav} userEmail={user.email}>
      {children}
    </AppShell>
  );
}
