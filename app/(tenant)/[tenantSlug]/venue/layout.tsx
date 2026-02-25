import type { ReactNode } from "react";
import { PageFrame } from "@/components/layout/PageFrame";
import { SectionHeader } from "./components/SectionHeader";
import { VenueNavTabs } from "./components/VenueNavTabs";

export default async function VenueLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ tenantSlug: string }>;
}) {
  const { tenantSlug } = await params;

  return (
    <PageFrame>
      <div className="space-y-4">
        <SectionHeader title="Venue Config" description="Venue Overview, Rooms, Equipment y Setup por sala." />
        <VenueNavTabs tenantSlug={tenantSlug} />
        {children}
      </div>
    </PageFrame>
  );
}
