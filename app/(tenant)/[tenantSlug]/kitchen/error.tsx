"use client";

import { Button } from "@/components/ui/button";

type KitchenErrorProps = {
  error: Error & { digest?: string };
  reset: () => void;
};

export default function KitchenError({ reset }: KitchenErrorProps) {
  return (
    <section className="rounded-[var(--radius-base)] border border-danger/40 bg-danger/10 p-4">
      <h1 className="text-lg font-semibold text-foreground">No fue posible cargar Cocina</h1>
      <p className="mt-2 text-sm text-muted">
        Ocurrió un problema al cargar esta vista. Intenta nuevamente.
      </p>
      <div className="mt-3">
        <Button type="button" onClick={() => reset()}>
          Reintentar
        </Button>
      </div>
    </section>
  );
}
