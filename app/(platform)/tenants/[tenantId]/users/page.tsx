import { Card } from "@/components/ui/card";
import { listTenantMemberships } from "@/lib/repos/membershipsRepo";
import { AddTenantMemberModal } from "../../components/AddTenantMemberModal";
import { MembershipsTable } from "../../components/MembershipsTable";

type TenantUsersPageProps = {
  params: Promise<{ tenantId: string }>;
};

export default async function TenantUsersPage({ params }: TenantUsersPageProps) {
  const { tenantId } = await params;
  const memberships = await listTenantMemberships(tenantId);

  return (
    <Card className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-base font-semibold">Usuarios del tenant</h2>
        <AddTenantMemberModal tenantId={tenantId} />
      </div>
      <MembershipsTable tenantId={tenantId} memberships={memberships} />
    </Card>
  );
}
