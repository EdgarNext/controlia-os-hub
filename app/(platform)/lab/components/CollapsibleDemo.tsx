"use client";

import { useMemo, useState } from "react";
import { Collapsible } from "@/components/ui/Collapsible";
import { Skeleton } from "@/components/ui/skeleton";

type AccordionItem = {
  id: string;
  title: string;
  content: string;
};

const items: AccordionItem[] = [
  {
    id: "a1",
    title: "Integración de checkout",
    content:
      "Este panel describe el estado de integración del checkout con flujos de pago, validaciones y fallback de errores para ambientes multi-tenant.",
  },
  {
    id: "a2",
    title: "Sincronización de inventario",
    content:
      "La sincronización se ejecuta por lotes y prioriza consistencia eventual. Incluye reintentos y trazabilidad por tenant en cola de eventos.",
  },
  {
    id: "a3",
    title: "Métricas operativas",
    content:
      "Se exponen métricas por módulo para tiempos de respuesta, errores y throughput, facilitando alertas y análisis de capacidad.",
  },
  {
    id: "a4",
    title: "Políticas de autorización",
    content:
      "El esquema contempla políticas por recurso y acción. Los permisos se validan server-side antes de cualquier mutación crítica.",
  },
  {
    id: "a5",
    title: "Plan de despliegue",
    content:
      "El plan considera despliegues por etapas, validación post-release y rollback rápido para minimizar riesgo en producción.",
  },
];

export function CollapsibleDemo() {
  const [singleOpenId, setSingleOpenId] = useState<string>(items[0].id);
  const [multiOpen, setMultiOpen] = useState<Record<string, boolean>>({
    a1: true,
    a2: false,
    a3: false,
    a4: false,
    a5: false,
  });

  const loadingPanel = useMemo(
    () => (
      <div className="space-y-2">
        <Skeleton className="h-4 w-2/3" />
        <Skeleton className="h-4 w-full" />
      </div>
    ),
    [],
  );

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <div className="space-y-2">
        <h4 className="text-sm font-semibold">Acordeón (single-open)</h4>
        {items.map((item) => (
          <Collapsible
            key={item.id}
            title={item.title}
            open={singleOpenId === item.id}
            onOpenChange={(open) => {
              if (open) {
                setSingleOpenId(item.id);
              }
            }}
          >
            {item.content}
          </Collapsible>
        ))}
      </div>

      <div className="space-y-2">
        <h4 className="text-sm font-semibold">Acordeón (multi-open + states)</h4>

        {items.map((item) => (
          <Collapsible
            key={`multi-${item.id}`}
            title={item.title}
            open={Boolean(multiOpen[item.id])}
            onOpenChange={(open) => {
              setMultiOpen((prev) => ({ ...prev, [item.id]: open }));
            }}
          >
            {item.content}
          </Collapsible>
        ))}

        <Collapsible title="Panel loading" defaultOpen>
          {loadingPanel}
        </Collapsible>

        <Collapsible title="Panel empty">
          <p>No hay datos disponibles para este segmento todavía.</p>
        </Collapsible>
      </div>
    </div>
  );
}
