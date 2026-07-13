import {
  DeviceAdminDetailPage,
  retailDeviceAdminRouteContext,
} from "@/app/(tenant)/[tenantSlug]/_components/device-admin/DeviceAdminPages";

type RetailDeviceDetailPageProps = {
  params: Promise<{ tenantSlug: string; deviceId: string }>;
};

export default async function RetailDeviceDetailPage({ params }: RetailDeviceDetailPageProps) {
  const { tenantSlug, deviceId } = await params;
  return DeviceAdminDetailPage({
    tenantSlug,
    deviceId,
    context: retailDeviceAdminRouteContext,
  });
}
