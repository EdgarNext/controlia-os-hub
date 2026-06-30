export type SimplePosReportsView = "income" | "products" | "orders";

export type SimplePosReportsPreset = "today" | "yesterday" | "last7" | "last30" | "custom";

export type SimplePosReportsFilters = {
  preset: SimplePosReportsPreset;
  date_from: string;
  date_to: string;
};

export type SimplePosReportsState = {
  view: SimplePosReportsView;
  filters: SimplePosReportsFilters;
  page: number;
  orderId: string | null;
  warning: string | null;
};

export type SimplePosIncomeDailyPoint = {
  date: string;
  label: string;
  gross_cents: number;
  orders_count: number;
};

export type SimplePosIncomeReport = {
  filters: SimplePosReportsFilters;
  totals: {
    gross_cents: number;
    orders_count: number;
    average_ticket_cents: number;
    paid_orders_count: number;
    printed_orders_count: number;
  };
  daily: SimplePosIncomeDailyPoint[];
};

export type SimplePosProductRow = {
  catalog_item_id: string;
  product_name: string;
  category_name: string | null;
  product_type: string | null;
  product_class: string | null;
  is_active: boolean | null;
  is_sold_out: boolean | null;
  is_popular: boolean | null;
  units_sold: number;
  revenue_cents: number;
  order_count: number;
  average_unit_price_cents: number;
};

export type SimplePosProductsReport = {
  filters: SimplePosReportsFilters;
  totals: {
    revenue_cents: number;
    units_sold: number;
    distinct_products_count: number;
  };
  top_by_units: SimplePosProductRow[];
  top_by_revenue: SimplePosProductRow[];
  rows: SimplePosProductRow[];
};

export type SimplePosOrderListItem = {
  id: string;
  folio_number: number;
  folio_text: string;
  status: string;
  total_cents: number;
  payment_received_cents: number | null;
  change_cents: number | null;
  payment_method: string | null;
  print_status: string;
  created_at: string;
  is_tab: boolean | null;
};

export type SimplePosOrderDetailItem = {
  id: string;
  catalog_item_id: string;
  product_name: string;
  category_name: string | null;
  qty: number;
  unit_price_cents: number;
  line_total_cents: number;
};

export type SimplePosOrderDetail = {
  order: SimplePosOrderListItem;
  items: SimplePosOrderDetailItem[];
};

export type SimplePosOrdersReport = {
  filters: SimplePosReportsFilters;
  totals: {
    gross_cents: number;
    paid_orders_count: number;
    average_ticket_cents: number;
    printed_orders_count: number;
  };
  page: number;
  page_size: number;
  total_count: number;
  total_pages: number;
  rows: SimplePosOrderListItem[];
  selected_order: SimplePosOrderDetail | null;
};
