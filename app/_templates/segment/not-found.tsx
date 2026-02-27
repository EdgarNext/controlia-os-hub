import { StatePanel } from "@/components/ui/state-panel";

export default function SegmentNotFoundTemplate() {
  return (
    <StatePanel
      kind="empty"
      title="Recurso no encontrado"
      message="No se encontro informacion para este segmento en el contexto actual."
    />
  );
}
