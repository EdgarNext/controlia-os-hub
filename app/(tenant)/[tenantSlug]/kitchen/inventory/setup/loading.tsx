import { KitchenActionRowSkeleton, KitchenTableSkeleton } from "../../_components/kitchen-loading-skeletons";

export default function KitchenInventorySetupLoading() {
  return (
    <div className="space-y-4" aria-live="polite" aria-busy="true">
      <KitchenActionRowSkeleton actions={3} />
      <KitchenTableSkeleton rows={6} columns={4} />
    </div>
  );
}
