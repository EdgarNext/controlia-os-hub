import {
  KitchenActionRowSkeleton,
  KitchenCardGridSkeleton,
  KitchenTableSkeleton,
} from "../_components/kitchen-loading-skeletons";

export default function KitchenInventoryLoading() {
  return (
    <div className="space-y-4" aria-live="polite" aria-busy="true">
      <KitchenCardGridSkeleton cards={3} />
      <KitchenActionRowSkeleton actions={2} />
      <KitchenTableSkeleton rows={7} columns={6} />
    </div>
  );
}
