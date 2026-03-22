import Link from "next/link";
import { StatePanel } from "@/components/ui/state-panel";

export default function PosDeviceDetailNotFound() {
  return (
    <StatePanel
      kind="empty"
      title="Dispositivo no encontrado"
      message="No existe un dispositivo POS con ese identificador en este tenant."
    >
      <Link href="../" className="text-sm font-medium text-primary hover:underline">
        Volver a Dispositivos
      </Link>
    </StatePanel>
  );
}
