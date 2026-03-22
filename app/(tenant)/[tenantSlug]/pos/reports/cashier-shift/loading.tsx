import { Skeleton } from "@/components/ui/skeleton";

export default function PosCashierShiftLoading() {
  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Skeleton className="h-6 w-56" />
        <Skeleton className="h-4 w-96" />
      </div>

      <Skeleton className="h-28 w-full" />

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Skeleton className="h-36 w-full" />
        <Skeleton className="h-36 w-full" />
        <Skeleton className="h-36 w-full" />
        <Skeleton className="h-36 w-full" />
      </div>

      <Skeleton className="h-56 w-full" />
      <Skeleton className="h-[30rem] w-full" />
    </div>
  );
}
