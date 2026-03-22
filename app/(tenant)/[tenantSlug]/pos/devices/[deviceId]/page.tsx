import { notFound } from "next/navigation";
import { isTenantAccessDeniedError } from "@/app/(tenant)/lib/access-errors";
import { getDeviceById, listKiosksForDevices } from "@/actions/pos/devices/actions";
import { DeviceDetailActions } from "./components/DeviceDetailActions";
import { CatalogSectionHeader } from "@/components/pos/catalog/CatalogSectionHeader";
import { StatePanel } from "@/components/ui/state-panel";

type PosDeviceDetailPageProps = {
  params: Promise<{ tenantSlug: string; deviceId: string }>;
};

type PosDeviceDetailResult =
  | {
      ok: true;
      tenantSlug: string;
      device: NonNullable<Awaited<ReturnType<typeof getDeviceById>>>;
      kiosks: Awaited<ReturnType<typeof listKiosksForDevices>>;
    }
  | {
      ok: false;
      message: string;
      hint: string;
    };

function formatTimestamp(value: string | null): string {
  if (!value) {
    return "Sin registro";
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return "Sin registro";
  }

  return parsed.toLocaleString("es-MX");
}

function formatDeviceStatus(status: "pending" | "active" | "revoked" | "disabled"): string {
  if (status === "pending") return "Pendiente";
  if (status === "active") return "Activo";
  if (status === "revoked") return "Revocado";
  return "Deshabilitado";
}

async function loadPosDeviceDetailPage(
  tenantSlug: string,
  deviceRecordId: string,
): Promise<PosDeviceDetailResult> {
  try {
    const [device, kiosks] = await Promise.all([
      getDeviceById(tenantSlug, deviceRecordId),
      listKiosksForDevices(tenantSlug),
    ]);

    if (!device) {
      notFound();
    }

    return {
      ok: true,
      tenantSlug,
      device,
      kiosks,
    };
  } catch (error) {
    if (isTenantAccessDeniedError(error)) {
      return {
        ok: false,
        message: "Este tenant no tiene activo el módulo sales_pos o no tienes acceso para administrar este dispositivo POS.",
        hint: "Activa sales_pos desde el catalogo de modulos y recuerda que esta pantalla sigue reservada para Platform Owner.",
      };
    }

    throw error;
  }
}

export default async function PosDeviceDetailPage({ params }: PosDeviceDetailPageProps) {
  const { tenantSlug, deviceId } = await params;
  const result = await loadPosDeviceDetailPage(tenantSlug, deviceId);

  if (!result.ok) {
    return (
      <div className="space-y-4">
        <CatalogSectionHeader title="POS · Detalle de dispositivo" description="Consulta y controla un equipo Edge del POS." />
        <StatePanel kind="permission" title="Sin permisos" message={result.message}>
          <p className="text-xs text-muted">{result.hint}</p>
        </StatePanel>
      </div>
    );
  }

  const kioskLabel = result.device.kiosk?.name ?? (result.device.kiosk ? `Kiosco ${result.device.kiosk.number}` : "Sin kiosco");

  return (
    <div className="space-y-4">
      <CatalogSectionHeader
        title="POS · Detalle de dispositivo"
        description={`Equipo ${result.device.name} (${result.device.deviceId}).`}
      />

      <div className="rounded-[var(--radius-base)] border border-border bg-surface p-4">
        <div className="grid gap-3 md:grid-cols-2">
          <p className="text-sm text-muted">
            <span className="font-medium text-foreground">Kiosco:</span> {kioskLabel}
          </p>
          <p className="text-sm text-muted">
            <span className="font-medium text-foreground">Estado:</span> {formatDeviceStatus(result.device.status)}
          </p>
          <p className="text-sm text-muted">
            <span className="font-medium text-foreground">Última señal:</span> {formatTimestamp(result.device.lastSeenAt)}
          </p>
          <p className="text-sm text-muted">
            <span className="font-medium text-foreground">Última sync:</span> {formatTimestamp(result.device.lastSyncAt)}
          </p>
          <p className="text-sm text-muted">
            <span className="font-medium text-foreground">Última sync catálogo:</span> No disponible (contrato actual usa `last_sync_at`).
          </p>
          <p className="text-sm text-muted">
            <span className="font-medium text-foreground">Última sync órdenes:</span> No disponible (contrato actual usa `last_sync_at`).
          </p>
          <p className="text-sm text-muted md:col-span-2">
            <span className="font-medium text-foreground">Claim vigente:</span>{" "}
            {result.device.claimCode ? `${result.device.claimCode} (vence ${formatTimestamp(result.device.claimExpiresAt)})` : "Sin claim activo"}
          </p>
        </div>
      </div>

      <DeviceDetailActions
        tenantSlug={result.tenantSlug}
        deviceRecordId={result.device.id}
        kioskId={result.device.kioskId}
        deviceName={result.device.name}
        kiosks={result.kiosks}
        disabled={result.device.status === "disabled"}
      />
    </div>
  );
}
