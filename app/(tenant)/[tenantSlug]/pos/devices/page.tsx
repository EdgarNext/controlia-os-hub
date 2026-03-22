import Link from "next/link";
import { isTenantAccessDeniedError } from "@/app/(tenant)/lib/access-errors";
import { listDevices } from "@/actions/pos/devices/actions";
import { CatalogSectionHeader } from "@/components/pos/catalog/CatalogSectionHeader";
import { StatePanel } from "@/components/ui/state-panel";

type PosDevicesPageProps = {
  params: Promise<{ tenantSlug: string }>;
};

type PosDevicesPageResult =
  | {
      ok: true;
      tenantSlug: string;
      devices: Awaited<ReturnType<typeof listDevices>>;
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

function formatRelative(value: string | null): string {
  if (!value) {
    return "Sin registro";
  }

  const timestamp = new Date(value).getTime();
  if (Number.isNaN(timestamp)) {
    return "Sin registro";
  }

  const diffMs = Date.now() - timestamp;
  const diffMinutes = Math.floor(diffMs / 60000);

  if (diffMinutes < 1) return "Hace segundos";
  if (diffMinutes < 60) return `Hace ${diffMinutes} min`;

  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) return `Hace ${diffHours} h`;

  const diffDays = Math.floor(diffHours / 24);
  return `Hace ${diffDays} d`;
}

function formatDeviceStatus(status: "pending" | "active" | "revoked" | "disabled"): string {
  if (status === "pending") return "Pendiente";
  if (status === "active") return "Activo";
  if (status === "revoked") return "Revocado";
  return "Deshabilitado";
}

async function loadPosDevicesPage(tenantSlug: string): Promise<PosDevicesPageResult> {
  try {
    const devices = await listDevices(tenantSlug);

    return {
      ok: true,
      tenantSlug: tenantSlug.trim().toLowerCase(),
      devices,
    };
  } catch (error) {
    if (isTenantAccessDeniedError(error)) {
      return {
        ok: false,
        message: "Este tenant no tiene activo el módulo sales_pos o no tienes acceso a la administracion de dispositivos POS.",
        hint: "Activa sales_pos desde el catalogo de modulos y recuerda que esta pantalla sigue reservada para Platform Owner.",
      };
    }

    throw error;
  }
}

export default async function PosDevicesPage({ params }: PosDevicesPageProps) {
  const { tenantSlug } = await params;
  const result = await loadPosDevicesPage(tenantSlug);

  return (
    <div className="space-y-4">
      <CatalogSectionHeader
        title="POS · Dispositivos"
        description="Administra equipos Edge, pairing y estado operativo de sincronización POS."
      />

      {result.ok ? (
        <>
          <div className="flex justify-end">
            <Link
              href={`/${result.tenantSlug}/pos/devices/new`}
              className="inline-flex items-center justify-center rounded-[var(--radius-base)] border border-border bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-opacity duration-200 hover:opacity-90"
            >
              Agregar dispositivo
            </Link>
          </div>

          {result.devices.length === 0 ? (
            <StatePanel
              kind="empty"
              title="Sin dispositivos registrados"
              message="Agrega el primer equipo Edge para iniciar pairing y sincronización POS."
            />
          ) : (
            <div className="overflow-hidden rounded-[var(--radius-base)] border border-border bg-surface">
              <table className="w-full text-left text-sm">
                <thead className="bg-surface-2 text-xs uppercase tracking-[0.08em] text-muted">
                  <tr>
                    <th className="px-4 py-3 font-semibold">Dispositivo</th>
                    <th className="px-4 py-3 font-semibold">Kiosco</th>
                    <th className="px-4 py-3 font-semibold">Estado</th>
                    <th className="px-4 py-3 font-semibold">Última señal</th>
                    <th className="px-4 py-3 font-semibold">Última sync</th>
                    <th className="px-4 py-3 font-semibold">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {result.devices.map((device) => {
                    const detailHref = `/${result.tenantSlug}/pos/devices/${device.id}`;
                    const kioskLabel = device.kiosk?.name ?? (device.kiosk ? `Kiosco ${device.kiosk.number}` : "Sin kiosco");

                    return (
                      <tr key={device.id} className="border-t border-border">
                        <td className="px-4 py-3">
                          <p className="font-medium text-foreground">{device.name}</p>
                          <p className="text-xs text-muted">ID técnico: {device.deviceId}</p>
                        </td>
                        <td className="px-4 py-3">
                          <p className="text-foreground">{kioskLabel}</p>
                          {device.kiosk ? <p className="text-xs text-muted">Número: {device.kiosk.number}</p> : null}
                        </td>
                        <td className="px-4 py-3">
                          <span className="rounded-full border border-border bg-surface-2 px-2 py-1 text-xs text-foreground">
                            {formatDeviceStatus(device.status)}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-muted">
                          <p>{formatRelative(device.lastSeenAt)}</p>
                          <p className="text-xs">{formatTimestamp(device.lastSeenAt)}</p>
                        </td>
                        <td className="px-4 py-3 text-muted">
                          <p>{formatRelative(device.lastSyncAt)}</p>
                          <p className="text-xs">{formatTimestamp(device.lastSyncAt)}</p>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex flex-wrap gap-2">
                            <Link
                              href={detailHref}
                              className="inline-flex items-center justify-center rounded-[var(--radius-base)] border border-border bg-surface-2 px-3 py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-surface"
                            >
                              Ver detalle
                            </Link>
                            <Link
                              href={`${detailHref}#desactivar`}
                              className="inline-flex items-center justify-center rounded-[var(--radius-base)] border border-warning/40 bg-warning/10 px-3 py-1.5 text-xs font-medium text-warning transition-colors hover:bg-warning/20"
                            >
                              Desactivar
                            </Link>
                            <Link
                              href={`${detailHref}#reclaim`}
                              className="inline-flex items-center justify-center rounded-[var(--radius-base)] border border-border bg-surface-2 px-3 py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-surface"
                            >
                              Reemitir claim
                            </Link>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </>
      ) : (
        <StatePanel kind="permission" title="Sin permisos" message={result.message}>
          <p className="text-xs text-muted">{result.hint}</p>
        </StatePanel>
      )}
    </div>
  );
}
