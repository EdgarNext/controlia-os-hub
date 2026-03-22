import type {
  PosCashierPerformanceRow,
  PosCashiersReportData,
  PosReportsOverviewViewModel,
} from "@/types/pos-reports";
import type { NormalizedPosReportsFilters } from "./filters";

type PosUserSourceRow = {
  id: string;
  name: string;
  role: string;
  is_active: boolean;
};

export function buildPosCashiersReportData(input: {
  filters: NormalizedPosReportsFilters;
  overview: PosReportsOverviewViewModel;
  posUsers: PosUserSourceRow[];
}): PosCashiersReportData {
  const cashiers: PosCashierPerformanceRow[] = input.posUsers
    .map((row) => ({
      cashier_id: row.id,
      cashier_name: row.name,
      cashier_role: row.role,
      is_active: row.is_active,
      gross_cents: null,
      orders_count: null,
      average_ticket_cents: null,
      share_percent: null,
      attribution_status: "pending-canonical-source" as const,
    }))
    .sort((left, right) => left.cashier_name.localeCompare(right.cashier_name));

  return {
    filters: {
      date_from: input.filters.date_from,
      date_to: input.filters.date_to,
      sale_channel: input.filters.sale_channel,
      payment_method: input.filters.payment_method,
    },
    totals: {
      gross_cents: input.overview.totals.gross_cents,
      orders_count: input.overview.totals.orders_count,
      average_ticket_cents: input.overview.totals.average_ticket_cents,
      configured_cashiers_count: cashiers.length,
      attributed_orders_count: 0,
      unattributed_orders_count: input.overview.totals.orders_count,
    },
    cashiers,
    attribution_supported: false,
    limitation_reason:
      "El esquema actual no persiste un campo canonico que relacione orden pagada con pos_users. orders no tiene operator_user_id y created_by no sirve como fuente operativa en la data actual.",
  };
}
