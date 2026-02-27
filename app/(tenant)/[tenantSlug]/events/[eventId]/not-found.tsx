import Link from "next/link";
import { Button } from "@/components/ui/button";
import { StatePanel } from "@/components/ui/state-panel";

export default function EventNotFound() {
  return (
    <div className="space-y-4">
      <StatePanel
        kind="empty"
        title="Evento no encontrado"
        message="No existe un evento con ese identificador en este tenant."
      />
      <Link href=".." relative="path">
        <Button type="button" variant="secondary">
          Volver a eventos
        </Button>
      </Link>
    </div>
  );
}
