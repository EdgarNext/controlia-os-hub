import Link from "next/link";
import { StatePanel } from "@/components/ui/state-panel";

export default function PosCatalogProductsNotFound() {
  return (
    <StatePanel
      kind="empty"
      title="Producto no encontrado"
      message="No encontramos el recurso solicitado en productos POS."
    >
      <Link href="./" className="text-sm font-medium text-primary hover:underline">
        Volver a Productos
      </Link>
    </StatePanel>
  );
}
