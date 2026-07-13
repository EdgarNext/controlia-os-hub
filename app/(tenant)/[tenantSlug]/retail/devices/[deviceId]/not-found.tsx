import Link from "next/link";
import { StatePanel } from "@/components/ui/state-panel";

export default function RetailDeviceDetailNotFound() {
  return (
    <StatePanel
      kind="empty"
      title="Terminal no encontrada"
      message="No existe una terminal retail con ese identificador en este tenant."
    >
      <Link href="../" className="text-sm font-medium text-primary hover:underline">
        Volver a Terminales
      </Link>
    </StatePanel>
  );
}
