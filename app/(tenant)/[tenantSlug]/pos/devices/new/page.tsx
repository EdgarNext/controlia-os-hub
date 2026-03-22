import Link from "next/link";
import { isTenantAccessDeniedError } from "@/app/(tenant)/lib/access-errors";
import { getNextAvailableKioskNumber, listKiosksForDevices } from "@/actions/pos/devices/actions";
import { DeviceClaimCreator } from "./components/DeviceClaimCreator";
import { CreateKioskForm } from "./components/CreateKioskForm";
import { CatalogSectionHeader } from "@/components/pos/catalog/CatalogSectionHeader";
import { StatePanel } from "@/components/ui/state-panel";

type PosDeviceNewPageProps = {
  params: Promise<{ tenantSlug: string }>;
};

type PosDeviceNewResult =
  | {
      ok: true;
      tenantSlug: string;
      kiosks: Awaited<ReturnType<typeof listKiosksForDevices>>;
      nextKioskNumber: number;
    }
  | {
      ok: false;
      message: string;
      hint: string;
    };

async function loadPosDeviceNewPage(tenantSlug: string): Promise<PosDeviceNewResult> {
  try {
    const [kiosks, nextKioskNumber] = await Promise.all([
      listKiosksForDevices(tenantSlug),
      getNextAvailableKioskNumber(tenantSlug),
    ]);

    return {
      ok: true,
      tenantSlug,
      kiosks,
      nextKioskNumber,
    };
  } catch (error) {
    if (isTenantAccessDeniedError(error)) {
      return {
        ok: false,
        message: "Este tenant no tiene activo el módulo sales_pos o no tienes acceso a emitir claims de dispositivos POS.",
        hint: "Activa sales_pos desde el catalogo de modulos y recuerda que esta pantalla sigue reservada para Platform Owner.",
      };
    }

    throw error;
  }
}

export default async function PosDeviceNewPage({ params }: PosDeviceNewPageProps) {
  const { tenantSlug } = await params;
  const result = await loadPosDeviceNewPage(tenantSlug);

  return (
    <div className="space-y-4">
      <CatalogSectionHeader
        title="POS · Agregar dispositivo"
        description="Asigna un kiosco y emite un código de pairing para activar un equipo Edge."
      />

      {result.ok ? (
        <div className="space-y-4">
          {result.kiosks.length > 0 ? (
            <DeviceClaimCreator tenantSlug={result.tenantSlug} kiosks={result.kiosks} />
          ) : (
            <StatePanel
              kind="empty"
              title="Sin kioscos disponibles"
              message="Primero registra un kiosco operativo para poder asignar dispositivos POS."
            >
              <Link href={`/${tenantSlug}/pos/devices`} className="text-sm font-medium text-primary hover:underline">
                Volver a Dispositivos
              </Link>
            </StatePanel>
          )}
          <CreateKioskForm tenantSlug={result.tenantSlug} nextNumber={result.nextKioskNumber} />
        </div>
      ) : (
        <StatePanel kind="permission" title="Sin permisos" message={result.message}>
          <p className="text-xs text-muted">{result.hint}</p>
        </StatePanel>
      )}
    </div>
  );
}
