import { Skeleton } from "@/components/ui/skeleton";

export default function EventNewLoading() {
  return (
    <div className="space-y-4">
      <Skeleton className="h-24 w-full" />
      <Skeleton className="h-64 w-full" />
    </div>
  );
}
