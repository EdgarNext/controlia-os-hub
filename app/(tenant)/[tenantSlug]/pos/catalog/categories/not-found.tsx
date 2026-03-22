import Link from "next/link";
import { StatePanel } from "@/components/ui/state-panel";

export default function PosCatalogCategoriesNotFound() {
  return (
    <StatePanel
      kind="empty"
      title="Categoría no encontrada"
      message="No encontramos el recurso solicitado en categorías POS."
    >
      <Link href="./" className="text-sm font-medium text-primary hover:underline">
        Volver a Categorías
      </Link>
    </StatePanel>
  );
}
