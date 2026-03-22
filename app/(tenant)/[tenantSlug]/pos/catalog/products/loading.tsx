import { Skeleton } from "@/components/ui/skeleton";

export default function CatalogProductsLoading() {
  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Skeleton className="h-6 w-56" />
        <Skeleton className="h-4 w-80" />
      </div>
      <Skeleton className="h-40 w-full" />
    </div>
  );
}
