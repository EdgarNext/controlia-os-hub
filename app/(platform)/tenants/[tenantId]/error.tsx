"use client";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

export default function TenantDetailError({ reset }: { reset: () => void }) {
  return (
    <Card className="space-y-3">
      <h2 className="text-base font-semibold">No se pudo cargar el tenant</h2>
      <p className="text-sm text-muted">Verifica permisos o vuelve a intentar.</p>
      <Button type="button" onClick={reset}>
        Reintentar
      </Button>
    </Card>
  );
}
