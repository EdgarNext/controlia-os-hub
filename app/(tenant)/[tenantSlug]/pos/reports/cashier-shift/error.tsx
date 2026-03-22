"use client";

import { Button } from "@/components/ui/button";
import { StatePanel } from "@/components/ui/state-panel";

export default function PosCashierShiftError({ reset }: { error: Error; reset: () => void }) {
  return (
    <div className="space-y-4">
      <StatePanel
        kind="error"
        title="No se pudo cargar el reporte de cortes"
        message="Ocurrio un error al consultar la vista de cortes de caja. Intenta nuevamente."
      />
      <Button type="button" onClick={() => reset()}>
        Reintentar
      </Button>
    </div>
  );
}
