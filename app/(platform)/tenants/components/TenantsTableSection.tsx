import { listTenants } from "@/lib/repos/tenantsRepo";
import { TenantsTable } from "./TenantsTable";

type StatusFilter = "active" | "inactive" | "archived" | null;

type TenantsTableSectionProps = {
  status: StatusFilter;
};

export async function TenantsTableSection({ status }: TenantsTableSectionProps) {
  const tenants = await listTenants(status);

  return <TenantsTable tenants={tenants} />;
}
