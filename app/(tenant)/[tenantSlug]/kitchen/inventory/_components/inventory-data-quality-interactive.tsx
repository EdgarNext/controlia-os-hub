"use client";

import Link from "next/link";
import { useActionState, useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { formatKitchenUnit, formatQuantityWithUnit } from "@/lib/kitchen/formatters";
import { initialKitchenInventoryActionState } from "@/lib/kitchen/inventory/action-state";
import { normalizeKitchenInventoryItemUnitAction, saveKitchenInventoryQuickFixAction } from "@/lib/kitchen/inventory/actions";
import type { KitchenInventoryDataQualityQueue, KitchenInventoryDataQualityRow } from "@/lib/kitchen/inventory/types";

type PurchaseOptionLite = {
  id: string;
  label: string;
  isDefault: boolean;
  isActive: boolean;
  supplierId: string | null;
  supplierName: string | null;
  purchaseUnitId: string;
  purchaseUnitCode: string | null;
  quantityPerPurchaseUnit: number;
  minPurchaseQuantity: number;
  purchaseMultiple: number;
  notes: string | null;
};

type CurrentPriceLite = {
  id: string;
  supplierId: string;
  supplierName: string | null;
  purchaseUnitId: string;
  purchaseUnitLabel: string;
  pricePerPurchaseUnit: number;
};

type InventoryDataQualityInteractiveProps = {
  tenantSlug: string;
  queue: KitchenInventoryDataQualityQueue;
  rows: KitchenInventoryDataQualityRow[];
  categories: Array<{ id: string; name: string }>;
  suppliers: Array<{ id: string; name: string }>;
  purchaseUnits: Array<{ id: string; code: string; name: string }>;
  purchaseOptionsByItem: Record<string, PurchaseOptionLite[]>;
  currentPriceByItem: Record<string, CurrentPriceLite[]>;
};

export function InventoryDataQualityInteractive({
  tenantSlug,
  queue,
  rows,
  categories,
  suppliers,
  purchaseUnits,
  purchaseOptionsByItem,
  currentPriceByItem,
}: InventoryDataQualityInteractiveProps) {
  const [openItemId, setOpenItemId] = useState<string | null>(null);

  useEffect(() => {
    if (!openItemId) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [openItemId]);

  const openRow = rows.find((row) => row.item.id === openItemId) ?? null;

  const formatCurrency = (value: number) =>
    `$${value.toLocaleString("es-MX", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  return (
    <>
      <section className="hidden rounded-[var(--radius-base)] border border-border bg-surface p-4 md:block">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1480px] text-left text-sm">
            <thead className="text-xs uppercase tracking-[0.08em] text-muted">
              <tr>
                <th className="px-3 py-2">Prioridad</th>
                <th className="px-3 py-2">Insumo</th>
                <th className="px-3 py-2">Categoría</th>
                <th className="px-3 py-2">Unidad base</th>
                <th className="px-3 py-2">Proveedor default</th>
                <th className="px-3 py-2 text-right whitespace-nowrap">Costo unitario</th>
                <th className="px-3 py-2">Opción compra default</th>
                <th className="px-3 py-2">Precio proveedor current</th>
                <th className="px-3 py-2">Balance</th>
                <th className="px-3 py-2">Estado</th>
                <th className="sticky right-0 z-20 border-l border-border bg-surface px-3 py-2 shadow-[-8px_0_12px_-12px_rgba(0,0,0,0.35)">Acción</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => {
                const poStatus = row.hasDefaultPurchaseOption ? "Configurada" : "Pendiente";
                const priceStatus = row.hasCurrentSupplierPrice ? "Vigente" : "Pendiente";
                const hasCritical = row.stateTags.includes("costo_0") || row.stateTags.includes("test_sandbox");
                return (
                  <tr key={row.item.id} className="border-t border-border">
                    <td className="px-3 py-2">
                      <span
                        className={`inline-flex min-w-8 items-center justify-center rounded-full px-2 py-1 text-xs font-semibold ${
                          row.cleanupPriorityScore >= 7
                            ? "bg-danger/15 text-danger"
                            : row.cleanupPriorityScore >= 4
                              ? "bg-warning/20 text-warning"
                              : "bg-surface-2 text-foreground"
                        }`}
                      >
                        {row.cleanupPriorityScore}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-foreground">{row.item.name}</td>
                    <td className="px-3 py-2 text-foreground">{row.item.kitchen_inventory_categories?.name ?? "Sin categoría"}</td>
                    <td className="px-3 py-2 text-foreground">{formatKitchenUnit(row.item.kitchen_inventory_units?.code ?? null)}</td>
                    <td className="px-3 py-2 text-foreground">{row.item.kitchen_inventory_suppliers?.name ?? "Sin proveedor"}</td>
                    <td className="px-3 py-2 text-right text-foreground">
                      {row.currentUnitCost <= 0 && !row.isAllowedZeroCost ? "Sin costo" : formatCurrency(row.currentUnitCost)}
                    </td>
                    <td className="px-3 py-2">
                      <Badge variant={row.hasDefaultPurchaseOption ? "success" : "primary"}>{poStatus}</Badge>
                    </td>
                    <td className="px-3 py-2">
                      <Badge variant={row.hasCurrentSupplierPrice ? "success" : "primary"}>{priceStatus}</Badge>
                    </td>
                    <td className="px-3 py-2 text-foreground">
                      {row.hasBalance ? formatQuantityWithUnit(row.totalBalance, row.item.kitchen_inventory_units?.code ?? null, 4) : "Sin balance"}
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex max-w-[360px] flex-wrap gap-1">
                        {row.stateTags.map((tag) => (
                          <Badge
                            key={`${row.item.id}:${tag}`}
                            variant={
                              tag === "completo"
                                ? "success"
                                : tag === "costo_0"
                                  ? "danger"
                                    : tag === "test_sandbox"
                                      ? "warning"
                                      : tag === "unidad_base_inconsistente" || tag === "costo_unitario_incongruente"
                                        ? "danger"
                                    : "primary"
                            }
                          >
                            {tag === "sin_categoria"
                              ? "Sin categoría"
                              : tag === "sin_proveedor"
                                ? "Sin proveedor"
                                : tag === "sin_opcion_compra"
                                  ? "Sin opción compra"
                                  : tag === "sin_precio_proveedor"
                                    ? "Sin precio proveedor"
                                    : tag === "costo_0"
                                      ? "Costo 0"
                                      : tag === "unidad_dudosa"
                                        ? "Unidad dudosa"
                                        : tag === "test_sandbox"
                                          ? "TEST/sandbox"
                                          : tag === "unidad_base_inconsistente"
                                            ? "Unidad base inconsistente"
                                            : tag === "costo_unitario_incongruente"
                                              ? "Costo incongruente"
                                          : "Completo"}
                          </Badge>
                        ))}
                      </div>
                      {hasCritical ? <p className="mt-1 text-xs text-danger">Atención prioritaria en operación.</p> : null}
                    </td>
                    <td className="sticky right-0 z-10 border-l border-border bg-surface px-3 py-2 shadow-[-8px_0_12px_-12px_rgba(0,0,0,0.35)">
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() => setOpenItemId(row.item.id)}
                          className="inline-flex rounded-[var(--radius-base)] border border-border bg-surface-2 px-2 py-1 text-xs text-foreground hover:bg-surface"
                        >
                          Corregir
                        </button>
                        <Link
                          href={`/${tenantSlug}/kitchen/inventory/items?q=${encodeURIComponent(row.item.name)}`}
                          className="inline-flex rounded-[var(--radius-base)] border border-border bg-surface-2 px-2 py-1 text-xs text-foreground hover:bg-surface"
                        >
                          Ver en insumos
                        </Link>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <p className="mt-3 text-xs text-muted">Cola activa: {queue}. Esta vista y su corrección rápida no modifican existencias ni movimientos.</p>
      </section>

      <section className="space-y-3 md:hidden">
        {rows.map((row) => (
          <article key={row.item.id} className="rounded-[var(--radius-base)] border border-border bg-surface p-3">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-foreground">{row.item.name}</p>
                <p className="text-xs text-muted">{row.item.kitchen_inventory_categories?.name ?? "Sin categoría"} · {formatKitchenUnit(row.item.kitchen_inventory_units?.code ?? null)}</p>
              </div>
              <button
                type="button"
                onClick={() => setOpenItemId(row.item.id)}
                className="inline-flex shrink-0 rounded-[var(--radius-base)] border border-border bg-surface-2 px-2 py-1 text-xs text-foreground"
              >
                Corregir
              </button>
            </div>
            <div className="mt-2 flex flex-wrap gap-1">
              {row.stateTags.map((tag) => (
                <Badge key={`${row.item.id}:${tag}`} variant={tag === "costo_0" || tag === "unidad_base_inconsistente" || tag === "costo_unitario_incongruente" ? "danger" : tag === "test_sandbox" ? "warning" : tag === "completo" ? "success" : "primary"}>
                  {tag}
                </Badge>
              ))}
            </div>
          </article>
        ))}
      </section>

      {typeof document !== "undefined" && openRow
        ? createPortal(
            <QuickFixOverlay
              tenantSlug={tenantSlug}
              row={openRow}
              categories={categories}
              suppliers={suppliers}
              purchaseUnits={purchaseUnits}
              purchaseOptions={purchaseOptionsByItem[openRow.item.id] ?? []}
              currentPrices={currentPriceByItem[openRow.item.id] ?? []}
              onClose={() => setOpenItemId(null)}
            />,
            document.body,
          )
        : null}
    </>
  );
}

function QuickFixOverlay({
  tenantSlug,
  row,
  categories,
  suppliers,
  purchaseUnits,
  purchaseOptions,
  currentPrices,
  onClose,
}: {
  tenantSlug: string;
  row: KitchenInventoryDataQualityRow;
  categories: Array<{ id: string; name: string }>;
  suppliers: Array<{ id: string; name: string }>;
  purchaseUnits: Array<{ id: string; code: string; name: string }>;
  purchaseOptions: PurchaseOptionLite[];
  currentPrices: CurrentPriceLite[];
  onClose: () => void;
}) {
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/45 p-2 sm:p-4" onClick={onClose}>
      <div className="flex h-[92vh] w-[min(96vw,1100px)] flex-col overflow-hidden rounded-[var(--radius-base)] border border-border bg-surface shadow-[var(--shadow-soft)]" onClick={(event) => event.stopPropagation()}>
        <div className="flex items-start justify-between gap-3 border-b border-border bg-surface p-3 sm:p-4">
          <div>
            <p className="text-xs text-muted">Corrección rápida</p>
            <h3 className="text-base font-semibold text-foreground">{row.item.name}</h3>
            <p className="text-xs text-muted">No modifica existencias ni movimientos.</p>
          </div>
          <button type="button" onClick={onClose} className="rounded-[var(--radius-base)] border border-border bg-surface-2 px-2 py-1 text-xs text-foreground">Cerrar</button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-3 sm:p-4">
          <QuickFixForm
            tenantSlug={tenantSlug}
            row={row}
            categories={categories}
            suppliers={suppliers}
            purchaseUnits={purchaseUnits}
            purchaseOptions={purchaseOptions}
            currentPrices={currentPrices}
          />
        </div>
      </div>
    </div>
  );
}

function QuickFixForm({
  tenantSlug,
  row,
  categories,
  suppliers,
  purchaseUnits,
  purchaseOptions,
  currentPrices,
}: {
  tenantSlug: string;
  row: KitchenInventoryDataQualityRow;
  categories: Array<{ id: string; name: string }>;
  suppliers: Array<{ id: string; name: string }>;
  purchaseUnits: Array<{ id: string; code: string; name: string }>;
  purchaseOptions: PurchaseOptionLite[];
  currentPrices: CurrentPriceLite[];
}) {
  const [state, formAction, isPending] = useActionState(saveKitchenInventoryQuickFixAction, initialKitchenInventoryActionState);
  const [normalizeState, normalizeAction, normalizePending] = useActionState(
    normalizeKitchenInventoryItemUnitAction,
    initialKitchenInventoryActionState,
  );
  const [formError, setFormError] = useState<string | null>(null);
  const [normalizeError, setNormalizeError] = useState<string | null>(null);

  const activePurchaseOptions = useMemo(() => purchaseOptions.filter((option) => option.isActive), [purchaseOptions]);
  const defaultOption = activePurchaseOptions.find((option) => option.isDefault)?.id ?? "";
  const [showCreatePurchaseOption, setShowCreatePurchaseOption] = useState(activePurchaseOptions.length === 0 || !row.hasDefaultPurchaseOption);
  const [selectedSupplierId, setSelectedSupplierId] = useState(row.item.default_supplier_id ?? "");
  const [selectedDefaultOptionId, setSelectedDefaultOptionId] = useState(defaultOption);
  const [selectedCreateUnitId, setSelectedCreateUnitId] = useState("");
  const [quantityInput, setQuantityInput] = useState("1");
  const [minInput, setMinInput] = useState("1");
  const [multipleInput, setMultipleInput] = useState("1");
  const [priceInput, setPriceInput] = useState(currentPrices[0] ? String(currentPrices[0].pricePerPurchaseUnit) : "");
  const [confirmReplaceCurrent, setConfirmReplaceCurrent] = useState(false);
  const [confirmAllowIncomplete, setConfirmAllowIncomplete] = useState(false);

  const selectedDefaultOption = activePurchaseOptions.find((option) => option.id === selectedDefaultOptionId) ?? null;
  const parsedQuantity = Number(quantityInput);
  const parsedMin = Number(minInput);
  const parsedMultiple = Number(multipleInput);
  const createValuesValid = Number.isFinite(parsedQuantity) && parsedQuantity > 0 && Number.isFinite(parsedMin) && parsedMin > 0 && Number.isFinite(parsedMultiple) && parsedMultiple > 0;

  const compatibleInactiveOption = useMemo(() => {
    if (!showCreatePurchaseOption || !selectedSupplierId || !selectedCreateUnitId || !createValuesValid) return null;
    return (
      purchaseOptions.find(
        (option) =>
          !option.isActive &&
          option.supplierId === selectedSupplierId &&
          option.purchaseUnitId === selectedCreateUnitId &&
          Number(option.quantityPerPurchaseUnit) === parsedQuantity &&
          Number(option.minPurchaseQuantity) === parsedMin &&
          Number(option.purchaseMultiple) === parsedMultiple,
      ) ?? null
    );
  }, [showCreatePurchaseOption, selectedSupplierId, selectedCreateUnitId, createValuesValid, purchaseOptions, parsedQuantity, parsedMin, parsedMultiple]);

  const selectedPriceScope = showCreatePurchaseOption
    ? { supplierId: selectedSupplierId, purchaseUnitId: selectedCreateUnitId }
    : selectedDefaultOption
      ? { supplierId: selectedDefaultOption.supplierId ?? "", purchaseUnitId: selectedDefaultOption.purchaseUnitId }
      : { supplierId: "", purchaseUnitId: "" };

  const existingCurrentToReplace =
    selectedPriceScope.supplierId && selectedPriceScope.purchaseUnitId
      ? currentPrices.find((price) => price.supplierId === selectedPriceScope.supplierId && price.purchaseUnitId === selectedPriceScope.purchaseUnitId) ?? null
      : null;

  const parsedPrice = priceInput.trim() ? Number(priceInput) : null;
  const isPriceInputValid = parsedPrice == null || (Number.isFinite(parsedPrice) && parsedPrice >= 0);
  const [nextDefaultUnitId, setNextDefaultUnitId] = useState(row.recommendedUnitId ?? row.item.default_unit_id ?? "");
  const [nextCurrentUnitCost, setNextCurrentUnitCost] = useState(
    row.derivedUnitCost != null ? String(Number(row.derivedUnitCost.toFixed(4))) : String(row.currentUnitCost),
  );
  const [confirmHistoricalImpact, setConfirmHistoricalImpact] = useState(false);
  const [confirmHistoricalPhrase, setConfirmHistoricalPhrase] = useState("");
  const hasHistoricalImpact = row.balancesCount > 0 || row.movementsCount > 0 || row.recipeLinesCount > 0;

  const wouldRemainIncomplete = useMemo(() => {
    const hasCategory = Boolean(row.item.category_id);
    const hasSupplier = Boolean(selectedSupplierId);
    const hasCost = row.isAllowedZeroCost ? true : row.currentUnitCost > 0;
    const hasPO = Boolean(selectedDefaultOptionId) || showCreatePurchaseOption || row.hasDefaultPurchaseOption;
    const hasPrice = Boolean(priceInput.trim()) || row.hasCurrentSupplierPrice;
    return !hasCategory || !hasSupplier || !hasCost || !hasPO || !hasPrice;
  }, [row, selectedSupplierId, selectedDefaultOptionId, showCreatePurchaseOption, priceInput]);

  function validateBeforeSubmit(event: React.FormEvent<HTMLFormElement>) {
    setFormError(null);
    if (showCreatePurchaseOption) {
      if (!selectedSupplierId) {
        event.preventDefault();
        setFormError("Para crear presentación de compra, selecciona proveedor default.");
        return;
      }
      if (!selectedCreateUnitId) {
        event.preventDefault();
        setFormError("Selecciona unidad de compra para crear presentación.");
        return;
      }
      if (!createValuesValid) {
        event.preventDefault();
        setFormError("Cantidad, mínimo y múltiplo deben ser mayores a 0.");
        return;
      }
    }
    if (!isPriceInputValid) {
      event.preventDefault();
      setFormError("El precio proveedor debe ser mayor o igual a 0.");
      return;
    }
    if (priceInput.trim() && existingCurrentToReplace && !confirmReplaceCurrent) {
      event.preventDefault();
      setFormError("Confirma el reemplazo del precio vigente para continuar.");
      return;
    }
    if (wouldRemainIncomplete && !confirmAllowIncomplete) {
      event.preventDefault();
      setFormError("Confirma guardar aunque el insumo quede incompleto.");
    }
  }

  function validateNormalize(event: React.FormEvent<HTMLFormElement>) {
    setNormalizeError(null);
    if (!nextDefaultUnitId) {
      event.preventDefault();
      setNormalizeError("Selecciona la nueva unidad base.");
      return;
    }
    if (!nextCurrentUnitCost.trim() || !Number.isFinite(Number(nextCurrentUnitCost)) || Number(nextCurrentUnitCost) < 0) {
      event.preventDefault();
      setNormalizeError("Captura un costo unitario válido (>= 0).");
      return;
    }
    if (hasHistoricalImpact) {
      if (!confirmHistoricalImpact) {
        event.preventDefault();
        setNormalizeError("Confirma el impacto histórico para continuar.");
        return;
      }
      if (confirmHistoricalPhrase !== "NORMALIZAR UNIDAD") {
        event.preventDefault();
        setNormalizeError("Escribe la frase exacta NORMALIZAR UNIDAD.");
      }
    }
  }

  return (
    <div className="space-y-4">
      <form action={formAction} onSubmit={validateBeforeSubmit} className="space-y-4">
        <input type="hidden" name="tenantSlug" value={tenantSlug} />
        <input type="hidden" name="itemId" value={row.item.id} />

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="space-y-3 rounded-[var(--radius-base)] border border-border bg-surface-2 p-3">
          <p className="text-sm font-semibold text-foreground">Datos básicos</p>
          <SearchableSelect id="quick-fix-category" name="categoryId" label="Categoría" placeholder="Selecciona categoría" clearable defaultValue={row.item.category_id ?? ""} options={categories.map((category) => ({ value: category.id, label: category.name }))} />
          <SearchableSelect id="quick-fix-supplier" name="defaultSupplierId" label="Proveedor default" placeholder="Selecciona proveedor" clearable defaultValue={row.item.default_supplier_id ?? ""} onValueChange={setSelectedSupplierId} options={suppliers.map((supplier) => ({ value: supplier.id, label: supplier.name }))} />
          <div className="space-y-1">
            <Label htmlFor="quick-fix-unit">Unidad base (solo lectura)</Label>
            <Input id="quick-fix-unit" value={formatKitchenUnit(row.item.kitchen_inventory_units?.code ?? null)} readOnly disabled />
          </div>
        </section>

        <section className="space-y-3 rounded-[var(--radius-base)] border border-border bg-surface-2 p-3">
          <p className="text-sm font-semibold text-foreground">Costo y precio vigente</p>
          <div className="space-y-1">
            <Label htmlFor="quick-fix-item-cost">Costo unitario actual</Label>
            <Input id="quick-fix-item-cost" name="currentUnitCost" type="number" min={0} step="0.0001" defaultValue={String(row.currentUnitCost)} required />
          </div>
          <div className="space-y-1">
            <Label htmlFor="quick-fix-price">Precio proveedor current (opcional)</Label>
            <Input id="quick-fix-price" name="pricePerPurchaseUnit" type="number" min={0} step="0.0001" defaultValue={currentPrices[0] ? String(currentPrices[0].pricePerPurchaseUnit) : ""} onChange={(event) => setPriceInput(event.target.value)} />
          </div>
          {priceInput.trim() && existingCurrentToReplace ? (
            <div className="rounded-[var(--radius-base)] border border-warning/40 bg-warning/10 p-2 text-xs text-foreground">
              <p className="font-medium">Se reemplazará un precio vigente.</p>
              <p>Actual: {existingCurrentToReplace.pricePerPurchaseUnit} / {existingCurrentToReplace.purchaseUnitLabel} · {existingCurrentToReplace.supplierName ?? "N/A"}</p>
              <p>Nuevo: {Number(priceInput || 0)} / {existingCurrentToReplace.purchaseUnitLabel}</p>
              <label className="mt-1 inline-flex items-center gap-2">
                <input type="checkbox" name="confirmReplaceCurrentPrice" checked={confirmReplaceCurrent} onChange={(event) => setConfirmReplaceCurrent(event.target.checked)} className="h-4 w-4 rounded border-border" />
                Confirmo reemplazar el precio vigente conservando historial
              </label>
            </div>
          ) : null}
        </section>
      </div>

      <section className="space-y-3 rounded-[var(--radius-base)] border border-border bg-surface-2 p-3">
        <p className="text-sm font-semibold text-foreground">Presentación de compra</p>
        <SearchableSelect id="quick-fix-default-po" name="defaultPurchaseOptionId" label="Opción default existente" placeholder="Selecciona opción" clearable defaultValue={defaultOption} onValueChange={setSelectedDefaultOptionId} options={activePurchaseOptions.map((option) => ({ value: option.id, label: option.label }))} />
        <label className="inline-flex items-center gap-2 text-xs text-muted">
          <input type="checkbox" name="createPurchaseOption" checked={showCreatePurchaseOption} onChange={(event) => setShowCreatePurchaseOption(event.target.checked)} className="h-4 w-4 rounded border-border" />
          Crear nueva presentación de compra
        </label>
        {showCreatePurchaseOption ? (
          <div className="grid gap-2 md:grid-cols-2">
            <SearchableSelect id="quick-fix-create-purchase-unit" name="createPurchaseUnitId" label="Unidad de compra" placeholder="Selecciona unidad" required onValueChange={setSelectedCreateUnitId} options={purchaseUnits.map((unit) => ({ value: unit.id, label: `${unit.code.toLowerCase()} · ${unit.name}` }))} />
            <div className="space-y-1">
              <Label htmlFor="quick-fix-create-quantity">Cantidad por unidad</Label>
              <Input id="quick-fix-create-quantity" name="createQuantityPerPurchaseUnit" type="number" min={0.0001} step="0.0001" defaultValue="1" onChange={(event) => setQuantityInput(event.target.value)} required />
            </div>
            <div className="space-y-1">
              <Label htmlFor="quick-fix-create-min">Mínimo compra</Label>
              <Input id="quick-fix-create-min" name="createMinPurchaseQuantity" type="number" min={0.0001} step="0.0001" defaultValue="1" onChange={(event) => setMinInput(event.target.value)} />
            </div>
            <div className="space-y-1">
              <Label htmlFor="quick-fix-create-multiple">Múltiplo</Label>
              <Input id="quick-fix-create-multiple" name="createPurchaseMultiple" type="number" min={0.0001} step="0.0001" defaultValue="1" onChange={(event) => setMultipleInput(event.target.value)} />
            </div>
            <div className="space-y-1 md:col-span-2">
              <Label htmlFor="quick-fix-create-notes">Notas</Label>
              <Input id="quick-fix-create-notes" name="createPurchaseOptionNotes" placeholder="Opcional" />
            </div>
            <label className="inline-flex items-center gap-2 text-xs text-muted md:col-span-2">
              <input type="checkbox" name="createPurchaseOptionIsDefault" className="h-4 w-4 rounded border-border" defaultChecked />
              Marcar como default
            </label>
            {compatibleInactiveOption ? (
              <div className="rounded-[var(--radius-base)] border border-warning/40 bg-warning/10 p-2 text-xs text-foreground md:col-span-2">
                <p className="font-medium">Existe una presentación compatible inactiva.</p>
                <p>{compatibleInactiveOption.supplierName ?? "Sin proveedor"} · {compatibleInactiveOption.purchaseUnitCode ?? "ud"} x {compatibleInactiveOption.quantityPerPurchaseUnit} · min {compatibleInactiveOption.minPurchaseQuantity} · múltiplo {compatibleInactiveOption.purchaseMultiple}</p>
                <label className="mt-1 inline-flex items-center gap-2">
                  <input type="checkbox" name="reactivateCompatibleOption" value={compatibleInactiveOption.id} className="h-4 w-4 rounded border-border" />
                  Reactivar presentación existente
                </label>
              </div>
            ) : null}
          </div>
        ) : null}
      </section>

        {wouldRemainIncomplete ? (
          <section className="rounded-[var(--radius-base)] border border-warning/40 bg-warning/10 p-3">
            <p className="text-xs text-foreground">Esta corrección todavía dejará el insumo incompleto.</p>
            <label className="mt-1 inline-flex items-center gap-2 text-xs text-foreground">
              <input type="checkbox" name="confirmAllowIncomplete" checked={confirmAllowIncomplete} onChange={(event) => setConfirmAllowIncomplete(event.target.checked)} className="h-4 w-4 rounded border-border" />
              Guardar aunque quede incompleto
            </label>
          </section>
        ) : null}

        {row.stateTags.includes("test_sandbox") ? (
          <section className="rounded-[var(--radius-base)] border border-warning/40 bg-warning/10 p-3 text-xs text-foreground">
            Este insumo parece de prueba. La política de limpieza TEST/sandbox se definirá en una tarea posterior.
          </section>
        ) : null}

        {formError ? <p className="text-xs text-danger">{formError}</p> : null}
        {state.message ? <p className={`text-xs ${state.ok ? "text-success" : "text-danger"}`}>{state.message}</p> : null}

        <div className="flex justify-end">
          <Button type="submit" isLoading={isPending}>Guardar corrección</Button>
        </div>
      </form>

      <section className="space-y-3 rounded-[var(--radius-base)] border border-danger/30 bg-danger/5 p-3">
        <p className="text-sm font-semibold text-foreground">Unidad base y costo derivado</p>
        <p className="text-xs text-muted">Esta corrección ajusta datos maestros del insumo. No modifica existencias ni movimientos automáticamente.</p>
        <div className="grid gap-2 text-xs md:grid-cols-2">
          <p>Unidad actual: <span className="text-foreground">{formatKitchenUnit(row.item.kitchen_inventory_units?.code ?? null)}</span></p>
          <p>Unidad recomendada: <span className="text-foreground">{formatKitchenUnit(row.recommendedUnitCode)}</span></p>
          <p>Presentación default: <span className="text-foreground">{row.defaultPurchaseOptionLite ? `1 ${row.defaultPurchaseOptionLite.purchase_unit_code ?? "ud"} = ${row.defaultPurchaseOptionLite.quantity_per_purchase_unit} ${row.defaultPurchaseOptionLite.inventory_unit_code ?? "ud"}` : "No disponible"}</span></p>
          <p>Precio proveedor current: <span className="text-foreground">{row.currentSupplierPriceLite ? `$${row.currentSupplierPriceLite.price_per_purchase_unit.toLocaleString("es-MX", { minimumFractionDigits: 2, maximumFractionDigits: 4 })}` : "No disponible"}</span></p>
          <p>Costo unitario actual: <span className="text-foreground">${row.currentUnitCost.toLocaleString("es-MX", { minimumFractionDigits: 2, maximumFractionDigits: 4 })}</span></p>
          <p>Costo derivado: <span className="text-foreground">{row.derivedUnitCost != null ? `$${row.derivedUnitCost.toLocaleString("es-MX", { minimumFractionDigits: 2, maximumFractionDigits: 4 })}` : "No calculable"}</span></p>
          <p>Balances: <span className="text-foreground">{row.balancesCount}</span></p>
          <p>Movimientos: <span className="text-foreground">{row.movementsCount}</span></p>
          <p>Recipe lines: <span className="text-foreground">{row.recipeLinesCount}</span></p>
        </div>

        <form action={normalizeAction} onSubmit={validateNormalize} className="grid gap-3 border-t border-border pt-3 md:grid-cols-2">
          <input type="hidden" name="tenantSlug" value={tenantSlug} />
          <input type="hidden" name="itemId" value={row.item.id} />
          <SearchableSelect
            id="normalize-next-unit"
            name="nextDefaultUnitId"
            label="Nueva unidad base"
            defaultValue={nextDefaultUnitId}
            onValueChange={setNextDefaultUnitId}
            options={purchaseUnits.map((unit) => ({ value: unit.id, label: `${unit.code.toLowerCase()} · ${unit.name}` }))}
          />
          <div className="space-y-1">
            <Label htmlFor="normalize-next-cost">Nuevo costo unitario</Label>
            <Input id="normalize-next-cost" name="nextCurrentUnitCost" type="number" min={0} step="0.0001" value={nextCurrentUnitCost} onChange={(event) => setNextCurrentUnitCost(event.target.value)} />
          </div>
          <label className="inline-flex items-center gap-2 text-xs text-muted md:col-span-2">
            <input type="checkbox" name="alignDefaultPurchaseOption" className="h-4 w-4 rounded border-border" defaultChecked />
            Alinear unidad inventariada de la presentación default a la nueva unidad base
          </label>
          {hasHistoricalImpact ? (
            <>
              <label className="inline-flex items-center gap-2 text-xs text-foreground md:col-span-2">
                <input
                  type="checkbox"
                  name="confirmHistoricalImpact"
                  checked={confirmHistoricalImpact}
                  onChange={(event) => setConfirmHistoricalImpact(event.target.checked)}
                  className="h-4 w-4 rounded border-border"
                />
                Entiendo que esta corrección ajusta semántica de datos existentes en etapa de desarrollo.
              </label>
              <div className="space-y-1 md:col-span-2">
                <Label htmlFor="normalize-phrase">Escribe la frase exacta</Label>
                <Input
                  id="normalize-phrase"
                  name="confirmHistoricalPhrase"
                  value={confirmHistoricalPhrase}
                  onChange={(event) => setConfirmHistoricalPhrase(event.target.value)}
                  placeholder="NORMALIZAR UNIDAD"
                />
              </div>
            </>
          ) : null}
          {normalizeError ? <p className="text-xs text-danger md:col-span-2">{normalizeError}</p> : null}
          {normalizeState.message ? (
            <p className={`text-xs md:col-span-2 ${normalizeState.ok ? "text-success" : "text-danger"}`}>{normalizeState.message}</p>
          ) : null}
          <div className="md:col-span-2 flex justify-end">
            <Button type="submit" isLoading={normalizePending}>Normalizar unidad base</Button>
          </div>
        </form>
      </section>
    </div>
  );
}
