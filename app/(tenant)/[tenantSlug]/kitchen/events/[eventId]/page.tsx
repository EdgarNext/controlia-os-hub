import { redirect } from "next/navigation";

type KitchenEventRedirectPageProps = {
  params: Promise<{ tenantSlug: string; eventId: string }>;
};

export default async function KitchenEventRedirectPage({ params }: KitchenEventRedirectPageProps) {
  const { tenantSlug, eventId } = await params;
  redirect(`/${tenantSlug}/kitchen/events/${eventId}/catering`);
}
