import type { ReactNode } from "react";
import { CatalogV2NavTabs } from "@/components/pos/catalog-v2/CatalogV2NavTabs";
import { Card } from "@/components/ui/card";

type CatalogV2LayoutProps = {
  children: ReactNode;
  params: Promise<{ tenantSlug: string }>;
};

export default async function CatalogV2Layout({ children, params }: CatalogV2LayoutProps) {
  const { tenantSlug } = await params;

  return (
    <div className="space-y-6">
      <Card className="space-y-4 border-border/80 bg-surface p-4">
        <div className="space-y-1">
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-muted">POS · Experiencia paralela</p>
          <h1 className="text-2xl font-semibold text-foreground">Catálogo V2</h1>
          <p className="max-w-3xl text-sm text-muted">
            Arquitectura nueva centrada en categorías, modifiers, productos y detalle operativo, sin saltos al flujo
            legacy.
          </p>
        </div>
        <CatalogV2NavTabs tenantSlug={tenantSlug} />
      </Card>

      {children}
    </div>
  );
}
