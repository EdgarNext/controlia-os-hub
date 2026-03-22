import type {
  PosCashierShiftReportData,
  PosCashierShiftRow,
  PosReportsFilters,
} from "@/types/pos-reports";
import type { NormalizedPosReportsFilters } from "./filters";

type CashShiftSourceRow = {
  id: string;
  kiosk_id: string;
  kiosk_label: string;
  opened_by_pos_user_id: string;
  closed_by_pos_user_id: string | null;
  opened_by_pos_user_name: string;
  closed_by_pos_user_name: string | null;
  status: "open" | "closed" | "canceled";
  opening_float_cents: number;
  declared_cash_cents: number | null;
  opened_at: string;
  closed_at: string | null;
};

export function buildPosCashierShiftReportData(input: {
  filters: NormalizedPosReportsFilters;
  cashShifts: CashShiftSourceRow[];
}): PosCashierShiftReportData {
  const shifts: PosCashierShiftRow[] = input.cashShifts
    .map((row) => ({
      cash_shift_id: row.id,
      kiosk_id: row.kiosk_id,
      kiosk_label: row.kiosk_label,
      opened_at: row.opened_at,
      closed_at: row.closed_at,
      opening_float_cents: row.opening_float_cents,
      declared_cash_cents: row.declared_cash_cents,
      opened_by_pos_user_id: row.opened_by_pos_user_id,
      closed_by_pos_user_id: row.closed_by_pos_user_id,
      opened_by_pos_user_name: row.opened_by_pos_user_name,
      closed_by_pos_user_name: row.closed_by_pos_user_name,
      expected_cents: null,
      difference_cents: null,
      status: row.status,
    }))
    .sort((left, right) => right.opened_at.localeCompare(left.opened_at));

  return {
    filters: {
      date_from: input.filters.date_from,
      date_to: input.filters.date_to,
      sale_channel: input.filters.sale_channel,
      payment_method: input.filters.payment_method,
    } satisfies PosReportsFilters,
    totals: {
      cash_shifts_count: shifts.length,
      kiosks_with_shifts_count: new Set(shifts.map((row) => row.kiosk_id)).size,
      total_expected_cents: null,
      total_difference_cents: null,
      open_shifts_count: shifts.filter((row) => row.status === "open").length,
      closed_shifts_count: shifts.filter((row) => row.status === "closed").length,
    },
    shifts,
    monetary_reconciliation_supported: false,
    open_shift_tracking_supported: true,
    limitation_reason:
      "cash_shifts ya permite supervisar apertura, cierre, operadores y montos declarados, pero expected y difference siguen fuera de fase hasta tener una relacion canonica con ventas por shift.",
  };
}
