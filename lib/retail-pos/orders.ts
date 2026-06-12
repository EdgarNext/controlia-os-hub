import type {
  CancelRetailPosOrderRequest,
  CreateRetailPosOrderLineInput,
  CreateRetailPosOrderRequest,
  CreateRetailPosOrderResponse,
  GetRetailPosOrderResponse,
  RetailPosOrder,
  RetailPosOrderLine,
  UpdateRetailPosOrderRequest,
} from "../../../shared/types/retail-pos";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import {
  assertRetailPosDeviceRole,
  resolveRetailPosRuntimeActor,
  type RetailPosRuntimeActor,
} from "./auth";
import { RetailPosRuntimeError } from "./errors";
import type { RuntimePerfTrace } from "./runtime-perf";
import { runSupabaseReadWithRetry } from "./runtime-supabase-retry";
import {
  isRetailPosCanonicalQuantity,
  normalizeRetailPosQuantity,
} from "./quantity";

type ProductRow = {
  id: string;
  tenant_id: string;
  category_id: string | null;
  name: string;
  brand: string | null;
  sku: string | null;
  barcode: string | null;
  unit_price_cents: number;
  sales_unit_code: string;
  sales_unit_label: string;
  allow_decimal_quantity: boolean;
  has_variants: boolean;
  is_active: boolean;
  deleted_at: string | null;
};

type VariantRow = {
  id: string;
  tenant_id: string;
  product_id: string;
  name: string;
  sku: string | null;
  barcode: string | null;
  unit_price_cents: number | null;
  is_default: boolean;
  is_active: boolean;
  sort_order: number;
  deleted_at: string | null;
};

type PosUserRow = {
  id: string;
  tenant_id: string;
  name: string;
  role: "cashier" | "supervisor" | "admin";
  is_active: boolean;
};

type OrderRow = RetailPosOrder;

type OrderLineRow = RetailPosOrderLine;

type PaymentRow = {
  id: string;
  tenant_id: string;
  order_id: string;
  cash_shift_id: string;
  device_id: string;
  pos_user_id: string;
  payment_method: "cash" | "card";
  amount_cents: number;
  received_amount_cents: number | null;
  change_cents: number;
  card_reference: string | null;
  paid_at: string;
  created_at: string;
  created_by: string | null;
};

type ResolvedOrderInputLine = {
  line_number: number;
  product_id: string;
  product_variant_id: string | null;
  quantity: string;
  discount_cents: number;
  product_name: string;
  variant_name: string | null;
  sku: string | null;
  barcode: string | null;
  sales_unit_code: string;
  sales_unit_label: string;
  allow_decimal_quantity: boolean;
  unit_price_cents: number;
};

type CurrentOrderContext = {
  order: OrderRow;
  lines: OrderLineRow[];
};

type ExistingOrderComparableLine = {
  line_number: number;
  product_id: string;
  product_variant_id: string | null;
  quantity: string;
  discount_cents: number;
  product_name: string;
  variant_name: string | null;
  sku: string | null;
  barcode: string | null;
  sales_unit_code: string;
  sales_unit_label: string;
  allow_decimal_quantity: boolean;
  unit_price_cents: number;
};

function asTrimmedString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function asArray<T>(value: T[] | null | undefined) {
  return Array.isArray(value) ? value : [];
}

function ensureNonNegativeInteger(value: unknown, field: string) {
  if (typeof value !== "number" || !Number.isInteger(value) || value < 0) {
    throw new RetailPosRuntimeError(400, `${field} must be a non-negative integer.`);
  }

  return value;
}

function ensurePositiveLineNumber(value: unknown) {
  if (typeof value !== "number" || !Number.isInteger(value) || value <= 0) {
    throw new RetailPosRuntimeError(400, "line_number must be a positive integer.");
  }

  return value;
}

function ensureCanonicalQuantity(value: unknown) {
  if (typeof value !== "string") {
    throw new RetailPosRuntimeError(400, "quantity must be a string.");
  }

  const normalized = normalizeRetailPosQuantity(value);

  if (!normalized || !isRetailPosCanonicalQuantity(normalized)) {
    throw new RetailPosRuntimeError(400, "quantity must be a positive decimal string with up to 3 decimals.");
  }

  return normalized;
}

function ensureWholeQuantity(value: string) {
  if (!value.endsWith(".000")) {
    throw new RetailPosRuntimeError(400, "quantity must be a whole unit for this product.");
  }
}

function parseDatePrefix(date = new Date()) {
  const year = String(date.getUTCFullYear()).slice(-2);
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");
  return `${year}${month}${day}`;
}

function isUniqueViolation(error: { code?: string; message?: string } | null, constraint?: string) {
  if (!error) {
    return false;
  }

  if (error.code !== "23505") {
    return false;
  }

  return constraint ? Boolean(error.message?.includes(constraint)) : true;
}

async function assertPosUser(tenantId: string, posUserId: string) {
  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .from("pos_users")
    .select("id, tenant_id, name, role, is_active")
    .eq("tenant_id", tenantId)
    .eq("id", posUserId)
    .eq("is_active", true)
    .limit(1)
    .maybeSingle<PosUserRow>();

  if (error) {
    throw new RetailPosRuntimeError(500, `Unable to load POS user: ${error.message}`);
  }

  if (!data) {
    throw new RetailPosRuntimeError(400, "POS user is not active for this tenant.");
  }

  return data;
}

async function assertDeviceRecordForTenant(tenantId: string, deviceRecordId: string) {
  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .from("pos_devices")
    .select("id")
    .eq("tenant_id", tenantId)
    .eq("id", deviceRecordId)
    .limit(1)
    .maybeSingle<{ id: string }>();

  if (error) {
    throw new RetailPosRuntimeError(500, `Unable to load POS device: ${error.message}`);
  }

  if (!data) {
    throw new RetailPosRuntimeError(400, "POS device is not available for this tenant.");
  }

  return data;
}

async function loadOrderContext(
  tenantId: string,
  orderId: string,
  trace?: RuntimePerfTrace,
): Promise<CurrentOrderContext> {
  const supabase = getSupabaseAdminClient({ trace });

  const orderPromise = trace
    ? runSupabaseReadWithRetry<OrderRow>({
        trace,
        step: "order_header",
        query: (signal) =>
          supabase
            .from("retail_pos_orders")
            .select(
              "id, tenant_id, folio, origin_client_order_id, status, origin_device_id, created_by_pos_user_id, cashier_pos_user_id, paid_by_device_id, subtotal_cents, discount_cents, total_cents, paid_at, cancelled_at, cancelled_by_pos_user_id, cancel_reason, created_at, updated_at, created_by, updated_by",
            )
            .abortSignal(signal)
            .eq("tenant_id", tenantId)
            .eq("id", orderId)
            .limit(1)
            .maybeSingle<OrderRow>(),
      })
    : supabase
        .from("retail_pos_orders")
        .select(
          "id, tenant_id, folio, origin_client_order_id, status, origin_device_id, created_by_pos_user_id, cashier_pos_user_id, paid_by_device_id, subtotal_cents, discount_cents, total_cents, paid_at, cancelled_at, cancelled_by_pos_user_id, cancel_reason, created_at, updated_at, created_by, updated_by",
        )
        .eq("tenant_id", tenantId)
        .eq("id", orderId)
        .limit(1)
        .maybeSingle<OrderRow>();
  const linesPromise = trace
    ? runSupabaseReadWithRetry<OrderLineRow[]>({
        trace,
        step: "order_lines",
        query: (signal) =>
          supabase
            .from("retail_pos_order_lines")
            .select(
              "id, tenant_id, order_id, line_number, product_id, product_variant_id, product_name, variant_name, sku, barcode, sales_unit_code, sales_unit_label, allow_decimal_quantity, quantity, unit_price_cents, line_subtotal_cents, discount_cents, line_total_cents, created_at, updated_at, created_by, updated_by",
            )
            .abortSignal(signal)
            .eq("tenant_id", tenantId)
            .eq("order_id", orderId)
            .order("line_number", { ascending: true }),
      })
    : supabase
        .from("retail_pos_order_lines")
        .select(
          "id, tenant_id, order_id, line_number, product_id, product_variant_id, product_name, variant_name, sku, barcode, sales_unit_code, sales_unit_label, allow_decimal_quantity, quantity, unit_price_cents, line_subtotal_cents, discount_cents, line_total_cents, created_at, updated_at, created_by, updated_by",
        )
        .eq("tenant_id", tenantId)
        .eq("order_id", orderId)
        .order("line_number", { ascending: true });
  const [orderResult, linesResult] = await Promise.all([orderPromise, linesPromise]);

  if (orderResult.error) {
    throw new RetailPosRuntimeError(500, `Unable to load retail_pos order: ${orderResult.error.message}`);
  }

  if (!orderResult.data) {
    throw new RetailPosRuntimeError(404, "retail_pos order not found.");
  }

  if (linesResult.error) {
    throw new RetailPosRuntimeError(500, `Unable to load retail_pos order lines: ${linesResult.error.message}`);
  }

  return {
    order: orderResult.data,
    lines: asArray(linesResult.data),
  };
}

async function loadOrderDetail(
  tenantId: string,
  orderId: string,
  trace?: RuntimePerfTrace,
): Promise<GetRetailPosOrderResponse> {
  const detailStartedAt =
    typeof performance !== "undefined" ? performance.now() : Date.now();
  const supabase = getSupabaseAdminClient({ trace });
  const context = await loadOrderContext(tenantId, orderId, trace);

  const { data: payment, error: paymentError } = await runSupabaseReadWithRetry<PaymentRow>({
    trace,
    step: "payment_lookup",
    query: (signal) =>
      supabase
        .from("retail_pos_payments")
        .select(
          "id, tenant_id, order_id, cash_shift_id, device_id, pos_user_id, payment_method, amount_cents, received_amount_cents, change_cents, card_reference, paid_at, created_at, created_by",
        )
        .abortSignal(signal)
        .eq("tenant_id", tenantId)
        .eq("order_id", orderId)
        .limit(1)
        .maybeSingle<PaymentRow>(),
  });

  if (paymentError) {
    throw new RetailPosRuntimeError(500, `Unable to load retail_pos payment: ${paymentError.message}`);
  }

  trace?.addDuration(
    "order_detail",
    (typeof performance !== "undefined" ? performance.now() : Date.now()) -
      detailStartedAt,
  );
  return {
    order: context.order,
    lines: context.lines,
    payment: payment ?? null,
  };
}

async function loadOrderDetailFromOrderContext(
  input: {
    tenantId: string;
    order: OrderRow;
    trace?: RuntimePerfTrace;
  },
): Promise<GetRetailPosOrderResponse> {
  const detailStartedAt =
    typeof performance !== "undefined" ? performance.now() : Date.now();
  const supabase = getSupabaseAdminClient({ trace: input.trace });

  const [linesResult, paymentResult] = await Promise.all([
    runSupabaseReadWithRetry<OrderLineRow[]>({
      trace: input.trace,
      step: "order_lines",
      query: (signal) =>
        supabase
          .from("retail_pos_order_lines")
          .select(
            "id, tenant_id, order_id, line_number, product_id, product_variant_id, product_name, variant_name, sku, barcode, sales_unit_code, sales_unit_label, allow_decimal_quantity, quantity, unit_price_cents, line_subtotal_cents, discount_cents, line_total_cents, created_at, updated_at, created_by, updated_by",
          )
          .abortSignal(signal)
          .eq("tenant_id", input.tenantId)
          .eq("order_id", input.order.id)
          .order("line_number", { ascending: true }),
    }),
    runSupabaseReadWithRetry<PaymentRow>({
      trace: input.trace,
      step: "payment_lookup",
      query: (signal) =>
        supabase
          .from("retail_pos_payments")
          .select(
            "id, tenant_id, order_id, cash_shift_id, device_id, pos_user_id, payment_method, amount_cents, received_amount_cents, change_cents, card_reference, paid_at, created_at, created_by",
          )
          .abortSignal(signal)
          .eq("tenant_id", input.tenantId)
          .eq("order_id", input.order.id)
          .limit(1)
          .maybeSingle<PaymentRow>(),
    }),
  ]);

  if (linesResult.error) {
    throw new RetailPosRuntimeError(500, `Unable to load retail_pos order lines: ${linesResult.error.message}`);
  }

  if (paymentResult.error) {
    throw new RetailPosRuntimeError(500, `Unable to load retail_pos payment: ${paymentResult.error.message}`);
  }

  input.trace?.addDuration(
    "order_detail",
    (typeof performance !== "undefined" ? performance.now() : Date.now()) -
      detailStartedAt,
  );

  return {
    order: input.order,
    lines: asArray(linesResult.data),
    payment: paymentResult.data ?? null,
  };
}

async function resolveLineSnapshots(input: {
  tenantId: string;
  lines: CreateRetailPosOrderLineInput[];
}): Promise<ResolvedOrderInputLine[]> {
  if (!Array.isArray(input.lines) || input.lines.length === 0) {
    throw new RetailPosRuntimeError(400, "At least one line is required.");
  }

  const productIds = Array.from(new Set(input.lines.map((line) => asTrimmedString(line.product_id)).filter(Boolean))) as string[];
  const variantIds = Array.from(
    new Set(input.lines.map((line) => asTrimmedString(line.product_variant_id)).filter(Boolean)),
  ) as string[];

  const supabase = getSupabaseAdminClient();
  const productsPromise = supabase
      .from("retail_pos_products")
      .select(
        "id, tenant_id, category_id, name, brand, sku, barcode, unit_price_cents, sales_unit_code, sales_unit_label, allow_decimal_quantity, has_variants, is_active, deleted_at",
      )
      .eq("tenant_id", input.tenantId)
      .eq("is_active", true)
      .is("deleted_at", null)
      .in("id", productIds);
  const variantsPromise =
    variantIds.length > 0
      ? supabase
          .from("retail_pos_product_variants")
          .select(
            "id, tenant_id, product_id, name, sku, barcode, unit_price_cents, is_default, is_active, sort_order, deleted_at",
          )
          .eq("tenant_id", input.tenantId)
          .eq("is_active", true)
          .is("deleted_at", null)
          .in("id", variantIds)
      : Promise.resolve({ data: [] as VariantRow[], error: null });
  const [productsResult, variantsResult] = await Promise.all([productsPromise, variantsPromise]);

  if (productsResult.error) {
    throw new RetailPosRuntimeError(500, `Unable to load retail_pos products: ${productsResult.error.message}`);
  }

  if (variantsResult.error) {
    throw new RetailPosRuntimeError(500, `Unable to load retail_pos variants: ${variantsResult.error.message}`);
  }

  const productsById = new Map(asArray(productsResult.data).map((product) => [product.id, product]));
  const variantsById = new Map(asArray(variantsResult.data).map((variant) => [variant.id, variant]));
  const seenLineNumbers = new Set<number>();

  return input.lines.map((line) => {
    const lineNumber = ensurePositiveLineNumber(line.line_number);
    if (seenLineNumbers.has(lineNumber)) {
      throw new RetailPosRuntimeError(400, `line_number ${lineNumber} is duplicated.`);
    }
    seenLineNumbers.add(lineNumber);

    const productId = asTrimmedString(line.product_id);
    if (!productId) {
      throw new RetailPosRuntimeError(400, "product_id is required.");
    }

    const product = productsById.get(productId);
    if (!product) {
      throw new RetailPosRuntimeError(400, `Product ${productId} is not available in retail_pos catalog.`);
    }

    const variantId = asTrimmedString(line.product_variant_id);
    const variant = variantId ? variantsById.get(variantId) : null;

    if (variantId && !variant) {
      throw new RetailPosRuntimeError(400, `Variant ${variantId} is not available in retail_pos catalog.`);
    }

    if (variant && variant.product_id !== product.id) {
      throw new RetailPosRuntimeError(400, `Variant ${variant.id} does not belong to product ${product.id}.`);
    }

    if (product.has_variants && !variant) {
      throw new RetailPosRuntimeError(400, `Product ${product.id} requires an active variant.`);
    }

    const quantity = ensureCanonicalQuantity(line.quantity);
    if (!product.allow_decimal_quantity) {
      ensureWholeQuantity(quantity);
    }

    const discountCents = ensureNonNegativeInteger(line.discount_cents, "discount_cents");
    const expectedUnitPriceCents = variant?.unit_price_cents ?? product.unit_price_cents;
    const providedUnitPriceCents = ensureNonNegativeInteger(line.unit_price_cents, "unit_price_cents");

    if (providedUnitPriceCents !== expectedUnitPriceCents) {
      throw new RetailPosRuntimeError(
        400,
        `unit_price_cents for product ${product.id}${variant ? ` variant ${variant.id}` : ""} does not match current catalog price.`,
      );
    }

    return {
      line_number: lineNumber,
      product_id: product.id,
      product_variant_id: variant?.id ?? null,
      quantity,
      discount_cents: discountCents,
      product_name: product.name,
      variant_name: variant?.name ?? null,
      sku: variant?.sku ?? product.sku,
      barcode: variant?.barcode ?? product.barcode,
      sales_unit_code: product.sales_unit_code,
      sales_unit_label: product.sales_unit_label,
      allow_decimal_quantity: product.allow_decimal_quantity,
      unit_price_cents: expectedUnitPriceCents,
    };
  });
}

async function generateRetailPosFolio(tenantId: string) {
  const supabase = getSupabaseAdminClient();
  const datePrefix = parseDatePrefix();
  const folioPrefix = `RP-${datePrefix}-`;

  for (let attempt = 0; attempt < 5; attempt += 1) {
    const { data, error } = await supabase
      .from("retail_pos_orders")
      .select("folio")
      .eq("tenant_id", tenantId)
      .ilike("folio", `${folioPrefix}%`)
      .order("folio", { ascending: false })
      .limit(25);

    if (error) {
      throw new RetailPosRuntimeError(500, `Unable to generate retail_pos folio: ${error.message}`);
    }

    const maxSequence = (asArray(data) as Array<{ folio: string }>).reduce((currentMax, row) => {
      const raw = row.folio.slice(folioPrefix.length);
      const parsed = Number.parseInt(raw, 10);
      return Number.isFinite(parsed) ? Math.max(currentMax, parsed) : currentMax;
    }, 0);

    const nextSequence = String(maxSequence + 1 + attempt).padStart(4, "0");
    return `${folioPrefix}${nextSequence}`;
  }

  throw new RetailPosRuntimeError(500, "Unable to allocate retail_pos folio.");
}

async function insertOrderLines(tenantId: string, orderId: string, lines: ResolvedOrderInputLine[]) {
  const supabase = getSupabaseAdminClient();
  const payload = lines.map((line) => ({
    tenant_id: tenantId,
    order_id: orderId,
    line_number: line.line_number,
    product_id: line.product_id,
    product_variant_id: line.product_variant_id,
    product_name: line.product_name,
    variant_name: line.variant_name,
    sku: line.sku,
    barcode: line.barcode,
    sales_unit_code: line.sales_unit_code,
    sales_unit_label: line.sales_unit_label,
    allow_decimal_quantity: line.allow_decimal_quantity,
    quantity: line.quantity,
    unit_price_cents: line.unit_price_cents,
    line_subtotal_cents: 0,
    discount_cents: line.discount_cents,
    line_total_cents: 0,
  }));

  const { error } = await supabase.from("retail_pos_order_lines").insert(payload);

  if (error) {
    throw new RetailPosRuntimeError(400, `Unable to write retail_pos order lines: ${error.message}`);
  }
}

function toComparableExistingLine(line: OrderLineRow): ExistingOrderComparableLine {
  return {
    line_number: line.line_number,
    product_id: line.product_id,
    product_variant_id: line.product_variant_id,
    quantity: line.quantity,
    discount_cents: line.discount_cents,
    product_name: line.product_name,
    variant_name: line.variant_name,
    sku: line.sku,
    barcode: line.barcode,
    sales_unit_code: line.sales_unit_code,
    sales_unit_label: line.sales_unit_label,
    allow_decimal_quantity: line.allow_decimal_quantity,
    unit_price_cents: line.unit_price_cents,
  };
}

function areResolvedLinesEquivalent(
  expectedLines: ResolvedOrderInputLine[],
  existingLines: OrderLineRow[],
) {
  if (expectedLines.length !== existingLines.length) {
    return false;
  }

  const existingComparable = existingLines
    .map(toComparableExistingLine)
    .sort((left, right) => left.line_number - right.line_number);
  const expectedComparable = [...expectedLines].sort(
    (left, right) => left.line_number - right.line_number,
  );

  return JSON.stringify(expectedComparable) === JSON.stringify(existingComparable);
}

async function cleanupOrderAfterCreateFailure(tenantId: string, orderId: string) {
  const supabase = getSupabaseAdminClient();
  const { error } = await supabase
    .from("retail_pos_orders")
    .delete()
    .eq("tenant_id", tenantId)
    .eq("id", orderId);

  if (error) {
    throw new RetailPosRuntimeError(
      500,
      `retail_pos order creation failed and cleanup also failed: ${error.message}`,
    );
  }
}

async function restoreOrderLines(
  tenantId: string,
  orderId: string,
  originalLines: OrderLineRow[],
) {
  const supabase = getSupabaseAdminClient();

  const { error: deleteError } = await supabase
    .from("retail_pos_order_lines")
    .delete()
    .eq("tenant_id", tenantId)
    .eq("order_id", orderId);

  if (deleteError) {
    throw new RetailPosRuntimeError(
      500,
      `retail_pos order update failed and line rollback delete failed: ${deleteError.message}`,
    );
  }

  if (originalLines.length === 0) {
    return;
  }

  const restorePayload = originalLines.map((line) => ({
    tenant_id: line.tenant_id,
    order_id: line.order_id,
    line_number: line.line_number,
    product_id: line.product_id,
    product_variant_id: line.product_variant_id,
    product_name: line.product_name,
    variant_name: line.variant_name,
    sku: line.sku,
    barcode: line.barcode,
    sales_unit_code: line.sales_unit_code,
    sales_unit_label: line.sales_unit_label,
    allow_decimal_quantity: line.allow_decimal_quantity,
    quantity: line.quantity,
    unit_price_cents: line.unit_price_cents,
    line_subtotal_cents: line.line_subtotal_cents,
    discount_cents: line.discount_cents,
    line_total_cents: line.line_total_cents,
  }));

  const { error: insertError } = await supabase
    .from("retail_pos_order_lines")
    .insert(restorePayload);

  if (insertError) {
    throw new RetailPosRuntimeError(
      500,
      `retail_pos order update failed and line rollback insert failed: ${insertError.message}`,
    );
  }
}

async function syncOrderLines(tenantId: string, orderId: string, lines: ResolvedOrderInputLine[]) {
  const supabase = getSupabaseAdminClient();
  const existingContext = await loadOrderContext(tenantId, orderId);
  const existingByLineNumber = new Map(existingContext.lines.map((line) => [line.line_number, line]));

  for (const line of lines) {
    const existing = existingByLineNumber.get(line.line_number);

    if (existing) {
      const { error } = await supabase
        .from("retail_pos_order_lines")
        .update({
          product_id: line.product_id,
          product_variant_id: line.product_variant_id,
          product_name: line.product_name,
          variant_name: line.variant_name,
          sku: line.sku,
          barcode: line.barcode,
          sales_unit_code: line.sales_unit_code,
          sales_unit_label: line.sales_unit_label,
          allow_decimal_quantity: line.allow_decimal_quantity,
          quantity: line.quantity,
          unit_price_cents: line.unit_price_cents,
          discount_cents: line.discount_cents,
        })
        .eq("tenant_id", tenantId)
        .eq("id", existing.id);

      if (error) {
        throw new RetailPosRuntimeError(400, `Unable to update retail_pos line ${line.line_number}: ${error.message}`);
      }

      existingByLineNumber.delete(line.line_number);
      continue;
    }

    const { error } = await supabase.from("retail_pos_order_lines").insert({
      tenant_id: tenantId,
      order_id: orderId,
      line_number: line.line_number,
      product_id: line.product_id,
      product_variant_id: line.product_variant_id,
      product_name: line.product_name,
      variant_name: line.variant_name,
      sku: line.sku,
      barcode: line.barcode,
      sales_unit_code: line.sales_unit_code,
      sales_unit_label: line.sales_unit_label,
      allow_decimal_quantity: line.allow_decimal_quantity,
      quantity: line.quantity,
      unit_price_cents: line.unit_price_cents,
      line_subtotal_cents: 0,
      discount_cents: line.discount_cents,
      line_total_cents: 0,
    });

    if (error) {
      throw new RetailPosRuntimeError(400, `Unable to insert retail_pos line ${line.line_number}: ${error.message}`);
    }
  }

  for (const line of existingByLineNumber.values()) {
    const { error } = await supabase
      .from("retail_pos_order_lines")
      .delete()
      .eq("tenant_id", tenantId)
      .eq("id", line.id);

    if (error) {
      throw new RetailPosRuntimeError(400, `Unable to delete retail_pos line ${line.line_number}: ${error.message}`);
    }
  }
}

async function createOrderWithRetry(input: {
  tenantId: string;
  originDeviceRecordId: string;
  createdByPosUserId: string;
  originClientOrderId: string;
}): Promise<OrderRow> {
  const supabase = getSupabaseAdminClient();

  for (let attempt = 0; attempt < 5; attempt += 1) {
    const folio = await generateRetailPosFolio(input.tenantId);
    const { data, error } = await supabase
      .from("retail_pos_orders")
      .insert({
        tenant_id: input.tenantId,
        folio,
        origin_client_order_id: input.originClientOrderId,
        status: "pending_payment",
        origin_device_id: input.originDeviceRecordId,
        created_by_pos_user_id: input.createdByPosUserId,
      })
      .select(
        "id, tenant_id, folio, origin_client_order_id, status, origin_device_id, created_by_pos_user_id, cashier_pos_user_id, paid_by_device_id, subtotal_cents, discount_cents, total_cents, paid_at, cancelled_at, cancelled_by_pos_user_id, cancel_reason, created_at, updated_at, created_by, updated_by",
      )
      .limit(1)
      .maybeSingle<OrderRow>();

    if (!error && data) {
      return data;
    }

    if (isUniqueViolation(error, "retail_pos_orders_tenant_folio_uidx")) {
      continue;
    }

    if (isUniqueViolation(error, "retail_pos_orders_tenant_origin_client_order_id_uidx")) {
      const existing = await findOrderByOriginClientOrderId(input.tenantId, input.originClientOrderId);
      if (existing) {
        return existing;
      }
    }

    throw new RetailPosRuntimeError(400, `Unable to create retail_pos order: ${error?.message ?? "unknown error"}`);
  }

  throw new RetailPosRuntimeError(409, "Unable to allocate a unique retail_pos folio.");
}

async function findOrderByOriginClientOrderId(tenantId: string, originClientOrderId: string) {
  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .from("retail_pos_orders")
    .select(
      "id, tenant_id, folio, origin_client_order_id, status, origin_device_id, created_by_pos_user_id, cashier_pos_user_id, paid_by_device_id, subtotal_cents, discount_cents, total_cents, paid_at, cancelled_at, cancelled_by_pos_user_id, cancel_reason, created_at, updated_at, created_by, updated_by",
    )
    .eq("tenant_id", tenantId)
    .eq("origin_client_order_id", originClientOrderId)
    .limit(1)
    .maybeSingle<OrderRow>();

  if (error) {
    throw new RetailPosRuntimeError(500, `Unable to resolve retail_pos order idempotency: ${error.message}`);
  }

  return data ?? null;
}

async function resolveCreateOriginDeviceId(actor: RetailPosRuntimeActor, request: CreateRetailPosOrderRequest) {
  if (actor.mode === "device") {
    if (!actor.deviceRecordId) {
      throw new RetailPosRuntimeError(400, "Authenticated device is missing internal device reference.");
    }
    return actor.deviceRecordId;
  }

  const originDeviceRecordId = asTrimmedString(request.origin_device_id);
  if (!originDeviceRecordId) {
    throw new RetailPosRuntimeError(400, "origin_device_id is required for session-driven retail_pos order creation.");
  }

  await assertDeviceRecordForTenant(actor.tenantId, originDeviceRecordId);
  return originDeviceRecordId;
}

function assertPendingPaymentStatus(status: string) {
  if (status !== "pending_payment") {
    throw new RetailPosRuntimeError(409, "retail_pos order is not editable unless status=pending_payment.");
  }
}

export async function createRetailPosOrder(input: {
  tenantSlug: string;
  request: CreateRetailPosOrderRequest;
  deviceId?: string | null;
  deviceSecret?: string | null;
  trace?: RuntimePerfTrace;
}): Promise<CreateRetailPosOrderResponse> {
  const actor = await resolveRetailPosRuntimeActor({
    tenantSlug: input.tenantSlug,
    deviceId: input.deviceId,
    deviceSecret: input.deviceSecret,
    trace: input.trace,
  });

  assertRetailPosDeviceRole(actor, ["order_station"]);

  if (input.request.tenant_id !== actor.tenantId) {
    throw new RetailPosRuntimeError(400, "tenant_id does not match runtime tenant.");
  }

  const originClientOrderId = asTrimmedString(input.request.origin_client_order_id);
  if (!originClientOrderId) {
    throw new RetailPosRuntimeError(400, "origin_client_order_id is required.");
  }

  await assertPosUser(actor.tenantId, input.request.created_by_pos_user_id);

  const resolvedLines = await resolveLineSnapshots({
    tenantId: actor.tenantId,
    lines: input.request.lines,
  });
  const originDeviceRecordId = await resolveCreateOriginDeviceId(actor, input.request);
  const existingOrder = await findOrderByOriginClientOrderId(actor.tenantId, originClientOrderId);

  if (existingOrder) {
    const existingDetail = await loadOrderDetail(actor.tenantId, existingOrder.id);

    if (
      existingOrder.created_by_pos_user_id !== input.request.created_by_pos_user_id ||
      existingOrder.origin_device_id !== originDeviceRecordId
    ) {
      throw new RetailPosRuntimeError(
        409,
        "origin_client_order_id already exists with a different retail_pos order payload.",
      );
    }

    if (!areResolvedLinesEquivalent(resolvedLines, existingDetail.lines)) {
      if (existingOrder.status !== "pending_payment") {
        throw new RetailPosRuntimeError(
          409,
          "origin_client_order_id already exists with a different retail_pos order payload.",
        );
      }

      await syncOrderLines(actor.tenantId, existingOrder.id, resolvedLines);
    }

    return loadOrderDetail(actor.tenantId, existingOrder.id);
  }

  const createdOrder = await createOrderWithRetry({
    tenantId: actor.tenantId,
    originDeviceRecordId,
    createdByPosUserId: input.request.created_by_pos_user_id,
    originClientOrderId,
  });

  try {
    await insertOrderLines(actor.tenantId, createdOrder.id, resolvedLines);
  } catch (error) {
    await cleanupOrderAfterCreateFailure(actor.tenantId, createdOrder.id);
    throw error;
  }

  return loadOrderDetail(actor.tenantId, createdOrder.id);
}

export async function updateRetailPosOrder(input: {
  tenantSlug: string;
  orderId: string;
  request: UpdateRetailPosOrderRequest;
  deviceId?: string | null;
  deviceSecret?: string | null;
}): Promise<GetRetailPosOrderResponse> {
  const actor = await resolveRetailPosRuntimeActor({
    tenantSlug: input.tenantSlug,
    deviceId: input.deviceId,
    deviceSecret: input.deviceSecret,
  });

  assertRetailPosDeviceRole(actor, ["order_station", "cashier_station"]);

  if (input.request.tenant_id !== actor.tenantId) {
    throw new RetailPosRuntimeError(400, "tenant_id does not match runtime tenant.");
  }

  if (input.request.order_id !== input.orderId) {
    throw new RetailPosRuntimeError(400, "order_id does not match route parameter.");
  }

  const context = await loadOrderContext(actor.tenantId, input.orderId);
  assertPendingPaymentStatus(context.order.status);

  const resolvedLines = await resolveLineSnapshots({
    tenantId: actor.tenantId,
    lines: input.request.lines,
  });

  try {
    await syncOrderLines(actor.tenantId, input.orderId, resolvedLines);
  } catch (error) {
    await restoreOrderLines(actor.tenantId, input.orderId, context.lines);
    throw error;
  }

  return loadOrderDetail(actor.tenantId, input.orderId);
}

export async function getRetailPosOrderById(input: {
  tenantSlug: string;
  orderId: string;
  deviceId?: string | null;
  deviceSecret?: string | null;
}) {
  const actor = await resolveRetailPosRuntimeActor({
    tenantSlug: input.tenantSlug,
    deviceId: input.deviceId,
    deviceSecret: input.deviceSecret,
  });

  assertRetailPosDeviceRole(actor, ["order_station", "cashier_station"]);
  return loadOrderDetail(actor.tenantId, input.orderId);
}

export async function getRetailPosOrderByFolio(input: {
  tenantSlug: string;
  folio: string;
  deviceId?: string | null;
  deviceSecret?: string | null;
  trace?: RuntimePerfTrace;
}) {
  const actor = await resolveRetailPosRuntimeActor({
    tenantSlug: input.tenantSlug,
    deviceId: input.deviceId,
    deviceSecret: input.deviceSecret,
    trace: input.trace,
  });

  assertRetailPosDeviceRole(actor, ["order_station", "cashier_station"]);

  const folio = asTrimmedString(input.folio);
  if (!folio) {
    throw new RetailPosRuntimeError(400, "folio is required.");
  }

  const byFolioStartedAt =
    typeof performance !== "undefined" ? performance.now() : Date.now();

  const supabase = getSupabaseAdminClient({ trace: input.trace });
  const { data, error } = await runSupabaseReadWithRetry<OrderRow>({
    trace: input.trace,
    step: "order_lookup_with_header",
    query: (signal) =>
      supabase
        .from("retail_pos_orders")
        .select(
          "id, tenant_id, folio, origin_client_order_id, status, origin_device_id, created_by_pos_user_id, cashier_pos_user_id, paid_by_device_id, subtotal_cents, discount_cents, total_cents, paid_at, cancelled_at, cancelled_by_pos_user_id, cancel_reason, created_at, updated_at, created_by, updated_by",
        )
        .abortSignal(signal)
        .eq("tenant_id", actor.tenantId)
        .eq("folio", folio)
        .limit(1)
        .maybeSingle<OrderRow>(),
  });

  if (error) {
    throw new RetailPosRuntimeError(500, `Unable to load retail_pos order by folio: ${error.message}`);
  }

  if (!data) {
    throw new RetailPosRuntimeError(404, "retail_pos order not found for folio.");
  }

  const detail = await loadOrderDetailFromOrderContext({
    tenantId: actor.tenantId,
    order: data,
    trace: input.trace,
  });

  input.trace?.addDuration(
    "order_by_folio_total",
    (typeof performance !== "undefined" ? performance.now() : Date.now()) -
      byFolioStartedAt,
  );

  return detail;
}

export async function cancelRetailPosOrder(input: {
  tenantSlug: string;
  orderId: string;
  request: CancelRetailPosOrderRequest;
  deviceId?: string | null;
  deviceSecret?: string | null;
}) {
  const actor = await resolveRetailPosRuntimeActor({
    tenantSlug: input.tenantSlug,
    deviceId: input.deviceId,
    deviceSecret: input.deviceSecret,
  });

  assertRetailPosDeviceRole(actor, ["order_station", "cashier_station"]);

  if (input.request.tenant_id !== actor.tenantId) {
    throw new RetailPosRuntimeError(400, "tenant_id does not match runtime tenant.");
  }

  if (input.request.order_id !== input.orderId) {
    throw new RetailPosRuntimeError(400, "order_id does not match route parameter.");
  }

  await assertPosUser(actor.tenantId, input.request.cancelled_by_pos_user_id);

  const context = await loadOrderContext(actor.tenantId, input.orderId);
  assertPendingPaymentStatus(context.order.status);

  const supabase = getSupabaseAdminClient();
  const cancelledAt = new Date().toISOString();
  const { error } = await supabase
    .from("retail_pos_orders")
    .update({
      status: "cancelled",
      cancelled_at: cancelledAt,
      cancelled_by_pos_user_id: input.request.cancelled_by_pos_user_id,
      cancel_reason: input.request.cancel_reason,
    })
    .eq("tenant_id", actor.tenantId)
    .eq("id", input.orderId)
    .eq("status", "pending_payment");

  if (error) {
    throw new RetailPosRuntimeError(400, `Unable to cancel retail_pos order: ${error.message}`);
  }

  return loadOrderDetail(actor.tenantId, input.orderId);
}
