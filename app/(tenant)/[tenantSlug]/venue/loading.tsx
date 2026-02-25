import { Skeleton } from "@/components/ui/skeleton";

export default function VenueLoading() {
  return (
    <div className="space-y-4">
      <Skeleton className="h-48 w-full" />
      <Skeleton className="h-48 w-full" />
      <Skeleton className="h-12 w-72" />
    </div>
  );
}
