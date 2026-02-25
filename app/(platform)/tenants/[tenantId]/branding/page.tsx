import { Card } from "@/components/ui/card";
import { getTenantBranding } from "@/lib/repos/brandingRepo";
import { BrandingForm } from "../../components/BrandingForm";

type TenantBrandingPageProps = {
  params: Promise<{ tenantId: string }>;
};

export default async function TenantBrandingPage({ params }: TenantBrandingPageProps) {
  const { tenantId } = await params;
  const branding = await getTenantBranding(tenantId);

  return (
    <Card>
      <h2 className="mb-4 text-base font-semibold">Branding del tenant</h2>
      <BrandingForm tenantId={tenantId} branding={branding} />
    </Card>
  );
}
