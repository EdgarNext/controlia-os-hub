import {
  DeviceAdminListPage,
  posDeviceAdminRouteContext,
} from "@/app/(tenant)/[tenantSlug]/_components/device-admin/DeviceAdminPages";

type PosDevicesPageProps = {
  params: Promise<{ tenantSlug: string }>;
};

export default async function PosDevicesPage({ params }: PosDevicesPageProps) {
  const { tenantSlug } = await params;
  return DeviceAdminListPage({ tenantSlug, context: posDeviceAdminRouteContext });
}
