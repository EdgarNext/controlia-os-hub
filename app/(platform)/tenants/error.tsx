"use client";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

export default function TenantsError({ reset }: { reset: () => void }) {
  return (
    <Card className="space-y-3">
      <h2 className="text-base font-semibold">No se pudo cargar Tenant Manager</h2>
      <p className="text-sm text-muted">Intenta recargar la vista.</p>
      <Button type="button" onClick={reset}>
        Reintentar
      </Button>
    </Card>
  );
}
