import { EmptyState } from "./components/EmptyState";
import { SectionHeader } from "./components/SectionHeader";

export default function ReportsPage() {
  return (
    <div className="space-y-4">
      <SectionHeader title="Reports" description="Tenant reports module scaffold." />
      <EmptyState message="Reports module is scaffolded and ready for implementation." />
    </div>
  );
}
