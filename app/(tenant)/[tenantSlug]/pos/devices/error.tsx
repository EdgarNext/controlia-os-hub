"use client";

import { Button } from "@/components/ui/button";
import { StatePanel } from "@/components/ui/state-panel";

export default function PosDevicesError({ error, reset }: { error: Error; reset: () => void }) {
  return (
    <div className="space-y-4">
      <StatePanel
        kind="error"
        title="No se pudo cargar dispositivos"
        message={error.message || "Ocurrió un error al cargar la vista de dispositivos POS."}
      />
      <Button type="button" onClick={() => reset()}>
        Reintentar
      </Button>
    </div>
  );
}
