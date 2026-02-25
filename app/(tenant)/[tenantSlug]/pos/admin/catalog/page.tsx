import { EmptyState } from "../../components/EmptyState";
import { SectionHeader } from "../../components/SectionHeader";

export default function PosAdminCatalogPage() {
  return (
    <div className="space-y-4">
      <SectionHeader
        title="POS Admin · Catalog"
        description="Manage categories, products, and variants consumed by local POS databases."
      />
      <EmptyState message="Catalog administration UI will be implemented in this section." />
    </div>
  );
}
