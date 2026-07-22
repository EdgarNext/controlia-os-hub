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
import {
  roundTo,
  type ExistingPurchaseOptionDraftLine,
  type NewPurchaseOptionDraftLine,
} from "@/lib/kitchen/inventory/price-update-drafts";
import type {
  KitchenInventoryPriceUpdateItem,
  KitchenInventoryPriceUpdateRecentBatch,
} from "@/lib/kitchen/inventory/price-updates";
import type { KitchenInventorySupplier, KitchenInventoryUnit } from "@/lib/kitchen/inventory/types";

type ExistingDraftLine = ExistingPurchaseOptionDraftLine & {
  id: string;
  notes: string;
  newPrice: string;
};

type NewDraftLine = NewPurchaseOptionDraftLine & {
  id: string;
  notes: string;
  newPrice: string;
  newPurchaseOption: {
    purchaseUnitId: string;
    quantityPerPurchaseUnit: string;
    inventoryUnitId: string;
  };
};

type DraftLine = ExistingDraftLine | NewDraftLine;

type ManualDraft = {
  mode: "existing_purchase_option" | "new_purchase_option";
  scope: "available" | "all";
  itemId: string;
  purchaseOptionId: string;
  purchaseUnitId: string;
  quantityPerPurchaseUnit: string;
  newPrice: string;
  notes: string;
  usedForCosting: boolean;
};

type PriceUpdatesClientProps = {
  tenantSlug: string;
  suppliers: KitchenInventorySupplier[];
  units: KitchenInventoryUnit[];
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

function createExistingLine(seed?: Partial<ExistingDraftLine>): ExistingDraftLine {
  return {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    mode: "existing_purchase_option",
    itemId: seed?.itemId ?? "",
    purchaseOptionId: seed?.purchaseOptionId ?? "",
    newPrice: seed?.newPrice ?? "",
    usedForCosting: seed?.usedForCosting ?? true,
    notes: seed?.notes ?? "",
  };
}

function createNewLine(seed?: Partial<NewDraftLine>): NewDraftLine {
  return {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    mode: "new_purchase_option",
    itemId: seed?.itemId ?? "",
    newPurchaseOption: {
      purchaseUnitId: seed?.newPurchaseOption?.purchaseUnitId ?? "",
      quantityPerPurchaseUnit: seed?.newPurchaseOption?.quantityPerPurchaseUnit ?? "",
      inventoryUnitId: seed?.newPurchaseOption?.inventoryUnitId ?? "",
    },
    newPrice: seed?.newPrice ?? "",
    usedForCosting: seed?.usedForCosting ?? true,
    notes: seed?.notes ?? "",
  };
}

function createManualDraft(): ManualDraft {
  return {
    mode: "existing_purchase_option",
    scope: "available",
    itemId: "",
    purchaseOptionId: "",
    purchaseUnitId: "",
    quantityPerPurchaseUnit: "",
    newPrice: "",
    notes: "",
    usedForCosting: true,
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

function parseDraftNumber(value: string): number | null {
  const normalized = value.trim();
  if (!normalized) return null;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

function visibleCountForScope(items: KitchenInventoryPriceUpdateItem[], supplierId: string): number {
  return items.filter((item) => item.options.some((option) => option.supplierId === supplierId)).length;
}

function MetricTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[var(--radius-base)] border border-border bg-surface p-3">
      <p className="text-xs text-muted">{label}</p>
      <p className="mt-1 text-base font-semibold text-foreground">{value}</p>
    </div>
  );
}

export function PriceUpdatesClient({
  tenantSlug,
  suppliers,
  units,
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
  const [pendingSupplierId, setPendingSupplierId] = useState<string | null>(null);
  const previousMessage = useRef("");
  const invoicePanelRef = useRef<HTMLElement | null>(null);

  const itemById = useMemo(() => new Map(items.map((item) => [item.id, item])), [items]);
  const supplierById = useMemo(() => new Map(suppliers.map((supplier) => [supplier.id, supplier])), [suppliers]);
  const unitById = useMemo(() => new Map(units.map((unit) => [unit.id, unit])), [units]);
  const supplierOptions = useMemo(
    () => suppliers.map((supplier) => ({ value: supplier.id, label: supplier.name })),
    [suppliers],
  );
  const suggestedSet = useMemo(() => new Set(suggestedItemIds), [suggestedItemIds]);
  const purchaseUnitOptions = useMemo(
    () =>
      units
        .filter((unit) => unit.is_active)
        .map((unit) => ({
          value: unit.id,
          label: unit.name,
          keywords: [unit.code],
        })),
    [units],
  );

  useEffect(() => {
    if (!flashInvoicePanel) return;
    const timeoutId = window.setTimeout(() => setFlashInvoicePanel(false), 1800);
    return () => window.clearTimeout(timeoutId);
  }, [flashInvoicePanel]);

  useEffect(() => {
    if (!state.message || state.message === previousMessage.current) return;
    previousMessage.current = state.message;

    if (state.ok) {
      toast.success(state.message);
      const timeoutId = window.setTimeout(() => {
        setLines([]);
        setInvoiceRef("");
        setNotes("");
        setManualDraft(createManualDraft());
        setIdempotencyKey(`price-update-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`);
        setFlashInvoicePanel(false);
      }, 0);
      return () => window.clearTimeout(timeoutId);
    }

    toast.error("No se pudo aplicar la factura. No se creó ninguna presentación ni se actualizó ningún precio.");
    return;
  }, [state.message, state.ok]);

  function getSupplierScopedOptions(itemId: string) {
    const item = itemById.get(itemId);
    if (!item) return [];
    return item.options.filter((option) => option.supplierId === supplierId);
  }

  function focusInvoicePanel() {
    invoicePanelRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    setFlashInvoicePanel(true);
  }

  function findEquivalentSupplierOption(itemId: string, purchaseUnitId: string, inventoryUnitId: string, quantity: number) {
    const item = itemById.get(itemId);
    if (!item) return null;
    return (
      item.options.find(
        (option) =>
          option.supplierId === supplierId &&
          option.purchaseUnitId === purchaseUnitId &&
          option.inventoryUnitId === inventoryUnitId &&
          roundTo(option.quantityPerPurchaseUnit, 4) === roundTo(quantity, 4),
      ) ?? null
    );
  }

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

    if (!supplierId) return filtered;
    if (scope === "available") return filtered.filter((item) => getSupplierScopedOptions(item.id).length > 0);
    return filtered;
  })();

  const selectedSupplierName = supplierById.get(supplierId)?.name ?? "Proveedor";
  const stepOneComplete = Boolean(supplierId && invoiceRef.trim() && invoiceDate.trim());
  const currentStep = !stepOneComplete ? 1 : lines.length === 0 ? 2 : 3;

  const encodedLines = useMemo(() => {
    const payload = lines.map((line) => {
      if (line.mode === "new_purchase_option") {
        return {
          mode: line.mode,
          itemId: line.itemId,
          newPurchaseOption: line.newPurchaseOption,
          newPrice: line.newPrice,
          usedForCosting: line.usedForCosting,
          notes: line.notes,
        };
      }
      return {
        mode: line.mode,
        itemId: line.itemId,
        purchaseOptionId: line.purchaseOptionId,
        newPrice: line.newPrice,
        usedForCosting: line.usedForCosting,
        notes: line.notes,
      };
    });
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
      const issuesForLine: string[] = [];
      const itemCostingCount = line.itemId ? costingCountByItem.get(line.itemId) ?? 0 : 0;

      if (!line.itemId) issuesForLine.push("Selecciona un insumo.");
      if (line.mode === "existing_purchase_option") {
        const options = line.itemId ? getSupplierScopedOptions(line.itemId) : [];
        const selectedOption = options.find((option) => option.id === line.purchaseOptionId) ?? null;
        const newPrice = parseDraftNumber(line.newPrice);
        const hasValidPrice = line.newPrice.trim().length > 0 && newPrice != null && newPrice >= 0;

        if (line.itemId && !line.purchaseOptionId) issuesForLine.push(`Selecciona la presentación para ${item?.name ?? "el insumo"}.`);
        if (line.itemId && line.purchaseOptionId && !hasValidPrice) issuesForLine.push(`Completa el nuevo precio de ${item?.name ?? "la línea"}.`);
        if (line.itemId && itemCostingCount !== 1) issuesForLine.push(`Selecciona la presentación principal para ${item?.name ?? "el insumo"}.`);
        if (!hasValidPrice) linesMissingPrice += 1;

        if (item && selectedOption && newPrice != null && newPrice >= 0 && selectedOption.quantityPerPurchaseUnit > 0) {
          const nextUnitCost = newPrice / selectedOption.quantityPerPurchaseUnit;
          impactTotal += item.upcomingImpactLines.reduce(
            (sum, impactLine) => sum + impactLine.requiredQuantity * (nextUnitCost - impactLine.snapshotUnitCost),
            0,
          );
        }
      } else {
        const quantity = parseDraftNumber(line.newPurchaseOption.quantityPerPurchaseUnit);
        const price = parseDraftNumber(line.newPrice);
        const hasValidPrice = price != null && price > 0;
        const duplicate = quantity
          ? findEquivalentSupplierOption(
              line.itemId,
              line.newPurchaseOption.purchaseUnitId,
              line.newPurchaseOption.inventoryUnitId,
              quantity,
            )
          : null;

        if (!line.newPurchaseOption.purchaseUnitId) issuesForLine.push("Selecciona el tipo de presentación.");
        if (quantity == null || quantity <= 0) issuesForLine.push("Captura un contenido mayor a cero.");
        if (price == null || price <= 0) issuesForLine.push("Captura el precio de esta presentación tal como aparece en la factura.");
        if (duplicate) issuesForLine.push("Ya existe una presentación con esta equivalencia.");
        if (line.itemId && itemCostingCount !== 1) issuesForLine.push(`Selecciona la presentación principal para ${item?.name ?? "el insumo"}.`);
        if (!hasValidPrice) linesMissingPrice += 1;

        if (item && quantity != null && quantity > 0 && price != null && price > 0) {
          const nextUnitCost = price / quantity;
          impactTotal += item.upcomingImpactLines.reduce(
            (sum, impactLine) => sum + impactLine.requiredQuantity * (nextUnitCost - impactLine.snapshotUnitCost),
            0,
          );
        }
      }

      if (issuesForLine.length === 0) {
        readyLines += 1;
      } else {
        linesNeedingReview += 1;
        issues.push(...issuesForLine);
      }
    }

    if (lines.length === 0) issues.unshift("Agrega al menos un insumo.");
    if (linesMissingPrice > 0) issues.unshift(`Completa el nuevo precio de ${linesMissingPrice.toLocaleString("es-MX")} línea(s).`);

    return {
      readyLines,
      linesNeedingReview,
      issues: Array.from(new Set(issues)),
      impactTotal,
      hasPendingPricing: linesMissingPrice > 0,
    };
  })();

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
  const manualAvailableOptions =
    manualDraft.itemId && manualDraft.scope === "available" ? getSupplierScopedOptions(manualDraft.itemId) : manualItem?.options ?? [];
  const manualSelectedOption =
    manualDraft.mode === "existing_purchase_option"
      ? manualAvailableOptions.find((option) => option.id === manualDraft.purchaseOptionId) ?? null
      : null;
  const manualQuantity = parseDraftNumber(manualDraft.quantityPerPurchaseUnit);
  const manualPrice = parseDraftNumber(manualDraft.newPrice);
  const manualNewUnitCost =
    manualDraft.mode === "new_purchase_option"
      ? manualQuantity != null && manualQuantity > 0 && manualPrice != null && manualPrice > 0
        ? roundTo(manualPrice / manualQuantity, 4)
        : null
      : manualSelectedOption &&
          manualPrice != null &&
          manualPrice >= 0 &&
          manualSelectedOption.quantityPerPurchaseUnit > 0
        ? roundTo(manualPrice / manualSelectedOption.quantityPerPurchaseUnit, 4)
        : null;
  const manualDuplicate =
    manualDraft.mode === "new_purchase_option" &&
    manualItem &&
    manualQuantity != null &&
    manualQuantity > 0 &&
    manualDraft.purchaseUnitId
      ? findEquivalentSupplierOption(manualItem.id, manualDraft.purchaseUnitId, manualItem.defaultUnitId, manualQuantity)
      : null;

  function resetManualDraft(next?: Partial<ManualDraft>) {
    setManualDraft({ ...createManualDraft(), ...next });
  }

  function addLine(line: DraftLine) {
    setLines((current) => [...current, line]);
    setFlashInvoicePanel(true);
  }

  function updateLine(lineId: string, patch: Partial<DraftLine>) {
    setLines((current) =>
      current.map((line) => {
        if (line.id !== lineId) return line;
        if (line.mode === "new_purchase_option") {
          const nextLine = {
            ...line,
            ...patch,
          } as NewDraftLine;
          if ("newPurchaseOption" in patch && patch.newPurchaseOption) {
            nextLine.newPurchaseOption = {
              ...line.newPurchaseOption,
              ...patch.newPurchaseOption,
            };
          }
          return nextLine;
        }
        return { ...line, ...patch } as ExistingDraftLine;
      }),
    );
  }

  function removeLine(lineId: string) {
    setLines((current) => current.filter((line) => line.id !== lineId));
  }

  function openManualModalForItem(itemId?: string, mode?: ManualDraft["mode"]) {
    const item = itemId ? itemById.get(itemId) ?? null : null;
    resetManualDraft({
      itemId: itemId ?? "",
      mode: mode ?? "existing_purchase_option",
      purchaseUnitId: "",
      quantityPerPurchaseUnit: "",
      purchaseOptionId: "",
      scope: mode === "new_purchase_option" ? "all" : "available",
      usedForCosting: true,
      ...(item
        ? {
            purchaseUnitId: "",
          }
        : {}),
    });
    setManualModalOpen(true);
  }

  function handleAddSuggestedLine(itemId: string, purchaseOptionId: string, itemName: string) {
    const exists = lines.some(
      (line) => line.mode === "existing_purchase_option" && line.itemId === itemId && line.purchaseOptionId === purchaseOptionId,
    );
    if (exists) {
      focusInvoicePanel();
      return;
    }

    addLine(
      createExistingLine({
        itemId,
        purchaseOptionId,
      }),
    );
    toast.success(`Insumo agregado a la factura. ${itemName} ya está en captura.`);
  }

  function confirmSupplierChange(nextSupplierId: string) {
    if (nextSupplierId === supplierId) return;
    if (supplierId && lines.length > 0) {
      setPendingSupplierId(nextSupplierId);
      return;
    }
    setSupplierId(nextSupplierId);
    setScope("available");
    resetManualDraft({ scope: "available" });
  }

  function applyConfirmedSupplierChange() {
    if (!pendingSupplierId) return;
    setLines([]);
    setSupplierId(pendingSupplierId);
    setPendingSupplierId(null);
    setScope("available");
    resetManualDraft({ scope: "available" });
    toast.info("La factura en captura se limpió para cambiar de proveedor.");
  }

  function handleAddManualLine() {
    if (!manualItem) return;

    if (manualDraft.mode === "existing_purchase_option") {
      if (!manualDraft.purchaseOptionId) return;
      addLine(
        createExistingLine({
          itemId: manualItem.id,
          purchaseOptionId: manualDraft.purchaseOptionId,
          newPrice: manualDraft.newPrice,
          notes: manualDraft.notes,
          usedForCosting: manualDraft.usedForCosting,
        }),
      );
      toast.success("Insumo agregado a la factura");
      setManualModalOpen(false);
      resetManualDraft();
      focusInvoicePanel();
      return;
    }

    if (!manualDraft.purchaseUnitId || manualQuantity == null || manualQuantity <= 0) return;
    if (manualPrice == null || manualPrice <= 0) return;
    if (manualDuplicate) {
      toast.error("Ya existe una presentación con esta equivalencia.");
      return;
    }

    addLine(
      createNewLine({
        itemId: manualItem.id,
        newPurchaseOption: {
          purchaseUnitId: manualDraft.purchaseUnitId,
          quantityPerPurchaseUnit: manualDraft.quantityPerPurchaseUnit,
          inventoryUnitId: manualItem.defaultUnitId,
        },
        newPrice: manualDraft.newPrice,
        notes: manualDraft.notes,
        usedForCosting: manualDraft.usedForCosting,
      }),
    );
    toast.success("Nueva presentación agregada a la factura");
    setManualModalOpen(false);
    resetManualDraft();
    focusInvoicePanel();
  }

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
                  Captura precios y nuevas presentaciones sin tocar inventario físico hasta aplicar la factura.
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
                  ? "Agrega insumos o nuevas presentaciones."
                  : "Selecciona productos y presentaciones.",
            },
            {
              step: 3,
              label: "Revisar y aplicar",
              summary: lines.length > 0 ? "Revisa líneas y aplica la factura." : "Aplica cuando existan líneas listas.",
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
                El proveedor definido aquí aplica a todas las líneas de esta factura.
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
              onValueChange={confirmSupplierChange}
              helpText={
                supplierId
                  ? "Este proveedor define qué presentaciones puedes usar o crear en la factura."
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
                    Selecciona un insumo existente. Después puedes usar una presentación configurada o crear una nueva
                    para este proveedor.
                  </p>
                </div>
                <Button type="button" variant="secondary" onClick={() => openManualModalForItem()} disabled={!supplierId}>
                  <PackagePlus className="h-4 w-4" aria-hidden="true" />
                  Agregar insumo a la factura
                </Button>
              </div>

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
                  {supplierId ? visibleCountForScope(items, supplierId).toLocaleString("es-MX") : "0"}
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
                  ? `Mostramos primero los insumos que ya tienen presentaciones con ${selectedSupplierName}.`
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
                  message="Primero elige el proveedor de la factura para mostrar solo los insumos compatibles."
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
                          ? "No hay insumos congelados en eventos próximos con costeo guardado."
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
                        const alreadyAdded =
                          defaultOption != null &&
                          lines.some(
                            (line) =>
                              line.mode === "existing_purchase_option" &&
                              line.itemId === item.id &&
                              line.purchaseOptionId === defaultOption.id,
                          );

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
                                  <p>
                                    {supplierScopedOptions.length === 1
                                      ? "1 presentación"
                                      : `${supplierScopedOptions.length.toLocaleString("es-MX")} presentaciones`}
                                  </p>
                                  {defaultOption ? (
                                    <p className="text-xs">
                                      {resolveLineOptionLabel(defaultOption, item.defaultUnitCode)}
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
                                  {alreadyAdded ? "Ver en factura" : "Agregar a la factura"}
                                </Button>
                              ) : (
                                <Button
                                  type="button"
                                  variant="secondary"
                                  onClick={() => openManualModalForItem(item.id, "new_purchase_option")}
                                >
                                  Crear presentación
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
                      Selecciona productos de la lista o usa “Agregar insumo a la factura”.
                    </p>
                  </div>
                </div>
              </div>
            ) : (
              <div className="mt-4 space-y-3">
                {lines.map((line, index) => {
                  const item = itemById.get(line.itemId) ?? null;
                  const itemCostingCount = lines.filter(
                    (candidate) => candidate.itemId === line.itemId && candidate.usedForCosting,
                  ).length;

                  if (line.mode === "new_purchase_option") {
                    const purchaseUnit = unitById.get(line.newPurchaseOption.purchaseUnitId) ?? null;
                    const quantity = parseDraftNumber(line.newPurchaseOption.quantityPerPurchaseUnit);
                    const newPrice = parseDraftNumber(line.newPrice);
                    const hasValidPrice = newPrice != null && newPrice > 0;
                    const nextUnitCost =
                      quantity != null && quantity > 0 && newPrice != null && newPrice > 0
                        ? roundTo(newPrice / quantity, 4)
                        : null;
                    const estimatedImpact =
                      item && nextUnitCost != null
                        ? item.upcomingImpactLines.reduce(
                            (sum, impactLine) =>
                              sum + impactLine.requiredQuantity * (nextUnitCost - impactLine.snapshotUnitCost),
                            0,
                          )
                        : null;
                    const duplicate =
                      item && quantity != null && quantity > 0
                        ? findEquivalentSupplierOption(
                            item.id,
                            line.newPurchaseOption.purchaseUnitId,
                            line.newPurchaseOption.inventoryUnitId,
                            quantity,
                          )
                        : null;

                    return (
                      <div key={line.id} className="rounded-[var(--radius-base)] border border-border bg-surface-2 p-4">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <div className="flex flex-wrap items-center gap-2">
                              <p className="text-base font-semibold text-foreground">
                                {item?.name ?? `Insumo ${index + 1}`}
                              </p>
                              <span className="rounded-full border border-primary/40 bg-primary/10 px-2 py-1 text-xs text-primary">
                                Nueva presentación
                              </span>
                            </div>
                            <p className="mt-1 text-sm text-muted">
                              Pendiente de crear al aplicar la factura
                            </p>
                          </div>
                          <Button type="button" variant="danger" onClick={() => removeLine(line.id)}>
                            Quitar
                          </Button>
                        </div>

                        <div className="mt-4 grid gap-3 md:grid-cols-2">
                          <SearchableSelect
                            id={`new-line-purchase-unit-${line.id}`}
                            name={`ignored-new-line-purchase-unit-${line.id}`}
                            label="Tipo de presentación"
                            placeholder="Selecciona presentación"
                            options={purchaseUnitOptions}
                            defaultValue={line.newPurchaseOption.purchaseUnitId}
                            onValueChange={(value) =>
                              updateLine(line.id, {
                                newPurchaseOption: { ...line.newPurchaseOption, purchaseUnitId: value },
                              } as Partial<DraftLine>)
                            }
                          />
                          <div className="space-y-1">
                            <Label htmlFor={`new-line-quantity-${line.id}`}>Contenido de la presentación</Label>
                            <Input
                              id={`new-line-quantity-${line.id}`}
                              type="number"
                              min="0.0001"
                              step="0.0001"
                              value={line.newPurchaseOption.quantityPerPurchaseUnit}
                              onChange={(event) =>
                                updateLine(line.id, {
                                  newPurchaseOption: {
                                    ...line.newPurchaseOption,
                                    quantityPerPurchaseUnit: event.target.value,
                                  },
                                } as Partial<DraftLine>)
                              }
                            />
                          </div>
                        </div>

                        <div className="mt-4 grid gap-3 md:grid-cols-3">
                          <MetricTile
                            label="Proveedor"
                            value={selectedSupplierName}
                          />
                          <MetricTile
                            label="Unidad del insumo"
                            value={item?.defaultUnitName ?? item?.defaultUnitCode ?? "—"}
                          />
                          <MetricTile
                            label="Equivalencia"
                            value={
                              purchaseUnit && quantity != null && quantity > 0
                                ? `1 ${purchaseUnit.code ?? purchaseUnit.name} = ${quantity.toLocaleString("es-MX", {
                                    minimumFractionDigits: 0,
                                    maximumFractionDigits: 4,
                                  })} ${item?.defaultUnitCode ?? "ud"}`
                                : "Pendiente"
                            }
                          />
                        </div>

                        <div className="mt-4 rounded-[var(--radius-base)] border border-border bg-surface p-3">
                          <p className="text-xs font-medium uppercase tracking-[0.08em] text-muted">Precio de compra</p>
                          <div className="mt-3 grid gap-3 md:grid-cols-[160px_minmax(0,1fr)]">
                            <MetricTile
                              label="Costo por unidad"
                              value={nextUnitCost != null ? formatCurrency(nextUnitCost) : "Pendiente"}
                            />
                            <div>
                              <Label htmlFor={`new-line-price-${line.id}`}>Precio en la factura</Label>
                              <Input
                                id={`new-line-price-${line.id}`}
                                value={line.newPrice}
                                onChange={(event) => updateLine(line.id, { newPrice: event.target.value })}
                                type="number"
                                min="0.0001"
                                step="0.0001"
                                className="mt-2 bg-surface"
                              />
                              {!hasValidPrice ? (
                                <p className="mt-2 text-sm text-warning">Ingresa un precio mayor a $0.</p>
                              ) : null}
                            </div>
                          </div>
                        </div>

                        <div className="mt-4 grid gap-3 md:grid-cols-2">
                          <MetricTile
                            label="Uso próximo"
                            value={item ? formatUpcomingUsage(item) : "Sin impacto en eventos próximos"}
                          />
                          <MetricTile
                            label="Impacto estimado"
                            value={
                              estimatedImpact == null
                                ? "Pendiente de calcular"
                                : estimatedImpact === 0
                                  ? "Sin variación estimada"
                                  : `${estimatedImpact >= 0 ? "+" : ""}${formatCurrency(estimatedImpact)}`
                            }
                          />
                        </div>

                        {duplicate ? (
                          <div className="mt-4 rounded-[var(--radius-base)] border border-warning/50 bg-warning/10 p-3 text-sm text-foreground">
                            Ya existe una presentación con esta equivalencia.
                            <div className="mt-2">
                              <Button
                                type="button"
                                variant="secondary"
                                onClick={() => {
                                  removeLine(line.id);
                                  handleAddSuggestedLine(item?.id ?? "", duplicate.id, item?.name ?? "Insumo");
                                }}
                              >
                                Usar presentación existente
                              </Button>
                            </div>
                          </div>
                        ) : null}

                        <div className="mt-4 space-y-3">
                          <label className="inline-flex items-start gap-2 text-sm text-foreground">
                            <input
                              type="checkbox"
                              checked={line.usedForCosting}
                              onChange={(event) => updateLine(line.id, { usedForCosting: event.target.checked })}
                              className="mt-0.5 h-4 w-4 rounded border-border"
                            />
                            <span>
                              <span className="font-medium">Usar esta presentación para próximos costeos</span>
                              <span className="mt-1 block text-sm text-muted">
                                El costo por unidad calculado será la referencia vigente de este insumo.
                              </span>
                            </span>
                          </label>

                          {line.itemId && itemCostingCount !== 1 ? (
                            <p className="text-sm text-warning">
                              Cada insumo debe dejar exactamente una presentación marcada como fuente de costeo.
                            </p>
                          ) : null}

                          <Collapsible title="Más detalles">
                            <div className="space-y-3">
                              <div className="space-y-1">
                                <Label htmlFor={`new-line-notes-${line.id}`}>Notas</Label>
                                <Input
                                  id={`new-line-notes-${line.id}`}
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
                  }

                  const lineOptions = line.itemId ? getSupplierScopedOptions(line.itemId) : [];
                  const selectedOption = lineOptions.find((option) => option.id === line.purchaseOptionId) ?? null;
                  const newPriceValue = parseDraftNumber(line.newPrice);
                  const hasValidPrice = line.newPrice.trim().length > 0 && newPriceValue != null && newPriceValue >= 0;
                  const nextUnitCost =
                    selectedOption && hasValidPrice && selectedOption.quantityPerPurchaseUnit > 0
                      ? roundTo(newPriceValue / selectedOption.quantityPerPurchaseUnit, 4)
                      : null;
                  const estimatedImpact =
                    item && nextUnitCost != null
                      ? item.upcomingImpactLines.reduce(
                          (sum, impactLine) =>
                            sum + impactLine.requiredQuantity * (nextUnitCost - impactLine.snapshotUnitCost),
                          0,
                        )
                      : null;

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
                        <Button type="button" variant="danger" onClick={() => removeLine(line.id)}>
                          Quitar
                        </Button>
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
                          <MetricTile
                            label="Vigente"
                            value={selectedOption?.currentPrice ? formatCurrency(selectedOption.currentPrice.pricePerPurchaseUnit) : "—"}
                          />
                          <div>
                            <Label htmlFor={`price-update-new-${line.id}`}>Nuevo precio</Label>
                            <Input
                              id={`price-update-new-${line.id}`}
                              value={line.newPrice}
                              onChange={(event) => updateLine(line.id, { newPrice: event.target.value })}
                              type="number"
                              min="0"
                              step="0.0001"
                              className="mt-2 bg-surface"
                            />
                            {!hasValidPrice ? (
                              <p className="mt-2 text-sm text-warning">
                                Podrás capturar el nuevo precio en la factura actual.
                              </p>
                            ) : null}
                          </div>
                        </div>
                      </div>

                      <div className="mt-4 grid gap-3 md:grid-cols-3">
                        <MetricTile
                          label="Costo unitario"
                          value={
                            selectedOption?.derivedUnitCost != null
                              ? `${formatCurrency(selectedOption.derivedUnitCost)} → ${nextUnitCost != null ? formatCurrency(nextUnitCost) : "Pendiente"}`
                              : nextUnitCost != null
                                ? formatCurrency(nextUnitCost)
                                : "Pendiente"
                          }
                        />
                        <MetricTile
                          label="Uso próximo"
                          value={item ? formatUpcomingUsage(item) : "Sin impacto en eventos próximos"}
                        />
                        <MetricTile
                          label="Impacto estimado"
                          value={
                            estimatedImpact == null
                              ? "Pendiente de calcular"
                              : estimatedImpact === 0
                                ? "Sin variación estimada"
                                : `${estimatedImpact >= 0 ? "+" : ""}${formatCurrency(estimatedImpact)}`
                          }
                        />
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
                        {line.itemId && itemCostingCount !== 1 ? (
                          <p className="text-sm text-warning">
                            Cada insumo debe dejar exactamente una presentación marcada como fuente de costeo.
                          </p>
                        ) : null}
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
              <Button type="submit" isLoading={isPending} disabled={!canApplyInvoice} className="w-full">
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

      <Modal open={manualModalOpen} onClose={() => setManualModalOpen(false)} title="Agregar insumo a la factura">
        <div className="space-y-4">
          <p className="text-sm text-muted">
            Selecciona un insumo existente. Después puedes usar una presentación configurada o crear una nueva para este
            proveedor.
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
              setManualDraft((current) => ({
                ...current,
                itemId: value,
                purchaseOptionId: "",
                purchaseUnitId: "",
                quantityPerPurchaseUnit: "",
              }))
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
                purchaseUnitId: "",
                quantityPerPurchaseUnit: "",
              }))
            }
            className="text-sm text-primary underline underline-offset-2"
          >
            {manualDraft.scope === "available"
              ? "Buscar en todo el catálogo"
              : `Volver a insumos disponibles con ${selectedSupplierName}`}
          </button>

          {manualItem ? (
            <div className="rounded-[var(--radius-base)] border border-border bg-surface-2 p-3">
              <p className="text-sm font-semibold text-foreground">Proveedor</p>
              <p className="mt-1 text-sm text-muted">{selectedSupplierName}</p>
            </div>
          ) : null}

          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant={manualDraft.mode === "existing_purchase_option" ? "primary" : "secondary"}
              onClick={() => setManualDraft((current) => ({ ...current, mode: "existing_purchase_option" }))}
              disabled={!manualItem}
            >
              Usar presentación existente
            </Button>
            <Button
              type="button"
              variant={manualDraft.mode === "new_purchase_option" ? "primary" : "secondary"}
              onClick={() => setManualDraft((current) => ({ ...current, mode: "new_purchase_option" }))}
              disabled={!manualItem}
            >
              Crear nueva presentación
            </Button>
          </div>

          {manualItem && manualDraft.mode === "existing_purchase_option" && manualAvailableOptions.length === 0 ? (
            <StatePanel
              kind="warning"
              title={`Este insumo no tiene una presentación disponible con ${selectedSupplierName}.`}
              message="Puedes crearla usando la información de la factura."
            >
              <div className="pt-2">
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => setManualDraft((current) => ({ ...current, mode: "new_purchase_option" }))}
                >
                  Crear presentación
                </Button>
              </div>
            </StatePanel>
          ) : null}

          {manualItem && manualDraft.mode === "existing_purchase_option" && manualAvailableOptions.length > 0 ? (
            <>
              <SearchableSelect
                id="manual-price-update-option"
                name="ignored-manual-option"
                label="Presentación"
                placeholder="Selecciona presentación"
                options={manualAvailableOptions.map((option) => ({
                  value: option.id,
                  label: `${resolveLineOptionLabel(option, manualItem.defaultUnitCode)}${
                    option.currentPrice ? ` · ${formatCurrency(option.currentPrice.pricePerPurchaseUnit)}` : ""
                  }`,
                }))}
                defaultValue={manualDraft.purchaseOptionId}
                onValueChange={(value) => setManualDraft((current) => ({ ...current, purchaseOptionId: value }))}
              />

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
                  value={manualSelectedOption?.derivedUnitCost != null ? formatCurrency(manualSelectedOption.derivedUnitCost) : "—"}
                />
              </div>
            </>
          ) : null}

          {manualItem && manualDraft.mode === "new_purchase_option" ? (
            <>
              <div>
                <p className="text-sm font-semibold text-foreground">Nueva presentación para {manualItem.name}</p>
                <p className="mt-1 text-sm text-muted">
                  Captura cómo viene el producto en la factura y cuánto contiene.
                </p>
              </div>

              <div className="grid gap-3 md:grid-cols-2">
                <SearchableSelect
                  id="manual-new-purchase-unit"
                  name="ignored-manual-new-purchase-unit"
                  label="Tipo de presentación"
                  placeholder="Selecciona tipo"
                  options={purchaseUnitOptions}
                  defaultValue={manualDraft.purchaseUnitId}
                  onValueChange={(value) => setManualDraft((current) => ({ ...current, purchaseUnitId: value }))}
                />
                <div className="space-y-1">
                  <Label htmlFor="manual-new-quantity">Contenido de la presentación</Label>
                  <Input
                    id="manual-new-quantity"
                    value={manualDraft.quantityPerPurchaseUnit}
                    onChange={(event) =>
                      setManualDraft((current) => ({ ...current, quantityPerPurchaseUnit: event.target.value }))
                    }
                    type="number"
                    min="0.0001"
                    step="0.0001"
                    placeholder="12"
                  />
                </div>
              </div>

              <div className="grid gap-3 md:grid-cols-2">
                <MetricTile
                  label="Unidad del insumo"
                  value={manualItem.defaultUnitName ?? manualItem.defaultUnitCode ?? "—"}
                />
                <MetricTile
                  label="Vista previa de equivalencia"
                  value={
                    manualDraft.purchaseUnitId && manualQuantity != null && manualQuantity > 0
                      ? `1 ${unitById.get(manualDraft.purchaseUnitId)?.code ?? unitById.get(manualDraft.purchaseUnitId)?.name ?? "ud"} = ${manualQuantity.toLocaleString("es-MX", {
                          minimumFractionDigits: 0,
                          maximumFractionDigits: 4,
                        })} ${manualItem.defaultUnitCode ?? "ud"}`
                      : "Pendiente"
                  }
                />
              </div>

              {manualDuplicate ? (
                <div className="rounded-[var(--radius-base)] border border-warning/50 bg-warning/10 p-3 text-sm text-foreground">
                  Ya existe una presentación con esta equivalencia.
                </div>
              ) : null}
            </>
          ) : null}

          <div className="grid gap-3 md:grid-cols-2">
            <div className="space-y-1">
              <Label htmlFor="manual-price-update-new-price">Precio en la factura</Label>
              <Input
                id="manual-price-update-new-price"
                value={manualDraft.newPrice}
                onChange={(event) => setManualDraft((current) => ({ ...current, newPrice: event.target.value }))}
                type="number"
                min={manualDraft.mode === "new_purchase_option" ? "0.0001" : "0"}
                step="0.0001"
                placeholder="0.00"
              />
              {manualDraft.mode === "new_purchase_option" && (manualPrice == null || manualPrice <= 0) ? (
                <p className="text-sm text-warning">Captura el precio de esta presentación tal como aparece en la factura.</p>
              ) : null}
            </div>
            <MetricTile
              label={manualDraft.mode === "new_purchase_option" ? "Costo por pieza" : "Nuevo costo unitario"}
              value={manualNewUnitCost != null ? formatCurrency(manualNewUnitCost) : "—"}
            />
          </div>

          <label className="inline-flex items-start gap-2 text-sm text-foreground">
            <input
              type="checkbox"
              checked={manualDraft.usedForCosting}
              onChange={(event) =>
                setManualDraft((current) => ({ ...current, usedForCosting: event.target.checked }))
              }
              className="mt-0.5 h-4 w-4 rounded border-border"
            />
            <span>
              <span className="font-medium">
                {manualDraft.mode === "new_purchase_option"
                  ? "Usar esta presentación para próximos costeos"
                  : "Usar para próximos costeos"}
              </span>
              <span className="mt-1 block text-sm text-muted">
                El costo por unidad calculado será la referencia vigente de este insumo.
              </span>
            </span>
          </label>

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
              disabled={
                !manualItem ||
                (manualDraft.mode === "existing_purchase_option"
                  ? !manualDraft.purchaseOptionId
                  : !manualDraft.purchaseUnitId || manualQuantity == null || manualQuantity <= 0 || manualPrice == null || manualPrice <= 0 || Boolean(manualDuplicate))
              }
            >
              <ListPlus className="h-4 w-4" aria-hidden="true" />
              {manualDraft.mode === "new_purchase_option"
                ? "Agregar nueva presentación a la factura"
                : "Agregar a la factura"}
            </Button>
          </div>
        </div>
      </Modal>

      <Modal open={pendingSupplierId != null} onClose={() => setPendingSupplierId(null)} title="Cambiar proveedor">
        <div className="space-y-4">
          <p className="text-sm text-muted">
            Las líneas actuales pertenecen a {selectedSupplierName}. Si cambias el proveedor se eliminarán de la factura en captura.
          </p>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={() => setPendingSupplierId(null)}>
              Cancelar
            </Button>
            <Button type="button" onClick={applyConfirmedSupplierChange}>
              Cambiar proveedor y limpiar factura
            </Button>
          </div>
        </div>
      </Modal>

      <div className="hidden">
        <Link href={`/${tenantSlug}/kitchen/inventory/presentaciones-precios`}>presentaciones</Link>
      </div>
    </div>
  );
}
