import { redirect } from "next/navigation";
import { resolveTenantModuleContext } from "@/lib/auth/module-role-guard";

type EventCreatePageProps = {
  params: Promise<{ tenantSlug: string }>;
};

export default async function EventCreatePage({ params }: EventCreatePageProps) {
  const { tenantSlug } = await params;
  await resolveTenantModuleContext(tenantSlug, "event_core", "read");
  redirect(`/${tenantSlug}/events/new`);
}
