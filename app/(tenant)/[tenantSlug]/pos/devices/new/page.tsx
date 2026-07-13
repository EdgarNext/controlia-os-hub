import {
  DeviceAdminNewPage,
  posDeviceAdminRouteContext,
} from "@/app/(tenant)/[tenantSlug]/_components/device-admin/DeviceAdminPages";

type PosDeviceNewPageProps = {
  params: Promise<{ tenantSlug: string }>;
};

export default async function PosDeviceNewPage({ params }: PosDeviceNewPageProps) {
  const { tenantSlug } = await params;
  return DeviceAdminNewPage({ tenantSlug, context: posDeviceAdminRouteContext });
}
