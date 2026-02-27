import { Skeleton } from "@/components/ui/skeleton";

export default function SegmentLoadingTemplate() {
  return (
    <div className="space-y-3">
      <Skeleton className="h-7 w-56" />
      <Skeleton className="h-28 w-full" />
      <Skeleton className="h-28 w-full" />
    </div>
  );
}
