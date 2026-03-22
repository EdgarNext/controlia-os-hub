export type PosReportPaymentMethod = "cash" | "card" | "employee";

export type PosReportSaleChannel = "all" | "quick-sale" | "tabs";

export type PosReportsFilters = {
  date_from: string;
  date_to: string;
  sale_channel: PosReportSaleChannel;
  payment_method: PosReportPaymentMethod | "all";
};

export type PosReportsDailyAggregateRow = {
  business_date_mx: string;
  is_tab: boolean;
  orders_count: number;
  gross_cents: number;
  cash_cents: number;
  card_cents: number;
  employee_cents: number;
  updated_at: string;
};

export type PosReportsOverviewViewModel = {
  filters: PosReportsFilters;
  totals: {
    orders_count: number;
    gross_cents: number;
    cash_cents: number;
    card_cents: number;
    employee_cents: number;
    average_ticket_cents: number;
  };
  daily: PosReportsDailyAggregateRow[];
};

export type PosReportOrderListItem = {
  id: string;
  tenant_id: string;
  kiosk_id: string;
  folio_number: number;
  folio_text: string;
  status: string;
  total_cents: number;
  payment_received_cents: number | null;
  change_cents: number | null;
  payment_method: PosReportPaymentMethod | null;
  print_status: string;
  print_attempt_count: number;
  last_print_error: string | null;
  last_print_at: string | null;
  created_at: string;
  closed_at?: string | null;
  is_tab?: boolean | null;
};

export type PosSalesTrendPoint = {
  date: string;
  label: string;
  gross_cents: number;
  orders_count: number;
  average_ticket_cents: number;
};

export type PosSalesDistributionRow = {
  key: string;
  label: string;
  gross_cents: number;
  orders_count: number;
  share_percent: number;
};

export type PosSalesVariationPoint = {
  label: string;
  gross_cents: number;
  change_cents: number;
};

export type PosSalesHighlights = {
  average_daily_sales_cents: number;
  active_days_count: number;
  best_day: {
    label: string;
    gross_cents: number;
  };
  quietest_day: {
    label: string;
    gross_cents: number;
  };
  strongest_growth: PosSalesVariationPoint | null;
  sharpest_drop: PosSalesVariationPoint | null;
};

export type PosSalesReportData = {
  filters: PosReportsFilters;
  totals: PosReportsOverviewViewModel["totals"];
  trend: PosSalesTrendPoint[];
  payment_distribution: PosSalesDistributionRow[];
  channel_distribution: PosSalesDistributionRow[];
  highlights: PosSalesHighlights;
  supports_payment_distribution: boolean;
};

export type PosProductPerformanceRow = {
  product_id: string;
  product_name: string;
  category_name: string | null;
  product_type: string | null;
  product_class: string | null;
  is_active: boolean | null;
  is_sold_out: boolean | null;
  is_popular: boolean | null;
  units_sold: number;
  gross_cents: number;
  order_count: number;
  average_unit_price_cents: number;
  share_percent: number;
  quick_sale_units: number;
  quick_sale_gross_cents: number;
  tab_units: number;
  tab_gross_cents: number;
};

export type PosProductsChartPoint = {
  product_id: string;
  label: string;
  gross_cents: number;
  units_sold: number;
  share_percent: number;
};

export type PosProductsHighlights = {
  top_revenue_product: {
    label: string;
    gross_cents: number;
    units_sold: number;
  } | null;
  top_units_product: {
    label: string;
    units_sold: number;
    gross_cents: number;
  } | null;
  low_performers: PosProductPerformanceRow[];
};

export type PosProductsReportData = {
  filters: PosReportsFilters;
  totals: {
    gross_cents: number;
    units_sold: number;
    products_sold_count: number;
    average_revenue_per_product_cents: number;
    top_five_share_percent: number;
  };
  products: PosProductPerformanceRow[];
  top_products_chart: PosProductsChartPoint[];
  highlights: PosProductsHighlights;
};

export type PosCashierPerformanceRow = {
  cashier_id: string;
  cashier_name: string;
  cashier_role: string;
  is_active: boolean;
  gross_cents: number | null;
  orders_count: number | null;
  average_ticket_cents: number | null;
  share_percent: number | null;
  attribution_status: "pending-canonical-source";
};

export type PosCashiersReportData = {
  filters: PosReportsFilters;
  totals: {
    gross_cents: number;
    orders_count: number;
    average_ticket_cents: number;
    configured_cashiers_count: number;
    attributed_orders_count: number;
    unattributed_orders_count: number;
  };
  cashiers: PosCashierPerformanceRow[];
  attribution_supported: boolean;
  limitation_reason: string;
};

export type PosCashierShiftRow = {
  cash_shift_id: string;
  kiosk_id: string;
  kiosk_label: string;
  opened_at: string;
  closed_at: string | null;
  opening_float_cents: number;
  declared_cash_cents: number | null;
  opened_by_pos_user_id: string;
  closed_by_pos_user_id: string | null;
  opened_by_pos_user_name: string;
  closed_by_pos_user_name: string | null;
  expected_cents: number | null;
  difference_cents: number | null;
  status: "open" | "closed" | "canceled";
};

export type PosCashierShiftReportData = {
  filters: PosReportsFilters;
  totals: {
    cash_shifts_count: number;
    kiosks_with_shifts_count: number;
    total_expected_cents: number | null;
    total_difference_cents: number | null;
    open_shifts_count: number;
    closed_shifts_count: number;
  };
  shifts: PosCashierShiftRow[];
  monetary_reconciliation_supported: boolean;
  open_shift_tracking_supported: boolean;
  limitation_reason: string;
};

export type PosAlertSeverity = "critical" | "medium" | "info";

export type PosAlertType =
  | "sales-gap-day"
  | "sales-concentration-top-products"
  | "cashier-attribution-unavailable"
  | "cash-shifts-without-reconciliation"
  | "sales-without-cash-shifts";

export type PosAlertItem = {
  id: string;
  severity: PosAlertSeverity;
  type: PosAlertType;
  title: string;
  description: string;
  source_report: "sales" | "products" | "cashiers" | "cashier-shift";
  context_value?: string | null;
  recommended_action?: string | null;
  href?: string | null;
};

export type PosAlertsSummary = {
  total_count: number;
  critical_count: number;
  medium_count: number;
  info_count: number;
};

export type PosAlertsReportData = {
  filters: PosReportsFilters;
  summary: PosAlertsSummary;
  alerts: PosAlertItem[];
  limitations: string[];
};
