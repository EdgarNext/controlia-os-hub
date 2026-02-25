"use client";

import { toast } from "sonner";
import { Button } from "@/components/ui/button";

export function ToastDemo() {
  return (
    <div className="flex flex-wrap gap-2">
      <Button onClick={() => toast.success("Success toast demo")}>Success</Button>
      <Button variant="warning" onClick={() => toast.warning("Warning toast demo")}>
        Warning
      </Button>
      <Button variant="danger" onClick={() => toast.error("Danger toast demo")}>
        Error
      </Button>
      <Button variant="secondary" onClick={() => toast.info("Info toast demo")}>
        Info
      </Button>
    </div>
  );
}
