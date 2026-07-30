import Link from "next/link";
import { notFound } from "next/navigation";
import { isTenantAccessDeniedError } from "@/app/(tenant)/lib/access-errors";
import {
  getDeviceById,
  getDeviceManagementCapabilities,
  getNextAvailableKioskNumber,
  listRetailPosOperators,
  listDevices,
  listKiosksForDevices,
} from "@/actions/pos/devices/actions";
import { DeviceDetailActions } from "@/app/(tenant)/[tenantSlug]/pos/devices/[deviceId]/components/DeviceDetailActions";
import { CreateKioskForm } from "@/app/(tenant)/[tenantSlug]/pos/devices/new/components/CreateKioskForm";
import { DeviceClaimCreator } from "@/app/(tenant)/[tenantSlug]/pos/devices/new/components/DeviceClaimCreator";
import { CatalogSectionHeader } from "@/components/pos/catalog/CatalogSectionHeader";
import { StatePanel } from "@/components/ui/state-panel";

type DeviceAdminRouteContext = {
  basePath: (tenantSlug: string) => string;
  listTitle: string;
  listDescription: string;
  newTitle: string;
  newDescription: string;
  detailTitle: string;
  detailDescription: (deviceName: string, deviceId: string) => string;
  permissionMessage: string;
  permissionHint: string;
  emptyTitle: string;
  emptyMessage: string;
  addDeviceLabel: string;
  backToListLabel: string;
};

type DeviceAdminIndexProps = {
  tenantSlug: string;
  context: DeviceAdminRouteContext;
};

type DeviceAdminNewProps = DeviceAdminIndexProps;

type DeviceAdminDetailProps = DeviceAdminIndexProps & {
  deviceId: string;
};

type DevicesPageResult =
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

type DeviceNewPageResult =
  | {
      ok: true;
      tenantSlug: string;
      capabilities: Awaited<ReturnType<typeof getDeviceManagementCapabilities>>;
      kiosks: Awaited<ReturnType<typeof listKiosksForDevices>>;
      operators: Awaited<ReturnType<typeof listRetailPosOperators>>;
      nextKioskNumber: number;
    }
  | {
      ok: false;
      message: string;
      hint: string;
    };

type DeviceDetailPageResult =
  | {
      ok: true;
      tenantSlug: string;
      device: NonNullable<Awaited<ReturnType<typeof getDeviceById>>>;
      kiosks: Awaited<ReturnType<typeof listKiosksForDevices>>;
      operators: Awaited<ReturnType<typeof listRetailPosOperators>>;
    }
  | {
      ok: false;
      message: string;
      hint: string;
    };

export const posDeviceAdminRouteContext: DeviceAdminRouteContext = {
  basePath: (tenantSlug) => `/${tenantSlug}/pos/devices`,
  listTitle: "POS · Dispositivos",
  listDescription: "Administra equipos Edge, claiming y estado operativo para sales_pos y retail_pos.",
  newTitle: "POS · Agregar dispositivo",
  newDescription: "Emite códigos de activación para equipos Edge de sales_pos o retail_pos desde una sola consola.",
  detailTitle: "POS · Detalle de dispositivo",
  detailDescription: (deviceName, deviceId) => `Equipo ${deviceName} (${deviceId}).`,
  permissionMessage: "Solo Platform Owner puede administrar dispositivos POS en Fase A.",
  permissionHint: "La asignación de equipos físicos al tenant sigue reservada a la operación de plataforma.",
  emptyTitle: "Sin dispositivos registrados",
  emptyMessage: "Agrega el primer equipo Edge para iniciar claiming y sincronización de sales_pos o retail_pos.",
  addDeviceLabel: "Agregar dispositivo",
  backToListLabel: "Volver a Dispositivos",
};

export const retailDeviceAdminRouteContext: DeviceAdminRouteContext = {
  basePath: (tenantSlug) => `/${tenantSlug}/retail/devices`,
  listTitle: "Retail · Terminales",
  listDescription: "Administra terminales retail, códigos de activación y estado operativo sin salir del contexto retail.",
  newTitle: "Retail · Activación de terminales",
  newDescription: "Genera códigos de activación para terminales retail reutilizando el flujo generalizado de provisioning.",
  detailTitle: "Retail · Detalle de terminal",
  detailDescription: (deviceName, deviceId) => `Terminal ${deviceName} (${deviceId}).`,
  permissionMessage: "Solo Platform Owner puede administrar terminales retail en Fase A.",
  permissionHint: "El tenant no puede autoprovisionar dispositivos físicos en esta etapa.",
  emptyTitle: "Sin terminales registradas",
  emptyMessage: "Genera la primera terminal retail para iniciar el claiming y sincronización del módulo retail_pos.",
  addDeviceLabel: "Activar terminal",
  backToListLabel: "Volver a Terminales",
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

async function loadDevicesPage(
  tenantSlug: string,
  context: DeviceAdminRouteContext,
): Promise<DevicesPageResult> {
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
        message: context.permissionMessage,
        hint: context.permissionHint,
      };
    }

    throw error;
  }
}

async function loadDeviceNewPage(
  tenantSlug: string,
  context: DeviceAdminRouteContext,
): Promise<DeviceNewPageResult> {
  try {
    const capabilities = await getDeviceManagementCapabilities(tenantSlug);
    const [kiosks, nextKioskNumber, operators] = await Promise.all([
      capabilities.canManageSalesPosDevices ? listKiosksForDevices(tenantSlug) : Promise.resolve([]),
      capabilities.canManageSalesPosDevices ? getNextAvailableKioskNumber(tenantSlug) : Promise.resolve(1),
      capabilities.canManageRetailPosDevices ? listRetailPosOperators(tenantSlug) : Promise.resolve([]),
    ]);

    return {
      ok: true,
      tenantSlug,
      capabilities,
      kiosks,
      operators,
      nextKioskNumber,
    };
  } catch (error) {
    if (isTenantAccessDeniedError(error)) {
      return {
        ok: false,
        message: context.permissionMessage,
        hint: context.permissionHint,
      };
    }

    throw error;
  }
}

async function loadDeviceDetailPage(
  tenantSlug: string,
  deviceId: string,
  context: DeviceAdminRouteContext,
): Promise<DeviceDetailPageResult> {
  try {
    const [device, kiosks, operators] = await Promise.all([
      getDeviceById(tenantSlug, deviceId),
      getDeviceManagementCapabilities(tenantSlug).then((capabilities) =>
        capabilities.canManageSalesPosDevices ? listKiosksForDevices(tenantSlug) : [],
      ),
      getDeviceManagementCapabilities(tenantSlug).then((capabilities) =>
        capabilities.canManageRetailPosDevices ? listRetailPosOperators(tenantSlug) : [],
      ),
    ]);

    if (!device) {
      notFound();
    }

    return {
      ok: true,
      tenantSlug,
      device,
      kiosks,
      operators,
    };
  } catch (error) {
    if (isTenantAccessDeniedError(error)) {
      return {
        ok: false,
        message: context.permissionMessage,
        hint: context.permissionHint,
      };
    }

    throw error;
  }
}

export async function DeviceAdminListPage({ tenantSlug, context }: DeviceAdminIndexProps) {
  const result = await loadDevicesPage(tenantSlug, context);

  return (
    <div className="space-y-4">
      <CatalogSectionHeader title={context.listTitle} description={context.listDescription} />

      {result.ok ? (
        <>
          <div className="flex justify-end">
            <Link
              href={`${context.basePath(result.tenantSlug)}/new`}
              className="inline-flex items-center justify-center rounded-[var(--radius-base)] border border-border bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-opacity duration-200 hover:opacity-90"
            >
              {context.addDeviceLabel}
            </Link>
          </div>

          {result.devices.length === 0 ? (
            <StatePanel kind="empty" title={context.emptyTitle} message={context.emptyMessage} />
          ) : (
            <div className="overflow-hidden rounded-[var(--radius-base)] border border-border bg-surface">
              <table className="w-full text-left text-sm">
                <thead className="bg-surface-2 text-xs uppercase tracking-[0.08em] text-muted">
                  <tr>
                    <th className="px-4 py-3 font-semibold">Dispositivo</th>
                    <th className="px-4 py-3 font-semibold">Módulo</th>
                    <th className="px-4 py-3 font-semibold">Asignación</th>
                    <th className="px-4 py-3 font-semibold">Estado</th>
                    <th className="px-4 py-3 font-semibold">Última señal</th>
                    <th className="px-4 py-3 font-semibold">Última sync</th>
                    <th className="px-4 py-3 font-semibold">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {result.devices.map((device) => {
                    const detailHref = `${context.basePath(result.tenantSlug)}/${device.id}`;
                    const assignmentLabel =
                      device.moduleKey === "retail_pos"
                        ? device.deviceRole ?? "Sin rol retail"
                        : device.kiosk?.name ?? (device.kiosk ? `Kiosco ${device.kiosk.number}` : "Sin kiosco");

                    return (
                      <tr key={device.id} className="border-t border-border">
                        <td className="px-4 py-3">
                          <p className="font-medium text-foreground">{device.name}</p>
                          <p className="text-xs text-muted">ID técnico: {device.deviceId}</p>
                        </td>
                        <td className="px-4 py-3">
                          <p className="text-foreground">{device.moduleKey}</p>
                        </td>
                        <td className="px-4 py-3">
                          <p className="text-foreground">{assignmentLabel}</p>
                          {device.moduleKey === "sales_pos" && device.kiosk ? (
                            <p className="text-xs text-muted">Número: {device.kiosk.number}</p>
                          ) : null}
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

export async function DeviceAdminNewPage({ tenantSlug, context }: DeviceAdminNewProps) {
  const result = await loadDeviceNewPage(tenantSlug, context);

  return (
    <div className="space-y-4">
      <CatalogSectionHeader title={context.newTitle} description={context.newDescription} />

      {result.ok ? (
        <div className="space-y-4">
          <DeviceClaimCreator
            tenantSlug={result.tenantSlug}
            kiosks={result.kiosks}
            canManageSalesPosDevices={result.capabilities.canManageSalesPosDevices}
            canManageRetailPosDevices={result.capabilities.canManageRetailPosDevices}
            operators={result.operators}
          />
          {result.capabilities.canManageSalesPosDevices && result.kiosks.length === 0 ? (
            <StatePanel
              kind="empty"
              title="Sin kioscos operativos"
              message="Puedes emitir claims retail_pos desde ahora. Para sales_pos primero registra un kiosco operativo."
            >
              <Link href={context.basePath(tenantSlug)} className="text-sm font-medium text-primary hover:underline">
                {context.backToListLabel}
              </Link>
            </StatePanel>
          ) : null}
          {result.capabilities.canManageSalesPosDevices ? (
            <CreateKioskForm tenantSlug={result.tenantSlug} nextNumber={result.nextKioskNumber} />
          ) : null}
        </div>
      ) : (
        <StatePanel kind="permission" title="Sin permisos" message={result.message}>
          <p className="text-xs text-muted">{result.hint}</p>
        </StatePanel>
      )}
    </div>
  );
}

export async function DeviceAdminDetailPage({ tenantSlug, deviceId, context }: DeviceAdminDetailProps) {
  const result = await loadDeviceDetailPage(tenantSlug, deviceId, context);

  if (!result.ok) {
    return (
      <div className="space-y-4">
        <CatalogSectionHeader title={context.detailTitle} description="Consulta y controla un equipo Edge del tenant." />
        <StatePanel kind="permission" title="Sin permisos" message={result.message}>
          <p className="text-xs text-muted">{result.hint}</p>
        </StatePanel>
      </div>
    );
  }

  const kioskLabel = result.device.kiosk?.name ?? (result.device.kiosk ? `Kiosco ${result.device.kiosk.number}` : "Sin kiosco");
  const assignmentLabel = result.device.moduleKey === "retail_pos" ? result.device.deviceRole ?? "Sin rol retail" : kioskLabel;

  return (
    <div className="space-y-4">
      <CatalogSectionHeader
        title={context.detailTitle}
        description={context.detailDescription(result.device.name, result.device.deviceId)}
      />

      <div className="rounded-[var(--radius-base)] border border-border bg-surface p-4">
        <div className="grid gap-3 md:grid-cols-2">
          <p className="text-sm text-muted">
            <span className="font-medium text-foreground">Módulo:</span> {result.device.moduleKey}
          </p>
          <p className="text-sm text-muted">
            <span className="font-medium text-foreground">{result.device.moduleKey === "retail_pos" ? "Rol retail:" : "Kiosco:"}</span> {assignmentLabel}
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
        moduleKey={result.device.moduleKey}
        deviceRole={result.device.deviceRole}
        kioskId={result.device.kioskId}
        deviceName={result.device.name}
        kiosks={result.kiosks}
        operators={result.operators}
        disabled={result.device.status === "disabled"}
      />
    </div>
  );
}
