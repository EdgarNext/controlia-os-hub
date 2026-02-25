import type { ReactNode } from "react";
import type { NavSection } from "@/lib/navigation/platform-nav";
import { PageFrame } from "./PageFrame";
import { Sidebar } from "./Sidebar";
import { TopBar } from "./TopBar";

type AppShellProps = {
  children: ReactNode;
  navSections: NavSection[];
  contentMode?: "fluid" | "reading";
  userEmail?: string | null;
};

export function AppShell({ children, navSections, contentMode = "fluid", userEmail }: AppShellProps) {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <TopBar userEmail={userEmail} />
      <div className="flex min-h-[calc(100vh-56px)]">
        <Sidebar sections={navSections} />
        <main className="min-w-0 flex-1">
          <PageFrame mode={contentMode}>{children}</PageFrame>
        </main>
      </div>
    </div>
  );
}
