import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export function TenantsTableFallback() {
  return (
    <Card className="space-y-2">
      <Skeleton className="h-10 w-full" />
      <Skeleton className="h-10 w-full" />
      <Skeleton className="h-10 w-full" />
    </Card>
  );
}
