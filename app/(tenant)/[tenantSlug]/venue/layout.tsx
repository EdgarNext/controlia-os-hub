import type { ReactNode } from "react";
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
    <div className="space-y-4">
      <SectionHeader title="Configuracion de venue" description="Resumen, salas, equipo y configuracion por sala." />
      <VenueNavTabs tenantSlug={tenantSlug} />
      {children}
    </div>
  );
}
