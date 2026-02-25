"use client";

import { useEffect } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { StatePanel } from "../../components/StatePanel";

export default function RoomSetupError({ error, reset }: { error: Error; reset: () => void }) {
  useEffect(() => {
    toast.error(error.message || "No se pudo cargar la configuracion de sala.");
  }, [error]);

  return (
    <div className="space-y-4">
      <StatePanel kind="error" title="Unable to load room setup" message={error.message} />
      <Button type="button" onClick={() => reset()}>
        Retry
      </Button>
    </div>
  );
}
