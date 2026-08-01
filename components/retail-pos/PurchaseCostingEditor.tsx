"use client";

import { AlertTriangle, Calculator, Check, ChevronDown, ChevronUp, Loader2, Plus, Trash2 } from "lucide-react";
import type { ReactNode } from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Modal } from "@/components/ui/Modal";
import { SearchableSelect } from "@/components/ui/searchable-select";
import type {
  AddPurchaseCostingLineInput,
  RetailPosPurchaseCostingDetail,
  RetailPosPurchaseCostingLine,
  RetailPosPurchaseCostingPriceMode,
  RetailPosCostingProductSearchResult,
  UpdatePurchaseCostingLineInput,
} from "@/shared/types/retail-pos";
import { CostingProductSearchDialog } from "./CostingProductSearchDialog";
import { centsToInput, formatBpsPercent, formatMoney, formatQuantity, inputToCents, parsePercentToBps, pluralizeRetailPosUnit, resolvePurchaseCostingFinalPrice, singularizeRetailPosPresentation } from "@/lib/retail-pos/purchase-costing-ui";
import { reconcilePurchaseCostingDocument, type PurchaseCostingMutationEnvelope, type PurchaseCostingMutationPatch } from "@/lib/retail-pos/purchase-costing-editor-sync";
import { appendDiagnosticEvent, isCostingDiagnosticsEnabled, type CostingDiagnosticEvent } from "@/lib/retail-pos/purchase-costing-diagnostics";
import { CostingDiagnosticPanel } from "./CostingDiagnosticPanel";

type Supplier = { id: string; name: string };
type Props = { tenantSlug: string; initialDocument: RetailPosPurchaseCostingDetail; suppliers: Supplier[] };
type LinePatch = Omit<UpdatePurchaseCostingLineInput, "expectedRevision">;
type HeaderField = "supplierId" | "invoiceReference" | "invoiceDate" | "taxRateBps" | "discountRateBps" | "defaultPublicMarkupBps" | "defaultWholesaleMarkupBps";

class ApiError extends Error { constructor(public status: number, message: string) { super(message); } }

async function requestJson<T>(url: string, init?: RequestInit, onDiagnostic?: (event: Omit<CostingDiagnosticEvent, "timestamp">) => void): Promise<T> {
  const requestBody = onDiagnostic && typeof init?.body === "string" ? JSON.parse(init.body) : undefined;
  onDiagnostic?.({ event: "request-start", requestUrl: url, requestMethod: init?.method ?? "GET", requestBody });
  const response = await fetch(url, { ...init, headers: { "content-type": "application/json", ...(init?.headers ?? {}) }, cache: "no-store" });
  const body = await response.json().catch(() => null) as { error?: string } | null;
  const returnedRevision = body && typeof body === "object" && "revision" in body && typeof body.revision === "number" ? body.revision : undefined;
  onDiagnostic?.({ event: response.ok ? "response-received" : "request-error", responseStatus: response.status, responseBody: body, revisionReturned: returnedRevision });
  if (!response.ok) throw new ApiError(response.status, body?.error ?? "No fue posible guardar los cambios.");
  return body as T;
}

function percentInput(bps: number | null) { return bps === null ? "" : formatBpsPercent(bps); }

function FieldLabel({ children }: { children: ReactNode }) { return <label className="text-xs font-medium text-muted">{children}</label>; }

function ToggleControl({ label, checked, disabled, onChange }: { label: string; checked: boolean; disabled?: boolean; onChange: (checked: boolean) => void }) {
  return <button type="button" role="switch" aria-checked={checked} aria-label={label} disabled={disabled} onClick={() => onChange(!checked)} className="inline-flex items-center gap-2 rounded border border-border bg-surface px-2.5 py-1.5 text-xs text-muted transition-colors hover:bg-surface-2 disabled:cursor-not-allowed disabled:opacity-60">
    <span className={`relative inline-flex h-4 w-7 shrink-0 rounded-full transition-colors ${checked ? "bg-primary" : "bg-border"}`}><span className={`absolute top-0.5 h-3 w-3 rounded-full bg-white transition-transform ${checked ? "translate-x-3.5" : "translate-x-0.5"}`} /></span>
    <span>{label}</span>
  </button>;
}

function LineEditor({ line, readOnly, applied, highlighted, onChange, onDelete }: { line: RetailPosPurchaseCostingLine; readOnly: boolean; applied?: boolean; highlighted?: boolean; onChange: (patch: LinePatch) => void; onDelete: () => void }) {
  const [expanded, setExpanded] = useState(false);
  const [qty, setQty] = useState(line.purchasedQuantity);
  const [purchasePresentation, setPurchasePresentation] = useState(line.purchaseUnitLabel === line.salesUnitLabelSnapshot ? "" : line.purchaseUnitLabel);
  const [differentPresentation, setDifferentPresentation] = useState(line.purchaseUnitLabel !== line.salesUnitLabelSnapshot || Number(line.unitsPerPurchaseUnit) !== 1);
  const [units, setUnits] = useState(line.unitsPerPurchaseUnit);
  const [cost, setCost] = useState(centsToInput(line.invoiceUnitCostCents));
  const [publicMarkup, setPublicMarkup] = useState(percentInput(line.publicMarkupOverrideBps));
  const [publicFinal, setPublicFinal] = useState(centsToInput(line.finalPublicPriceCents));
  const [wholesaleMarkup, setWholesaleMarkup] = useState(percentInput(line.wholesaleMarkupOverrideBps));
  const [wholesaleFinal, setWholesaleFinal] = useState(centsToInput(line.finalWholesalePriceCents));
  const [publicPriceMode, setPublicPriceMode] = useState<RetailPosPurchaseCostingPriceMode>(line.publicPriceMode);
  const [wholesalePriceMode, setWholesalePriceMode] = useState<RetailPosPurchaseCostingPriceMode>(line.wholesalePriceMode);
  const [useGeneralMarkup, setUseGeneralMarkup] = useState(line.publicMarkupOverrideBps === null && line.wholesaleMarkupOverrideBps === null);

  useEffect(() => {
    // The line is replaced after autosave reconciliation; refresh the local input drafts.
    // eslint-disable-next-line react-hooks/set-state-in-effect
  setQty(line.purchasedQuantity); setPurchasePresentation(line.purchaseUnitLabel === line.salesUnitLabelSnapshot ? "" : line.purchaseUnitLabel); setDifferentPresentation(line.purchaseUnitLabel !== line.salesUnitLabelSnapshot || Number(line.unitsPerPurchaseUnit) !== 1); setUnits(line.unitsPerPurchaseUnit); setCost(centsToInput(line.invoiceUnitCostCents));
    setPublicMarkup(percentInput(line.publicMarkupOverrideBps)); setPublicFinal(centsToInput(line.finalPublicPriceCents)); setWholesaleMarkup(percentInput(line.wholesaleMarkupOverrideBps)); setWholesaleFinal(centsToInput(line.finalWholesalePriceCents));
    setPublicPriceMode(line.publicPriceMode); setWholesalePriceMode(line.wholesalePriceMode);
    setUseGeneralMarkup(line.publicMarkupOverrideBps === null && line.wholesaleMarkupOverrideBps === null);
  }, [line]);

  const commitQuantity = () => { if (qty.trim() && qty !== line.purchasedQuantity) onChange({ purchasedQuantity: qty }); };
  const commitUnits = () => { if (units.trim() && units !== line.unitsPerPurchaseUnit) onChange({ unitsPerPurchaseUnit: units }); };
  const commitPurchasePresentation = () => { const value = purchasePresentation.trim() || line.salesUnitLabelSnapshot; if (value !== line.purchaseUnitLabel) onChange({ purchaseUnitLabel: value }); };
  const commitCost = () => { const value = inputToCents(cost); if (value !== null && value !== line.invoiceUnitCostCents) onChange({ invoiceUnitCostCents: value }); };
  const commitPercent = (value: string, current: number | null, key: "publicMarkupOverrideBps" | "wholesaleMarkupOverrideBps") => { const parsed = value.trim() === "" ? null : parsePercentToBps(value, 100000); if (parsed !== null || value.trim() === "") { if (parsed !== current) onChange({ [key]: parsed }); } };
  const commitPrice = (value: string, current: number | null, key: "finalPublicPriceCents" | "finalWholesalePriceCents", modeKey: "publicPriceMode" | "wholesalePriceMode", currentMode: RetailPosPurchaseCostingPriceMode, setMode: (mode: RetailPosPurchaseCostingPriceMode) => void) => { const parsed = value.trim() === "" ? null : inputToCents(value); if (parsed !== null || value.trim() === "") { setMode("manual"); if (key === "finalPublicPriceCents") setPublicFinal(centsToInput(parsed)); else setWholesaleFinal(centsToInput(parsed)); if (parsed !== current || currentMode !== "manual") onChange({ [key]: parsed, [modeKey]: "manual" }); } };
  const toggleGeneralMarkup = (checked: boolean) => {
    setUseGeneralMarkup(checked);
    if (checked) {
      setPublicMarkup(""); setWholesaleMarkup("");
      onChange({ publicMarkupOverrideBps: null, wholesaleMarkupOverrideBps: null });
      return;
    }
    setPublicMarkup(formatBpsPercent(line.effectivePublicMarkupBps)); setWholesaleMarkup(formatBpsPercent(line.effectiveWholesaleMarkupBps));
    onChange({ publicMarkupOverrideBps: line.effectivePublicMarkupBps, wholesaleMarkupOverrideBps: line.effectiveWholesaleMarkupBps });
  };
  const setPriceMode = (mode: RetailPosPurchaseCostingPriceMode, priceType: "public" | "wholesale") => {
    const suggested = priceType === "public" ? line.suggestedPublicPriceCents : line.suggestedWholesalePriceCents;
    const current = priceType === "public" ? line.finalPublicPriceCents : line.finalWholesalePriceCents;
    const next = resolvePurchaseCostingFinalPrice(mode, suggested, current);
    if (priceType === "public") { setPublicPriceMode(mode); setPublicFinal(centsToInput(next)); onChange({ publicPriceMode: mode }); }
    else { setWholesalePriceMode(mode); setWholesaleFinal(centsToInput(next)); onChange({ wholesalePriceMode: mode }); }
  };
  const setPresentationMode = (checked: boolean) => {
    setDifferentPresentation(checked);
    if (!checked) {
      setPurchasePresentation(""); setUnits("1");
      if (line.purchaseUnitLabel !== line.salesUnitLabelSnapshot || Number(line.unitsPerPurchaseUnit) !== 1) onChange({ purchaseUnitLabel: line.salesUnitLabelSnapshot, unitsPerPurchaseUnit: "1" });
    }
  };
  const salesUnit = line.salesUnitLabelSnapshot || "unidad";
  const salesUnitPlural = pluralizeRetailPosUnit(salesUnit);
  const differentPresentationLabel = `¿Se compró en una presentación distinta a ${salesUnit.toLocaleLowerCase("es-MX")}?`;
  const purchaseUnitSingular = singularizeRetailPosPresentation(purchasePresentation);
  const purchaseUnitPlural = purchasePresentation.trim() ? pluralizeRetailPosUnit(purchaseUnitSingular) : "presentación";
  const conversionLabel = purchasePresentation.trim() ? `${salesUnitPlural} por ${purchaseUnitSingular}` : `${salesUnit} por presentación`;
  const parsedQuantity = Number(qty);
  const parsedUnits = Number(units);
  const conversionExplanation = Number.isFinite(parsedQuantity) && parsedQuantity > 0 && Number.isFinite(parsedUnits) && parsedUnits > 0
    ? `${formatQuantity(qty)} ${purchaseUnitPlural} × ${formatQuantity(units)} ${salesUnitPlural} = ${formatQuantity(String(parsedQuantity * parsedUnits))} ${salesUnitPlural}`
    : null;

  return (
    <li className={`border-b border-border p-4 last:border-b-0 ${highlighted ? "bg-warning/10" : ""}`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="font-medium text-foreground">{line.productNameSnapshot}</p>
            <span className="inline-flex items-center rounded-full border border-primary/25 bg-primary/10 px-2 py-0.5 text-[11px] font-medium text-primary">Unidad de venta · {salesUnit}</span>
            <ToggleControl label={differentPresentationLabel} checked={differentPresentation} disabled={readOnly} onChange={setPresentationMode} />
            {differentPresentation ? <label className="inline-flex min-w-[12rem] flex-1 items-center gap-2 text-xs text-muted"><span className="whitespace-nowrap">Presentación de compra</span><Input className="min-w-0" disabled={readOnly} value={purchasePresentation} placeholder="Ej. caja, bulto, paquete, rollo, saco o tubo" onChange={(event) => setPurchasePresentation(event.target.value)} onBlur={commitPurchasePresentation} /></label> : null}
            {differentPresentation && conversionExplanation ? <span className="inline-flex items-center rounded-full border border-border bg-surface-2 px-2.5 py-1 text-[11px] font-medium text-muted">{conversionExplanation}</span> : null}
          </div>
          <p className="mt-1 text-xs text-muted">{line.productSkuSnapshot ? `SKU: ${line.productSkuSnapshot} · ` : ""}{line.productSupplierNameSnapshot ?? "Sin proveedor"}</p>
        </div>
        <div className="flex flex-wrap items-center justify-end gap-2">
          {(line.publicMarkupOverrideBps !== null || line.wholesaleMarkupOverrideBps !== null) ? <ToggleControl label="Usar incremento general" checked={useGeneralMarkup} disabled={readOnly} onChange={toggleGeneralMarkup} /> : null}
          {!readOnly ? <div className="ml-2 border-l border-border pl-3"><button type="button" onClick={onDelete} className="rounded p-2 text-muted hover:bg-danger/10 hover:text-danger" aria-label={`Quitar ${line.productNameSnapshot}`}><Trash2 className="h-4 w-4" aria-hidden="true" /></button></div> : null}
        </div>
      </div>
      {(applied || (readOnly && line.baseUnitCostCents !== null)) ? <div className="mt-3 grid gap-2 rounded border border-border bg-surface-2 p-3 text-xs sm:grid-cols-3"><div><span className="text-muted">Costo</span><div>{formatMoney(line.previousCostCents)} → <strong>{formatMoney(line.baseUnitCostCents)}</strong></div></div><div><span className="text-muted">P. público</span><div>{formatMoney(line.previousPublicPriceCents)} → <strong>{formatMoney(line.finalPublicPriceCents)}</strong></div></div><div><span className="text-muted">P. mayoreo</span><div>{formatMoney(line.previousWholesalePriceCents)} → <strong>{formatMoney(line.finalWholesalePriceCents)}</strong></div></div></div> : null}

      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-8">
        <label className="min-w-0"><FieldLabel>Cantidad comprada</FieldLabel><Input disabled={readOnly} value={qty} onChange={(event) => setQty(event.target.value)} onBlur={commitQuantity} onKeyDown={(event) => { if (event.key === "Enter") event.currentTarget.blur(); }} inputMode="decimal" /></label>
        {differentPresentation ? <label className="min-w-0"><FieldLabel>{conversionLabel}</FieldLabel><Input disabled={readOnly} value={units} onChange={(event) => setUnits(event.target.value)} onBlur={commitUnits} onKeyDown={(event) => { if (event.key === "Enter") event.currentTarget.blur(); }} inputMode="decimal" /></label> : null}
        <label><FieldLabel>Costo facturado</FieldLabel><Input disabled={readOnly} value={cost} placeholder="$0.00" onChange={(event) => setCost(event.target.value)} onBlur={commitCost} onKeyDown={(event) => { if (event.key === "Enter") event.currentTarget.blur(); }} inputMode="decimal" /></label>
        <label><FieldLabel>Incremento público <span className="text-muted">{line.publicMarkupOverrideBps === null ? "· General" : "· Ajustado"}</span></FieldLabel><div className="relative"><Input disabled={readOnly} value={publicMarkup} placeholder={formatBpsPercent(line.effectivePublicMarkupBps)} onChange={(event) => { setPublicMarkup(event.target.value); setUseGeneralMarkup(false); }} onBlur={() => commitPercent(publicMarkup, line.publicMarkupOverrideBps, "publicMarkupOverrideBps")} onKeyDown={(event) => { if (event.key === "Enter") event.currentTarget.blur(); }} inputMode="decimal" className="pr-7" /><span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-sm text-muted">%</span></div></label>
        <label className="min-w-0"><div className="flex items-center gap-1"><FieldLabel>Precio público final</FieldLabel><span className="rounded-full bg-surface-2 px-1.5 py-0.5 text-[10px] font-medium text-muted">{publicPriceMode === "rounded" ? "Redondeado" : publicPriceMode === "manual" ? "Manual" : "Sugerido"}</span></div><Input disabled={readOnly} value={publicFinal} placeholder="Sugerido" onChange={(event) => { setPublicFinal(event.target.value); setPublicPriceMode("manual"); }} onBlur={() => commitPrice(publicFinal, line.finalPublicPriceCents, "finalPublicPriceCents", "publicPriceMode", line.publicPriceMode, setPublicPriceMode)} /><div className="mt-1 flex flex-wrap items-center gap-2 text-[11px] text-muted"><span>{line.suggestedPublicPriceCents === null ? "Pendiente de recalcular" : `Sugerido: ${formatMoney(line.suggestedPublicPriceCents)}`}</span>{!readOnly && line.suggestedPublicPriceCents !== null ? <button type="button" className="text-primary hover:underline" onClick={() => setPriceMode(publicPriceMode === "manual" ? "rounded" : publicPriceMode === "rounded" ? "suggested" : "rounded", "public")}>{publicPriceMode === "rounded" ? "Usar sugerido" : publicPriceMode === "manual" ? "Usar redondeo automático" : "Redondear ↑"}</button> : null}</div></label>
        <label><FieldLabel>Incremento mayoreo <span className="text-muted">{line.wholesaleMarkupOverrideBps === null ? "· General" : "· Ajustado"}</span></FieldLabel><div className="relative"><Input disabled={readOnly} value={wholesaleMarkup} placeholder={formatBpsPercent(line.effectiveWholesaleMarkupBps)} onChange={(event) => { setWholesaleMarkup(event.target.value); setUseGeneralMarkup(false); }} onBlur={() => commitPercent(wholesaleMarkup, line.wholesaleMarkupOverrideBps, "wholesaleMarkupOverrideBps")} onKeyDown={(event) => { if (event.key === "Enter") event.currentTarget.blur(); }} inputMode="decimal" className="pr-7" /><span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-sm text-muted">%</span></div></label>
        <label className="min-w-0"><div className="flex items-center gap-1"><FieldLabel>Precio mayoreo final</FieldLabel><span className="rounded-full bg-surface-2 px-1.5 py-0.5 text-[10px] font-medium text-muted">{wholesalePriceMode === "rounded" ? "Redondeado" : wholesalePriceMode === "manual" ? "Manual" : "Sugerido"}</span></div><Input disabled={readOnly} value={wholesaleFinal} placeholder="Sugerido" onChange={(event) => { setWholesaleFinal(event.target.value); setWholesalePriceMode("manual"); }} onBlur={() => commitPrice(wholesaleFinal, line.finalWholesalePriceCents, "finalWholesalePriceCents", "wholesalePriceMode", line.wholesalePriceMode, setWholesalePriceMode)} /><div className="mt-1 flex flex-wrap items-center gap-2 text-[11px] text-muted"><span>{line.suggestedWholesalePriceCents === null ? "Pendiente de recalcular" : `Sugerido: ${formatMoney(line.suggestedWholesalePriceCents)}`}</span>{!readOnly && line.suggestedWholesalePriceCents !== null ? <button type="button" className="text-primary hover:underline" onClick={() => setPriceMode(wholesalePriceMode === "manual" ? "rounded" : wholesalePriceMode === "rounded" ? "suggested" : "rounded", "wholesale")}>{wholesalePriceMode === "rounded" ? "Usar sugerido" : wholesalePriceMode === "manual" ? "Usar redondeo automático" : "Redondear ↑"}</button> : null}</div></label>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-x-6 gap-y-2 text-sm">
        <span>Público sugerido: <strong>{formatMoney(line.suggestedPublicPriceCents)}</strong></span>
        <span>Mayoreo sugerido: <strong>{formatMoney(line.suggestedWholesalePriceCents)}</strong></span>
        {line.finalPublicPriceCents !== null && line.suggestedPublicPriceCents !== null && line.finalPublicPriceCents !== line.suggestedPublicPriceCents ? <span className="text-warning">Público ajustado</span> : null}
        {line.finalWholesalePriceCents !== null && line.suggestedWholesalePriceCents !== null && line.finalWholesalePriceCents !== line.suggestedWholesalePriceCents ? <span className="text-warning">Mayoreo ajustado</span> : null}
        <button type="button" className="inline-flex items-center gap-1 text-xs text-primary hover:underline" onClick={() => setExpanded((value) => !value)} aria-expanded={expanded}>{expanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}Detalle económico</button>
      </div>
      {expanded ? <dl className="mt-3 grid gap-2 rounded border border-border bg-surface-2 p-3 text-xs sm:grid-cols-4"><div><dt className="text-muted">Subtotal</dt><dd>{formatMoney(line.subtotalCents)}</dd></div><div><dt className="text-muted">IVA</dt><dd>{formatMoney(line.taxCents)}</dd></div><div><dt className="text-muted">Total con IVA</dt><dd>{formatMoney(line.grossTotalCents)}</dd></div><div><dt className="text-muted">Descuento</dt><dd>{formatMoney(line.discountCents)}</dd></div><div><dt className="text-muted">Total neto</dt><dd>{formatMoney(line.netTotalCents)}</dd></div><div><dt className="text-muted">Unidades de venta</dt><dd>{formatQuantity(line.saleUnitsQuantity)}</dd></div><div><dt className="text-muted">Costo base</dt><dd>{formatMoney(line.baseUnitCostCents)}</dd></div></dl> : null}
    </li>
  );
}

export function PurchaseCostingEditor({ tenantSlug, initialDocument, suppliers }: Props) {
  const [document, setDocument] = useState(initialDocument);
  const documentRef = useRef(initialDocument);
  const [supplierId, setSupplierId] = useState(initialDocument.supplierId ?? "");
  const [supplierOnly, setSupplierOnly] = useState(Boolean(initialDocument.supplierId));
  const [invoiceReference, setInvoiceReference] = useState(initialDocument.invoiceReference ?? "");
  const [invoiceDate, setInvoiceDate] = useState(initialDocument.invoiceDate ?? "");
  const [taxRate, setTaxRate] = useState(formatBpsPercent(initialDocument.taxRateBps));
  const [discountRate, setDiscountRate] = useState(formatBpsPercent(initialDocument.discountRateBps));
  const [publicMarkup, setPublicMarkup] = useState(formatBpsPercent(initialDocument.defaultPublicMarkupBps));
  const [wholesaleMarkup, setWholesaleMarkup] = useState(formatBpsPercent(initialDocument.defaultWholesaleMarkupBps));
  const [dialogOpen, setDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [pendingCount, setPendingCount] = useState(0);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [conflict, setConflict] = useState(false);
  const [highlightedLineId, setHighlightedLineId] = useState<string | null>(null);
  const [applyOpen, setApplyOpen] = useState(false);
  const queueRef = useRef(Promise.resolve());
  const conflictRef = useRef(false);
  const mutationIdRef = useRef(0);
  const headerDraftRef = useRef<Partial<Record<HeaderField, string>>>({});
  const editorInstanceIdRef = useRef(`costing-editor-${Math.random().toString(36).slice(2)}`);
  const initialDocumentRef = useRef(initialDocument);
  const [diagnosticEnabled, setDiagnosticEnabled] = useState(false);
  const [diagnosticEvents, setDiagnosticEvents] = useState<CostingDiagnosticEvent[]>([]);

  const recordDiagnostic = useCallback((event: Omit<CostingDiagnosticEvent, "timestamp">) => {
    if (!diagnosticEnabled) return;
    setDiagnosticEvents((events) => appendDiagnosticEvent(events, { costingId: documentRef.current.id, ...event }));
  }, [diagnosticEnabled]);

  useEffect(() => {
    setDiagnosticEnabled(isCostingDiagnosticsEnabled(window.location.search));
  }, []);

  useEffect(() => {
    if (!diagnosticEnabled) return;
    const instanceId = editorInstanceIdRef.current;
    const mountedDocument = initialDocumentRef.current;
    recordDiagnostic({ event: "editor-mounted", revisionAfter: mountedDocument.revision, documentAfter: mountedDocument, field: instanceId });
    return () => recordDiagnostic({ event: "editor-unmounted", revisionBefore: documentRef.current.revision, documentBefore: documentRef.current, field: instanceId });
  }, [diagnosticEnabled, recordDiagnostic]);

  useEffect(() => {
    if (!diagnosticEnabled || initialDocumentRef.current === initialDocument) return;
    const previous = initialDocumentRef.current;
    recordDiagnostic({ event: "initial-document-changed", revisionBefore: previous.revision, revisionAfter: initialDocument.revision, documentBefore: previous, documentAfter: initialDocument });
    initialDocumentRef.current = initialDocument;
  }, [diagnosticEnabled, initialDocument, recordDiagnostic]);

  const baseUrl = `/api/tenant/${encodeURIComponent(tenantSlug)}/retail-pos/purchase-costings`;
  const readOnly = document.status === "applied" || document.status === "voided";
  const lineIds = useMemo(() => document.lines.map((line) => line.productId), [document.lines]);

  function applyDocument(next: RetailPosPurchaseCostingDetail) {
    headerDraftRef.current = {};
    documentRef.current = next; setDocument(next); setSupplierId(next.supplierId ?? ""); setInvoiceReference(next.invoiceReference ?? ""); setInvoiceDate(next.invoiceDate ?? ""); setTaxRate(formatBpsPercent(next.taxRateBps)); setDiscountRate(formatBpsPercent(next.discountRateBps)); setPublicMarkup(formatBpsPercent(next.defaultPublicMarkupBps)); setWholesaleMarkup(formatBpsPercent(next.defaultWholesaleMarkupBps));
  }

  function applyReconciledDocument(next: RetailPosPurchaseCostingDetail, mutation: PurchaseCostingMutationEnvelope) {
    const before = documentRef.current;
    const merged = reconcilePurchaseCostingDocument(next, documentRef.current, mutation);
    documentRef.current = merged;
    setDocument(merged);
    setSupplierId(merged.supplierId ?? "");
    setInvoiceReference(headerDraftRef.current.invoiceReference ?? merged.invoiceReference ?? "");
    setInvoiceDate(headerDraftRef.current.invoiceDate ?? merged.invoiceDate ?? "");
    setTaxRate(headerDraftRef.current.taxRateBps ?? formatBpsPercent(merged.taxRateBps));
    setDiscountRate(headerDraftRef.current.discountRateBps ?? formatBpsPercent(merged.discountRateBps));
    setPublicMarkup(headerDraftRef.current.defaultPublicMarkupBps ?? formatBpsPercent(merged.defaultPublicMarkupBps));
    setWholesaleMarkup(headerDraftRef.current.defaultWholesaleMarkupBps ?? formatBpsPercent(merged.defaultWholesaleMarkupBps));
    recordDiagnostic({ event: "mutation-reconciled", revisionBefore: before.revision, revisionReturned: next.revision, revisionAfter: merged.revision, documentBefore: before, documentAfter: merged });
    recordDiagnostic({ event: "state-updated", localValueBefore: before.supplierId, localValueAfter: merged.supplierId, revisionAfter: merged.revision, documentBefore: before, documentAfter: merged });
  }

  function enqueue(operation: (current: RetailPosPurchaseCostingDetail) => Promise<RetailPosPurchaseCostingDetail>, patch: PurchaseCostingMutationPatch = {}, baseDocument = documentRef.current) {
    const mutation: PurchaseCostingMutationEnvelope = { mutationId: mutationIdRef.current + 1, expectedRevision: baseDocument.revision, baseDocument, patch: { ...patch } };
    mutationIdRef.current = mutation.mutationId;
    setPendingCount((count) => count + 1);
    recordDiagnostic({ event: "mutation-enqueued", patch, revisionBefore: baseDocument.revision, revisionSubmitted: baseDocument.revision, queueLength: pendingCount + 1, documentBefore: baseDocument });
    queueRef.current = queueRef.current.then(async () => {
      if (conflictRef.current || readOnly) { setPendingCount((count) => Math.max(0, count - 1)); return; }
      setSaving(true); setSaved(false); setError(null);
      try { const next = await operation(documentRef.current); applyReconciledDocument(next, mutation); setSaved(true); } catch (nextError) { if (nextError instanceof ApiError && nextError.status === 409) { conflictRef.current = true; setConflict(true); recordDiagnostic({ event: "conflict", responseStatus: nextError.status, revisionBefore: documentRef.current.revision }); } else { recordDiagnostic({ event: "request-error", responseBody: nextError instanceof Error ? nextError.message : nextError }); setError(nextError instanceof Error ? nextError.message : "No fue posible guardar los cambios."); } } finally { setSaving(false); setPendingCount((count) => Math.max(0, count - 1)); }
    });
  }

  function applyDocumentToCatalog() {
    const current = documentRef.current;
    setApplyOpen(false);
    setSaving(true);
    requestJson<{ document: RetailPosPurchaseCostingDetail; updatedProducts: unknown[] }>(`${baseUrl}/${current.id}/apply`, { method: "POST", body: JSON.stringify({ expectedRevision: current.revision }) })
      .then((result) => { applyDocument(result.document); setNotice(`Costeo aplicado al catálogo. Se actualizaron ${result.updatedProducts.length} productos.`); })
      .catch((nextError) => { if (nextError instanceof ApiError && nextError.status === 409) { conflictRef.current = true; setConflict(true); } else setError(nextError instanceof Error ? nextError.message : "No fue posible aplicar el costeo al catálogo."); })
      .finally(() => setSaving(false));
  }

  function optimisticHeader(field: HeaderField, value: unknown) {
    const next = { ...documentRef.current, [field]: value } as RetailPosPurchaseCostingDetail;
    documentRef.current = next; setDocument(next);
  }

  function optimisticLine(lineId: string, patch: Partial<RetailPosPurchaseCostingLine>) {
    const next = { ...documentRef.current, lines: documentRef.current.lines.map((line) => line.id === lineId ? { ...line, ...patch } : line) };
    documentRef.current = next; setDocument(next);
  }

  function updateHeader(field: HeaderField, value: unknown) {
    const baseDocument = documentRef.current;
    recordDiagnostic({ event: "field-blur", field, localValueBefore: baseDocument[field], submittedValue: value, revisionBefore: baseDocument.revision, documentBefore: baseDocument });
    optimisticHeader(field, value);
    enqueue((current) => requestJson<RetailPosPurchaseCostingDetail>(`${baseUrl}/${current.id}`, { method: "PATCH", body: JSON.stringify({ [field]: value, expectedRevision: current.revision }) }, (event) => recordDiagnostic({ ...event, field, submittedValue: value, revisionBefore: current.revision, revisionSubmitted: current.revision })), { [field]: value }, baseDocument);
  }

  function commitPercentField(value: string, field: "taxRateBps" | "discountRateBps" | "defaultPublicMarkupBps" | "defaultWholesaleMarkupBps", setter: (value: string) => void, maximum: number) {
    const parsed = parsePercentToBps(value, maximum);
    if (parsed === null) { setError("Captura un porcentaje válido."); const fallback = formatBpsPercent(documentRef.current[field]); headerDraftRef.current[field] = fallback; setter(fallback); return; }
    const formatted = formatBpsPercent(parsed); headerDraftRef.current[field] = formatted; setter(formatted);
    if (parsed !== documentRef.current[field]) updateHeader(field, parsed);
  }

  function handleLineChange(lineId: string, patch: LinePatch) {
    const baseDocument = documentRef.current;
    optimisticLine(lineId, patch as Partial<RetailPosPurchaseCostingLine>);
    enqueue((current) => requestJson<RetailPosPurchaseCostingDetail>(`${baseUrl}/${current.id}/lines/${lineId}`, { method: "PATCH", body: JSON.stringify({ ...patch, expectedRevision: current.revision }) }), patch as PurchaseCostingMutationPatch, baseDocument);
  }

  function handleAdd(product: RetailPosCostingProductSearchResult) {
    recordDiagnostic({ event: "product-selected", productId: product.productId, submittedValue: product });
    const existing = documentRef.current.lines.find((line) => line.productId === product.productId);
    if (existing) { setNotice("El producto ya está agregado."); setHighlightedLineId(existing.id); return; }
    const input: Omit<AddPurchaseCostingLineInput, "expectedRevision"> = { productId: product.productId, purchasedQuantity: "1", purchaseUnitLabel: product.salesUnitLabel ?? product.salesUnitCode ?? "unidad", unitsPerPurchaseUnit: "1", invoiceUnitCostCents: 0, publicMarkupOverrideBps: null, wholesaleMarkupOverrideBps: null, finalPublicPriceCents: null, finalWholesalePriceCents: null };
    recordDiagnostic({ event: "product-add-request", productId: product.productId, requestBody: { ...input }, revisionSubmitted: documentRef.current.revision, documentBefore: documentRef.current });
    enqueue((current) => requestJson<RetailPosPurchaseCostingDetail>(`${baseUrl}/${current.id}/lines`, { method: "POST", body: JSON.stringify({ ...input, expectedRevision: current.revision }) }, (event) => recordDiagnostic({ ...event, event: event.event === "response-received" ? "product-add-response" : event.event, productId: product.productId, revisionBefore: current.revision, revisionSubmitted: current.revision })), {}, documentRef.current);
    setNotice(`${product.name} agregado. Captura el costo facturado.`);
  }

  function handleDelete(line: RetailPosPurchaseCostingLine) {
    enqueue((current) => requestJson<RetailPosPurchaseCostingDetail>(`${baseUrl}/${current.id}/lines/${line.id}?expectedRevision=${current.revision}`, { method: "DELETE" }));
  }

  function reload() { window.location.reload(); }

  const costsReady = document.lines.length > 0 && document.lines.every((line) => line.invoiceUnitCostCents > 0 && Number(line.purchasedQuantity) > 0 && Number(line.unitsPerPurchaseUnit) > 0);
  const percentagesReady = [document.taxRateBps, document.discountRateBps, document.defaultPublicMarkupBps, document.defaultWholesaleMarkupBps].every((value) => Number.isInteger(value) && value >= 0);
  const canCalculate = Boolean(document.supplierId) && costsReady && percentagesReady && pendingCount === 0 && !saving && !conflict && !readOnly;
  const canApply = document.status === "calculated" && pendingCount === 0 && !saving && !conflict;

  return <div className="space-y-4 pb-8">
    {diagnosticEnabled ? <CostingDiagnosticPanel events={diagnosticEvents} document={document} revision={document.revision} queueLength={pendingCount} onClear={() => setDiagnosticEvents([])} /> : null}
    {conflict ? <div className="flex flex-wrap items-center justify-between gap-3 rounded border border-warning/40 bg-warning/10 p-3 text-sm" role="alert"><span className="flex items-center gap-2"><AlertTriangle className="h-4 w-4" aria-hidden="true" />El documento cambió en otra sesión.</span><div className="flex gap-2"><Button type="button" variant="secondary" onClick={reload}>Recargar documento</Button><Button type="button" variant="ghost" onClick={() => { conflictRef.current = false; setConflict(false); }}>Seguir revisando</Button></div></div> : null}
    {error ? <div className="rounded border border-danger/40 bg-danger/10 p-3 text-sm text-danger" role="alert">{error}</div> : null}
    {notice ? <div className="rounded border border-primary/30 bg-primary/5 p-3 text-sm text-primary" role="status">{notice}</div> : null}

    <Card className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-xs uppercase tracking-wide text-muted">Documento de costeo</p><span className="inline-flex rounded bg-warning/15 px-2 py-0.5 text-[10px] font-semibold tracking-wide text-warning">COSTEO UI V2</span><h1 className="mt-1 text-xl font-semibold">{document.invoiceReference || "Nuevo costeo"}</h1></div><div className="flex items-center gap-2 text-sm">{saving ? <><Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />Guardando…</> : saved ? <><Check className="h-4 w-4 text-success" aria-hidden="true" />Guardado</> : null}<span className="rounded-full bg-surface-2 px-2.5 py-1 text-xs font-medium">{document.status === "draft" ? "Borrador" : document.status === "calculated" ? "Calculado" : document.status === "applied" ? "Aplicado" : "Anulado"}</span></div></div>
      <div className="grid gap-2 md:grid-cols-2 lg:grid-cols-8">
        <label className="min-w-0 lg:col-span-2"><FieldLabel>Proveedor</FieldLabel><SearchableSelect id="costing-detail-supplier" name="costingSupplierDetail" options={suppliers.map((supplier) => ({ value: supplier.id, label: supplier.name }))} placeholder="Selecciona proveedor" clearable defaultValue={supplierId} disabled={readOnly} onValueChange={(value) => { recordDiagnostic({ event: "field-change", field: "supplierId", localValueBefore: supplierId, localValueAfter: value, submittedValue: value, documentBefore: documentRef.current }); setSupplierId(value); setSupplierOnly(Boolean(value)); updateHeader("supplierId", value || null); }} /></label>
        <label><FieldLabel>Referencia de factura</FieldLabel><Input disabled={readOnly} value={invoiceReference} onChange={(event) => { const value = event.target.value; recordDiagnostic({ event: "field-change", field: "invoiceReference", localValueBefore: invoiceReference, localValueAfter: value, documentBefore: documentRef.current }); headerDraftRef.current.invoiceReference = value; setInvoiceReference(value); }} onBlur={() => updateHeader("invoiceReference", invoiceReference.trim() || null)} /></label>
        <label><FieldLabel>Fecha de factura</FieldLabel><Input disabled={readOnly} type="date" value={invoiceDate} onChange={(event) => { const value = event.target.value; recordDiagnostic({ event: "field-change", field: "invoiceDate", localValueBefore: invoiceDate, localValueAfter: value, documentBefore: documentRef.current }); headerDraftRef.current.invoiceDate = value; setInvoiceDate(value); }} onBlur={() => updateHeader("invoiceDate", invoiceDate || null)} /></label>
        <label><FieldLabel>IVA (%)</FieldLabel><div className="relative"><Input disabled={readOnly} value={taxRate} onChange={(event) => { const value = event.target.value; headerDraftRef.current.taxRateBps = value; setTaxRate(value); }} onBlur={() => commitPercentField(taxRate, "taxRateBps", setTaxRate, 10000)} inputMode="decimal" className="pr-8" /><span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-sm text-muted">%</span></div></label>
        <label><FieldLabel>Descuento de factura (%)</FieldLabel><div className="relative"><Input disabled={readOnly} value={discountRate} onChange={(event) => { const value = event.target.value; headerDraftRef.current.discountRateBps = value; setDiscountRate(value); }} onBlur={() => commitPercentField(discountRate, "discountRateBps", setDiscountRate, 10000)} inputMode="decimal" className="pr-8" /><span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-sm text-muted">%</span></div></label>
        <label><FieldLabel>Incremento público general (%)</FieldLabel><div className="relative"><Input disabled={readOnly} value={publicMarkup} onChange={(event) => { const value = event.target.value; headerDraftRef.current.defaultPublicMarkupBps = value; setPublicMarkup(value); }} onBlur={() => commitPercentField(publicMarkup, "defaultPublicMarkupBps", setPublicMarkup, 100000)} inputMode="decimal" className="pr-8" /><span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-sm text-muted">%</span></div></label>
        <label><FieldLabel>Incremento mayoreo general (%)</FieldLabel><div className="relative"><Input disabled={readOnly} value={wholesaleMarkup} onChange={(event) => { const value = event.target.value; headerDraftRef.current.defaultWholesaleMarkupBps = value; setWholesaleMarkup(value); }} onBlur={() => commitPercentField(wholesaleMarkup, "defaultWholesaleMarkupBps", setWholesaleMarkup, 100000)} inputMode="decimal" className="pr-8" /><span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-sm text-muted">%</span></div></label>
      </div>
    </Card>

    <Card className="p-0"><div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-4 py-3 sm:px-5"><div><h2 className="font-semibold">Productos del costeo</h2><p className="text-xs text-muted">{document.lines.length} producto{document.lines.length === 1 ? "" : "s"}. El costo facturado se captura sin IVA ni descuento.</p></div>{!readOnly ? <Button type="button" onClick={() => setDialogOpen(true)}><Plus className="h-4 w-4" aria-hidden="true" />Agregar producto</Button> : null}</div>{document.lines.length === 0 ? <div className="p-8 text-center text-sm text-muted">Agrega productos para comenzar la captura.</div> : <ul>{document.lines.map((line) => <LineEditor key={line.id} line={line} highlighted={highlightedLineId === line.id} readOnly={readOnly} onChange={(patch) => handleLineChange(line.id, patch)} onDelete={() => handleDelete(line)} />)}</ul>}</Card>

    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]"><Card><h2 className="font-semibold">Resumen</h2><dl className="mt-3 grid grid-cols-2 gap-3 text-sm sm:grid-cols-4 lg:grid-cols-2"><div><dt className="text-muted">Subtotal sin IVA</dt><dd className="font-medium">{formatMoney(document.subtotalCents)}</dd></div><div><dt className="text-muted">IVA</dt><dd className="font-medium">{formatMoney(document.taxCents)}</dd></div><div><dt className="text-muted">Total con IVA</dt><dd className="font-medium">{formatMoney(document.grossTotalCents)}</dd></div><div><dt className="text-muted">Descuento</dt><dd className="font-medium">{formatMoney(document.discountCents)}</dd></div><div><dt className="text-muted">Total neto de factura</dt><dd className="text-lg font-semibold">{formatMoney(document.netTotalCents)}</dd></div><div><dt className="text-muted">Productos</dt><dd className="font-medium">{document.lines.length}</dd></div></dl></Card>{document.status === "draft" ? <Card className="flex flex-col justify-between gap-4"><div><h2 className="font-semibold">Acciones</h2><p className="mt-1 text-xs text-muted">Los cambios se guardan automáticamente.</p></div><Button type="button" className="w-full" disabled={!canCalculate} onClick={() => enqueue((current) => requestJson<RetailPosPurchaseCostingDetail>(`${baseUrl}/${current.id}/calculate`, { method: "POST", body: JSON.stringify({ expectedRevision: current.revision }) }))}><Calculator className="h-4 w-4" aria-hidden="true" />Calcular costeo</Button>{!canCalculate ? <p className="text-xs text-muted">{!document.supplierId ? "Selecciona un proveedor." : !costsReady ? "Captura un costo facturado mayor a cero en cada línea." : saving ? "Esperando guardados…" : "Revisa los datos antes de calcular."}</p> : null}</Card> : null}</div>

    {document.status === "calculated" ? <Card className="flex flex-wrap items-center justify-between gap-3 border-primary/30"><div><p className="font-semibold">Listo para aplicar</p><p className="text-sm text-muted">Aplicará costo y ambos precios al catálogo. El documento quedará en modo lectura.</p></div><Button type="button" disabled={!canApply} onClick={() => setApplyOpen(true)}>Aplicar al catálogo</Button></Card> : null}
    <Modal open={applyOpen} onClose={() => setApplyOpen(false)} title="Aplicar costeo al catálogo"><div className="space-y-4"><p className="text-sm">Se actualizarán el costo, el precio público y el precio mayoreo de <strong>{document.lines.length} productos</strong>.</p><div className="rounded border border-border bg-surface-2 p-3 text-sm"><dl className="grid gap-2"><div className="flex justify-between gap-3"><dt className="text-muted">Proveedor</dt><dd>{suppliers.find((supplier) => supplier.id === document.supplierId)?.name ?? "—"}</dd></div><div className="flex justify-between gap-3"><dt className="text-muted">Referencia</dt><dd>{document.invoiceReference || "—"}</dd></div><div className="flex justify-between gap-3"><dt className="text-muted">Total neto</dt><dd>{formatMoney(document.netTotalCents)}</dd></div><div className="flex justify-between gap-3"><dt className="text-muted">Precios ajustados manualmente</dt><dd>{document.lines.filter((line) => line.finalPublicPriceCents !== line.suggestedPublicPriceCents || line.finalWholesalePriceCents !== line.suggestedWholesalePriceCents).length}</dd></div><div className="flex justify-between gap-3"><dt className="text-muted">Advertencias</dt><dd>{document.lines.reduce((count, line) => count + line.warnings.length, 0)}</dd></div></dl></div><p className="text-sm text-warning">El documento quedará aplicado y ya no podrá editarse.</p><div className="flex justify-end gap-2"><Button type="button" variant="secondary" onClick={() => setApplyOpen(false)}>Volver</Button><Button type="button" onClick={applyDocumentToCatalog}>Aplicar al catálogo</Button></div></div></Modal>
    <CostingProductSearchDialog tenantSlug={tenantSlug} open={dialogOpen} supplierId={supplierId || null} supplierName={suppliers.find((supplier) => supplier.id === supplierId)?.name ?? null} supplierOnly={supplierOnly} excludedProductIds={lineIds} onOpenChange={setDialogOpen} onSupplierOnlyChange={setSupplierOnly} onSelect={handleAdd} />
  </div>;
}
