import { KitchenCardGridSkeleton, KitchenTableSkeleton } from "../../_components/kitchen-loading-skeletons";

export default function KitchenRecipesCostingLoading() {
  return (
    <div className="space-y-4" aria-live="polite" aria-busy="true">
      <KitchenCardGridSkeleton cards={3} />
      <KitchenTableSkeleton rows={8} columns={7} />
      <KitchenTableSkeleton rows={6} columns={4} />
    </div>
  );
}
