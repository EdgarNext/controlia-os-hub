"use client";

import { SearchableSelect } from "@/components/ui/searchable-select";
import type { EventCateringConsumptionLine, EventCateringConsumptionLineAvailability } from "@/lib/kitchen/event-catering/types";
import { updateConsumptionLineAction } from "@/lib/kitchen/event-catering/actions";

type ConsumptionLineEditorProps = {
  tenantSlug: string;
  consumptionId: string;
  line: EventCateringConsumptionLine;
  availability: EventCateringConsumptionLineAvailability | null;
};

export function ConsumptionLineEditor({ tenantSlug, consumptionId, line, availability }: ConsumptionLineEditorProps) {
  const locationOptions = availability?.location_options ?? [];
  const useSearchable = locationOptions.length > 5;
  return (
    <form action={updateConsumptionLineAction} className="flex flex-wrap items-center gap-1">
      <input type="hidden" name="tenantSlug" value={tenantSlug} />
      <input type="hidden" name="consumptionId" value={consumptionId} />
      <input type="hidden" name="lineId" value={line.id} />
      <input
        name="consumedQuantity"
        type="number"
        min="0"
        step="0.0001"
        defaultValue={String(line.consumed_quantity)}
        className="h-8 w-20 rounded border border-border bg-surface px-2 text-xs"
      />
      <input
        name="wasteQuantity"
        type="number"
        min="0"
        step="0.0001"
        defaultValue={String(line.waste_quantity)}
        className="h-8 w-20 rounded border border-border bg-surface px-2 text-xs"
      />
      <input
        name="leftoverQuantity"
        type="number"
        min="0"
        step="0.0001"
        defaultValue={String(line.leftover_quantity)}
        className="h-8 w-20 rounded border border-border bg-surface px-2 text-xs"
      />
      {useSearchable ? (
        <SearchableSelect
          name="locationId"
          placeholder="Ubicación"
          defaultValue={line.location_id ?? ""}
          clearable
          className="w-64"
          options={locationOptions.map((location) => ({
            value: location.location_id,
            label: `${location.location_name} · disp ${Number(location.available_quantity).toLocaleString("es-MX", {
              minimumFractionDigits: 2,
              maximumFractionDigits: 4,
            })} · físico ${Number(location.physical_balance).toLocaleString("es-MX", { maximumFractionDigits: 4 })} · reservado otros ${Number(location.reserved_other_plans).toLocaleString("es-MX", { maximumFractionDigits: 4 })}`,
          }))}
        />
      ) : (
        <select name="locationId" defaultValue={line.location_id ?? ""} className="h-8 rounded border border-border bg-surface px-2 text-xs">
          <option value="">Sin ubicación</option>
          {locationOptions.map((location) => (
            <option key={location.location_id} value={location.location_id}>
              {location.location_name} · disp{" "}
              {Number(location.available_quantity).toLocaleString("es-MX", { minimumFractionDigits: 2, maximumFractionDigits: 4 })}
              {" · físico "}
              {Number(location.physical_balance).toLocaleString("es-MX", { maximumFractionDigits: 4 })}
              {" · otros "}
              {Number(location.reserved_other_plans).toLocaleString("es-MX", { maximumFractionDigits: 4 })}
            </option>
          ))}
        </select>
      )}
      <input name="notes" placeholder="nota" defaultValue={line.notes ?? ""} className="h-8 w-28 rounded border border-border bg-surface px-2 text-xs" />
      <button type="submit" className="inline-flex rounded border border-border bg-surface px-2 py-1 text-xs">
        Guardar
      </button>
    </form>
  );
}
