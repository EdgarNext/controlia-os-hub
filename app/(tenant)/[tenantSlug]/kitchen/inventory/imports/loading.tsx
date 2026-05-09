import { KitchenActionRowSkeleton, KitchenTableSkeleton } from "../../_components/kitchen-loading-skeletons";

export default function KitchenInventoryImportsLoading() {
  return (
    <div className="space-y-4" aria-live="polite" aria-busy="true">
      <KitchenActionRowSkeleton actions={1} />
      <KitchenTableSkeleton rows={8} columns={8} />
    </div>
  );
}
