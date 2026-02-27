"use client";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { StatePanel } from "@/components/ui/state-panel";

export default function TenantDetailError({ reset }: { reset: () => void }) {
  return (
    <Card className="space-y-3">
      <StatePanel
        kind="error"
        title="No se pudo cargar el tenant"
        message="Verifica permisos o vuelve a intentar."
      />
      <Button type="button" onClick={reset}>
        Reintentar
      </Button>
    </Card>
  );
}
