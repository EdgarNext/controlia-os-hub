import { KitchenCardGridSkeleton, KitchenTableSkeleton } from "../../_components/kitchen-loading-skeletons";
export default function Loading() { return <div className="space-y-4" aria-busy="true"><KitchenCardGridSkeleton cards={4} /><KitchenTableSkeleton rows={5} columns={4} /></div>; }
