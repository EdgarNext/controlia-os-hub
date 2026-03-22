"use client";

import { Button } from "@/components/ui/button";
import { StatePanel } from "@/components/ui/state-panel";

export default function PosCatalogCategoriesError({
  error,
  reset,
}: {
  error: Error;
  reset: () => void;
}) {
  return (
    <div className="space-y-4">
      <StatePanel
        kind="error"
        title="No se pudieron cargar las categorías"
        message={error.message || "Ocurrió un error al consultar categorías del catálogo POS."}
      />
      <Button type="button" onClick={() => reset()}>
        Reintentar
      </Button>
    </div>
  );
}
