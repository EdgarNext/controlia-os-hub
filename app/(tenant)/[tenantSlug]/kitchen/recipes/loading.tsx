import {
  KitchenActionRowSkeleton,
  KitchenCardGridSkeleton,
  KitchenTableSkeleton,
} from "../_components/kitchen-loading-skeletons";

export default function KitchenRecipesLoading() {
  return (
    <div className="space-y-4" aria-live="polite" aria-busy="true">
      <KitchenActionRowSkeleton actions={2} />
      <KitchenCardGridSkeleton cards={2} />
      <KitchenTableSkeleton rows={8} columns={7} />
    </div>
  );
}
