import {
  DeviceAdminNewPage,
  retailDeviceAdminRouteContext,
} from "@/app/(tenant)/[tenantSlug]/_components/device-admin/DeviceAdminPages";

type RetailDevicesNewPageProps = {
  params: Promise<{ tenantSlug: string }>;
};

export default async function RetailDevicesNewPage({ params }: RetailDevicesNewPageProps) {
  const { tenantSlug } = await params;
  return DeviceAdminNewPage({ tenantSlug, context: retailDeviceAdminRouteContext });
}
