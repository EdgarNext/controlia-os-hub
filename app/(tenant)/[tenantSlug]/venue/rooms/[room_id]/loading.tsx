import { Skeleton } from "@/components/ui/skeleton";

export default function RoomSetupLoading() {
  return (
    <div className="space-y-4">
      <Skeleton className="h-10 w-40" />
      <Skeleton className="h-24 w-full" />
      <Skeleton className="h-56 w-full" />
    </div>
  );
}
