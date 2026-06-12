import {
  KitchenActionRowSkeleton,
  KitchenCardGridSkeleton,
  KitchenTableSkeleton,
} from "@/app/(tenant)/[tenantSlug]/kitchen/_components/kitchen-loading-skeletons";

export default function KitchenInventoryDataQualityLoading() {
  return (
    <div className="space-y-4" aria-live="polite" aria-busy="true">
      <KitchenCardGridSkeleton cards={6} />
      <KitchenActionRowSkeleton actions={8} />
      <KitchenTableSkeleton rows={10} columns={9} />
    </div>
  );
}
