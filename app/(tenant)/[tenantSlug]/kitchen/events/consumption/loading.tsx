import { KitchenHeaderSkeleton, KitchenTableSkeleton } from "../../_components/kitchen-loading-skeletons";

export default function KitchenEventsConsumptionLoading() {
  return (
    <div className="space-y-4" aria-live="polite" aria-busy="true">
      <KitchenHeaderSkeleton />
      <KitchenTableSkeleton rows={10} columns={6} />
    </div>
  );
}
