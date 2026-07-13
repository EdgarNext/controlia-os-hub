import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import type { RetailPosDeviceRole, RetailPosZReportV1 } from "@/shared/types/retail-pos";

type RetailReportsFiltersInput = {
  dateFrom?: string | null;
  dateTo?: string | null;
  deviceId?: string | null;
  orderStatus?: "all" | "pending_payment" | "paid" | "cancelled" | null;
};

type RetailReportsFilters = {
  dateFrom: string;
  dateTo: string;
  deviceId: string | null;
  orderStatus: "all" | "pending_payment" | "paid" | "cancelled";
};

type RetailDeviceOption = {
  id: string;
  name: string;
  role: RetailPosDeviceRole;
};

type RetailOrderRow = {
  id: string;
  tenant_id: string;
  folio: string;
  origin_local_folio: string | null;
  status: "pending_payment" | "paid" | "cancelled";
  origin_device_id: string;
  created_by_pos_user_id: string;
  cashier_pos_user_id: string | null;
  paid_by_device_id: string | null;
  subtotal_cents: number;
  discount_cents: number;
  total_cents: number;
  paid_at: string | null;
  cancelled_at: string | null;
  cancel_reason: string | null;
  created_at: string;
};

type RetailOrderLineRow = {
  order_id: string;
  product_id: string;
  product_variant_id: string | null;
  product_name: string;
  variant_name: string | null;
  sku: string | null;
  sales_unit_label: string;
  quantity: string | number;
  unit_price_cents: number;
  line_total_cents: number;
};

type RetailPaymentRow = {
  id: string;
  order_id: string;
  cash_shift_id: string;
  device_id: string;
  pos_user_id: string;
  payment_method: "cash" | "card";
  amount_cents: number;
  received_amount_cents: number | null;
  change_cents: number;
  paid_at: string;
};

type RetailCashShiftRow = {
  id: string;
  device_id: string;
  opened_by_pos_user_id: string;
  closed_by_pos_user_id: string | null;
  status: "open" | "closed" | "canceled";
  opening_float_cents: number;
  expected_cash_cents: number | null;
  declared_cash_cents: number | null;
  difference_cents: number | null;
  opened_at: string;
  closed_at: string | null;
  closing_note: string | null;
};

type RetailTicketEventRow = {
  order_id: string;
  ticket_type: "order" | "payment";
  event_type: "printed" | "reprinted" | "print_failed";
  created_at: string;
};

type PosUserRow = {
  id: string;
  name: string | null;
};

type DeviceRow = {
  id: string;
  name: string;
  status: string;
};

type DeviceSettingsRow = {
  device_id: string;
  device_role: RetailPosDeviceRole;
};

type TenantRow = {
  id: string;
  name: string;
};

export type RetailReportsPageFilters = RetailReportsFilters;

export type RetailReportsOverview = {
  businessDateLabel: string;
  dateRangeLabel: string;
  filters: RetailReportsFilters;
  devices: RetailDeviceOption[];
  summary: {
    totalOrders: number;
    paidOrders: number;
    pendingOrders: number;
    cancelledOrders: number;
    grossSalesCents: number;
    discountsCents: number;
    netSalesCents: number;
    cashCents: number;
    cardCents: number;
    averageTicketCents: number;
    soldLinesCount: number;
    soldUnits: number;
  };
  paymentMethods: Array<{
    method: "cash" | "card";
    paymentsCount: number;
    totalCents: number;
  }>;
  audit: {
    printedCount: number;
    reprintedCount: number;
    failedPrintCount: number;
    paymentPrintedCount: number;
    paymentReprintedCount: number;
    orderPrintedCount: number;
    orderReprintedCount: number;
    note: string;
  };
  recentOrders: Array<{
    orderId: string;
    folio: string;
    localFolio: string | null;
    status: "pending_payment" | "paid" | "cancelled";
    totalCents: number;
    paymentMethod: "cash" | "card" | null;
    originDeviceName: string | null;
    paidDeviceName: string | null;
    createdAt: string;
    paidAt: string | null;
    cancelledAt: string | null;
    cancelReason: string | null;
  }>;
};

export type RetailCashShiftReport = {
  filters: RetailReportsFilters;
  devices: RetailDeviceOption[];
  rows: Array<{
    cashShiftId: string;
    deviceName: string | null;
    openedByName: string | null;
    closedByName: string | null;
    openedAt: string;
    closedAt: string | null;
    status: "open" | "closed" | "canceled";
    openingFloatCents: number;
    expectedCashCents: number | null;
    declaredCashCents: number | null;
    differenceCents: number | null;
    cashSalesCents: number;
    cardSalesCents: number;
    totalSalesCents: number;
    paymentsCount: number;
    ordersCount: number;
    closingNote: string | null;
  }>;
  totals: {
    shiftsCount: number;
    openShiftsCount: number;
    closedShiftsCount: number;
    totalExpectedCashCents: number;
    totalDeclaredCashCents: number;
    totalDifferenceCents: number;
    totalCashSalesCents: number;
    totalCardSalesCents: number;
    totalSalesCents: number;
  };
};

export type RetailSalesReport = {
  filters: RetailReportsFilters;
  devices: RetailDeviceOption[];
  summary: RetailReportsOverview["summary"];
  paymentMethods: RetailReportsOverview["paymentMethods"];
  orders: RetailReportsOverview["recentOrders"];
};

export type RetailProductsReport = {
  filters: RetailReportsFilters;
  devices: RetailDeviceOption[];
  rows: Array<{
    productKey: string;
    productName: string;
    variantName: string | null;
    sku: string | null;
    unitLabel: string;
    quantitySold: number;
    totalSoldCents: number;
    ordersCount: number;
    averageUnitPriceCents: number;
  }>;
  totals: {
    distinctProducts: number;
    quantitySold: number;
    totalSoldCents: number;
  };
};

type RetailPosZReportPaymentRow = RetailPaymentRow;

type RetailPosZReportOrderRow = RetailOrderRow;

type RetailPosZReportOrderLineRow = {
  order_id: string;
  quantity: string | number;
};

type RetailPosZReportShiftRow = RetailCashShiftRow & {
  tenant_id: string;
};

function getMexicoCityToday() {
  const now = new Date();
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Mexico_City",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  return formatter.format(now);
}

function normalizeDateOnly(value: string | null | undefined, fallback: string) {
  if (typeof value !== "string") {
    return fallback;
  }

  const normalized = value.trim();
  return /^\d{4}-\d{2}-\d{2}$/.test(normalized) ? normalized : fallback;
}

function normalizeDeviceId(value: string | null | undefined) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function normalizeOrderStatus(
  value: string | null | undefined,
): "all" | "pending_payment" | "paid" | "cancelled" {
  if (value === "pending_payment" || value === "paid" || value === "cancelled") {
    return value;
  }

  return "all";
}

function buildFilters(input?: RetailReportsFiltersInput): RetailReportsFilters {
  const today = getMexicoCityToday();
  const dateFrom = normalizeDateOnly(input?.dateFrom, today);
  const rawDateTo = normalizeDateOnly(input?.dateTo, dateFrom);
  const dateTo = rawDateTo < dateFrom ? dateFrom : rawDateTo;

  return {
    dateFrom,
    dateTo,
    deviceId: normalizeDeviceId(input?.deviceId),
    orderStatus: normalizeOrderStatus(input?.orderStatus),
  };
}

function parseQuantity(value: string | number) {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : 0;
  }

  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function parseTimeZoneOffsetMinutes(value: string) {
  if (value === "GMT" || value === "UTC") {
    return 0;
  }

  const match = value.match(/^(?:GMT|UTC)([+-])(\d{1,2})(?::?(\d{2}))?$/);
  if (!match) {
    return 0;
  }

  const [, sign, hoursText, minutesText] = match;
  const totalMinutes = Number.parseInt(hoursText, 10) * 60 + Number.parseInt(minutesText ?? "0", 10);
  return sign === "-" ? -totalMinutes : totalMinutes;
}

function getTimeZoneOffsetMinutes(date: Date, timeZone: string) {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone,
    timeZoneName: "shortOffset",
    hour: "2-digit",
    minute: "2-digit",
  });
  const offsetPart = formatter.formatToParts(date).find((part) => part.type === "timeZoneName")?.value;

  return parseTimeZoneOffsetMinutes(offsetPart ?? "UTC");
}

function getMexicoCityDayBoundaryIso(dateOnly: string, dayOffset: number) {
  const [year, month, day] = dateOnly.split("-").map((value) => Number.parseInt(value, 10));
  const utcGuess = new Date(Date.UTC(year, month - 1, day + dayOffset, 0, 0, 0, 0));
  let utcDate = utcGuess;

  for (let iteration = 0; iteration < 2; iteration += 1) {
    const offsetMinutes = getTimeZoneOffsetMinutes(utcDate, "America/Mexico_City");
    utcDate = new Date(utcGuess.getTime() - offsetMinutes * 60_000);
  }

  return utcDate.toISOString();
}

function startOfDayIso(dateOnly: string) {
  return getMexicoCityDayBoundaryIso(dateOnly, 0);
}

function endExclusiveIso(dateOnly: string) {
  return getMexicoCityDayBoundaryIso(dateOnly, 1);
}

function isWithinRange(value: string | null, startIso: string, endIso: string) {
  if (!value) {
    return false;
  }

  return value >= startIso && value < endIso;
}

function formatDateRangeLabel(filters: RetailReportsFilters) {
  if (filters.dateFrom === filters.dateTo) {
    return filters.dateFrom;
  }

  return `${filters.dateFrom} -> ${filters.dateTo}`;
}

function getBusinessDateLabel(filters: RetailReportsFilters) {
  return filters.dateFrom === filters.dateTo ? filters.dateFrom : formatDateRangeLabel(filters);
}

function buildPaymentMethodSummary(payments: RetailPaymentRow[]) {
  const cash = payments.filter((payment) => payment.payment_method === "cash");
  const card = payments.filter((payment) => payment.payment_method === "card");

  return [
    {
      method: "cash" as const,
      paymentsCount: cash.length,
      totalCents: cash.reduce((sum, payment) => sum + payment.amount_cents, 0),
    },
    {
      method: "card" as const,
      paymentsCount: card.length,
      totalCents: card.reduce((sum, payment) => sum + payment.amount_cents, 0),
    },
  ];
}

function buildAudit(ticketEvents: RetailTicketEventRow[]) {
  const printedCount = ticketEvents.filter((event) => event.event_type === "printed").length;
  const reprintedCount = ticketEvents.filter((event) => event.event_type === "reprinted").length;
  const failedPrintCount = ticketEvents.filter((event) => event.event_type === "print_failed").length;
  const paymentPrintedCount = ticketEvents.filter(
    (event) => event.ticket_type === "payment" && event.event_type === "printed",
  ).length;
  const paymentReprintedCount = ticketEvents.filter(
    (event) => event.ticket_type === "payment" && event.event_type === "reprinted",
  ).length;
  const orderPrintedCount = ticketEvents.filter(
    (event) => event.ticket_type === "order" && event.event_type === "printed",
  ).length;
  const orderReprintedCount = ticketEvents.filter(
    (event) => event.ticket_type === "order" && event.event_type === "reprinted",
  ).length;

  return {
    printedCount,
    reprintedCount,
    failedPrintCount,
    paymentPrintedCount,
    paymentReprintedCount,
    orderPrintedCount,
    orderReprintedCount,
    note:
      ticketEvents.length === 0
        ? "La evidencia de impresion aun no ha sido validada en terminal real."
        : "Las metricas de impresion se muestran solo con evidencia registrada en retail_pos_ticket_events.",
  };
}

function getOrderActivityTimestamp(order: RetailOrderRow) {
  return order.paid_at ?? order.cancelled_at ?? order.created_at;
}

async function loadBaseRetailReportData(tenantId: string, filtersInput?: RetailReportsFiltersInput) {
  const filters = buildFilters(filtersInput);
  const startIso = startOfDayIso(filters.dateFrom);
  const endIso = endExclusiveIso(filters.dateTo);
  const supabase = getSupabaseAdminClient();

  const [
    devicesResult,
    settingsResult,
    usersResult,
    createdOrdersResult,
    paidOrdersResult,
    cancelledOrdersResult,
    paymentsResult,
    shiftsResult,
    ticketEventsResult,
  ] =
    await Promise.all([
      supabase.from("pos_devices").select("id, name, status").eq("tenant_id", tenantId).returns<DeviceRow[]>(),
      supabase
        .from("retail_pos_device_settings")
        .select("device_id, device_role")
        .eq("tenant_id", tenantId)
        .eq("is_active", true)
        .returns<DeviceSettingsRow[]>(),
      supabase.from("pos_users").select("id, name").eq("tenant_id", tenantId).returns<PosUserRow[]>(),
      supabase
        .from("retail_pos_orders")
        .select(
          "id, tenant_id, folio, origin_local_folio, status, origin_device_id, created_by_pos_user_id, cashier_pos_user_id, paid_by_device_id, subtotal_cents, discount_cents, total_cents, paid_at, cancelled_at, cancel_reason, created_at",
        )
        .eq("tenant_id", tenantId)
        .gte("created_at", startIso)
        .lt("created_at", endIso)
        .order("created_at", { ascending: false })
        .returns<RetailOrderRow[]>(),
      supabase
        .from("retail_pos_orders")
        .select(
          "id, tenant_id, folio, origin_local_folio, status, origin_device_id, created_by_pos_user_id, cashier_pos_user_id, paid_by_device_id, subtotal_cents, discount_cents, total_cents, paid_at, cancelled_at, cancel_reason, created_at",
        )
        .eq("tenant_id", tenantId)
        .not("paid_at", "is", null)
        .gte("paid_at", startIso)
        .lt("paid_at", endIso)
        .order("paid_at", { ascending: false })
        .returns<RetailOrderRow[]>(),
      supabase
        .from("retail_pos_orders")
        .select(
          "id, tenant_id, folio, origin_local_folio, status, origin_device_id, created_by_pos_user_id, cashier_pos_user_id, paid_by_device_id, subtotal_cents, discount_cents, total_cents, paid_at, cancelled_at, cancel_reason, created_at",
        )
        .eq("tenant_id", tenantId)
        .not("cancelled_at", "is", null)
        .gte("cancelled_at", startIso)
        .lt("cancelled_at", endIso)
        .order("cancelled_at", { ascending: false })
        .returns<RetailOrderRow[]>(),
      supabase
        .from("retail_pos_payments")
        .select(
          "id, order_id, cash_shift_id, device_id, pos_user_id, payment_method, amount_cents, received_amount_cents, change_cents, paid_at",
        )
        .eq("tenant_id", tenantId)
        .gte("paid_at", startIso)
        .lt("paid_at", endIso)
        .order("paid_at", { ascending: false })
        .returns<RetailPaymentRow[]>(),
      supabase
        .from("retail_pos_cash_shifts")
        .select(
          "id, device_id, opened_by_pos_user_id, closed_by_pos_user_id, status, opening_float_cents, expected_cash_cents, declared_cash_cents, difference_cents, opened_at, closed_at, closing_note",
        )
        .eq("tenant_id", tenantId)
        .order("opened_at", { ascending: false })
        .returns<RetailCashShiftRow[]>(),
      supabase
        .from("retail_pos_ticket_events")
        .select("order_id, ticket_type, event_type, created_at")
        .eq("tenant_id", tenantId)
        .gte("created_at", startIso)
        .lt("created_at", endIso)
        .returns<RetailTicketEventRow[]>(),
    ]);

  if (devicesResult.error) {
    throw new Error(`Unable to load retail devices: ${devicesResult.error.message}`);
  }
  if (settingsResult.error) {
    throw new Error(`Unable to load retail device settings: ${settingsResult.error.message}`);
  }
  if (usersResult.error) {
    throw new Error(`Unable to load retail POS users: ${usersResult.error.message}`);
  }
  if (createdOrdersResult.error) {
    throw new Error(`Unable to load retail created orders report: ${createdOrdersResult.error.message}`);
  }
  if (paidOrdersResult.error) {
    throw new Error(`Unable to load retail paid orders report: ${paidOrdersResult.error.message}`);
  }
  if (cancelledOrdersResult.error) {
    throw new Error(
      `Unable to load retail cancelled orders report: ${cancelledOrdersResult.error.message}`,
    );
  }
  if (paymentsResult.error) {
    throw new Error(`Unable to load retail payments report: ${paymentsResult.error.message}`);
  }
  if (shiftsResult.error) {
    throw new Error(`Unable to load retail cash shifts report: ${shiftsResult.error.message}`);
  }
  if (ticketEventsResult.error) {
    throw new Error(`Unable to load retail ticket events report: ${ticketEventsResult.error.message}`);
  }

  const deviceById = new Map((devicesResult.data ?? []).map((row) => [row.id, row]));
  const settingsByDeviceId = new Map((settingsResult.data ?? []).map((row) => [row.device_id, row]));
  const userById = new Map((usersResult.data ?? []).map((row) => [row.id, row]));
  const allOrders = new Map<string, RetailOrderRow>();
  const paymentsByOrderId = new Map<string, RetailPaymentRow[]>();
  const paymentsByShiftId = new Map<string, RetailPaymentRow[]>();

  for (const order of [
    ...(createdOrdersResult.data ?? []),
    ...(paidOrdersResult.data ?? []),
    ...(cancelledOrdersResult.data ?? []),
  ]) {
    allOrders.set(order.id, order);
  }

  for (const payment of paymentsResult.data ?? []) {
    const orderBucket = paymentsByOrderId.get(payment.order_id) ?? [];
    orderBucket.push(payment);
    paymentsByOrderId.set(payment.order_id, orderBucket);

    const shiftBucket = paymentsByShiftId.get(payment.cash_shift_id) ?? [];
    shiftBucket.push(payment);
    paymentsByShiftId.set(payment.cash_shift_id, shiftBucket);
  }

  const devices: RetailDeviceOption[] = (devicesResult.data ?? [])
    .map((device) => {
      const settings = settingsByDeviceId.get(device.id);
      if (!settings) {
        return null;
      }

      return {
        id: device.id,
        name: device.name,
        role: settings.device_role,
      };
    })
    .filter((device): device is RetailDeviceOption => Boolean(device))
    .sort((left, right) => left.name.localeCompare(right.name, "es-MX"));

  const orders = [...allOrders.values()]
    .sort((left, right) => getOrderActivityTimestamp(right).localeCompare(getOrderActivityTimestamp(left)))
    .filter((order) => {
    if (filters.orderStatus !== "all" && order.status !== filters.orderStatus) {
      return false;
    }

    if (!filters.deviceId) {
      return true;
    }

    if (order.origin_device_id === filters.deviceId || order.paid_by_device_id === filters.deviceId) {
      return true;
    }

      return (paymentsByOrderId.get(order.id) ?? []).some((payment) => payment.device_id === filters.deviceId);
    });

  const payments = (paymentsResult.data ?? []).filter((payment) => {
    if (!filters.deviceId) {
      return true;
    }

    return payment.device_id === filters.deviceId;
  });

  const ticketEvents = (ticketEventsResult.data ?? []).filter((event) => {
    if (!filters.deviceId) {
      return true;
    }

    const order = orders.find((candidate) => candidate.id === event.order_id);
    return Boolean(order);
  });

  const shifts = (shiftsResult.data ?? []).filter((shift) => {
    const inRange =
      isWithinRange(shift.opened_at, startIso, endIso) || isWithinRange(shift.closed_at, startIso, endIso);

    if (!inRange) {
      return false;
    }

    if (!filters.deviceId) {
      return true;
    }

    return shift.device_id === filters.deviceId;
  });

  const paidOrderIds = Array.from(
    new Set(
      orders
        .filter((order) => order.status === "paid")
        .map((order) => order.id),
    ),
  );

  const linesResult = paidOrderIds.length
    ? await supabase
        .from("retail_pos_order_lines")
        .select(
          "order_id, product_id, product_variant_id, product_name, variant_name, sku, sales_unit_label, quantity, unit_price_cents, line_total_cents",
        )
        .eq("tenant_id", tenantId)
        .in("order_id", paidOrderIds)
        .returns<RetailOrderLineRow[]>()
    : { data: [] as RetailOrderLineRow[], error: null };

  if (linesResult.error) {
    throw new Error(`Unable to load retail order lines report: ${linesResult.error.message}`);
  }

  return {
    filters,
    devices,
    userById,
    deviceById,
    settingsByDeviceId,
    orders,
    payments,
    paymentsByOrderId,
    paymentsByShiftId,
    shifts,
    ticketEvents,
    lines: linesResult.data ?? [],
    startIso,
    endIso,
  };
}

export async function getRetailReportsOverview(
  tenantId: string,
  filtersInput?: RetailReportsFiltersInput,
): Promise<RetailReportsOverview> {
  const data = await loadBaseRetailReportData(tenantId, filtersInput);
  const paidOrders = data.orders.filter((order) => order.status === "paid");
  const soldLines = data.lines;
  const soldUnits = soldLines.reduce((sum, line) => sum + parseQuantity(line.quantity), 0);
  const paymentMethods = buildPaymentMethodSummary(data.payments);

  return {
    businessDateLabel: getBusinessDateLabel(data.filters),
    dateRangeLabel: formatDateRangeLabel(data.filters),
    filters: data.filters,
    devices: data.devices,
    summary: {
      totalOrders: data.orders.length,
      paidOrders: paidOrders.length,
      pendingOrders: data.orders.filter((order) => order.status === "pending_payment").length,
      cancelledOrders: data.orders.filter((order) => order.status === "cancelled").length,
      grossSalesCents: paidOrders.reduce((sum, order) => sum + order.subtotal_cents, 0),
      discountsCents: paidOrders.reduce((sum, order) => sum + order.discount_cents, 0),
      netSalesCents: paidOrders.reduce((sum, order) => sum + order.total_cents, 0),
      cashCents: paymentMethods.find((row) => row.method === "cash")?.totalCents ?? 0,
      cardCents: paymentMethods.find((row) => row.method === "card")?.totalCents ?? 0,
      averageTicketCents:
        paidOrders.length > 0
          ? Math.round(paidOrders.reduce((sum, order) => sum + order.total_cents, 0) / paidOrders.length)
          : 0,
      soldLinesCount: soldLines.length,
      soldUnits,
    },
    paymentMethods,
    audit: buildAudit(data.ticketEvents),
    recentOrders: data.orders.slice(0, 25).map((order) => {
      const firstPayment = (data.paymentsByOrderId.get(order.id) ?? [])[0] ?? null;

      return {
        orderId: order.id,
        folio: order.folio,
        localFolio: order.origin_local_folio,
        status: order.status,
        totalCents: order.total_cents,
        paymentMethod: firstPayment?.payment_method ?? null,
        originDeviceName: data.deviceById.get(order.origin_device_id)?.name ?? null,
        paidDeviceName: order.paid_by_device_id ? data.deviceById.get(order.paid_by_device_id)?.name ?? null : null,
        createdAt: order.created_at,
        paidAt: order.paid_at,
        cancelledAt: order.cancelled_at,
        cancelReason: order.cancel_reason,
      };
    }),
  };
}

export async function getRetailCashShiftReport(
  tenantId: string,
  filtersInput?: RetailReportsFiltersInput,
): Promise<RetailCashShiftReport> {
  const data = await loadBaseRetailReportData(tenantId, filtersInput);
  const rows = data.shifts.map((shift) => {
    const payments = data.paymentsByShiftId.get(shift.id) ?? [];
    const cashSalesCents = payments
      .filter((payment) => payment.payment_method === "cash")
      .reduce((sum, payment) => sum + payment.amount_cents, 0);
    const cardSalesCents = payments
      .filter((payment) => payment.payment_method === "card")
      .reduce((sum, payment) => sum + payment.amount_cents, 0);
    const ordersCount = new Set(payments.map((payment) => payment.order_id)).size;

    return {
      cashShiftId: shift.id,
      deviceName: data.deviceById.get(shift.device_id)?.name ?? null,
      openedByName: data.userById.get(shift.opened_by_pos_user_id)?.name ?? null,
      closedByName: shift.closed_by_pos_user_id ? data.userById.get(shift.closed_by_pos_user_id)?.name ?? null : null,
      openedAt: shift.opened_at,
      closedAt: shift.closed_at,
      status: shift.status,
      openingFloatCents: shift.opening_float_cents,
      expectedCashCents: shift.expected_cash_cents,
      declaredCashCents: shift.declared_cash_cents,
      differenceCents: shift.difference_cents,
      cashSalesCents,
      cardSalesCents,
      totalSalesCents: cashSalesCents + cardSalesCents,
      paymentsCount: payments.length,
      ordersCount,
      closingNote: shift.closing_note,
    };
  });

  return {
    filters: data.filters,
    devices: data.devices,
    rows,
    totals: {
      shiftsCount: rows.length,
      openShiftsCount: rows.filter((row) => row.status === "open").length,
      closedShiftsCount: rows.filter((row) => row.status === "closed").length,
      totalExpectedCashCents: rows.reduce((sum, row) => sum + (row.expectedCashCents ?? 0), 0),
      totalDeclaredCashCents: rows.reduce((sum, row) => sum + (row.declaredCashCents ?? 0), 0),
      totalDifferenceCents: rows.reduce((sum, row) => sum + (row.differenceCents ?? 0), 0),
      totalCashSalesCents: rows.reduce((sum, row) => sum + row.cashSalesCents, 0),
      totalCardSalesCents: rows.reduce((sum, row) => sum + row.cardSalesCents, 0),
      totalSalesCents: rows.reduce((sum, row) => sum + row.totalSalesCents, 0),
    },
  };
}

export async function getRetailSalesReport(
  tenantId: string,
  filtersInput?: RetailReportsFiltersInput,
): Promise<RetailSalesReport> {
  const overview = await getRetailReportsOverview(tenantId, filtersInput);

  return {
    filters: overview.filters,
    devices: overview.devices,
    summary: overview.summary,
    paymentMethods: overview.paymentMethods,
    orders: overview.recentOrders,
  };
}

export async function getRetailProductsReport(
  tenantId: string,
  filtersInput?: RetailReportsFiltersInput,
): Promise<RetailProductsReport> {
  const data = await loadBaseRetailReportData(tenantId, filtersInput);
  const aggregate = new Map<
    string,
    {
      productKey: string;
      productName: string;
      variantName: string | null;
      sku: string | null;
      unitLabel: string;
      quantitySold: number;
      totalSoldCents: number;
      orderIds: Set<string>;
      weightedUnitPriceTotal: number;
    }
  >();

  for (const line of data.lines) {
    const key = [
      line.product_id,
      line.product_variant_id ?? "base",
      line.product_name,
      line.variant_name ?? "",
      line.sku ?? "",
      line.sales_unit_label,
    ].join("::");
    const current = aggregate.get(key) ?? {
      productKey: key,
      productName: line.product_name,
      variantName: line.variant_name,
      sku: line.sku,
      unitLabel: line.sales_unit_label,
      quantitySold: 0,
      totalSoldCents: 0,
      orderIds: new Set<string>(),
      weightedUnitPriceTotal: 0,
    };
    const quantity = parseQuantity(line.quantity);

    current.quantitySold += quantity;
    current.totalSoldCents += line.line_total_cents;
    current.orderIds.add(line.order_id);
    current.weightedUnitPriceTotal += line.unit_price_cents * quantity;
    aggregate.set(key, current);
  }

  const rows = [...aggregate.values()]
    .map((row) => ({
      productKey: row.productKey,
      productName: row.productName,
      variantName: row.variantName,
      sku: row.sku,
      unitLabel: row.unitLabel,
      quantitySold: row.quantitySold,
      totalSoldCents: row.totalSoldCents,
      ordersCount: row.orderIds.size,
      averageUnitPriceCents:
        row.quantitySold > 0 ? Math.round(row.weightedUnitPriceTotal / row.quantitySold) : 0,
    }))
    .sort((left, right) => right.totalSoldCents - left.totalSoldCents);

  return {
    filters: data.filters,
    devices: data.devices,
    rows,
    totals: {
      distinctProducts: rows.length,
      quantitySold: rows.reduce((sum, row) => sum + row.quantitySold, 0),
      totalSoldCents: rows.reduce((sum, row) => sum + row.totalSoldCents, 0),
    },
  };
}

export async function getRetailPosZReportByCashShift(params: {
  tenantId: string;
  shiftId: string;
}): Promise<RetailPosZReportV1> {
  const supabase = getSupabaseAdminClient();
  const warnings: RetailPosZReportV1["warnings"] = [];

  const [tenantResult, shiftResult] = await Promise.all([
    supabase.from("tenants").select("id, name").eq("id", params.tenantId).limit(1).maybeSingle<TenantRow>(),
    supabase
      .from("retail_pos_cash_shifts")
      .select(
        "id, tenant_id, device_id, opened_by_pos_user_id, closed_by_pos_user_id, status, opening_float_cents, expected_cash_cents, declared_cash_cents, difference_cents, opened_at, closed_at, closing_note",
      )
      .eq("tenant_id", params.tenantId)
      .eq("id", params.shiftId)
      .limit(1)
      .maybeSingle<RetailPosZReportShiftRow>(),
  ]);

  if (tenantResult.error) {
    throw new Error(`Unable to load retail tenant for Z report: ${tenantResult.error.message}`);
  }

  if (shiftResult.error) {
    throw new Error(`Unable to load retail cash shift for Z report: ${shiftResult.error.message}`);
  }

  const shift = shiftResult.data;
  if (!shift) {
    throw new Error("RETAIL_POS_Z_REPORT_NOT_FOUND");
  }

  if (shift.status === "open") {
    warnings.push({
      code: "shift_open",
      message: "El turno sigue abierto. Esta vista es operativa y no representa un Reporte Z final.",
    });
  }

  if (shift.status === "canceled") {
    warnings.push({
      code: "shift_canceled",
      message: "El turno está cancelado. La lectura se muestra solo como referencia administrativa.",
    });
  }

  const [deviceResult, settingsResult, usersResult, paymentsResult] = await Promise.all([
    supabase.from("pos_devices").select("id, name").eq("tenant_id", params.tenantId).eq("id", shift.device_id).limit(1).maybeSingle<DeviceRow>(),
    supabase
      .from("retail_pos_device_settings")
      .select("device_id, device_role")
      .eq("tenant_id", params.tenantId)
      .eq("device_id", shift.device_id)
      .eq("is_active", true)
      .limit(1)
      .maybeSingle<DeviceSettingsRow>(),
    supabase.from("pos_users").select("id, name").eq("tenant_id", params.tenantId).returns<PosUserRow[]>(),
    supabase
      .from("retail_pos_payments")
      .select("id, order_id, cash_shift_id, device_id, pos_user_id, payment_method, amount_cents, received_amount_cents, change_cents, paid_at")
      .eq("tenant_id", params.tenantId)
      .eq("cash_shift_id", shift.id)
      .order("paid_at", { ascending: true })
      .returns<RetailPosZReportPaymentRow[]>(),
  ]);

  if (deviceResult.error) {
    throw new Error(`Unable to load retail device for Z report: ${deviceResult.error.message}`);
  }
  if (settingsResult.error) {
    throw new Error(`Unable to load retail device settings for Z report: ${settingsResult.error.message}`);
  }
  if (usersResult.error) {
    throw new Error(`Unable to load retail POS users for Z report: ${usersResult.error.message}`);
  }
  if (paymentsResult.error) {
    throw new Error(`Unable to load retail payments for Z report: ${paymentsResult.error.message}`);
  }

  const userById = new Map((usersResult.data ?? []).map((row) => [row.id, row]));
  const payments = paymentsResult.data ?? [];
  const orderIds = Array.from(new Set(payments.map((payment) => payment.order_id)));

  const ordersResult = orderIds.length
    ? await supabase
        .from("retail_pos_orders")
        .select(
          "id, tenant_id, folio, origin_local_folio, status, origin_device_id, created_by_pos_user_id, cashier_pos_user_id, paid_by_device_id, subtotal_cents, discount_cents, total_cents, paid_at, cancelled_at, cancel_reason, created_at",
        )
        .eq("tenant_id", params.tenantId)
        .in("id", orderIds)
        .returns<RetailPosZReportOrderRow[]>()
    : { data: [] as RetailPosZReportOrderRow[], error: null };

  if (ordersResult.error) {
    throw new Error(`Unable to load retail orders for Z report: ${ordersResult.error.message}`);
  }

  const orders = ordersResult.data ?? [];
  const orderById = new Map(orders.map((order) => [order.id, order]));
  const missingOrderIds = orderIds.filter((orderId) => !orderById.has(orderId));

  if (missingOrderIds.length > 0) {
    warnings.push({
      code: "missing_orders",
      message: `Se omitieron ${missingOrderIds.length} pagos porque sus órdenes no pudieron cargarse.`,
    });
  }

  const validOrderIds = orderIds.filter((orderId) => orderById.has(orderId));
  const linesResult = validOrderIds.length
    ? await supabase
        .from("retail_pos_order_lines")
        .select("order_id, quantity")
        .eq("tenant_id", params.tenantId)
        .in("order_id", validOrderIds)
        .returns<RetailPosZReportOrderLineRow[]>()
    : { data: [] as RetailPosZReportOrderLineRow[], error: null };

  if (linesResult.error) {
    throw new Error(`Unable to load retail order lines for Z report: ${linesResult.error.message}`);
  }

  const lines = linesResult.data ?? [];
  const cashPayments = payments.filter((payment) => payment.payment_method === "cash");
  const cardPayments = payments.filter((payment) => payment.payment_method === "card");
  const cashSalesCents = cashPayments.reduce((sum, payment) => sum + payment.amount_cents, 0);
  const cardSalesCents = cardPayments.reduce((sum, payment) => sum + payment.amount_cents, 0);
  const totalSalesCents = cashSalesCents + cardSalesCents;
  const paidOrders = validOrderIds
    .map((orderId) => orderById.get(orderId))
    .filter((order): order is RetailPosZReportOrderRow => Boolean(order));
  const paidOrdersCount = paidOrders.length;
  const averageTicketCents =
    paidOrdersCount > 0
      ? Math.round(paidOrders.reduce((sum, order) => sum + order.total_cents, 0) / paidOrdersCount)
      : 0;

  const expectedCashCents =
    typeof shift.expected_cash_cents === "number"
      ? shift.expected_cash_cents
      : shift.opening_float_cents + cashSalesCents;
  if (shift.expected_cash_cents === null) {
    warnings.push({
      code: "expected_cash_recalculated",
      message: "El efectivo esperado no estaba persistido y se recalculó desde fondo inicial + pagos en efectivo.",
    });
  }

  const differenceCents =
    typeof shift.difference_cents === "number"
      ? shift.difference_cents
      : typeof shift.declared_cash_cents === "number"
        ? shift.declared_cash_cents - expectedCashCents
        : null;
  if (shift.difference_cents === null && typeof shift.declared_cash_cents === "number") {
    warnings.push({
      code: "difference_recalculated",
      message: "La diferencia no estaba persistida y se recalculó desde efectivo declarado - efectivo esperado.",
    });
  }

  if (payments.length === 0) {
    warnings.push({
      code: "shift_without_payments",
      message: "Este turno no tiene pagos asociados. El Reporte Z v1 se muestra con montos en cero.",
    });
  }

  if (!settingsResult.data) {
    warnings.push({
      code: "missing_device_role",
      message: "No se encontró configuración activa de rol para la terminal del turno.",
    });
  }

  return {
    tenantId: params.tenantId,
    tenantName: tenantResult.data?.name ?? null,
    cashShiftId: shift.id,
    status: shift.status,
    deviceId: shift.device_id,
    deviceName: deviceResult.data?.name ?? null,
    deviceRole: settingsResult.data?.device_role ?? null,
    openedAt: shift.opened_at,
    closedAt: shift.closed_at,
    generatedAt: new Date().toISOString(),
    openedByPosUserId: shift.opened_by_pos_user_id,
    openedByName: userById.get(shift.opened_by_pos_user_id)?.name ?? null,
    closedByPosUserId: shift.closed_by_pos_user_id,
    closedByName: shift.closed_by_pos_user_id ? userById.get(shift.closed_by_pos_user_id)?.name ?? null : null,
    openingFloatCents: shift.opening_float_cents,
    cashSalesCents,
    cardSalesCents,
    totalSalesCents,
    expectedCashCents,
    declaredCashCents: shift.declared_cash_cents,
    differenceCents,
    paymentsCount: payments.length,
    paidOrdersCount,
    averageTicketCents,
    closingNote: shift.closing_note,
    future: {
      discountsCents: paidOrders.reduce((sum, order) => sum + order.discount_cents, 0),
      cancellationsCount: null,
      cancellationsAmountCents: null,
      returnsCount: null,
      returnsAmountCents: null,
      pendingSyncPaymentsCount: null,
      pendingSyncAmountCents: null,
    },
    printEvidence: {
      status: "not_available",
      printedCount: null,
      reprintedCount: null,
      failedCount: null,
      note: "La evidencia formal de impresión/reimpresión de Reporte Z no está modelada en v1.",
    },
    paymentMethods: [
      {
        method: "cash",
        paymentsCount: cashPayments.length,
        totalCents: cashSalesCents,
      },
      {
        method: "card",
        paymentsCount: cardPayments.length,
        totalCents: cardSalesCents,
      },
    ],
    orders: paidOrders
      .map((order) => {
        const firstPayment = payments.find((payment) => payment.order_id === order.id) ?? null;
        return {
          orderId: order.id,
          folio: order.folio,
          paidAt: order.paid_at,
          totalCents: order.total_cents,
          paymentMethod: firstPayment?.payment_method ?? null,
        };
      })
      .sort((left, right) => (right.paidAt ?? "").localeCompare(left.paidAt ?? "")),
    linesSummary: {
      soldLinesCount: lines.length,
      soldUnits: lines.reduce((sum, line) => sum + parseQuantity(line.quantity), 0),
    },
    warnings,
  };
}
