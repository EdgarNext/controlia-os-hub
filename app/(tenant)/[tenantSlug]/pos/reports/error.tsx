"use client";

import { Button } from "@/components/ui/button";
import { StatePanel } from "@/components/ui/state-panel";

export default function PosReportsError({
  reset,
}: {
  error: Error;
  reset: () => void;
}) {
  return (
    <div className="space-y-4">
      <StatePanel
        kind="error"
        title="No se pudo cargar el overview POS"
        message="Ocurrio un error al consultar los reportes del POS. Intenta nuevamente."
      />
      <Button type="button" onClick={() => reset()}>
        Reintentar
      </Button>
    </div>
  );
}
