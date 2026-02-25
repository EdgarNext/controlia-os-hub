import { EmptyState } from "./components/EmptyState";
import { SectionHeader } from "./components/SectionHeader";

export default function CatalogPage() {
  return (
    <div className="space-y-4">
      <SectionHeader title="Catalog" description="Tenant catalog module scaffold." />
      <EmptyState message="Catalog module is scaffolded and ready for implementation." />
    </div>
  );
}
