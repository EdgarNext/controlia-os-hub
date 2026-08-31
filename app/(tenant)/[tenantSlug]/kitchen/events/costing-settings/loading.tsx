import { CostingSettingsSkeleton } from "./_components/costing-settings-skeleton";
export default function Loading() { return <div className="space-y-4" aria-live="polite" aria-busy="true"><div className="h-32 animate-pulse rounded-[var(--radius-base)] bg-surface" /><CostingSettingsSkeleton /></div>; }
