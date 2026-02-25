import { redirect } from "next/navigation";

type EventCreatePageProps = {
  params: Promise<{ tenantSlug: string }>;
};

export default async function EventCreatePage({ params }: EventCreatePageProps) {
  const { tenantSlug } = await params;
  redirect(`/${tenantSlug}/events/new`);
}
