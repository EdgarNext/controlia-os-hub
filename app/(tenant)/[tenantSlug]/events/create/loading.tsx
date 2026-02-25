import { PageFrame } from "@/components/layout/PageFrame";
import { Skeleton } from "@/components/ui/skeleton";

export default function EventCreateLoading() {
  return (
    <PageFrame>
      <div className="space-y-4">
        <Skeleton className="h-7 w-56" />
        <Skeleton className="h-80 w-full" />
        <Skeleton className="h-48 w-full" />
      </div>
    </PageFrame>
  );
}
