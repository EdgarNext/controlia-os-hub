import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { getLabChartSeries } from "./lib/queries";
import { ButtonStates } from "./components/ButtonStates";
import { ChartDemo } from "./components/ChartDemo";
import { AnimationShowcase } from "./components/AnimationShowcase";
import { EmptyState } from "./components/EmptyState";
import { SectionHeader } from "./components/SectionHeader";
import { ToastDemo } from "./components/ToastDemo";
import { TokenSwatches } from "./components/TokenSwatches";

export default async function LabPage() {
  const chartData = await getLabChartSeries();

  return (
    <div className="space-y-6">
      <SectionHeader
        title="Lab Playground"
        description="Token preview, UI states, toasts, chart and motion demo."
      />

      <Card>
        <h3 className="mb-3 text-sm font-semibold">Color tokens</h3>
        <TokenSwatches />
      </Card>

      <Card>
        <h3 className="mb-3 text-sm font-semibold">Button states</h3>
        <ButtonStates />
      </Card>

      <Card>
        <h3 className="mb-3 text-sm font-semibold">Toast demo</h3>
        <ToastDemo />
      </Card>

      <Card>
        <h3 className="mb-3 text-sm font-semibold">Chart demo</h3>
        <ChartDemo data={chartData} />
      </Card>

      <Card>
        <h3 className="mb-3 text-sm font-semibold">Animation with CSS + Tailwind</h3>
        <div className="motion-lift rounded-[var(--radius-base)] border border-border bg-surface-2 p-4">
          <p className="text-sm text-muted">Hover this block to see translate + shadow transition.</p>
        </div>
      </Card>

      <AnimationShowcase />

      <Card>
        <h3 className="mb-3 text-sm font-semibold">Skeleton state</h3>
        <div className="space-y-2">
          <Skeleton className="h-4 w-1/3" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-4/5" />
        </div>
      </Card>

      <EmptyState title="More playground blocks soon" subtitle="Reserved for upcoming UI experiments." />
    </div>
  );
}
