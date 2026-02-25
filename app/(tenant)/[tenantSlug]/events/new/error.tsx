"use client";

import { useEffect } from "react";
import { toast } from "sonner";
import { PageFrame } from "@/components/layout/PageFrame";
import { Button } from "@/components/ui/button";
import { StatePanel } from "./components/StatePanel";

export default function EventNewError({ error, reset }: { error: Error; reset: () => void }) {
  useEffect(() => {
    toast.error(error.message || "No se pudo cargar el wizard de eventos.");
  }, [error]);

  return (
    <PageFrame>
      <div className="space-y-4">
        <StatePanel kind="error" title="Unable to load event wizard" message={error.message} />
        <Button type="button" onClick={() => reset()}>
          Retry
        </Button>
      </div>
    </PageFrame>
  );
}
