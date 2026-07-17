"use client";

import Link from "next/link";
import {
  ArrowRight,
  CheckCircle2,
  Circle,
  ListPlus,
  PackagePlus,
  ReceiptText,
  Search,
  ShoppingCart,
  TriangleAlert,
} from "lucide-react";
import { useActionState, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Collapsible } from "@/components/ui/Collapsible";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Modal } from "@/components/ui/Modal";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { StatePanel } from "@/components/ui/state-panel";
import { initialKitchenInventoryActionState } from "@/lib/kitchen/inventory/action-state";
import { applyKitchenInventoryPriceUpdateBatchAction } from "@/lib/kitchen/inventory/price-update-actions";
import type {
  KitchenInventoryPriceUpdateItem,
  KitchenInventoryPriceUpdateRecentBatch,
} from "@/lib/kitchen/inventory/price-updates";
import type { KitchenInventorySupplier } from "@/lib/kitchen/inventory/types";

type DraftLine = {
  id: string;
  itemId: string;
  purchaseOptionId: string;
  newPrice: string;
  usedForCosting: boolean;
  notes: string;
};

type ManualDraft = {
  itemId: string;
  purchaseOptionId: string;
  newPrice: string;
  notes: string;
  scope: "available" | "all";
};

type PriceUpdatesClientProps = {
  tenantSlug: string;
  suppliers: KitchenInventorySupplier[];
  items: KitchenInventoryPriceUpdateItem[];
  suggestedItemIds: string[];
  upcomingEventsWithoutInitialSnapshot: Array<{
    id: string;
    name: string | null;
    status: string | null;
    startsAt: string;
  }>;
  recentBatches: KitchenInventoryPriceUpdateRecentBatch[];
};

function createDraftLine(seed?: Partial<DraftLine>): DraftLine {
  return {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    itemId: seed?.itemId ?? "",
    purchaseOptionId: seed?.purchaseOptionId ?? "",
    newPrice: seed?.newPrice ?? "",
    usedForCosting: seed?.usedForCosting ?? true,
    notes: seed?.notes ?? "",
  };
}

function createManualDraft(): ManualDraft {
  return {
    itemId: "",
    purchaseOptionId: "",
    newPrice: "",
    notes: "",
    scope: "available",
  };
}

function formatCurrency(value: number): string {
  return `$${value.toLocaleString("es-MX", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function formatDate(value: string | null): string {
  if (!value) return "—";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleDateString("es-MX", {
    year: "numeric",
    month: "short",
    day: "numeric",
    timeZone: "America/Mexico_City",
  });
}

function getTodayIsoDate(): string {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Mexico_City",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  return formatter.format(new Date());
}

function translateBatchStatus(status: string): string {
  const normalized = status.trim().toLowerCase();
  if (normalized === "applied") return "Aplicada";
  if (normalized === "pending") return "Pendiente";
  if (normalized === "failed") return "Error";
  return status;
}

function formatUpcomingUsage(item: KitchenInventoryPriceUpdateItem): string {
  if (item.upcomingImpactLines.length === 0) return "Sin impacto en eventos próximos";
  const eventCount = new Set(item.upcomingImpactLines.map((line) => line.eventId)).size;
  const totalRequired = item.upcomingImpactLines.reduce((sum, line) => sum + line.requiredQuantity, 0);
  return `${eventCount.toLocaleString("es-MX")} evento${eventCount === 1 ? "" : "s"} · ${totalRequired.toLocaleString("es-MX", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 4,
  })} ${item.defaultUnitCode ?? "ud"}`;
}

function resolveLineOptionLabel(
  option: KitchenInventoryPriceUpdateItem["options"][number],
  fallbackUnitCode: string | null,
) {
  return `1 ${option.purchaseUnitCode ?? "ud"} = ${option.quantityPerPurchaseUnit.toLocaleString("es-MX", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 4,
  })} ${option.inventoryUnitCode ?? fallbackUnitCode ?? "ud"}`;
}

export function PriceUpdatesClient({
  tenantSlug,
  suppliers,
  items,
  suggestedItemIds,
  upcomingEventsWithoutInitialSnapshot,
  recentBatches,
}: PriceUpdatesClientProps) {
  const [state, formAction, isPending] = useActionState(
    applyKitchenInventoryPriceUpdateBatchAction,
    initialKitchenInventoryActionState,
  );
  const [supplierId, setSupplierId] = useState("");
  const [invoiceRef, setInvoiceRef] = useState("");
  const [invoiceDate, setInvoiceDate] = useState(getTodayIsoDate);
  const [notes, setNotes] = useState("");
  const [scope, setScope] = useState<"available" | "upcoming" | "all">("available");
  const [query, setQuery] = useState("");
  const [lines, setLines] = useState<DraftLine[]>([]);
  const [idempotencyKey, setIdempotencyKey] = useState(() =>
    `price-update-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`,
  );
  const [manualModalOpen, setManualModalOpen] = useState(false);
  const [manualDraft, setManualDraft] = useState<ManualDraft>(createManualDraft);
  const [flashInvoicePanel, setFlashInvoicePanel] = useState(false);
  const [unavailableItemId, setUnavailableItemId] = useState<string | null>(null);
  const previousMessage = useRef("");
  const invoicePanelRef = useRef<HTMLElement | null>(null);

  const itemById = useMemo(() => new Map(items.map((item) => [item.id, item])), [items]);
  const supplierById = useMemo(() => new Map(suppliers.map((supplier) => [supplier.id, supplier])), [suppliers]);
  const supplierOptions = useMemo(
    () => suppliers.map((supplier) => ({ value: supplier.id, label: supplier.name })),
    [suppliers],
  );
  const suggestedSet = useMemo(() => new Set(suggestedItemIds), [suggestedItemIds]);

  useEffect(() => {
    if (!flashInvoicePanel) return;
    const timeoutId = window.setTimeout(() => setFlashInvoicePanel(false), 1800);
    return () => window.clearTimeout(timeoutId);
  }, [flashInvoicePanel]);

  useEffect(() => {
    if (!state.message || state.message === previousMessage.current) return;
    previousMessage.current = state.message;

    if (state.ok) {
      const supplierName = supplierById.get(supplierId)?.name ?? "Proveedor";
      toast.success(
        `Factura aplicada. Se actualizaron ${lines.length.toLocaleString("es-MX")} precio(s) del proveedor ${supplierName}.`,
      );
      const timeoutId = window.setTimeout(() => {
        setLines([]);
        setInvoiceRef("");
        setNotes("");
        setManualDraft(createManualDraft());
        setIdempotencyKey(`price-update-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`);
        setFlashInvoicePanel(false);
      }, 0);
      return () => window.clearTimeout(timeoutId);
    } else {
      toast.error(
        "No se pudo aplicar la factura. No se realizó ningún cambio. Revisa las líneas e inténtalo nuevamente.",
      );
      return;
    }
  }, [lines.length, state.message, state.ok, supplierById, supplierId]);

  const visibleItems = (() => {
    const upcomingItems = suggestedItemIds
      .map((itemId) => itemById.get(itemId))
      .filter((item): item is KitchenInventoryPriceUpdateItem => Boolean(item));
    const source = scope === "all" ? items : upcomingItems;

    const normalizedQuery = query.trim().toLocaleLowerCase("es-MX");
    const filtered = !normalizedQuery
      ? source
      : source.filter((item) => {
          const haystack = [item.name, item.defaultUnitCode ?? ""].join(" ").toLocaleLowerCase("es-MX");
          return haystack.includes(normalizedQuery);
        });

    if (!supplierId) {
      return filtered;
    }

    if (scope === "available") {
      return filtered.filter((item) => getSupplierScopedOptions(item.id).length > 0);
    }

    return filtered;
  })();

  function getSupplierScopedOptions(itemId: string) {
    const item = itemById.get(itemId);
    if (!item) return [];
    return item.options.filter((option) => !supplierId || option.supplierId === supplierId);
  }

  function focusInvoicePanel() {
    invoicePanelRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    setFlashInvoicePanel(true);
  }

  function hasExactLine(itemId: string, purchaseOptionId: string) {
    return lines.some((line) => line.itemId === itemId && line.purchaseOptionId === purchaseOptionId);
  }

  function addLine(seed?: Partial<DraftLine>) {
    const nextLine = createDraftLine(seed);
    setLines((current) => [...current, nextLine]);
    setFlashInvoicePanel(true);
  }

  function handleAddSuggestedLine(
    itemId: string,
    purchaseOptionId: string,
    itemName: string,
  ) {
    if (hasExactLine(itemId, purchaseOptionId)) {
      focusInvoicePanel();
      return;
    }

    addLine({
      itemId,
      purchaseOptionId,
      usedForCosting: true,
    });

    if (lines.length === 0) {
      toast.success(`Insumo agregado. ${itemName} se agregó a la factura.`);
    }
  }

  function removeLine(lineId: string) {
    setLines((current) => current.filter((line) => line.id !== lineId));
  }

  function updateLine(lineId: string, patch: Partial<DraftLine>) {
    setLines((current) =>
      current.map((line) => {
        if (line.id !== lineId) return line;
        const next = { ...line, ...patch };
        if (patch.itemId != null && patch.itemId !== line.itemId) {
          next.purchaseOptionId = "";
          next.usedForCosting = true;
        }
        return next;
      }),
    );
  }

  function handleSupplierChange(nextSupplierId: string) {
    if (nextSupplierId === supplierId) return;
    if (supplierId && lines.length > 0) {
      setLines([]);
      toast.info("La factura se reinició para cambiar de proveedor.");
    }
    setSupplierId(nextSupplierId);
    setScope("available");
    setManualDraft(() => ({ ...createManualDraft(), scope: "available" }));
  }

  function handleAddManualLine() {
    if (!manualDraft.itemId || !manualDraft.purchaseOptionId) return;
    const item = itemById.get(manualDraft.itemId);
    handleAddSuggestedLine(manualDraft.itemId, manualDraft.purchaseOptionId, item?.name ?? "Insumo");
    setLines((current) =>
      current.map((line, index) =>
        index === current.length - 1
          ? {
              ...line,
              newPrice: manualDraft.newPrice,
              notes: manualDraft.notes,
            }
          : line,
      ),
    );
    setManualDraft(createManualDraft());
    setManualModalOpen(false);
    focusInvoicePanel();
  }

  const encodedLines = useMemo(() => {
    const payload = lines
      .map((line) => ({
        itemId: line.itemId,
        purchaseOptionId: line.purchaseOptionId,
        newPrice: line.newPrice,
        usedForCosting: line.usedForCosting,
        notes: line.notes,
      }))
      .filter((line) => line.itemId || line.purchaseOptionId || line.newPrice || line.notes);

    return JSON.stringify(payload);
  }, [lines]);

  const lineMetrics = (() => {
    const costingCountByItem = new Map<string, number>();
    for (const line of lines) {
      if (!line.itemId) continue;
      costingCountByItem.set(line.itemId, (costingCountByItem.get(line.itemId) ?? 0) + (line.usedForCosting ? 1 : 0));
    }

    let readyLines = 0;
    let linesNeedingReview = 0;
    let linesMissingPrice = 0;
    const issues: string[] = [];
    let impactTotal = 0;

    for (const line of lines) {
      const item = itemById.get(line.itemId) ?? null;
      const options = line.itemId ? getSupplierScopedOptions(line.itemId) : [];
      const selectedOption = options.find((option) => option.id === line.purchaseOptionId) ?? null;
      const newPrice = Number(line.newPrice);
      const hasValidPrice = line.newPrice.trim().length > 0 && Number.isFinite(newPrice) && newPrice >= 0;
      const issuesForLine: string[] = [];

      if (!line.itemId) issuesForLine.push("Selecciona un insumo.");
      if (line.itemId && !line.purchaseOptionId) issuesForLine.push(`Selecciona la presentación para ${item?.name ?? "el insumo"}.`);
      if (line.itemId && line.purchaseOptionId && !hasValidPrice) issuesForLine.push(`Completa el nuevo precio de ${item?.name ?? "la línea"}.`);
      if (line.itemId && (costingCountByItem.get(line.itemId) ?? 0) !== 1) {
        issuesForLine.push(`Selecciona la presentación principal para ${item?.name ?? "el insumo"}.`);
      }

      if (issuesForLine.length === 0) {
        readyLines += 1;
      } else {
        linesNeedingReview += 1;
        issues.push(...issuesForLine);
      }

      if (!hasValidPrice) {
        linesMissingPrice += 1;
      }

      if (item && selectedOption && hasValidPrice && selectedOption.quantityPerPurchaseUnit > 0) {
        const nextUnitCost = newPrice / selectedOption.quantityPerPurchaseUnit;
        impactTotal += item.upcomingImpactLines.reduce(
          (sum, impactLine) => sum + impactLine.requiredQuantity * (nextUnitCost - impactLine.snapshotUnitCost),
          0,
        );
      }
    }

    if (lines.length === 0) {
      issues.unshift("Agrega al menos un insumo.");
    }
    if (linesMissingPrice > 0) {
      issues.unshift(`Completa el nuevo precio de ${linesMissingPrice.toLocaleString("es-MX")} línea(s).`);
    }

    return {
      readyLines,
      linesNeedingReview,
      issues: Array.from(new Set(issues)),
      impactTotal,
      hasPendingPricing: linesMissingPrice > 0,
    };
  })();

  const selectedSupplierName = supplierById.get(supplierId)?.name ?? "Proveedor";
  const stepOneComplete = Boolean(supplierId && invoiceRef.trim() && invoiceDate.trim());
  const currentStep =
    !stepOneComplete ? 1 : lines.length === 0 ? 2 : 3;
  const applyBlockingReason = !supplierId
    ? "Selecciona un proveedor."
    : !invoiceRef.trim()
      ? "Captura la referencia o folio de la factura."
      : !invoiceDate.trim()
        ? "Captura la fecha de la factura."
        : lines.length === 0
          ? "Agrega al menos un insumo."
          : lineMetrics.issues[0] ?? null;
  const canApplyInvoice = applyBlockingReason == null;

  const manualItem = itemById.get(manualDraft.itemId) ?? null;
  const manualAllOptions = manualItem?.options ?? [];
  const manualOptions =
    manualDraft.itemId && manualDraft.scope === "available"
      ? getSupplierScopedOptions(manualDraft.itemId)
      : manualAllOptions;
  const manualSelectedOption = manualOptions.find((option) => option.id === manualDraft.purchaseOptionId) ?? null;
  const manualNewUnitCost =
    manualSelectedOption &&
    manualDraft.newPrice.trim().length > 0 &&
    Number.isFinite(Number(manualDraft.newPrice)) &&
    Number(manualDraft.newPrice) >= 0 &&
    manualSelectedOption.quantityPerPurchaseUnit > 0
      ? Number(manualDraft.newPrice) / manualSelectedOption.quantityPerPurchaseUnit
      : null;

  return (
    <div className="space-y-4">
      <section className="rounded-[var(--radius-base)] border border-border bg-surface p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2">
              <span className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-border bg-surface-2">
                <ReceiptText className="h-5 w-5 text-primary" aria-hidden="true" />
              </span>
              <div>
                <h1 className="text-xl font-semibold text-foreground">Actualizar precios por factura</h1>
                <p className="text-sm text-muted">
                  Captura los precios recibidos del proveedor. Los nuevos costos se usarán en los próximos costeos.
                </p>
              </div>
            </div>
            <p className="text-sm text-muted">
              Esta captura actualiza precios de costeo. No registra entradas de inventario.
            </p>
          </div>
          <div className="rounded-[var(--radius-base)] border border-border bg-surface-2 px-3 py-2 text-xs text-muted">
            Eventos próximos: 30 días
          </div>
        </div>
      </section>

      <section className="rounded-[var(--radius-base)] border border-border bg-surface p-4">
        <p className="text-xs font-medium uppercase tracking-[0.08em] text-muted">Progreso de captura</p>
        <div className="mt-3 grid gap-3 md:grid-cols-3">
          {[
            {
              step: 1,
              label: "Datos de factura",
              summary: stepOneComplete ? "Datos de factura completos" : "Captura proveedor, referencia y fecha.",
            },
            {
              step: 2,
              label: "Agregar insumos",
              summary:
                stepOneComplete && lines.length === 0
                  ? "Agrega los insumos incluidos en la factura."
                  : "Selecciona productos y presentaciones.",
            },
            {
              step: 3,
              label: "Revisar y aplicar",
              summary:
                lines.length > 0
                  ? "Revisa precios y aplica la factura."
                  : "Aplica la factura cuando existan líneas listas.",
            },
          ].map((step) => {
            const stateForStep =
              step.step < currentStep ? "completed" : step.step === currentStep ? "current" : "pending";
            const Icon = stateForStep === "completed" ? CheckCircle2 : Circle;
            return (
              <div
                key={step.step}
                aria-current={stateForStep === "current" ? "step" : undefined}
                className={`rounded-[var(--radius-base)] border p-3 ${
                  stateForStep === "completed"
                    ? "border-success/40 bg-success/10"
                    : stateForStep === "current"
                      ? "border-primary/40 bg-primary/10"
                      : "border-border bg-surface-2"
                }`}
              >
                <div className="flex items-start gap-3">
                  <Icon
                    className={`mt-0.5 h-4 w-4 ${
                      stateForStep === "completed"
                        ? "text-success"
                        : stateForStep === "current"
                          ? "text-primary"
                          : "text-muted"
                    }`}
                    aria-hidden="true"
                  />
                  <div>
                    <p className="text-sm font-semibold text-foreground">
                      {step.step}. {step.label}
                    </p>
                    <p className="mt-1 text-sm text-muted">{step.summary}</p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {upcomingEventsWithoutInitialSnapshot.length > 0 ? (
        <section className="rounded-[var(--radius-base)] border border-warning/50 bg-warning/10 p-4">
          <p className="text-sm font-semibold text-foreground">Eventos próximos sin costeo inicial guardado</p>
          <p className="mt-1 text-sm text-muted">
            Estos eventos todavía no pueden mostrar impacto estimado porque aún no tienen un costo inicial vigente.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            {upcomingEventsWithoutInitialSnapshot.map((event) => (
              <span
                key={event.id}
                className="rounded-full border border-border bg-surface px-3 py-1 text-xs text-foreground"
              >
                {(event.name ?? "Evento sin nombre")} · {formatDate(event.startsAt)}
              </span>
            ))}
          </div>
        </section>
      ) : null}

      {lines.length > 0 ? (
        <a
          href="#current-invoice"
          className="inline-flex items-center gap-2 rounded-[var(--radius-base)] border border-border bg-surface px-3 py-2 text-sm text-foreground lg:hidden"
        >
          Factura actual · {lines.length.toLocaleString("es-MX")} línea(s)
          <ArrowRight className="h-4 w-4" aria-hidden="true" />
        </a>
      ) : null}

      <form action={formAction} className="space-y-4">
        <input type="hidden" name="tenantSlug" value={tenantSlug} />
        <input type="hidden" name="linesJson" value={encodedLines} />
        <input type="hidden" name="idempotencyKey" value={idempotencyKey} />

        <section className="rounded-[var(--radius-base)] border border-border bg-surface p-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="text-sm font-semibold text-foreground">Datos de factura</h2>
              <p className="mt-1 text-sm text-muted">
                Captura el proveedor, la referencia y la fecha para habilitar las presentaciones correctas.
              </p>
            </div>
            {!supplierId ? (
              <span className="rounded-full border border-warning/50 bg-warning/10 px-3 py-1 text-xs text-warning">
                Primero selecciona el proveedor de la factura.
              </span>
            ) : null}
          </div>

          <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <SearchableSelect
              id="price-update-supplier"
              name="supplierId"
              label="Proveedor"
              placeholder="Selecciona proveedor"
              required
              options={supplierOptions}
              defaultValue={supplierId}
              onValueChange={handleSupplierChange}
              helpText={
                supplierId
                  ? "Este proveedor define qué presentaciones puedes usar en la factura."
                  : "Selecciona un proveedor para ver sus presentaciones y agregar insumos."
              }
            />
            <div className="space-y-1">
              <Label htmlFor="price-update-invoice-ref">Factura o folio</Label>
              <Input
                id="price-update-invoice-ref"
                name="invoiceRef"
                placeholder="FAC-10428"
                required
                value={invoiceRef}
                onChange={(event) => setInvoiceRef(event.target.value)}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="price-update-invoice-date">Fecha de factura</Label>
              <Input
                id="price-update-invoice-date"
                name="invoiceDate"
                type="date"
                value={invoiceDate}
                onChange={(event) => setInvoiceDate(event.target.value)}
                required
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="price-update-notes">Notas</Label>
              <Input
                id="price-update-notes"
                name="notes"
                placeholder="Opcional"
                value={notes}
                onChange={(event) => setNotes(event.target.value)}
              />
            </div>
          </div>
        </section>

        <div className="grid gap-4 xl:grid-cols-[minmax(0,1.65fr)_minmax(320px,0.95fr)]">
          <section className="space-y-4">
            <section className="rounded-[var(--radius-base)] border border-border bg-surface p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h2 className="text-sm font-semibold text-foreground">Insumos para agregar</h2>
                  <p className="mt-1 text-sm text-muted">
                    Selecciona los productos incluidos en la factura del proveedor.
                  </p>
                </div>
                <Button type="button" variant="secondary" onClick={() => setManualModalOpen(true)} disabled={!supplierId}>
                  <PackagePlus className="h-4 w-4" aria-hidden="true" />
                  Agregar otro insumo
                </Button>
              </div>

              <p className="mt-2 text-xs text-muted">
                Úsalo cuando el insumo de la factura no aparezca en la lista sugerida.
              </p>

              <div className="mt-4 flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => setScope("available")}
                  disabled={!supplierId}
                  className={`rounded-full px-3 py-1 text-xs ${
                    scope === "available"
                      ? "bg-primary text-primary-foreground"
                      : "border border-border bg-surface-2 text-foreground"
                  } disabled:cursor-not-allowed disabled:opacity-60`}
                >
                  Disponibles con {supplierId ? selectedSupplierName : "proveedor"} ·{" "}
                  {supplierId
                    ? visibleCountForScope(items, supplierId).toLocaleString("es-MX")
                    : "0"}
                </button>
                <button
                  type="button"
                  onClick={() => setScope("upcoming")}
                  className={`rounded-full px-3 py-1 text-xs ${
                    scope === "upcoming"
                      ? "bg-primary text-primary-foreground"
                      : "border border-border bg-surface-2 text-foreground"
                  }`}
                >
                  Todos los insumos próximos · {suggestedItemIds.length.toLocaleString("es-MX")}
                </button>
                <button
                  type="button"
                  onClick={() => setScope("all")}
                  className={`rounded-full px-3 py-1 text-xs ${
                    scope === "all"
                      ? "bg-primary text-primary-foreground"
                      : "border border-border bg-surface-2 text-foreground"
                  }`}
                >
                  Todos los insumos · {items.length.toLocaleString("es-MX")}
                </button>
              </div>

              <p className="mt-3 text-sm text-muted">
                {scope === "available"
                  ? `Mostramos primero los insumos que sí puedes actualizar con ${selectedSupplierName}.`
                  : scope === "upcoming"
                  ? "Mostramos primero los insumos utilizados en eventos próximos que ya tienen un costeo."
                  : "Consulta todo el catálogo para capturar insumos fuera de los eventos próximos."}
              </p>

              <div className="mt-4">
                <div className="relative">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" aria-hidden="true" />
                  <Input
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    placeholder="Buscar insumo por nombre o unidad"
                    className="pl-9"
                  />
                </div>
              </div>

              {!supplierId ? (
                <StatePanel
                  kind="warning"
                  title="Selecciona el proveedor para ver los insumos y presentaciones disponibles."
                  message="Primero elige el proveedor de la factura para mostrar solo los insumos que realmente puedes agregar."
                  className="mt-4"
                />
              ) : visibleItems.length === 0 ? (
                <div className="mt-4">
                  <StatePanel
                    kind="empty"
                    title="Sin insumos para mostrar"
                      message={
                      scope === "available"
                        ? `No encontramos insumos compatibles con ${selectedSupplierName}.`
                        : scope === "upcoming"
                        ? "No hay insumos congelados en eventos próximos con costeo guardado. Cambia a Todos los insumos para continuar."
                        : "No encontramos insumos con los filtros actuales."
                    }
                  />
                </div>
              ) : (
                <div className="mt-4 overflow-x-auto">
                  <table className="w-full min-w-[860px] text-left text-sm">
                    <thead className="text-xs uppercase tracking-[0.08em] text-muted">
                      <tr>
                        <th className="px-3 py-2">Insumo</th>
                        <th className="px-3 py-2">Uso próximo</th>
                        <th className="px-3 py-2">Costo vigente</th>
                        <th className="px-3 py-2">Presentación</th>
                        <th className="px-3 py-2 text-right">Acción</th>
                      </tr>
                    </thead>
                    <tbody>
                      {visibleItems.map((item) => {
                        const supplierScopedOptions = getSupplierScopedOptions(item.id);
                        const defaultOption =
                          supplierScopedOptions.find((option) => option.isDefault) ?? supplierScopedOptions[0] ?? null;
                        const alreadyAdded = defaultOption ? hasExactLine(item.id, defaultOption.id) : false;
                        return (
                          <tr key={item.id} className="border-t border-border">
                            <td className="px-3 py-3 align-top text-foreground">
                              <p>{item.name}</p>
                              <p className="mt-1 text-xs text-muted">
                                {suggestedSet.has(item.id) ? "Sugerido por eventos próximos" : "Catálogo general"}
                              </p>
                            </td>
                            <td className="px-3 py-3 text-muted">{formatUpcomingUsage(item)}</td>
                            <td className="px-3 py-3 text-foreground">{formatCurrency(item.currentUnitCost)}</td>
                            <td className="px-3 py-3 text-muted">
                              {supplierScopedOptions.length === 0 ? (
                                <span>No disponible con {selectedSupplierName}</span>
                              ) : (
                                <div className="space-y-1">
                                  <p>{supplierScopedOptions.length === 1 ? "1 presentación" : `${supplierScopedOptions.length.toLocaleString("es-MX")} presentaciones`}</p>
                                  {defaultOption ? (
                                    <p className="text-xs">
                                      {defaultOption.purchaseUnitCode ?? "ud"}
                                      {defaultOption.currentPrice
                                        ? ` · ${formatCurrency(defaultOption.currentPrice.pricePerPurchaseUnit)}`
                                        : " · sin precio vigente"}
                                    </p>
                                  ) : null}
                                </div>
                              )}
                            </td>
                            <td className="px-3 py-3 text-right">
                              {defaultOption ? (
                                <Button
                                  type="button"
                                  variant={alreadyAdded ? "secondary" : "primary"}
                                  onClick={() =>
                                    alreadyAdded
                                      ? focusInvoicePanel()
                                      : handleAddSuggestedLine(item.id, defaultOption.id, item.name)
                                  }
                                >
                                  {alreadyAdded ? "Ver en factura" : "Agregar"}
                                </Button>
                              ) : (
                                <Button type="button" variant="secondary" onClick={() => setUnavailableItemId(item.id)}>
                                  No disponible
                                </Button>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          </section>

          <section
            id="current-invoice"
            ref={invoicePanelRef}
            className={`rounded-[var(--radius-base)] border bg-surface p-4 xl:sticky xl:top-4 xl:self-start ${
              flashInvoicePanel ? "border-primary/60 shadow-[var(--shadow-soft)]" : "border-border"
            }`}
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-sm font-semibold text-foreground">Factura actual</h2>
                <p className="mt-1 text-sm text-muted">
                  {selectedSupplierName} · {invoiceRef.trim() || "Sin referencia"} · {lines.length.toLocaleString("es-MX")} línea(s)
                </p>
              </div>
              <span className="rounded-full border border-border bg-surface-2 px-3 py-1 text-xs text-muted">
                {lineMetrics.readyLines.toLocaleString("es-MX")} listas · {lineMetrics.linesNeedingReview.toLocaleString("es-MX")} revisión
              </span>
            </div>

            {!supplierId ? (
              <StatePanel
                kind="warning"
                title="Captura primero los datos de factura"
                message="Completa proveedor, referencia y fecha para empezar a agregar insumos."
                className="mt-4"
              />
            ) : lines.length === 0 ? (
              <div className="mt-4 rounded-[var(--radius-base)] border border-border bg-surface-2 p-4">
                <div className="flex items-start gap-3">
                  <ShoppingCart className="mt-0.5 h-5 w-5 text-muted" aria-hidden="true" />
                  <div>
                    <p className="text-sm font-semibold text-foreground">Todavía no agregas insumos</p>
                    <p className="mt-1 text-sm text-muted">
                      Selecciona productos de la lista o usa “Agregar otro insumo”.
                    </p>
                  </div>
                </div>
              </div>
            ) : (
              <div className="mt-4 space-y-3">
                {lines.map((line, index) => {
                  const item = itemById.get(line.itemId) ?? null;
                  const lineOptions = line.itemId ? getSupplierScopedOptions(line.itemId) : [];
                  const selectedOption = lineOptions.find((option) => option.id === line.purchaseOptionId) ?? null;
                  const newPriceValue = Number(line.newPrice);
                  const hasValidPrice = line.newPrice.trim().length > 0 && Number.isFinite(newPriceValue) && newPriceValue >= 0;
                  const nextUnitCost =
                    selectedOption && hasValidPrice && selectedOption.quantityPerPurchaseUnit > 0
                      ? newPriceValue / selectedOption.quantityPerPurchaseUnit
                      : null;
                  const estimatedImpact =
                    item && nextUnitCost != null
                      ? item.upcomingImpactLines.reduce(
                          (sum, impactLine) =>
                            sum + impactLine.requiredQuantity * (nextUnitCost - impactLine.snapshotUnitCost),
                          0,
                        )
                      : null;
                  const itemCostingCount = lines.filter(
                    (candidate) => candidate.itemId === line.itemId && candidate.usedForCosting,
                  ).length;
                  const lineIssues: string[] = [];
                  if (!line.itemId) lineIssues.push("Selecciona un insumo.");
                  if (line.itemId && !line.purchaseOptionId) lineIssues.push("Selecciona una presentación.");
                  if (line.itemId && line.purchaseOptionId && !hasValidPrice) lineIssues.push("Captura el nuevo precio.");
                  if (line.itemId && itemCostingCount !== 1) {
                    lineIssues.push("Selecciona la presentación principal de costeo.");
                  }

                  return (
                    <div key={line.id} className="rounded-[var(--radius-base)] border border-border bg-surface-2 p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-base font-semibold text-foreground">
                            {item?.name ?? `Insumo ${index + 1}`}
                          </p>
                          <p className="mt-1 text-sm text-muted">
                            {selectedOption
                              ? resolveLineOptionLabel(selectedOption, item?.defaultUnitCode ?? null)
                              : "Selecciona la presentación de compra"}
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          <Button type="button" variant="danger" onClick={() => removeLine(line.id)}>
                            Quitar
                          </Button>
                        </div>
                      </div>

                      <div className="mt-4 grid gap-3 md:grid-cols-[1fr_auto]">
                        <SearchableSelect
                          id={`price-update-option-${line.id}`}
                          name={`ignored-option-${line.id}`}
                          label="Presentación"
                          placeholder="Selecciona presentación"
                          options={lineOptions.map((option) => ({
                            value: option.id,
                            label: `${resolveLineOptionLabel(option, item?.defaultUnitCode ?? null)}${
                              option.currentPrice ? ` · ${formatCurrency(option.currentPrice.pricePerPurchaseUnit)}` : ""
                            }`,
                          }))}
                          defaultValue={line.purchaseOptionId}
                          onValueChange={(value) => updateLine(line.id, { purchaseOptionId: value })}
                          disabled={!line.itemId}
                        />
                        <div className="flex items-end" />
                      </div>

                      <div className="mt-4 rounded-[var(--radius-base)] border border-border bg-surface p-3">
                        <p className="text-xs font-medium uppercase tracking-[0.08em] text-muted">Precio de compra</p>
                        <div className="mt-3 grid gap-3 md:grid-cols-[160px_minmax(0,1fr)]">
                          <div>
                            <p className="text-xs text-muted">Vigente</p>
                            <p className="mt-1 text-base font-semibold text-foreground">
                              {selectedOption?.currentPrice
                                ? formatCurrency(selectedOption.currentPrice.pricePerPurchaseUnit)
                                : "—"}
                            </p>
                          </div>
                          <div>
                            <Label htmlFor={`price-update-new-${line.id}`}>Nuevo precio</Label>
                            <Input
                              id={`price-update-new-${line.id}`}
                              value={line.newPrice}
                              onChange={(event) => updateLine(line.id, { newPrice: event.target.value })}
                              type="number"
                              min="0"
                              step="0.0001"
                              placeholder=""
                              className="mt-2 bg-surface"
                            />
                            {!hasValidPrice ? (
                              <p className="mt-2 text-sm text-warning">Captura el nuevo precio.</p>
                            ) : null}
                          </div>
                        </div>
                      </div>

                      <div className="mt-4 grid gap-3 md:grid-cols-3">
                        <div className="rounded-[var(--radius-base)] border border-border bg-surface p-3">
                          <p className="text-xs text-muted">Costo unitario</p>
                          <p className="mt-1 text-sm font-medium text-foreground">
                            {selectedOption?.derivedUnitCost != null ? formatCurrency(selectedOption.derivedUnitCost) : "—"}{" "}
                            <span className="text-muted">→</span>{" "}
                            {nextUnitCost != null ? formatCurrency(nextUnitCost) : "Pendiente"}
                          </p>
                        </div>
                        <div className="rounded-[var(--radius-base)] border border-border bg-surface p-3">
                          <p className="text-xs text-muted">Uso próximo</p>
                          <p className="mt-1 text-sm text-foreground">
                            {item ? formatUpcomingUsage(item) : "Sin impacto en eventos próximos"}
                          </p>
                        </div>
                        <div className="rounded-[var(--radius-base)] border border-border bg-surface p-3">
                          <p className="text-xs text-muted">Impacto estimado</p>
                          <p className="mt-1 text-sm text-foreground">
                            {estimatedImpact == null
                              ? "Pendiente de calcular"
                              : estimatedImpact === 0
                                ? "Sin variación estimada"
                                : `${estimatedImpact >= 0 ? "+" : ""}${formatCurrency(estimatedImpact)}`}
                          </p>
                        </div>
                      </div>

                      <div className="mt-4 space-y-3">
                        <label className="inline-flex items-start gap-2 text-sm text-foreground">
                          <input
                            type="checkbox"
                            checked={line.usedForCosting}
                            onChange={(event) => updateLine(line.id, { usedForCosting: event.target.checked })}
                            className="mt-0.5 h-4 w-4 rounded border-border"
                          />
                          <span>
                            <span className="font-medium">Usar para próximos costeos</span>
                            <span className="mt-1 block text-sm text-muted">
                              Esta presentación será la referencia para futuros costeos.
                            </span>
                          </span>
                        </label>
                        <Collapsible title="Más detalles">
                          <div className="space-y-3">
                            <div className="space-y-1">
                              <Label htmlFor={`price-update-notes-${line.id}`}>Trazabilidad</Label>
                              <Input
                                id={`price-update-notes-${line.id}`}
                                value={line.notes}
                                onChange={(event) => updateLine(line.id, { notes: event.target.value })}
                                placeholder="Lote, comentario o referencia interna"
                              />
                            </div>
                          </div>
                        </Collapsible>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            <div className="mt-4 rounded-[var(--radius-base)] border border-border bg-surface-2 p-4">
              <p className="text-sm font-semibold text-foreground">Validaciones antes de aplicar</p>
              <p className="mt-1 text-sm text-muted">
                {canApplyInvoice
                  ? `${lineMetrics.readyLines.toLocaleString("es-MX")} línea(s) listas`
                  : `${lineMetrics.readyLines.toLocaleString("es-MX")} línea(s) listas · ${lineMetrics.linesNeedingReview.toLocaleString("es-MX")} necesita${lineMetrics.linesNeedingReview === 1 ? "" : "n"} revisión`}
              </p>
              <div className="mt-3 space-y-2">
                {!canApplyInvoice && applyBlockingReason ? (
                  <div className="flex items-start gap-2 text-sm text-muted">
                      <TriangleAlert className="mt-0.5 h-4 w-4 text-warning" aria-hidden="true" />
                      <span>{applyBlockingReason}</span>
                    </div>
                ) : (
                  <div className="flex items-start gap-2 text-sm text-foreground">
                    <CheckCircle2 className="mt-0.5 h-4 w-4 text-success" aria-hidden="true" />
                    <span>Todo listo para aplicar la factura.</span>
                  </div>
                )}
              </div>
            </div>

            <div className="mt-4 rounded-[var(--radius-base)] border border-border bg-surface-2 p-4">
              <p className="text-xs font-medium uppercase tracking-[0.08em] text-muted">Impacto total estimado</p>
              <p className="mt-1 text-2xl font-semibold text-foreground">
                {lines.length === 0 || lineMetrics.hasPendingPricing
                  ? "Pendiente de calcular"
                  : lineMetrics.impactTotal === 0
                    ? "Sin variación estimada"
                  : `${lineMetrics.impactTotal >= 0 ? "+" : ""}${formatCurrency(lineMetrics.impactTotal)}`}
              </p>
              <p className="mt-1 text-sm text-muted">
                {lines.length === 0
                  ? "Agrega líneas para estimar el efecto de la factura."
                  : "La estimación reutiliza los insumos afectados en eventos próximos con costeo guardado."}
              </p>
            </div>

            {state.message ? (
              <div
                className={`mt-4 rounded-[var(--radius-base)] border p-3 text-sm ${
                  state.ok ? "border-success/40 bg-success/10 text-foreground" : "border-danger/40 bg-danger/10 text-foreground"
                }`}
              >
                {state.message}
              </div>
            ) : null}

            <div className="mt-4 space-y-3">
              <p className="text-xs text-muted">
                La aplicación es atómica: si una línea falla por conversión o configuración, la factura completa no se
                aplica.
              </p>
              <Button
                type="submit"
                isLoading={isPending}
                disabled={!canApplyInvoice}
                className="w-full"
              >
                {isPending ? "Aplicando factura..." : "Aplicar factura"}
              </Button>
            </div>
          </section>
        </div>
      </form>

      <details className="rounded-[var(--radius-base)] border border-border bg-surface p-4">
        <summary className="cursor-pointer list-none text-sm font-semibold text-foreground">
          Facturas recientes · {recentBatches.length.toLocaleString("es-MX")}
        </summary>
        <p className="mt-2 text-sm text-muted">Últimos lotes aplicados o capturados desde esta pantalla.</p>
        {recentBatches.length === 0 ? (
          <p className="mt-3 text-sm text-muted">Todavía no hay facturas registradas en este flujo.</p>
        ) : (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[720px] text-left text-sm">
              <thead className="text-xs uppercase tracking-[0.08em] text-muted">
                <tr>
                  <th className="px-3 py-2">Proveedor</th>
                  <th className="px-3 py-2">Referencia</th>
                  <th className="px-3 py-2">Fecha</th>
                  <th className="px-3 py-2 text-right">Líneas</th>
                  <th className="px-3 py-2">Estado</th>
                </tr>
              </thead>
              <tbody>
                {recentBatches.map((batch) => (
                  <tr key={batch.id} className="border-t border-border">
                    <td className="px-3 py-2 text-foreground">{batch.supplierName ?? "Proveedor"}</td>
                    <td className="px-3 py-2 text-foreground">{batch.invoiceRef}</td>
                    <td className="px-3 py-2 text-muted">{formatDate(batch.invoiceDate)}</td>
                    <td className="px-3 py-2 text-right text-foreground">{batch.lineCount.toLocaleString("es-MX")}</td>
                    <td className="px-3 py-2 text-muted">{translateBatchStatus(batch.status)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </details>

      <Modal
        open={manualModalOpen}
        onClose={() => setManualModalOpen(false)}
        title="Agregar otro insumo"
      >
        <div className="space-y-4">
          <p className="text-sm text-muted">
            Úsalo cuando el insumo de la factura no aparezca en la lista sugerida.
          </p>

          <SearchableSelect
            id="manual-price-update-item"
            name="ignored-manual-item"
            label="Insumo"
            placeholder="Selecciona insumo"
            options={(manualDraft.scope === "available"
              ? items.filter((item) => getSupplierScopedOptions(item.id).length > 0)
              : items
            ).map((item) => ({
              value: item.id,
              label: item.name,
              keywords: [item.defaultUnitCode ?? ""],
            }))}
            defaultValue={manualDraft.itemId}
            onValueChange={(value) =>
              setManualDraft((current) => ({ ...current, itemId: value, purchaseOptionId: "" }))
            }
          />

          <button
            type="button"
            onClick={() =>
              setManualDraft((current) => ({
                ...current,
                scope: current.scope === "available" ? "all" : "available",
                itemId: "",
                purchaseOptionId: "",
              }))
            }
            className="text-sm text-primary underline underline-offset-2"
          >
            {manualDraft.scope === "available"
              ? "Buscar en todo el catálogo"
              : `Volver a insumos disponibles con ${selectedSupplierName}`}
          </button>

          {manualItem && manualOptions.length === 0 ? (
            <StatePanel
              kind="warning"
              title={`Este insumo no está disponible con ${selectedSupplierName}.`}
              message="Configura una presentación antes de agregarlo a la factura."
            >
              <div className="pt-2">
                <Link
                  href={`/${tenantSlug}/kitchen/inventory/presentaciones-precios`}
                  className="text-sm text-primary underline underline-offset-2"
                >
                  Ir a presentaciones y proveedores
                </Link>
              </div>
            </StatePanel>
          ) : (
            <SearchableSelect
              id="manual-price-update-option"
              name="ignored-manual-option"
              label="Presentación"
              placeholder="Selecciona presentación"
              options={manualOptions.map((option) => ({
                value: option.id,
                label: `${resolveLineOptionLabel(option, manualItem?.defaultUnitCode ?? null)}${
                  option.currentPrice ? ` · ${formatCurrency(option.currentPrice.pricePerPurchaseUnit)}` : ""
                }`,
              }))}
              defaultValue={manualDraft.purchaseOptionId}
              onValueChange={(value) => setManualDraft((current) => ({ ...current, purchaseOptionId: value }))}
              disabled={!manualDraft.itemId}
            />
          )}

          <div className="grid gap-3 md:grid-cols-2">
            <MetricTile
              label="Costo vigente"
              value={
                manualSelectedOption?.currentPrice
                  ? formatCurrency(manualSelectedOption.currentPrice.pricePerPurchaseUnit)
                  : "—"
              }
            />
            <MetricTile
              label="Costo unitario actual"
              value={
                manualSelectedOption?.derivedUnitCost != null
                  ? formatCurrency(manualSelectedOption.derivedUnitCost)
                  : "—"
              }
            />
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            <div className="space-y-1">
              <Label htmlFor="manual-price-update-new-price">Nuevo precio</Label>
              <Input
                id="manual-price-update-new-price"
                value={manualDraft.newPrice}
                onChange={(event) => setManualDraft((current) => ({ ...current, newPrice: event.target.value }))}
                type="number"
                min="0"
                step="0.0001"
                placeholder="0.00"
              />
            </div>
            <MetricTile
              label="Nuevo costo unitario"
              value={manualNewUnitCost != null ? formatCurrency(manualNewUnitCost) : "—"}
            />
          </div>

          <div className="space-y-1">
            <Label htmlFor="manual-price-update-notes">Notas</Label>
            <Input
              id="manual-price-update-notes"
              value={manualDraft.notes}
              onChange={(event) => setManualDraft((current) => ({ ...current, notes: event.target.value }))}
              placeholder="Lote, comentario o referencia interna"
            />
          </div>

          <div className="flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={() => setManualModalOpen(false)}>
              Cancelar
            </Button>
            <Button
              type="button"
              onClick={handleAddManualLine}
              disabled={!manualDraft.itemId || !manualDraft.purchaseOptionId}
            >
              <ListPlus className="h-4 w-4" aria-hidden="true" />
              Agregar a factura
            </Button>
          </div>
        </div>
      </Modal>

      <Modal
        open={unavailableItemId != null}
        onClose={() => setUnavailableItemId(null)}
        title="Insumo no disponible"
      >
        <div className="space-y-4">
          <p className="text-sm text-muted">
            {itemById.get(unavailableItemId ?? "")?.name ?? "Este insumo"} no tiene una presentación configurada para{" "}
            {selectedSupplierName}.
          </p>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={() => setUnavailableItemId(null)}>
              Cerrar
            </Button>
            <Link
              href={`/${tenantSlug}/kitchen/inventory/presentaciones-precios`}
              className="inline-flex items-center justify-center rounded-[var(--radius-base)] border border-border bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90"
            >
              Configurar presentación
            </Link>
          </div>
        </div>
      </Modal>
    </div>
  );
}

function MetricTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[var(--radius-base)] border border-border bg-surface p-3">
      <p className="text-xs text-muted">{label}</p>
      <p className="mt-1 text-base font-semibold text-foreground">{value}</p>
    </div>
  );
}

function visibleCountForScope(items: KitchenInventoryPriceUpdateItem[], supplierId: string): number {
  return items.filter((item) => item.options.some((option) => option.supplierId === supplierId)).length;
}
