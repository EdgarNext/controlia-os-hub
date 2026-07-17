import { CheckCircle2, Circle, CircleAlert, CookingPot, NotebookPen, RefreshCw, Sigma } from "lucide-react";
import type { ChefProgressStage } from "@/lib/kitchen/event-catering/chef-costing";

function resolveStageIcon(stage: ChefProgressStage) {
  if (stage.key === "servicios") return CookingPot;
  if (stage.key === "recetas") return NotebookPen;
  if (stage.key === "costo_inicial") return Sigma;
  return RefreshCw;
}

function resolveStateIcon(state: ChefProgressStage["state"]) {
  if (state === "completed") return CheckCircle2;
  if (state === "attention") return CircleAlert;
  return Circle;
}

export function EventProgressStepper({ stages }: { stages: ChefProgressStage[] }) {
  const completedCount = stages.filter((stage) => stage.state === "completed").length;
  const currentStage =
    stages.find((stage) => stage.state === "current") ??
    stages.find((stage) => stage.state === "attention") ??
    stages.find((stage) => stage.state === "pending") ??
    null;

  return (
    <section className="rounded-[var(--radius-base)] border border-border bg-surface p-4">
      <p className="text-xs font-medium uppercase tracking-[0.08em] text-muted">Progreso del evento</p>
      <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted">
        <p>{completedCount.toLocaleString("es-MX")} de {stages.length.toLocaleString("es-MX")} etapas completadas</p>
        <p>Paso actual: {currentStage?.label ?? "Completado"}</p>
      </div>
      <div className="mt-4 grid gap-3 lg:grid-cols-4">
        {stages.map((stage, index) => {
          const StepIcon = resolveStageIcon(stage);
          const StateIcon = resolveStateIcon(stage.state);
          const toneClass =
            stage.state === "completed"
              ? "border-emerald-300 bg-emerald-50"
              : stage.state === "current"
                ? "border-primary/50 bg-primary/10"
                : stage.state === "attention"
                  ? "border-amber-300 bg-amber-50"
                  : "border-border bg-surface-2";
          const badgeLabel =
            stage.state === "completed"
              ? "Completado"
              : stage.state === "current"
                ? "Paso actual"
                : stage.state === "attention"
                  ? "Atención"
                  : "Pendiente";

          return (
            <div
              key={stage.key}
              aria-current={stage.state === "current" ? "step" : undefined}
              className={`relative rounded-[var(--radius-base)] border p-3 ${toneClass}`}
            >
              {index < stages.length - 1 ? (
                <span
                  aria-hidden="true"
                  className={`absolute right-[-10px] top-8 hidden h-px w-5 lg:block ${
                    stage.state === "completed" ? "bg-emerald-300" : "bg-border"
                  }`}
                />
              ) : null}
              <div className="flex items-start gap-3">
                <span className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-border bg-surface">
                  <StepIcon className="h-5 w-5 text-primary" aria-hidden="true" />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-sm font-semibold text-foreground">{stage.label}</p>
                    <StateIcon className="h-4 w-4 text-muted" aria-hidden="true" />
                    <span className="rounded-full border border-current/10 bg-surface px-2 py-0.5 text-[11px] font-medium text-foreground">
                      {badgeLabel}
                    </span>
                  </div>
                  <p className="mt-1 text-sm text-muted">{stage.summary}</p>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
