import {
  KitchenActionRowSkeleton,
  KitchenCardGridSkeleton,
  KitchenTableSkeleton,
} from "../_components/kitchen-loading-skeletons";

export default function KitchenEventsLoading() {
  return (
    <div className="space-y-4" aria-live="polite" aria-busy="true">
      <KitchenCardGridSkeleton cards={4} />
      <KitchenActionRowSkeleton actions={2} />
      <KitchenTableSkeleton rows={8} columns={6} />
    </div>
  );
}
