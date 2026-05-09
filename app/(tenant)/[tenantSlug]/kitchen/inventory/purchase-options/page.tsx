import { redirect } from "next/navigation";

type KitchenInventoryPurchaseOptionsPageProps = {
  params: Promise<{ tenantSlug: string }>;
};

export default async function KitchenInventoryPurchaseOptionsPage({
  params,
}: KitchenInventoryPurchaseOptionsPageProps) {
  const { tenantSlug } = await params;
  redirect(`/${tenantSlug}/kitchen/inventory/presentaciones-precios`);
}
