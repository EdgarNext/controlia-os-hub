import {
  DeviceAdminListPage,
  retailDeviceAdminRouteContext,
} from "@/app/(tenant)/[tenantSlug]/_components/device-admin/DeviceAdminPages";

type RetailDevicesPageProps = {
  params: Promise<{ tenantSlug: string }>;
};

export default async function RetailDevicesPage({ params }: RetailDevicesPageProps) {
  const { tenantSlug } = await params;
  return DeviceAdminListPage({ tenantSlug, context: retailDeviceAdminRouteContext });
}
