import type { ReactNode } from "react";
import type { NavSection } from "@/lib/navigation/platform-nav";
import type { AppTheme } from "@/lib/theme/constants";
import { PageFrame } from "./PageFrame";
import { Sidebar } from "./Sidebar";
import { TopBar } from "./TopBar";

type AppShellProps = {
  children: ReactNode;
  navSections: NavSection[];
  contentMode?: "fluid" | "reading";
  userEmail?: string | null;
  theme: AppTheme;
};

export function AppShell({ children, navSections, contentMode = "fluid", userEmail, theme }: AppShellProps) {
  return (
    <div className="h-screen overflow-hidden bg-background text-foreground">
      <TopBar userEmail={userEmail} theme={theme} />
      <div className="flex h-[calc(100vh-56px)]">
        <Sidebar sections={navSections} />
        <main className="min-w-0 flex-1 overflow-y-auto">
          <PageFrame mode={contentMode}>{children}</PageFrame>
        </main>
      </div>
    </div>
  );
}
