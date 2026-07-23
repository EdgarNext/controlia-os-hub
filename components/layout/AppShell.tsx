import type { ReactNode } from "react";
import type { NavSection } from "@/lib/navigation/platform-nav";
import type { AppTheme } from "@/lib/theme/constants";
import { PageFrame } from "./PageFrame";
import { Sidebar } from "./Sidebar";
import { TopBar } from "./TopBar";
import type { TenantBranding } from "@/lib/navigation/tenant-branding";
import { formatLocalDateTime } from "@/lib/formatters/local-date-time";

type AppShellProps = {
  children: ReactNode;
  navSections: NavSection[];
  contentMode?: "fluid" | "reading";
  userEmail?: string | null;
  theme: AppTheme;
  variant: "platform" | "tenant";
  brandName?: string;
  tenantBranding?: TenantBranding | null;
};

export function AppShell({
  children,
  navSections,
  contentMode = "fluid",
  userEmail,
  theme,
  variant,
  brandName,
  tenantBranding,
}: AppShellProps) {
  const initialDate = new Date();

  return (
    <div className="h-screen overflow-hidden bg-background text-foreground">
      <TopBar
        userEmail={userEmail}
        theme={theme}
        variant={variant}
        brandName={brandName}
        tenantBranding={tenantBranding}
        initialLocalTime={formatLocalDateTime(initialDate)}
        initialDateTime={initialDate.toISOString()}
      />
      <div className="flex h-[calc(100vh-56px)]">
        <Sidebar sections={navSections} />
        <main className="min-w-0 flex-1 overflow-y-auto">
          <PageFrame mode={contentMode}>{children}</PageFrame>
        </main>
      </div>
    </div>
  );
}
