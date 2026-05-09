import { KitchenActionRowSkeleton, KitchenTableSkeleton } from "../../../../../_components/kitchen-loading-skeletons";

export default function KitchenReceiptDetailLoading() {
  return (
    <div className="space-y-4" aria-live="polite" aria-busy="true">
      <KitchenActionRowSkeleton actions={2} />
      <KitchenTableSkeleton rows={8} columns={8} />
    </div>
  );
}
