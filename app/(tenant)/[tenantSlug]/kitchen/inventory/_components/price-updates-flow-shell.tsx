"use client";

import type { ReactNode } from "react";
import { CheckCircle2, Circle } from "lucide-react";
import { createContext, useContext, useMemo, useState } from "react";

type PriceUpdatesFlowShellProps = {
  children: ReactNode;
};

type PriceUpdatesFlowContextValue = {
  currentStep: 1 | 2 | 3;
  setCurrentStep: (step: 1 | 2 | 3) => void;
};

const PriceUpdatesFlowContext = createContext<PriceUpdatesFlowContextValue | null>(null);

export function usePriceUpdatesFlow() {
  const context = useContext(PriceUpdatesFlowContext);
  if (!context) {
    throw new Error("usePriceUpdatesFlow must be used within PriceUpdatesFlowShell");
  }
  return context;
}

export function PriceUpdatesFlowShell({ children }: PriceUpdatesFlowShellProps) {
  const [currentStep, setCurrentStep] = useState<1 | 2 | 3>(1);
  const value = useMemo(() => ({ currentStep, setCurrentStep }), [currentStep]);

  return (
    <PriceUpdatesFlowContext.Provider value={value}>
      <section className="rounded-[var(--radius-base)] border border-border bg-surface p-4">
        <p className="text-xs font-medium uppercase tracking-[0.08em] text-muted">Proceso de actualización</p>
        <div className="mt-3 grid gap-3 md:grid-cols-3">
          {[
            [1, "Datos de factura", "Proveedor, referencia y fecha"],
            [2, "Agregar insumos", "Selecciona presentaciones y precios"],
            [3, "Revisar y aplicar", "Valida las líneas antes de guardar"],
          ].map(([step, label, summary]) => {
            const numericStep = step as 1 | 2 | 3;
            const state = numericStep < currentStep ? "completed" : numericStep === currentStep ? "current" : "pending";
            const Icon = state === "completed" ? CheckCircle2 : Circle;

            return (
              <div
                key={numericStep}
                aria-current={state === "current" ? "step" : undefined}
                className={`rounded-[var(--radius-base)] border p-3 ${
                  state === "completed"
                    ? "border-success/40 bg-success/10"
                    : state === "current"
                      ? "border-primary/40 bg-primary/10"
                      : "border-border bg-surface-2"
                }`}
              >
                <div className="flex items-start gap-3">
                  <Icon
                    className={`mt-0.5 h-4 w-4 ${
                      state === "completed" ? "text-success" : state === "current" ? "text-primary" : "text-muted"
                    }`}
                    aria-hidden="true"
                  />
                  <div>
                    <p className="text-sm font-semibold text-foreground">Paso {numericStep}: {label}</p>
                    <p className="mt-1 text-sm text-muted">{summary}</p>
                    <p className="mt-1 text-xs font-medium text-muted">
                      {state === "completed" ? "Completado" : state === "current" ? "Actual" : "Pendiente"}
                    </p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </section>
      {children}
    </PriceUpdatesFlowContext.Provider>
  );
}
