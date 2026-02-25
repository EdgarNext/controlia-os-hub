import { Card } from "@/components/ui/card";

export function EmptyState({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <Card className="text-center">
      <h3 className="text-base font-semibold">{title}</h3>
      <p className="mt-1 text-sm text-muted">{subtitle}</p>
    </Card>
  );
}
