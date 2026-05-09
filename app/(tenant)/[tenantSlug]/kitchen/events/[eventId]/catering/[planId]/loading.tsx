import {
  KitchenActionRowSkeleton,
  KitchenCardGridSkeleton,
  KitchenHeaderSkeleton,
  KitchenTableSkeleton,
} from "../../../../_components/kitchen-loading-skeletons";

export default function KitchenEventPlanLoading() {
  return (
    <div className="space-y-4" aria-live="polite" aria-busy="true">
      <KitchenHeaderSkeleton />
      <KitchenCardGridSkeleton cards={4} />
      <KitchenActionRowSkeleton actions={2} />
      <KitchenTableSkeleton rows={8} columns={7} />
      <KitchenTableSkeleton rows={7} columns={10} />
    </div>
  );
}
