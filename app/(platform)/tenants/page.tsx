import { Suspense } from "react";
import { Card } from "@/components/ui/card";
import { CreateTenantModal } from "./components/CreateTenantModal";
import { TenantFilters } from "./components/TenantFilters";
import { TenantsPageHeader } from "./components/TenantsPageHeader";
import { TenantsTableFallback } from "./components/TenantsTableFallback";
import { TenantsTableSection } from "./components/TenantsTableSection";

type StatusFilter = "active" | "inactive" | "archived";

type TenantsPageProps = {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
};

function getFirstParam(value: string | string[] | undefined) {
  if (Array.isArray(value)) {
    return value[0];
  }

  return value;
}

function normalizeStatusFilter(value: string | undefined): StatusFilter | null {
  if (value === "active" || value === "inactive" || value === "archived") {
    return value;
  }

  return null;
}

export default async function TenantsPage({ searchParams }: TenantsPageProps) {
  const params = await searchParams;
  const selectedStatus = normalizeStatusFilter(getFirstParam(params.status));
  const shouldOpenCreateModal = getFirstParam(params.new) === "1";

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <TenantsPageHeader />
        <CreateTenantModal defaultOpen={shouldOpenCreateModal} />
      </div>

      <Card className="space-y-3">
        <p className="text-sm text-muted">Filtrar por estado</p>
        <TenantFilters selected={selectedStatus} />
      </Card>

      <Suspense key={selectedStatus ?? "all"} fallback={<TenantsTableFallback />}>
        <TenantsTableSection status={selectedStatus} />
      </Suspense>
    </div>
  );
}
