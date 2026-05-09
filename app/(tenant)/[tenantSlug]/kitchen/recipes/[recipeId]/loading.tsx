import { KitchenCardGridSkeleton, KitchenTableSkeleton } from "../../_components/kitchen-loading-skeletons";

export default function KitchenRecipeDetailLoading() {
  return (
    <div className="space-y-4" aria-live="polite" aria-busy="true">
      <KitchenCardGridSkeleton cards={3} />
      <KitchenTableSkeleton rows={8} columns={6} />
    </div>
  );
}
