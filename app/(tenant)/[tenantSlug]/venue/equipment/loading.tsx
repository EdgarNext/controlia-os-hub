import { Skeleton } from "@/components/ui/skeleton";

export default function VenueEquipmentLoading() {
  return (
    <div className="space-y-4">
      <Skeleton className="h-10 w-56" />
      <Skeleton className="h-24 w-full" />
      <Skeleton className="h-24 w-full" />
    </div>
  );
}
