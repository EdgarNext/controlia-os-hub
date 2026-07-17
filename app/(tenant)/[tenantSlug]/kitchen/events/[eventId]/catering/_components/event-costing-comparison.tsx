import Link from "next/link";
import { ActionFeedbackForm } from "@/app/(tenant)/[tenantSlug]/kitchen/events/_components/action-feedback-form";
import type { ChefEventDetail } from "@/lib/kitchen/event-catering/chef-costing";
import type { KitchenMutationActionState } from "@/lib/kitchen/event-catering/mutation-action-state";
import { KitchenSubmitButton } from "@/app/(tenant)/[tenantSlug]/kitchen/_components/kitchen-submit-button";
import { CostingStatus } from "./costing-status";
import { UpdateCostButton } from "./update-cost-button";

function formatMoney(value: number | null): string {
  if (value == null) return "—";
  return `$${value.toLocaleString("es-MX", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function formatPercent(value: number | null): string {
  if (value == null) return "—";
  return `${value.toLocaleString("es-MX", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%`;
}

function formatDateTime(value: string | null): string {
  if (!value) return "—";
  return new Date(value).toLocaleString("es-MX", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "America/Mexico_City",
  });
}

type EventCostingComparisonProps = {
  tenantSlug: string;
  eventId: string;
  detail: ChefEventDetail;
  canManage: boolean;
  submitInitialCosting: (
    previousState: KitchenMutationActionState,
    formData: FormData,
  ) => Promise<KitchenMutationActionState>;
};

export function EventCostingComparison({
  tenantSlug,
  eventId,
  detail,
  canManage,
  submitInitialCosting,
}: EventCostingComparisonProps) {
  const isPreviewState = detail.initialPreview != null && detail.latestInitialSnapshot == null;
  const initialCostValue =
    detail.initialCostDisplay.kind === "money"
      ? formatMoney(detail.initialCostDisplay.value)
      : detail.initialCostDisplay.label;
  const updatedCostValue =
    detail.updatedCostDisplay.kind === "money"
      ? formatMoney(detail.updatedCostDisplay.value)
      : detail.updatedCostDisplay.label;
  const isHistoricalView = detail.initialCostDisplay.semantic === "historical";
  const previewTotalCost = detail.initialPreview
    ? formatMoney(detail.initialPreview.itemRows.reduce((acc, row) => acc + row.lineTotalCost, 0))
    : null;
  const previewServiceCount = detail.initialPreview?.serviceRows.length ?? 0;
  const previewRecipeCount = detail.initialPreview?.recipeRows.length ?? 0;
  const previewCostPerPerson =
    detail.initialPreview && detail.event.expected_attendance && detail.event.expected_attendance > 0
      ? formatMoney(
          detail.initialPreview.itemRows.reduce((acc, row) => acc + row.lineTotalCost, 0) /
            detail.event.expected_attendance,
        )
      : null;

  return (
    <section id="vista-previa-costo" className="rounded-[var(--radius-base)] border border-border bg-surface p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-foreground">
            {isPreviewState
              ? "Vista previa del costo"
              : !detail.configurationChanged && detail.latestInitialSnapshot
                ? "Costo inicial guardado"
                : "Resumen de costos"}
          </h2>
          <p className="mt-1 text-sm text-muted">
            {isPreviewState
              ? "Este importe usa la configuración y los precios vigentes. Al guardarlo se convertirá en el Costo inicial."
              : !detail.configurationChanged && detail.latestInitialSnapshot
                ? "Este bloque muestra el costo inicial vigente del evento y su referencia frente a precios actualizados."
                : "Compara el costo inicial guardado del evento como referencia histórica contra el costo actualizado con precios vigentes."}
          </p>
          {detail.costingMessage ? <p className="mt-2 text-sm text-muted">{detail.costingMessage}</p> : null}
          {detail.priceUpdateMessage && detail.priceUpdateLabel !== detail.costingLabel ? (
            <p className="mt-2 text-sm text-muted">{detail.priceUpdateMessage}</p>
          ) : null}
        </div>
        <CostingStatus label={detail.costingLabel} />
      </div>

      {isPreviewState ? (
        <div className="mt-4 grid gap-3 lg:grid-cols-[1.2fr_0.8fr]">
          <div className="rounded-[var(--radius-base)] border border-primary/40 bg-primary/10 p-4">
            <p className="text-xs font-medium uppercase tracking-[0.08em] text-muted">Costo estimado del evento</p>
            <p className="mt-2 text-3xl font-semibold text-foreground">{previewTotalCost}</p>
            <p className="mt-2 text-sm text-muted">
              {previewCostPerPerson ? `${previewCostPerPerson} por persona · ` : ""}
              {previewServiceCount.toLocaleString("es-MX")} servicios · {previewRecipeCount.toLocaleString("es-MX")} recetas
            </p>
            <p className="mt-3 text-sm text-muted">
              La configuración está lista. Revisa la vista previa y guarda el costo inicial para conservar esta configuración y sus precios.
            </p>
            {canManage ? (
              <ActionFeedbackForm action={submitInitialCosting} className="mt-4">
                <input type="hidden" name="tenantSlug" value={tenantSlug} />
                <input type="hidden" name="eventId" value={eventId} />
                <KitchenSubmitButton
                  disabled={!detail.canCalculateInitialCost}
                  pendingLabel="Guardando costo inicial..."
                >
                  Guardar costo inicial
                </KitchenSubmitButton>
              </ActionFeedbackForm>
            ) : null}
          </div>
          <div className="space-y-3">
            <MetricCard
              label="Último costo guardado"
              value={initialCostValue}
              detail="Corresponde a una configuración anterior."
            />
            <MetricCard
              label="Vista previa actual"
              value={previewTotalCost ?? "—"}
              detail={
                detail.latestHistoricalInitialSnapshot?.totalCost != null && detail.initialPreview
                  ? `La nueva vista previa es ${formatMoney(
                      detail.initialPreview.itemRows.reduce((acc, row) => acc + row.lineTotalCost, 0) -
                        detail.latestHistoricalInitialSnapshot.totalCost,
                    )} respecto al último costo guardado.`
                  : "Usa la configuración y los precios vigentes."
              }
            />
          </div>
        </div>
      ) : isHistoricalView ? (
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <MetricCard
            label="Último costo guardado"
            value={initialCostValue}
            detail="Corresponde a una configuración anterior."
          />
          <MetricCard
            label="Estado actual"
            value="Configuración anterior"
            detail="Genera un nuevo costo inicial antes de volver a recostear."
          />
        </div>
      ) : (
        <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
          <MetricCard
            label="Costo inicial guardado"
            value={initialCostValue}
            detail={detail.initialCostDisplay.detail}
          />
          <MetricCard
            label="Costo actualizado vigente"
            value={updatedCostValue}
            detail={detail.updatedCostDisplay.detail}
          />
          <MetricCard label="Variación por precio" value={formatMoney(detail.priceVariationAmount)} />
          <MetricCard label="Variación porcentual" value={formatPercent(detail.priceVariationPercent)} />
          <MetricCard label="Inicial por persona" value={formatMoney(detail.initialCostPerPerson)} />
          <MetricCard label="Actualizado por persona" value={formatMoney(detail.updatedCostPerPerson)} />
        </div>
      )}

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <MetricCard
          label="Fecha del costo inicial guardado"
          value={formatDateTime(
            (detail.latestInitialSnapshot ?? detail.latestHistoricalInitialSnapshot)?.createdAt ?? null,
          )}
        />
        {!isHistoricalView ? (
          <MetricCard
            label={detail.latestInitialSnapshot ? "Snapshot utilizado" : "Fecha del costo actualizado"}
            value={
              detail.latestInitialSnapshot
                ? detail.latestInitialSnapshot.id.slice(0, 8).toUpperCase()
                : formatDateTime(detail.latestUpdatedSnapshot?.createdAt ?? null)
            }
          />
        ) : null}
      </div>

      {canManage ? (
        <div className="mt-4 flex flex-wrap items-start gap-3">
          {!isPreviewState && (!detail.latestInitialSnapshot || detail.configurationChanged) ? (
            <ActionFeedbackForm action={submitInitialCosting}>
              <input type="hidden" name="tenantSlug" value={tenantSlug} />
              <input type="hidden" name="eventId" value={eventId} />
                <KitchenSubmitButton
                  disabled={!detail.canCalculateInitialCost}
                  pendingLabel="Guardando costo inicial..."
                >
                {detail.latestInitialSnapshot ? "Generar nuevo costo inicial" : "Calcular costo inicial"}
              </KitchenSubmitButton>
            </ActionFeedbackForm>
          ) : null}

          {detail.canUpdateCost ? <UpdateCostButton tenantSlug={tenantSlug} eventId={eventId} /> : null}

          {detail.priceUpdateStatus === "price_resolution_warning" ? (
            <Link
              href={`/${tenantSlug}/kitchen/inventory/price-updates`}
              className="inline-flex rounded-[var(--radius-base)] border border-border bg-surface-2 px-3 py-2 text-sm text-foreground"
            >
              Revisar precios
            </Link>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}

function MetricCard({ label, value, detail }: { label: string; value: string; detail?: string | null }) {
  return (
    <div className="rounded-[var(--radius-base)] border border-border bg-surface-2 p-3">
      <p className="text-xs text-muted">{label}</p>
      <p className="mt-1 text-base font-semibold text-foreground">{value}</p>
      {detail ? <p className="mt-1 text-xs text-muted">{detail}</p> : null}
    </div>
  );
}
