"use client";

import { Button } from "@/components/ui/button";
import { StatePanel } from "@/components/ui/state-panel";

type SegmentErrorTemplateProps = {
  error: Error;
  reset: () => void;
};

export default function SegmentErrorTemplate({ error, reset }: SegmentErrorTemplateProps) {
  return (
    <div className="space-y-4">
      <StatePanel
        kind="error"
        title="No se pudo cargar este segmento"
        message={error.message || "Ocurrio un error inesperado. Intenta nuevamente."}
      />
      <Button type="button" onClick={() => reset()}>
        Reintentar
      </Button>
    </div>
  );
}
