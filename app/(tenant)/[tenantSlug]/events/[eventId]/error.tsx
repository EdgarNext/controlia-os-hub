"use client";

import { useEffect } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { StatePanel } from "./components/StatePanel";

export default function EventDetailsError({ error, reset }: { error: Error; reset: () => void }) {
  useEffect(() => {
    toast.error(error.message || "No se pudieron cargar los detalles del evento.");
  }, [error]);

  return (
    <div className="space-y-4">
      <StatePanel kind="error" title="No se pudieron cargar los detalles del evento" message={error.message} />
      <Button type="button" onClick={() => reset()}>
        Reintentar
      </Button>
    </div>
  );
}
