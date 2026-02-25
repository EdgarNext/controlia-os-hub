import { EmptyState } from "../../components/EmptyState";
import { SectionHeader } from "../../components/SectionHeader";

export default function PosAdminReportsPage() {
  return (
    <div className="space-y-4">
      <SectionHeader
        title="POS Admin · Reports"
        description="Track sales and synchronization quality across POS kiosks."
      />
      <EmptyState message="POS reporting UI will be implemented in this section." />
    </div>
  );
}
