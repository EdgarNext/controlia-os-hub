import { EmptyState } from "./components/EmptyState";
import { SectionHeader } from "./components/SectionHeader";

export default function UsersPage() {
  return (
    <div className="space-y-4">
      <SectionHeader title="Users" description="Tenant users module scaffold." />
      <EmptyState message="Users module is scaffolded and ready for implementation." />
    </div>
  );
}
