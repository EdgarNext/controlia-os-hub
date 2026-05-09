import { KitchenHeaderSkeleton, KitchenTableSkeleton } from "../../_components/kitchen-loading-skeletons";

export default function KitchenEventsRequisitionsLoading() {
  return (
    <div className="space-y-4" aria-live="polite" aria-busy="true">
      <KitchenHeaderSkeleton />
      <KitchenTableSkeleton rows={8} columns={5} />
    </div>
  );
}
