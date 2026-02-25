import Link from "next/link";
import { EmptyState } from "./components/EmptyState";
import { SectionHeader } from "./components/SectionHeader";

export default function PosPage() {
  return (
    <div className="space-y-4">
      <SectionHeader title="POS" description="Tenant POS module scaffold." />
      <div className="flex flex-wrap gap-2">
        <Link
          href="./admin"
          className="rounded-[var(--radius-base)] border border-border bg-surface px-3 py-2 text-sm font-medium text-foreground transition-colors hover:bg-surface-2"
        >
          Open POS Admin
        </Link>
      </div>
      <EmptyState message="POS module is scaffolded and ready for implementation." />
    </div>
  );
}
