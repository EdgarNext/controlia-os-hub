import { Badge } from "@/components/ui/badge";
import type { TenantStatus } from "@/lib/repos/types";

export function TenantStatusBadge({ status }: { status: TenantStatus }) {
  if (status === "active") {
    return <Badge variant="success">active</Badge>;
  }

  if (status === "inactive") {
    return <Badge variant="warning">inactive</Badge>;
  }

  return <Badge variant="danger">archived</Badge>;
}
