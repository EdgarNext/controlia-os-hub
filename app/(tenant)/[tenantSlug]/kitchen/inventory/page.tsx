import { resolveKitchenPage } from "../_lib/page-access";
import { redirect } from "next/navigation";

type KitchenInventoryPageProps = {
  params: Promise<{ tenantSlug: string }>;
};

export default async function KitchenInventoryPage({ params }: KitchenInventoryPageProps) {
  const { tenantSlug } = await params;
  const result = await resolveKitchenPage(tenantSlug, "kitchen_inventory", "overview");

  if (!result.ok) {
    redirect(`/${tenantSlug}/kitchen`);
  }

  redirect(`/${tenantSlug}/kitchen/inventory/items`);
}
