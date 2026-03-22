"use client";

import { Button } from "@/components/ui/button";
import { StatePanel } from "@/components/ui/state-panel";

export default function PosProductsError({ reset }: { error: Error; reset: () => void }) {
  return (
    <div className="space-y-4">
      <StatePanel
        kind="error"
        title="No se pudo cargar el reporte de productos"
        message="Ocurrio un error al consultar la vista por producto. Intenta nuevamente."
      />
      <Button type="button" onClick={() => reset()}>
        Reintentar
      </Button>
    </div>
  );
}
