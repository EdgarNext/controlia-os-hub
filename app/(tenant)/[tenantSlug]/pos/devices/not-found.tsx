import Link from "next/link";
import { StatePanel } from "@/components/ui/state-panel";

export default function PosDevicesNotFound() {
  return (
    <StatePanel
      kind="empty"
      title="Vista no encontrada"
      message="No encontramos el segmento solicitado en Dispositivos POS."
    >
      <Link href="./" className="text-sm font-medium text-primary hover:underline">
        Volver a Dispositivos
      </Link>
    </StatePanel>
  );
}
