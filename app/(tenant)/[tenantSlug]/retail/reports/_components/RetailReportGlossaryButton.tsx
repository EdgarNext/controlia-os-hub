"use client";

import { useState } from "react";
import { BookText } from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/button";
import { getRetailReportingGlossaryEntries } from "@/lib/retail-pos/reporting-ui";

export function RetailReportGlossaryButton() {
  const [open, setOpen] = useState(false);
  const glossaryEntries = getRetailReportingGlossaryEntries();

  return (
    <>
      <Button type="button" variant="secondary" onClick={() => setOpen(true)} className="min-h-9 px-3 py-1.5">
        <BookText className="h-4 w-4" aria-hidden="true" />
        Glosario
      </Button>

      <Modal open={open} onClose={() => setOpen(false)} title="Glosario de reportes retail">
        <div className="max-h-[70vh] space-y-4 overflow-y-auto pr-1">
          {glossaryEntries.map((entry) => (
            <section key={entry.key} className="space-y-1">
              <h4 className="text-sm font-semibold text-foreground">{entry.label}</h4>
              <p className="text-sm text-muted">{entry.description}</p>
            </section>
          ))}
        </div>
      </Modal>
    </>
  );
}
