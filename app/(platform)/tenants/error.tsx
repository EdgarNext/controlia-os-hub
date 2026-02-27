"use client";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { StatePanel } from "@/components/ui/state-panel";

export default function TenantsError({ reset }: { reset: () => void }) {
  return (
    <Card className="space-y-3">
      <StatePanel
        kind="error"
        title="No se pudo cargar la gestion de tenants"
        message="Intenta recargar la vista."
      />
      <Button type="button" onClick={reset}>
        Reintentar
      </Button>
    </Card>
  );
}
