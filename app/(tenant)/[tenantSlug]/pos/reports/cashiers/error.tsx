"use client";

import { Button } from "@/components/ui/button";
import { StatePanel } from "@/components/ui/state-panel";

export default function PosCashiersError({ reset }: { error: Error; reset: () => void }) {
  return (
    <div className="space-y-4">
      <StatePanel
        kind="error"
        title="No se pudo cargar el reporte de cajeros"
        message="Ocurrio un error al consultar la vista por cajero. Intenta nuevamente."
      />
      <Button type="button" onClick={() => reset()}>
        Reintentar
      </Button>
    </div>
  );
}
