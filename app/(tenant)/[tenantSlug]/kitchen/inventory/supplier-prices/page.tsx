import { redirect } from "next/navigation";

type KitchenInventorySupplierPricesPageProps = {
  params: Promise<{ tenantSlug: string }>;
};

export default async function KitchenInventorySupplierPricesPage({
  params,
}: KitchenInventorySupplierPricesPageProps) {
  const { tenantSlug } = await params;
  redirect(`/${tenantSlug}/kitchen/inventory/presentaciones-precios`);
}
